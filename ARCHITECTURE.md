# PharmaCRM - Enterprise Pharmaceutical CRM Platform

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐  │
│  │  Web App      │  │  Mobile App  │  │  Third-Party Consumers   │  │
│  │  (React/TS)   │  │  (React      │  │  (API Integrations)      │  │
│  │               │  │   Native)    │  │                          │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬──────────────┘  │
└─────────┼──────────────────┼─────────────────────┼──────────────────┘
          │                  │                     │
          ▼                  ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (Kong/Custom)                       │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌────────────┐  │
│  │ Rate Limit  │ │ Auth (JWT)   │ │ Audit Log   │ │ API Version│  │
│  └─────────────┘ └──────────────┘ └─────────────┘ └────────────┘  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
          ┌──────────────────┼──────────────────────┐
          ▼                  ▼                      ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐
│  CORE SERVICES   │ │  AI SERVICES     │ │  INTEGRATION SERVICES    │
│  (Node.js/TS)    │ │  (Python/FastAPI)│ │  (Node.js/TS)            │
│                  │ │                  │ │                          │
│ ┌──────────────┐ │ │ ┌──────────────┐ │ │ ┌────────────────────┐  │
│ │ HCP Module   │ │ │ │ Scoring      │ │ │ │ Webhook Engine     │  │
│ ├──────────────┤ │ │ ├──────────────┤ │ │ ├────────────────────┤  │
│ │ Engagement   │ │ │ │ NBA Engine   │ │ │ │ ETL Pipeline       │  │
│ ├──────────────┤ │ │ ├──────────────┤ │ │ ├────────────────────┤  │
│ │ Field Force  │ │ │ │ Segmentation │ │ │ │ External Data Sync │  │
│ ├──────────────┤ │ │ ├──────────────┤ │ │ ├────────────────────┤  │
│ │ Compliance   │ │ │ │ NL Summaries │ │ │ │ ERP Connector      │  │
│ ├──────────────┤ │ │ ├──────────────┤ │ │ └────────────────────┘  │
│ │ Analytics    │ │ │ │ Copilot      │ │ │                          │
│ └──────────────┘ │ │ └──────────────┘ │ │                          │
└────────┬─────────┘ └────────┬─────────┘ └──────────┬───────────────┘
         │                    │                      │
         ▼                    ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA LAYER                                    │
│  ┌──────────────┐ ┌──────────────┐ ┌────────────┐ ┌────────────┐  │
│  │ PostgreSQL   │ │ Redis        │ │ S3/MinIO   │ │ TimescaleDB│  │
│  │ (Primary DB) │ │ (Cache/Queue)│ │ (Documents)│ │ (Metrics)  │  │
│  └──────────────┘ └──────────────┘ └────────────┘ └────────────┘  │
│  ┌──────────────┐ ┌──────────────┐                                  │
│  │ Audit Store  │ │ Vector Store │                                  │
│  │ (Immutable)  │ │ (pgvector)   │                                  │
│  └──────────────┘ └──────────────┘                                  │
└─────────────────────────────────────────────────────────────────────┘
```

### Technology Decisions

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Backend Core | Node.js + TypeScript + Express | Type safety, ecosystem, team availability |
| AI Services | Python + FastAPI | ML ecosystem, scikit-learn, LLM libraries |
| Primary DB | PostgreSQL 16+ | ACID compliance, JSON support, extensions |
| Vector Store | pgvector (PG extension) | No separate vector DB, co-located with data |
| Time-series | TimescaleDB (PG extension) | Analytics, metrics, no new infra |
| Cache/Queue | Redis | Session cache, job queues, pub/sub |
| Object Storage | S3-compatible (MinIO) | Documents, exports, attachments |
| Auth | JWT + RBAC + OAuth2 | Standard, stateless, auditable |
| Frontend | React 18 + TypeScript | Component ecosystem, PWA support |
| API Protocol | REST (OpenAPI 3.1) | Interoperability, tooling, documentation |
| Containerization | Docker + Docker Compose | Reproducible, environment-agnostic |

### Module Dependency Map

```
HCP Management ◄──── Field Force
      │                    │
      ▼                    │
Engagement ◄───────────────┘
      │
      ▼
AI Intelligence ──────► Omnichannel Orchestration
      │                         │
      ▼                         ▼
Analytics ◄────────────── Compliance & Governance
      │
      ▼
Integration Layer ──── External Systems
```

### Security Architecture

- All API endpoints require JWT authentication
- RBAC with granular permissions per module
- All mutations produce immutable audit log entries
- PII fields encrypted at rest (AES-256)
- TLS 1.3 for all transport
- CORS restricted to known origins
- Rate limiting per user/role
- Consent status checked before any HCP data access
- AI outputs tagged with model version, input hash, and confidence score

### Compliance Architecture

- Every data mutation writes to append-only audit_log table
- Consent records are immutable (new records override, old preserved)
- AI decisions logged with full explainability payload
- Data retention policies enforced via scheduled jobs
- GDPR right-to-erasure implemented via anonymization (not deletion) to preserve audit integrity
- Role-based data visibility (field rep sees own territory, manager sees region)
