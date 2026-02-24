FROM python:3.11-slim

WORKDIR /app

# 依存関係をインストール
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# アプリケーションコードをコピー
COPY main.py .
COPY service-account-key.json .

# 環境変数
ENV GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY=/app/service-account-key.json
ENV PORT=8080

# 起動
CMD ["python", "main.py"]
