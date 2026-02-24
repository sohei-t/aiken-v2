# AIKEN v2 - 開発ガイド

## プロジェクト概要

AIKEN v2 は、AI研修代行SaaSシステムの次世代版です。
既存のAIKEN-School（Python + Jinja2モノリス）を、React SPA + マイクロサービスで再構築します。

## 開発フロー

### Issue駆動開発

1. **Issue作成**: 機能要件やバグをIssueとして登録
2. **ブランチ作成**: `feature/issue-{番号}-{概要}` または `fix/issue-{番号}-{概要}`
3. **実装**: ブランチで開発
4. **PR作成**: mainへのPRを作成（Issueをリンク）
5. **マージ**: レビュー後にmainへマージ

### ブランチ命名規則

- `feature/issue-{N}-{description}` - 新機能
- `fix/issue-{N}-{description}` - バグ修正
- `refactor/issue-{N}-{description}` - リファクタリング
- `docs/issue-{N}-{description}` - ドキュメント

### コミットメッセージ

```
feat: 機能追加の説明 (#Issue番号)
fix: バグ修正の説明 (#Issue番号)
docs: ドキュメント更新 (#Issue番号)
refactor: リファクタリングの説明 (#Issue番号)
```

## アーキテクチャ方針

### コスト最適化が最優先

- Firebase無料枠（Spark/Blaze Always Free）を最大活用
- Cloud RunはUSリージョン（無料枠対象）に配置
- Cloud SQL不使用 → Firestore一本化
- 利用者制限でコスト制御

### 技術スタック

| レイヤー | 技術 | 理由 |
|---------|------|------|
| Frontend | React 19 + TypeScript + Vite | SPA高速表示、コード分割 |
| UI | Tailwind CSS + shadcn/ui | 軽量、統一デザイン |
| Hosting | Firebase Hosting | CDN配信、¥0 |
| DB | Firestore | サーバーレス、¥0スタート |
| Auth | Firebase Auth | 50,000 MAU無料 |
| Payment | Stripe via Cloud Functions | 基本料¥0 |
| API | Cloud Run (FastAPI) US region | 200万req/月無料 |
| Storage | Google Drive API | API無料 |

### ベースプロジェクト

`/Users/sohei/Desktop/personal-video-platform-agent` の構造をベースに拡張。
以下の機能が既に実装済みで流用可能:

- Firebase Hosting + React SPA
- Firebase Auth（メール/Google認証）
- Cloud Run FastAPI（Drive API）
- Stripe連携（Cloud Functions）
- 教室構造（階層ネスト）
- 動画再生（ViewerPage）
- ユーザー管理

### AIKEN-Schoolから移植する機能

- AIコンテンツ生成パイプライン（リサーチ→スライド→台本→SSML→TTS→クイズ）
- クイズ機能（AI自動生成含む）
- 進捗トラッキング（詳細な視聴履歴）
- AI受講者分析
- 通知システム
- レビューワークフロー
- クォータ管理（プラン制限）
- マルチテナント管理

## デプロイ情報

### 本番環境（予定）

| 項目 | 値 |
|------|-----|
| GCPプロジェクト | aiken-production-2024 |
| Firebase Hosting | TBD |
| Cloud Run (API) | us-central1（無料枠対象） |
| Firestore | TBD |

### ローカル開発

```bash
cd project
npm install
npm run dev      # フロントエンド開発サーバー
```

## 既存システムとの関係

| システム | パス | 役割 |
|---------|------|------|
| AIKEN-School (v1) | `/Users/sohei/Desktop/AIKEN-School` | 現行本番（Python + Jinja2） |
| personal-video-platform | `/Users/sohei/Desktop/personal-video-platform-agent` | ベーステンプレート（React + Firebase） |
| **aiken-v2** | `/Users/sohei/Desktop/aiken-v2` | **次世代版（本リポジトリ）** |

## 無料枠制限

| サービス | 無料枠 | 超過時の対応 |
|---------|--------|------------|
| Firebase Hosting | 10GB帯域/月 | 利用者数制限 |
| Firestore読取 | 50,000/日 | ポーリング間隔延長 |
| Firestore書込 | 20,000/日 | バッチ書き込み最適化 |
| Cloud Functions | 200万回/月 | レート制限 |
| Cloud Run | 200万req/月 | AI生成回数制限 |
| Firebase Auth | 50,000 MAU | プラン上限で制御 |
