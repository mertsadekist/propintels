# IST Valuation Platform

A full-stack property valuation platform for IST Real Estate. Agents create shareable valuation links, clients submit property details via a public wizard, and the system automatically computes a market valuation verdict, generates a PDF report, and notifies the client by email.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | MySQL 8 via Prisma 6 |
| Auth | NextAuth.js v4 (credentials) |
| Job Queue | BullMQ + Redis |
| PDF Generation | Puppeteer / Chromium |
| File Storage | AWS S3 / Cloudflare R2 |
| Email | Nodemailer (Resend SMTP or generic SMTP) |
| UI | Tailwind CSS + shadcn/ui |
| Testing | Vitest |

---

## Features

- **Role-based access control** — Admin, Manager, Agent, Viewer
- **Project management** — Multiple real estate projects with per-project comparable data
- **Comparable entries** — Listings and transactions with automatic PSF calculation
- **Public valuation wizard** — Token-gated 3-step form for clients
- **Valuation engine** — Outlier-filtered comparable matching with configurable benchmark and thresholds
- **PDF reports** — Asynchronous generation via BullMQ worker, uploaded to S3/R2
- **Email notifications** — Welcome email on team invite, forgot-password flow, report-ready notification to client
- **Audit log** — Immutable record of all admin actions
- **Branding settings** — White-label support with custom logo, colors, and disclaimer

---

## Getting Started

### Prerequisites

- Node.js 20+
- MySQL 8
- Redis 7
- (Optional) Cloudflare R2 or AWS S3 bucket

### 1. Clone and install

```bash
git clone https://github.com/your-org/ist-valuation-platform.git
cd ist-valuation-platform
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | MySQL connection string |
| `NEXTAUTH_SECRET` | Yes | 32+ character random string |
| `NEXTAUTH_URL` | Yes | Public URL of the app |
| `REDIS_URL` | Yes | Redis connection string |
| `S3_BUCKET` | Yes | S3/R2 bucket name |
| `S3_REGION` | Yes | Storage region (use `auto` for R2) |
| `S3_ENDPOINT` | Yes (R2) | R2 endpoint URL |
| `S3_ACCESS_KEY_ID` | Yes | Storage access key |
| `S3_SECRET_ACCESS_KEY` | Yes | Storage secret key |
| `EMAIL_FROM` | Optional | Sender address for outbound email |
| `EMAIL_API_KEY` | Optional | Resend API key (Option A) |
| `SMTP_HOST` | Optional | SMTP host (Option B) |

### 3. Migrate the database

```bash
npx prisma migrate deploy
```

### 4. Seed initial data

Creates the admin user, roles, default valuation rules, and branding settings.

```bash
npm run db:seed
```

Default credentials:
- **Email:** `admin@ist-realestate.com`
- **Password:** `AdminPassword123!`

> Change the password immediately after first login.

### 5. Start the application

```bash
# Development
npm run dev

# Start the PDF worker (separate terminal)
npm run worker:dev
```

---

## Docker Compose (Recommended for Production)

Starts MySQL, Redis, the Next.js app, the BullMQ worker, and a one-shot database migrator.

```bash
# Create a .env with at least NEXTAUTH_SECRET and email/S3 settings
docker-compose up -d
```

Then seed the database:

```bash
docker-compose exec app npx tsx prisma/seed.ts
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Next.js in development mode |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run worker` | Start the BullMQ PDF worker |
| `npm run worker:dev` | Start the worker with hot-reload |
| `npm run test` | Run all tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run type-check` | TypeScript type checking |
| `npm run db:migrate` | Deploy Prisma migrations |
| `npm run db:migrate:dev` | Create a new migration (dev only) |
| `npm run db:seed` | Run the database seed script |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:generate` | Regenerate Prisma client |

---

## Project Structure

```
ist-valuation-platform/
├── app/                        # Next.js App Router
│   ├── (admin)/admin/          # Protected admin pages
│   ├── (auth)/                 # Login / forgot-password / reset-password
│   ├── (public)/v/[token]/     # Public valuation wizard
│   └── api/                    # API route handlers
├── src/
│   ├── auth/                   # NextAuth config, session helpers, RBAC
│   ├── audit/                  # Audit log writer
│   ├── components/             # React components (admin + public + shadcn/ui)
│   ├── db/                     # Prisma client + repository layer
│   ├── jobs/                   # BullMQ queue definition + PDF worker
│   ├── lib/                    # Redis, rate limiter, utilities
│   ├── notifications/          # Mail sender + email templates
│   ├── pdf/                    # HTML renderer, Puppeteer PDF gen, S3 storage
│   ├── valuation/              # Valuation engine (matching, stats, verdict)
│   └── validation/             # Zod schemas
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── migrations/             # SQL migrations
│   └── seed.ts                 # Initial data seed
├── tests/                      # Vitest unit tests
├── docker/                     # MySQL init SQL
├── Dockerfile                  # Next.js app image
├── Dockerfile.worker           # BullMQ worker image
└── docker-compose.yml          # Full stack orchestration
```

---

## Valuation Engine

The engine runs entirely in-process and is database-agnostic (pure functions):

1. **Matching** — Filters comparables by property type, bedrooms, and area (±N% tolerance)
2. **Outlier removal** — Trim 10% or IQR method
3. **Aggregation** — Computes mean, median, min, max PSF for listings and transactions
4. **Benchmark** — Configurable: transaction median PSF or listing median PSF
5. **Verdict** — Ratio of `clientPsf / benchmarkPsf` mapped to: `BELOW_MARKET` | `ALIGNED` | `SLIGHTLY_ABOVE` | `ABOVE_MARKET` | `INSUFFICIENT_DATA`
6. **Confidence** — 0–100 score based on data volume and recency

---

## Roles

| Role | Access |
|---|---|
| ADMIN | Full access — users, projects, settings, all leads |
| MANAGER | Projects, leads, reports (no team management) |
| AGENT | Own leads, create links in assigned projects |
| VIEWER | Read-only access |

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/auth/forgot-password` | Request password reset |
| POST | `/api/auth/reset-password` | Complete password reset |
| GET/POST | `/api/projects` | List / create projects |
| GET/PATCH/DELETE | `/api/projects/[id]` | Project CRUD |
| GET/POST | `/api/projects/[id]/entries` | Comparable entries |
| POST | `/api/projects/[id]/entries/import` | Bulk CSV import |
| GET/POST | `/api/projects/[id]/links` | Valuation links |
| GET/POST | `/api/leads` | Lead management |
| PATCH | `/api/leads/[id]/status` | Update lead status |
| POST | `/api/leads/[id]/assign` | Assign agent |
| GET/POST | `/api/leads/[id]/report` | Get/trigger PDF report |
| GET | `/api/public/v/[token]/meta` | Validate public token |
| POST | `/api/public/v/[token]/submit` | Submit valuation form |
| GET | `/api/reports` | List all reports |
| GET/POST | `/api/settings/branding` | Branding settings |
| GET/POST | `/api/settings/valuation-rules` | Valuation rule settings |
| GET/POST | `/api/team` | Team member management |
| GET/PATCH | `/api/team/[userId]` | Update / disable team member |
| GET | `/api/dashboard/kpis` | Dashboard KPI metrics |
| GET | `/api/audit` | Audit log |

---

## License

Private — IST Real Estate. All rights reserved.
