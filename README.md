![CI](https://github.com/sohei-t/aiken-v2/actions/workflows/ci.yml/badge.svg)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Hosting%20%7C%20Auth%20%7C%20Firestore-FFCA28?logo=firebase&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green)

# AIKEN v2 -- Next-Generation AI Training Platform

**Your training, powered by AI.**

A cost-optimized SaaS platform that leverages AI to automate corporate training content creation, delivery, and learner analytics. Built with a modern React SPA frontend and serverless microservice backend, AIKEN v2 operates within cloud free tiers for small deployments and scales gracefully as usage grows.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Cost Structure](#cost-structure)
- [Features](#features)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Configuration](#configuration)
- [Development Workflow](#development-workflow)
- [Deployment](#deployment)
- [License](#license)

---

## Overview

AIKEN v2 is a ground-up rebuild of the original AIKEN-School system (Python + Jinja2 monolith), re-architected as a React single-page application backed by Firebase services and Cloud Run microservices. The primary design goals are:

- **Cost optimization** -- Run at zero cost for small deployments, scaling to approximately 27,000 JPY/month at 500 tenants
- **AI-first content pipeline** -- Automate the full training content lifecycle: research, slide generation, narration scripts, text-to-speech, and quiz creation
- **Modern developer experience** -- React 19, TypeScript, Vite, Tailwind CSS, and shadcn/ui for rapid iteration

---

## Architecture

```
+-------------------------------+
|    Firebase Hosting (CDN)     |   React 19 SPA
|    Static assets, zero cost   |   Vite + TypeScript + Tailwind + shadcn/ui
+-------------------------------+
              |
     +--------+--------+
     |        |        |
+----v--+ +---v---+ +--v-----------+
| Fire- | | Cloud | | Cloud Run    |
| store | | Func- | | (US region)  |
|       | | tions | |              |
| Main  | |Stripe | | AI Generator |
| DB    | |Notif- | | Drive API    |
| Free  | |ications| | TTS         |
| tier  | | Free  | | Free tier    |
+-------+ +-------+ +--------------+
```

### Service Responsibilities

| Service | Responsibility | Cost at Scale |
|---------|---------------|---------------|
| **Firebase Hosting** | CDN-delivered SPA, SSL | Free (10 GB bandwidth/month) |
| **Firebase Auth** | Email and Google sign-in | Free (50,000 MAU) |
| **Firestore** | Primary database (NoSQL) | Free tier, then pay-per-operation |
| **Cloud Functions** | Stripe payment webhooks, notifications | Free (2M invocations/month) |
| **Cloud Run (US)** | AI content generation, Drive API, TTS | Free (2M requests/month) |
| **Stripe** | Subscription billing | Transaction-based fees only |

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | React 19 + TypeScript + Vite | SPA with fast HMR, code splitting |
| **UI Framework** | Tailwind CSS + shadcn/ui | Utility-first styling, consistent design system |
| **Hosting** | Firebase Hosting (CDN) | Global CDN delivery, zero base cost |
| **Database** | Cloud Firestore | Serverless NoSQL, real-time sync, generous free tier |
| **Authentication** | Firebase Authentication | Email/Google auth, 50K MAU free |
| **Payments** | Stripe (via Cloud Functions) | Zero base cost, PCI-compliant |
| **API Services** | Cloud Run (FastAPI, Python) | Serverless containers, US region for free tier |
| **File Storage** | Google Drive API | Free API access for content storage |
| **AI Models** | Claude / Gemini / GPT-4o | Multi-model content generation |
| **Text-to-Speech** | Google Cloud TTS / OpenAI TTS | Narration audio for training content |

---

## Cost Structure

A key design principle is that the platform must be **free to operate** at small scale. Cost projections by tenant count:

| Tenant Count | Estimated Monthly Cost (JPY) | Notes |
|-------------|------------------------------|-------|
| 0 -- 10 | **0** | All services within free tiers |
| ~50 | ~1,000 -- 1,250 | Firestore reads begin to exceed free tier |
| ~500 | ~16,500 -- 27,000 | Cloud Run and Firestore at moderate volume |

Cost control mechanisms:
- Cloud Run deployed in US region to qualify for free tier
- Firestore used instead of Cloud SQL to eliminate fixed database costs
- Polling intervals extended under load to reduce read operations
- AI generation quotas enforced per pricing plan
- Batch write optimization to minimize Firestore write costs

---

## Features

### AI-Powered Content Pipeline

- **Automated research** -- AI analyzes source material and generates structured training content
- **Slide generation** -- Automatic creation of presentation slides from training outlines
- **Script writing** -- Narration scripts generated from slide content
- **Text-to-speech** -- Audio narration via Google Cloud TTS or OpenAI TTS
- **Quiz generation** -- AI-generated assessments with answer explanations

### Learner Management

- **Progress tracking** -- Detailed viewing history and completion metrics
- **AI learner analytics** -- Automated analysis of learner engagement and performance
- **Notification system** -- Automated reminders and completion notifications

### Administration

- **Multi-tenant management** -- Separate workspaces for different organizations
- **Review workflow** -- Content approval pipeline before publication
- **Quota management** -- Plan-based usage limits for AI generation
- **Subscription billing** -- Stripe-powered recurring payments

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)

### Local Development

```bash
# Clone the repository
git clone https://github.com/sohei-t/aiken-v2.git
cd aiken-v2/project

# Install dependencies
npm install

# Start the development server
npm run dev
```

The application will be available at `http://localhost:5173`.

### Environment Configuration

Create a `.env.local` file in the `project/` directory with your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

---

## Project Structure

```
aiken-v2/
  project/                    # Main application
    src/                      # React frontend source
      components/             # Reusable UI components
      pages/                  # Page-level components (routes)
      services/               # API integration services
      hooks/                  # Custom React hooks
      types/                  # TypeScript type definitions
      __tests__/              # Frontend unit tests
    functions/                # Firebase Cloud Functions (Stripe, notifications)
    backend/                  # Cloud Run microservices
      drive-api/              # Google Drive file management
      ai-generator/           # AI content generation pipeline
      ai-analyzer/            # AI learner analytics
    firebase.json             # Firebase project configuration
    firestore.rules           # Firestore security rules
    firestore.indexes.json    # Firestore index definitions
    storage.rules             # Cloud Storage security rules
    vite.config.js            # Vite build configuration
    tsconfig.json             # TypeScript configuration
    package.json
  docs/                       # Documentation
    ARCHITECTURE.md           # Detailed architecture design
    MIGRATION.md              # Migration guide from v1
    COST_ANALYSIS.md          # Cost analysis and projections
  README.md
```

---

## Configuration

### Firebase Setup

1. Create a Firebase project in the [Firebase Console](https://console.firebase.google.com/)
2. Enable Authentication (Email/Password and Google providers)
3. Create a Firestore database
4. Deploy security rules: `firebase deploy --only firestore:rules`

### Cloud Run Services

```bash
# Deploy AI generator service
cd project/backend/ai-generator
gcloud run deploy ai-generator --source . --region us-central1

# Deploy Drive API service
cd project/backend/drive-api
gcloud run deploy drive-api --source . --region us-central1
```

### Stripe Integration

1. Create a Stripe account and obtain API keys
2. Configure webhook endpoints in the Stripe dashboard
3. Set Cloud Functions environment variables:

```bash
firebase functions:config:set stripe.secret_key="sk_..."
firebase functions:config:set stripe.webhook_secret="whsec_..."
```

---

## Development Workflow

This project follows an issue-driven development process:

1. **Create an issue** -- Define the feature or bug fix
2. **Create a branch** -- `feature/issue-{N}-{description}` or `fix/issue-{N}-{description}`
3. **Implement** -- Develop on the feature branch
4. **Open a pull request** -- Link to the originating issue
5. **Review and merge** -- Merge to `main` after review

### Commit Convention

```
feat: description (#issue-number)
fix: description (#issue-number)
docs: description (#issue-number)
refactor: description (#issue-number)
```

### Running Tests

```bash
cd project
npm test
```

---

## Deployment

### Frontend (Firebase Hosting)

```bash
cd project
npm run build
firebase deploy --only hosting
```

### Cloud Functions

```bash
cd project
firebase deploy --only functions
```

### Cloud Run Services

Each backend service is deployed independently via `gcloud run deploy` from its respective directory.

---

## License

MIT License. See [LICENSE](./LICENSE) for details.
