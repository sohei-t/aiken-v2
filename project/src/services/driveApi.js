/**
 * Drive API Service
 * Cloud Run バックエンド経由で Google Drive にアクセス
 * サービスアカウント認証を使用（ユーザーOAuth不要）
 */

const DRIVE_API_URL = import.meta.env.VITE_DRIVE_API_URL || 'https://pvp-drive-api-153069559514.asia-northeast1.run.app';

/**
 * Firebase ID トークンを取得
 */
const getIdToken = async (auth) => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('ログインが必要です');
  }
  return user.getIdToken();
};

/**
 * ファイルをアップロード
 * @param {Object} auth - Firebase Auth インスタンス
 * @param {File} file - アップロードするファイル
 * @param {string} classroomId - 教室ID
 * @returns {Promise<{fileId: string, url: string, downloadUrl: string}>}
 */
export const uploadToDrive = async (auth, file, classroomId) => {
  const token = await getIdToken(auth);

  const formData = new FormData();
  formData.append('file', file);

  const url = new URL(`${DRIVE_API_URL}/upload`);
  if (classroomId) {
    url.searchParams.append('classroom_id', classroomId);
  }

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'アップロードに失敗しました' }));
    throw new Error(error.detail || 'アップロードに失敗しました');
  }

  const data = await response.json();
  return {
    fileId: data.file_id,
    url: data.url,
    downloadUrl: data.download_url
  };
};

/**
 * ファイルをダウンロード（Blob URL として取得）- 認証必要
 * @param {Object} auth - Firebase Auth インスタンス
 * @param {string} fileId - Google Drive ファイルID
 * @returns {Promise<string>} Blob URL
 */
export const downloadFromDrive = async (auth, fileId) => {
  const token = await getIdToken(auth);

  const response = await fetch(`${DRIVE_API_URL}/download/${fileId}`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error('ファイルのダウンロードに失敗しました');
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * 公開ファイルをダウンロード（Blob URL として取得）- 認証不要
 * @param {string} fileId - Google Drive ファイルID
 * @returns {Promise<string>} Blob URL
 */
export const downloadPublicFile = async (fileId) => {
  const response = await fetch(`${DRIVE_API_URL}/public/download/${fileId}`);

  if (!response.ok) {
    throw new Error('ファイルのダウンロードに失敗しました');
  }

  const blob = await response.blob();
  return URL.createObjectURL(blob);
};

/**
 * ファイルを削除
 * @param {Object} auth - Firebase Auth インスタンス
 * @param {string} fileId - Google Drive ファイルID
 */
export const deleteFromDrive = async (auth, fileId) => {
  const token = await getIdToken(auth);

  const response = await fetch(`${DRIVE_API_URL}/delete/${fileId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  if (!response.ok && response.status !== 404) {
    const error = await response.json().catch(() => ({ detail: '削除に失敗しました' }));
    throw new Error(error.detail || '削除に失敗しました');
  }
};

/**
 * ヘルスチェック
 * @returns {Promise<boolean>}
 */
export const checkHealth = async () => {
  try {
    const response = await fetch(`${DRIVE_API_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
};
