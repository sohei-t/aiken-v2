"""
Personal Video Platform - Drive API Backend
サービスアカウント認証でGoogle Driveにアクセスする FastAPI バックエンド
"""

import os
import io
from typing import Optional
from urllib.parse import quote
from fastapi import FastAPI, UploadFile, File, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload
from googleapiclient.errors import HttpError
import firebase_admin
from firebase_admin import credentials, auth

# Firebase Admin 初期化
# Note: Drive APIはaiken-production-2024のサービスアカウントを使用
# Firebase Authはpersonal-video-platformプロジェクトのトークンを検証
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "personal-video-platform")
if not firebase_admin._apps:
    firebase_admin.initialize_app(options={'projectId': FIREBASE_PROJECT_ID})

app = FastAPI(title="Personal Video Platform Drive API")

# CORS 設定
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://personal-video-platform.web.app",
        "https://personal-video-platform.firebaseapp.com",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type"],
)

# Google Drive 設定
SCOPES = ['https://www.googleapis.com/auth/drive']
SERVICE_ACCOUNT_KEY_PATH = os.getenv("GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY", "/app/service-account-key.json")
SHARED_FOLDER_ID = os.getenv("GOOGLE_DRIVE_SHARED_FOLDER_ID")

# Drive サービス初期化
drive_service = None

def get_drive_service():
    global drive_service
    if drive_service is None:
        creds = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_KEY_PATH,
            scopes=SCOPES
        )
        drive_service = build('drive', 'v3', credentials=creds)
    return drive_service


async def verify_firebase_token(authorization: str = Header(None)) -> dict:
    """Firebase IDトークンを検証"""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization header missing")

    token = authorization.replace("Bearer ", "")
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


class UploadResponse(BaseModel):
    file_id: str
    url: str
    download_url: str


class DeleteRequest(BaseModel):
    file_id: str


@app.get("/health")
async def health_check():
    """ヘルスチェック"""
    return {"status": "healthy"}


@app.post("/upload", response_model=UploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    classroom_id: str = None,
    authorization: str = Header(None)
):
    """
    ファイルをGoogle Driveにアップロード
    認証されたユーザーのみ使用可能
    """
    # Firebase トークン検証
    user = await verify_firebase_token(authorization)

    if not SHARED_FOLDER_ID:
        raise HTTPException(status_code=500, detail="GOOGLE_DRIVE_SHARED_FOLDER_ID not configured")

    service = get_drive_service()

    # ファイル内容を読み込み
    content = await file.read()

    # フォルダ階層を決定
    folder_path = f"pvp/{classroom_id}" if classroom_id else "pvp/uploads"

    # フォルダを作成または取得
    parent_id = SHARED_FOLDER_ID
    for folder_name in folder_path.split('/'):
        parent_id = get_or_create_folder(service, folder_name, parent_id)

    # MIMEタイプを決定
    mime_type = file.content_type or 'application/octet-stream'

    # ファイルをアップロード
    file_metadata = {
        'name': file.filename,
        'parents': [parent_id]
    }

    media = MediaIoBaseUpload(
        io.BytesIO(content),
        mimetype=mime_type,
        resumable=True
    )

    try:
        uploaded_file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id',
            supportsAllDrives=True
        ).execute()

        file_id = uploaded_file['id']

        # 一般公開設定
        permission = {'type': 'anyone', 'role': 'reader'}
        service.permissions().create(
            fileId=file_id,
            body=permission,
            supportsAllDrives=True
        ).execute()

        return UploadResponse(
            file_id=file_id,
            url=f"https://drive.google.com/file/d/{file_id}/preview",
            download_url=f"https://drive.google.com/uc?id={file_id}&export=download"
        )

    except HttpError as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")


@app.get("/public/download/{file_id}")
async def public_download_file(file_id: str):
    """
    公開ファイルをダウンロード（認証不要）
    ファイルが公開設定されている場合のみアクセス可能
    """
    service = get_drive_service()

    try:
        # ファイル情報を取得
        file_info = service.files().get(
            fileId=file_id,
            fields='name, mimeType',
            supportsAllDrives=True
        ).execute()

        # ファイルをダウンロード
        request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
        file_bytes = io.BytesIO()
        downloader = MediaIoBaseDownload(file_bytes, request)

        done = False
        while not done:
            _, done = downloader.next_chunk()

        file_bytes.seek(0)

        # ファイル名をRFC 5987形式でエンコード（日本語対応）
        filename = file_info["name"]
        encoded_filename = quote(filename, safe='')

        return StreamingResponse(
            file_bytes,
            media_type=file_info.get('mimeType', 'application/octet-stream'),
            headers={
                'Content-Disposition': f"inline; filename*=UTF-8''{encoded_filename}"
            }
        )

    except HttpError as e:
        raise HTTPException(status_code=404, detail=f"File not found: {str(e)}")


@app.get("/download/{file_id}")
async def download_file(
    file_id: str,
    authorization: str = Header(None)
):
    """
    ファイルをダウンロード（プロキシ）
    認証されたユーザーのみ使用可能
    """
    # Firebase トークン検証
    await verify_firebase_token(authorization)

    service = get_drive_service()

    try:
        # ファイル情報を取得
        file_info = service.files().get(
            fileId=file_id,
            fields='name, mimeType',
            supportsAllDrives=True
        ).execute()

        # ファイルをダウンロード
        request = service.files().get_media(fileId=file_id, supportsAllDrives=True)
        file_bytes = io.BytesIO()
        downloader = MediaIoBaseDownload(file_bytes, request)

        done = False
        while not done:
            _, done = downloader.next_chunk()

        file_bytes.seek(0)

        # ファイル名をRFC 5987形式でエンコード（日本語対応）
        filename = file_info["name"]
        encoded_filename = quote(filename, safe='')

        return StreamingResponse(
            file_bytes,
            media_type=file_info.get('mimeType', 'application/octet-stream'),
            headers={
                'Content-Disposition': f"inline; filename*=UTF-8''{encoded_filename}"
            }
        )

    except HttpError as e:
        raise HTTPException(status_code=404, detail=f"File not found: {str(e)}")


@app.delete("/delete/{file_id}")
async def delete_file(
    file_id: str,
    authorization: str = Header(None)
):
    """
    ファイルを削除
    認証されたユーザーのみ使用可能
    """
    # Firebase トークン検証
    await verify_firebase_token(authorization)

    service = get_drive_service()

    try:
        service.files().delete(
            fileId=file_id,
            supportsAllDrives=True
        ).execute()

        return {"status": "deleted", "file_id": file_id}

    except HttpError as e:
        raise HTTPException(status_code=404, detail=f"Delete failed: {str(e)}")


def get_or_create_folder(service, folder_name: str, parent_id: str) -> str:
    """フォルダを取得または作成"""
    # 既存フォルダを検索
    query = f"name='{folder_name}' and '{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"

    results = service.files().list(
        q=query,
        spaces='drive',
        fields='files(id)',
        supportsAllDrives=True,
        includeItemsFromAllDrives=True
    ).execute()

    files = results.get('files', [])

    if files:
        return files[0]['id']

    # フォルダを作成
    file_metadata = {
        'name': folder_name,
        'mimeType': 'application/vnd.google-apps.folder',
        'parents': [parent_id]
    }

    folder = service.files().create(
        body=file_metadata,
        fields='id',
        supportsAllDrives=True
    ).execute()

    return folder['id']


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8080)))
