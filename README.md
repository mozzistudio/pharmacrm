# PharmaCRM

Enterprise-grade, AI-native CRM platform for pharmaceutical commercial, medical, and field teams.

## Architecture

```
┌─────────────┐  ┌─────────────┐  ┌──────────────┐
│  React/TS   │  │  Mobile App  │  │  3rd Party   │
│  Frontend   │  │  (Future)    │  │  API Clients │
└──────┬──────┘  └──────┬──────┘  └──────┬───────┘
       └────────────────┼────────────────┘
                        ▼
              ┌──────────────────┐
              │    API Gateway   │
              │  (Rate Limit,    │
              │   Auth, Audit)   │
              └────────┬─────────┘
          ┌────────────┼────────────┐
          ▼            ▼            ▼
  ┌──────────────┐ ┌────────┐ ┌────────────┐
  │ Node.js/TS   │ │ Python │ │ Integration│
  │ Core Backend │ │ AI Svc │ │ Services   │
  └──────┬───────┘ └───┬────┘ └─────┬──────┘
         └─────────────┼────────────┘
                       ▼
         ┌──────────────────────────┐
         │ PostgreSQL + Redis + S3  │
         └──────────────────────────┘
```

## Modules

| Module | Description |
|--------|-------------|
| **HCP Management** | Profiles, segmentation, consent tracking, PII encryption |
| **Engagement** | Interactions, tasks, follow-ups across all channels |
| **Field Force** | Visit plans, offline sync, AI route suggestions |
| **Omnichannel** | Email campaigns, channel recommendation, compliance approval |
| **AI Intelligence** | Scoring, NBA engine, account summaries, copilot chat |
| **Compliance** | Audit logs (immutable), GDPR reports, consent history |
| **Analytics** | Dashboards, territory performance, engagement trends |
| **Integrations** | Webhooks, data imports, prescription data ingestion |

## Tech Stack

- **Backend**: Node.js + TypeScript + Express + Knex
- **AI Services**: Python + FastAPI + scikit-learn
- **Database**: PostgreSQL 16 (pgcrypto, uuid-ossp)
- **Cache/Queue**: Redis
- **Frontend**: React 18 + TypeScript + TailwindCSS + React Query
- **Auth**: JWT + RBAC (7 roles)
- **Containerization**: Docker + Docker Compose

## Quick Start

```bash
# Start all services
docker-compose up -d

# Run backend locally
cd backend && npm install && npm run dev

# Run AI services locally
cd ai-services && pip install -r requirements.txt && uvicorn app.main:app --reload

# Run frontend locally
cd frontend && npm install && npm run dev
```

## API Endpoints

Base URL: `/api/v1`

| Prefix | Module |
|--------|--------|
| `/auth` | Authentication (login, register, refresh) |
| `/hcps` | HCP profiles, consent, AI scores |
| `/engagement` | Interactions and tasks |
| `/field-force` | Visit plans, suggestions, offline sync |
| `/omnichannel` | Campaigns, channel recommendations |
| `/ai` | Scoring, NBA, summaries, copilot |
| `/compliance` | Audit log, GDPR reports |
| `/analytics` | Dashboard, trends, reports |
| `/integrations` | Webhooks, data imports |

## AI Design Principles

1. **Explainable**: Every AI output includes factors, weights, and descriptions
2. **Auditable**: All AI decisions logged with model version and input hash
3. **Bounded**: AI never generates medical claims or treatment recommendations
4. **Human-controlled**: Users accept/reject AI recommendations
5. **Consent-aware**: AI respects consent boundaries

## Compliance

- GDPR right-to-erasure via anonymization (preserving audit integrity)
- Immutable audit log for all data mutations
- PII encrypted at rest (AES-256)
- Role-based access control with territory scoping
- Consent checked before any channel engagement

## Testing

```bash
# Backend tests
cd backend && npm test

# AI service tests
cd ai-services && pytest tests/

# Frontend lint
cd frontend && npm run lint
```

## Project Structure

```
pharmacrm/
├── backend/                 # Node.js/TypeScript API
│   ├── src/
│   │   ├── config/          # Environment configuration
│   │   ├── database/        # Migrations, seeds, connection
│   │   ├── middleware/       # Auth, audit, validation, consent
│   │   ├── modules/         # Domain modules
│   │   │   ├── hcp/         # HCP profiles, auth
│   │   │   ├── engagement/  # Interactions, tasks
│   │   │   ├── field-force/ # Visit plans, sync
│   │   │   ├── compliance/  # Audit, GDPR
│   │   │   ├── analytics/   # Dashboards, reports
│   │   │   ├── omnichannel/ # Campaigns, channels
│   │   │   ├── ai-intelligence/ # AI connector
│   │   │   └── integration/ # Webhooks, imports
│   │   ├── types/           # TypeScript type definitions
│   │   └── utils/           # Logger, encryption, errors
│   └── tests/
├── ai-services/             # Python/FastAPI AI microservice
│   ├── app/
│   │   ├── routers/         # API endpoints
│   │   ├── services/        # Scoring, NBA, segmentation
│   │   └── schemas/         # Pydantic models
│   └── tests/
├── frontend/                # React/TypeScript SPA
│   └── src/
│       ├── components/      # UI components
│       ├── pages/           # Route pages
│       ├── services/        # API client
│       ├── store/           # Zustand state
│       └── types/           # TypeScript types
├── infrastructure/          # IaC configs (future)
├── docker-compose.yml
└── ARCHITECTURE.md
```
