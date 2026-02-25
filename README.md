![CI](https://github.com/sohei-t/aiken-v2/actions/workflows/ci.yml/badge.svg)
![React](https://img.shields.io/badge/React-19-blue)
![License](https://img.shields.io/badge/License-MIT-green)

# AIKEN v2 - AI研修代行システム

**あなたの研修、AIが代行します**

## 概要

AIKEN v2は、AI技術を活用した次世代型の研修SaaSプラットフォームです。
既存のAIKEN-Schoolシステムをモダンなアーキテクチャで再構築し、高速表示とコスト最適化を実現します。

## アーキテクチャ

```
┌─────────────────────────────┐
│   Firebase Hosting (CDN)    │  React SPA (Vite + TypeScript)
│   即時配信、¥0 運用          │  Tailwind CSS + shadcn/ui
└──────────┬──────────────────┘
           │
    ┌──────┼──────────┐
    │      │          │
┌───▼──┐ ┌▼────┐ ┌───▼──────┐
│Fire- │ │Cloud│ │Cloud Run │
│store │ │Func │ │(US region)│
│      │ │     │ │          │
│メインDB│ │Stripe│ │AI生成    │
│¥0~   │ │通知  │ │Drive API │
│      │ │¥0   │ │TTS ¥0   │
└──────┘ └─────┘ └──────────┘
```

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| **Frontend** | React 19 + TypeScript + Vite |
| **UI** | Tailwind CSS + shadcn/ui |
| **Hosting** | Firebase Hosting (CDN) |
| **Database** | Firestore |
| **Auth** | Firebase Authentication |
| **Payment** | Stripe (via Cloud Functions) |
| **API** | Cloud Run (FastAPI) - US region |
| **Storage** | Google Drive API |
| **AI** | Claude / Gemini / GPT-4o |
| **TTS** | Google Cloud TTS / OpenAI TTS |

## コスト目標

- **顧客0-10社**: ¥0/月（全て無料枠内）
- **顧客50社**: ~¥1,000-1,250/月
- **顧客500社**: ~¥16,500-27,000/月

## 開発フロー

Issue駆動の開発フローを採用しています。

1. Issue作成 → ブランチ作成
2. 実装 → PR作成
3. レビュー → mainにマージ

## セットアップ

```bash
cd project
npm install
npm run dev
```

## ディレクトリ構成

```
aiken-v2/
├── project/                # メインアプリケーション
│   ├── src/                # React フロントエンド
│   │   ├── components/     # UIコンポーネント
│   │   ├── pages/          # ページコンポーネント
│   │   ├── services/       # API連携サービス
│   │   ├── hooks/          # カスタムフック
│   │   └── types/          # TypeScript型定義
│   ├── functions/          # Firebase Cloud Functions
│   ├── backend/            # Cloud Run サービス群
│   │   ├── drive-api/      # Google Drive API
│   │   ├── ai-generator/   # AIコンテンツ生成
│   │   └── ai-analyzer/    # AI受講者分析
│   ├── firebase.json       # Firebase設定
│   └── package.json
├── docs/                   # ドキュメント
│   ├── ARCHITECTURE.md     # アーキテクチャ設計
│   ├── MIGRATION.md        # v1からの移行ガイド
│   └── COST_ANALYSIS.md    # コスト分析
├── CLAUDE.md               # AI開発ガイド
└── README.md
```
