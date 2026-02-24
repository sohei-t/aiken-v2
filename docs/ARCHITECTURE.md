# AIKEN v2 アーキテクチャ設計

## システム構成

```
┌─────────────────────────────────┐
│     Firebase Hosting (CDN)      │  React SPA (Vite)
│     10GB/月 無料                │  初回ロード ~93KB (gzip)
└──────────────┬──────────────────┘
               │
    ┌──────────┼─────────────┐
    │          │             │
┌───▼───┐  ┌──▼──────┐  ┌───▼──────────┐
│Fire-  │  │Cloud    │  │Cloud Run     │
│store  │  │Functions│  │(us-central1) │
│       │  │         │  │              │
│50K読取│  │200万回  │  │200万req/月   │
│/日無料│  │/月無料  │  │無料          │
└───────┘  └─────────┘  └──────────────┘
```

## コスト最適化方針

### 無料枠活用

| サービス | 無料枠 | 超過対策 |
|---------|--------|---------|
| Firebase Hosting | 10GB帯域/月 | 画像最適化、キャッシュ |
| Firestore | 50K読取/日 | ポーリング間隔制御 |
| Cloud Functions | 200万回/月 | レート制限 |
| Cloud Run (US) | 200万req/月 | AI生成回数制限 |
| Firebase Auth | 50,000 MAU | プラン上限 |

### Cloud Run USリージョンの理由

Cloud Runの無料枠は**USリージョンのみ**対象。
asia-northeast1（東京）では無料枠が適用されない。

- Drive API: バックグラウンド処理なのでレイテンシ許容
- AI生成: 数分かかる処理なので数十msの差は影響なし
- TTS: 同上

## Firestoreスキーマ設計

```
customers/{customerId}
  ├── classrooms/{classroomId}
  │     ├── name, description, accessType, themeColor
  │     └── contents/{contentId}
  │           ├── title, description, htmlFileId, mp3FileId
  │           ├── duration, order, resourceType
  │           └── quizzes/{quizId}
  ├── trainees/{traineeId}
  │     ├── name, email, department, role
  │     └── progress/{contentId}
  │           ├── status, progressPercentage, completedAt
  │           └── quizSessions/{sessionId}
  ├── settings/config
  │     ├── aiApiKeys (encrypted)
  │     ├── ttsSettings
  │     └── reviewSettings
  └── usage/quota
        ├── classroomCount, traineeCount, videoCount
        └── storageUsedMb, aiGenerationCount

users/{uid}
  ├── email, displayName, role (admin/user)
  ├── customerId (テナント紐付け)
  ├── subscriptionStatus, stripeCustomerId
  └── watchHistory/{contentId}

notifications/{notificationId}
  ├── customerId, recipientEmail
  ├── type, title, message
  └── isRead, createdAt
```

## バンドルサイズ

| チャンク | サイズ (gzip) | 内容 |
|---------|-------------|------|
| index (app code) | ~93KB | ページ、コンポーネント |
| vendor-react | ~17KB | React, React Router |
| vendor-firebase | ~107KB | Firebase SDK（遅延ロード可） |
| vendor-ui | ~20KB | Lucide icons, dnd-kit |
| CSS | ~8KB | Tailwind CSS |
| **合計** | **~245KB** | v1の1.1MBから**78%削減** |
