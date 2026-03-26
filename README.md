# IST Valuation Platform

> A full-stack real-estate valuation platform that lets property developers and agents generate instant, data-driven valuations based on live market comparables (listings + DLD transactions), complete with an admin dashboard, automated PDF reports, and a four-tier role system.

---

## Table of Contents

1. [Overview](#overview)
2. [Tech Stack](#tech-stack)
3. [Database Schema](#database-schema)
4. [Valuation Engine — Math & Formulas](#valuation-engine--math--formulas)
   - [4.1 Price Per Square Foot (PSF)](#41-price-per-square-foot-psf)
   - [4.2 Comparable Selection](#42-comparable-selection)
   - [4.3 Outlier Removal](#43-outlier-removal)
   - [4.4 Descriptive Statistics](#44-descriptive-statistics)
   - [4.5 Area Valuation](#45-area-valuation)
   - [4.6 Project Valuation](#46-project-valuation)
   - [4.7 Specialist Assessment](#47-specialist-assessment)
   - [4.8 Verdict](#48-verdict)
   - [4.9 Confidence Score](#49-confidence-score)
5. [End-to-End Valuation Flow](#end-to-end-valuation-flow)
6. [Roles & Permissions (RBAC)](#roles--permissions-rbac)
7. [Valuation Links](#valuation-links)
8. [PDF Report Generation](#pdf-report-generation)
9. [Full API Reference](#full-api-reference)
10. [Admin Dashboard](#admin-dashboard)
11. [Environment Variables](#environment-variables)
12. [Installation & Running](#installation--running)
13. [Project Structure](#project-structure)

---

## Overview

The platform operates on a three-actor model:

```
Client  ←  shareable valuation link  →  fills form  →  instant result + PDF report
Admin   ←  dashboard                 →  manages leads, projects, reports
Agent   ←  dashboard                 →  creates links, handles assigned leads
```

**Core capabilities:**
- **Dual automated valuation** — area-wide market + project-specific comparison
- **Manual specialist layer** — human expert price override as a third card
- **Smart comparable engine** — two-pass filtering with configurable outlier removal
- **Confidence scoring** — driven by data volume, variance, and recency
- **Shareable links** — per-project, with usage limits, expiry, and agent attribution
- **Automated PDF reports** — generated via Puppeteer, stored as binary in DB
- **Immutable audit log** — every mutation is recorded
- **RBAC** — four roles with fine-grained permission control

---

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Framework** | Next.js (App Router) | 14.2 |
| **UI** | React + TypeScript | 18 / 5 |
| **Styling** | Tailwind CSS + Radix UI | 3.4 |
| **ORM** | Prisma | 6.19 |
| **Database** | MySQL | 8+ |
| **Authentication** | NextAuth.js | 4.24 |
| **Job Queue** | BullMQ + Redis | 5.70 |
| **PDF Generation** | Puppeteer + @sparticuz/chromium | 24 |
| **Email** | Resend / Nodemailer (SMTP) | — |
| **Charts** | Recharts | 3.7 |
| **Validation** | Zod | 4.3 |
| **Forms** | React Hook Form | 7.71 |
| **Data Fetching** | SWR | 2.4 |
| **Testing** | Vitest | 2.1 |

---

## Database Schema

### Entity Relationship Map

```
┌─────────────────────────────────────────────────────────────┐
│                       User & Auth                           │
│  User ──< UserRole >── Role                                 │
│  User ──< PasswordResetToken                                │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                      Core Domain                            │
│  Project ──< Entry          (listings + DLD transactions)   │
│  Project ──< ValuationLink  (public client links)           │
│  Project ──< Lead           (valuation requests)            │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                   Valuation Output                          │
│  Lead ──── ValuationResult     (engine output snapshot)     │
│  Lead ──── Report              (generated PDF)              │
│  Lead ──── SpecialistAssessment (expert override)           │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                    Infrastructure                           │
│  AuditLog  (immutable event log)                            │
│  Setting   (branding + valuation rules config)              │
└─────────────────────────────────────────────────────────────┘
```

### Table Definitions

#### `Project` — Real estate projects

| Field | Type | Description |
|-------|------|-------------|
| `id` | String PK | Unique identifier |
| `name` | String | Project name |
| `location` | String? | Geographic location |
| `category` | `RESIDENTIAL \| COMMERCIAL` | Project classification |
| `defaultType` | PropertyType? | Default property type for the form |
| `areaTolerancePct` | Float | Area tolerance window (%) |
| `currency` | String (default: AED) | Display currency |
| `isActive` | Boolean | Soft-delete flag |

#### `Entry` — Comparable data points

| Field | Type | Description |
|-------|------|-------------|
| `sourceType` | `LISTING \| TRANSACTION` | Data source |
| `propertyType` | PropertyType | Type of unit |
| `bedrooms` | Int? | Bedroom count |
| `bathrooms` | Int? | Bathroom count |
| `areaSqft` | Float? | Area in sq ft — listings |
| `askPrice` | Float? | Asking price |
| `lowestPrice` | Float? | Lowest listed price |
| `askPsf` | Float? | **askPrice ÷ areaSqft** (computed) |
| `lowPsf` | Float? | **lowestPrice ÷ areaSqft** (computed) |
| `transactionAreaSqft` | Float? | Actual area — DLD transactions |
| `transactionPrice` | Float? | Actual transaction price |
| `transactionPsf` | Float? | **transactionPrice ÷ transactionAreaSqft** (computed) |
| `transactionDate` | DateTime? | Date of DLD transaction |
| `locationLabel` | String? | Location description |
| `portal` | String? | Source portal (e.g. PropertyFinder) |

#### `Lead` — Client valuation requests

| Field | Type | Description |
|-------|------|-------------|
| `id` | String PK | Request identifier |
| `projectId` | String FK | Associated project |
| `linkId` | String FK | Link used to submit |
| `fullName` | String | Client name |
| `phone` | String | Phone number |
| `email` | String? | Email address |
| `category` | PropertyCategory | Residential / Commercial |
| `propertyType` | PropertyType | Unit type |
| `bedrooms` | Int? | Bedroom count |
| `areaSqft` | Float | Area to value |
| `clientPrice` | Float? | Client's asking price |
| `status` | LeadStatus | Pipeline stage |
| `assignedAgentId` | String? | Assigned agent |
| `ipAddress` | String? | Client IP for rate-limiting |

#### `ValuationResult` — Valuation engine output

| Field | Type | Description |
|-------|------|-------------|
| `leadId` | String FK | Parent lead |
| `rulesVersion` | String | Config version at time of valuation |
| `areaTolerancePct` | Float | Tolerance used |
| `outlierMethod` | String | Outlier removal method used |
| `minComps` | Int | Minimum comparables threshold |
| `benchmark` | String | Benchmark stat used (median/mean) |
| `clientPsf` | Float? | **clientPrice ÷ clientAreaSqft** |
| `listingCount` | Int | Number of listing comps used |
| `listingMeanPsf` | Float? | Mean PSF of listing comps |
| `listingMedianPsf` | Float? | Median PSF of listing comps |
| `listingMinPsf` | Float? | Min PSF of listing comps |
| `listingMaxPsf` | Float? | Max PSF of listing comps |
| `transactionCount` | Int | Number of DLD transaction comps |
| `transactionMeanPsf` | Float? | Mean PSF of transactions |
| `transactionMedianPsf` | Float? | Median PSF of transactions |
| `transactionMinPsf` | Float? | Min PSF of transactions |
| `transactionMaxPsf` | Float? | Max PSF of transactions |
| `recommendedLow` | Float? | Recommended price — low end |
| `recommendedMid` | Float? | Recommended price — midpoint |
| `recommendedHigh` | Float? | Recommended price — high end |
| `verdict` | VerdictLabel | Price verdict |
| `ratioToMarket` | Float? | clientPsf / benchmarkPsf |
| `confidence` | Int? | Confidence score (0–100) |
| `explanations` | JSON | Human-readable verdict explanations |
| `compsUsed` | JSON | Area-level comparables snapshot |
| `projectValuationData` | JSON? | Project-level valuation result |
| `projectCompsUsed` | JSON? | Project-level comparables snapshot |

#### `SpecialistAssessment` — Expert override

| Field | Type | Description |
|-------|------|-------------|
| `leadId` | String FK | Parent lead |
| `specialistId` | String FK | Specialist user |
| `estimatedPrice` | Float | Expert price estimate |
| `estimatedPsf` | Float | Expert PSF estimate |
| `notes` | String? | Specialist notes |

#### `ValuationLink` — Public shareable links

| Field | Type | Description |
|-------|------|-------------|
| `id` | String PK | Forms the URL token: `/v/{id}` |
| `projectId` | String FK | Associated project |
| `agentId` | String? FK | Creating agent (for lead attribution) |
| `label` | String? | Descriptive name |
| `status` | `ACTIVE \| DISABLED \| EXPIRED` | Link state |
| `expiresAt` | DateTime? | Optional expiry |
| `maxUses` | Int? | Optional usage cap |
| `usedCount` | Int | Actual submission count |

#### `Report` — Generated PDF artifacts

| Field | Type | Description |
|-------|------|-------------|
| `leadId` | String FK | Parent lead |
| `status` | `QUEUED \| PROCESSING \| READY \| FAILED` | Generation status |
| `pdfData` | Bytes? | Raw PDF binary (LongBlob in MySQL) |
| `fileName` | String | e.g. `valuation-report-{leadId}.pdf` |
| `checksumSha256` | String? | Integrity checksum |
| `fileSize` | Int? | File size in bytes |
| `errorMessage` | String? | Populated on failure |

---

## Valuation Engine — Math & Formulas

Source files: `src/valuation/`

---

### 4.1 Price Per Square Foot (PSF)

**File:** `src/valuation/engine.ts`

```
Listing entries:
  askPsf = askPrice    / areaSqft
  lowPsf = lowestPrice / areaSqft

DLD Transaction entries:
  transactionPsf = transactionPrice / transactionAreaSqft

Client input:
  clientPsf = clientPrice / clientAreaSqft
```

---

### 4.2 Comparable Selection

**File:** `src/valuation/matching.ts`

#### Two-Pass Filtering Algorithm

```
Pass 1 — Strict:
  [1] Property type match  (with DLD alias exception below)
  [2] Exact bedroom match
  [3] Area within tolerance window

Pass 2 — Relaxed  (activated when Pass 1 yields fewer than minComps):
  [1] Property type match
  [2] Bedroom filter ignored
  [3] Area within tolerance window
```

#### Area Tolerance Window

```
lowerBound = clientAreaSqft * (1 - areaTolerancePct / 100)
upperBound = clientAreaSqft * (1 + areaTolerancePct / 100)

A comparable is accepted when:
  lowerBound <= entryAreaSqft <= upperBound
```

**Example:** client area = 1,000 sqft, tolerance = 20%
```
lowerBound = 1,000 * 0.80 = 800 sqft
upperBound = 1,000 * 1.20 = 1,200 sqft
→ All entries between 800 and 1,200 sqft are included
```

> **DLD Exception:** Off-plan units are often registered as `LAND` in DLD records. Therefore `LAND` is treated as equivalent to `VILLA / TOWNHOUSE / DUPLEX / PENTHOUSE` when matching within the same project. Same-project entries are also exempt from the area tolerance check.

---

### 4.3 Outlier Removal

**File:** `src/valuation/outliers.ts`

#### Method 1: Trim 10% (default)

```
1. Sort PSF values ascending: sorted[0..n-1]
2. cutCount = floor(n * 0.10)
3. Cleaned set = sorted[ cutCount .. n - cutCount - 1 ]
```

**Example:** 20 values → cutCount = 2 → remove lowest 2 and highest 2 → 16 values remain

#### Method 2: IQR (Interquartile Range)

```
Q1 = percentile(sorted, 25)
Q3 = percentile(sorted, 75)
IQR = Q3 - Q1

lowerFence = Q1 - 1.5 * IQR
upperFence = Q3 + 1.5 * IQR

Retained values: lowerFence <= PSF <= upperFence
```

#### Percentile Calculation (Linear Interpolation)

```
index  = (p / 100) * (n - 1)
lower  = sorted[ floor(index) ]
upper  = sorted[ ceil(index)  ]
weight = index - floor(index)

percentile(p) = lower * (1 - weight) + upper * weight
```

---

### 4.4 Descriptive Statistics

**File:** `src/valuation/stats.ts`

```
Mean:
  mean = sum(psfValues) / n

Median:
  if n is odd:  median = sorted[ (n-1)/2 ]
  if n is even: median = ( sorted[n/2 - 1] + sorted[n/2] ) / 2

Min:  sorted[0]
Max:  sorted[n-1]
```

#### Benchmark PSF Selection

```
When benchmark = "transactionMedianPsf":
  Priority 1 → transactionMedianPsf  (if transactionCount > 0)
  Priority 2 → listingMedianPsf      (fallback)
  Priority 3 → null                  → INSUFFICIENT_DATA

When benchmark = "listingMedianPsf":
  Priority 1 → listingMedianPsf      (if listingCount > 0)
  Priority 2 → transactionMedianPsf  (fallback)
  Priority 3 → null                  → INSUFFICIENT_DATA
```

---

### 4.5 Area Valuation

**File:** `src/valuation/engine.ts` — primary valuation path

```
Inputs:
  clientAreaSqft, clientBedrooms, clientPropertyType, clientPrice

Algorithm:
  [1]  Load project listing entries  (sourceType = LISTING)
  [2]  Load DLD transaction entries  (sourceType = TRANSACTION)
       → filtered by area tolerance + property type + bedrooms (Two-Pass)
  [3]  Remove outliers using configured method
  [4]  Compute aggregates per group:
         listingStats     = { count, mean, median, min, max }
         transactionStats = { count, mean, median, min, max }
  [5]  Check minimum threshold:
         if (listingCount + transactionCount) < minComps:
           → verdict = INSUFFICIENT_DATA
  [6]  Select benchmarkPsf (median or mean, per config)
  [7]  Compute recommended price range:
         recommendedLow  = min(all cleaned PSF values) * clientAreaSqft
         recommendedMid  = benchmarkPsf               * clientAreaSqft
         recommendedHigh = max(all cleaned PSF values) * clientAreaSqft
  [8]  Compute clientPsf = clientPrice / clientAreaSqft
  [9]  Apply Verdict formula
  [10] Compute Confidence Score
```

---

### 4.6 Project Valuation

**File:** `app/api/public/v/[token]/submit/route.ts`

Identical algorithm to Area Valuation, but data sources are restricted:

```
Project comparables = project listing entries
                    + project-only transaction entries
                      (instead of all transactions for the location)

Result stored in:
  ValuationResult.projectValuationData  (JSON — full engine output)
  ValuationResult.projectCompsUsed      (JSON — comparables snapshot)
```

This enables a side-by-side comparison across two scopes:
- **Area Valuation** → the broader geographic market
- **Project Valuation** → the specific project's own price history

---

### 4.7 Specialist Assessment

**File:** `app/api/leads/[leadId]/specialist-assessment/route.ts`

A manual third valuation layer entered by a human expert:

```
Input: estimatedPrice  (entered by the specialist in the admin dashboard)

estimatedPsf = estimatedPrice / lead.areaSqft

Displayed alongside the two automated valuations:
  Card 1 — Area Valuation      (broad market)
  Card 2 — Project Valuation   (project-level)
  Card 3 — Specialist          (human expert opinion)
```

---

### 4.8 Verdict

**File:** `src/valuation/verdict.ts`

```
ratio = clientPsf / benchmarkPsf

if ratio < threshold_below_market   → BELOW_MARKET    (below market value)
if ratio <= threshold_aligned_max   → ALIGNED         (in line with market)
if ratio <= threshold_slightly_max  → SLIGHTLY_ABOVE  (slightly above market)
otherwise                           → ABOVE_MARKET    (significantly above market)
```

**Default thresholds** (configurable via `/admin/settings/valuation-rules`):

| Threshold | Default | Meaning |
|-----------|---------|---------|
| `threshold_below_market` | 0.95 | Below 95% of market |
| `threshold_aligned_max` | 1.05 | Within ±5% of market |
| `threshold_slightly_max` | 1.15 | 5%–15% above market |
| Above | > 1.15 | More than 15% above market |

---

### 4.9 Confidence Score

**File:** `src/valuation/scoring.ts`

A score from **0 to 100** composed of four independent factors:

#### Factor 1: Comparable Volume (0–40 pts)

| Comparable count | Points |
|-----------------|--------|
| ≥ 15 | 40 |
| ≥ 10 | 30 |
| ≥ 7 | 25 |
| ≥ 5 | 20 |
| ≥ 3 | 10 |
| < 3 | 0 |

#### Factor 2: DLD Transaction Presence (0–10 pts)

| DLD transaction count | Points |
|-----------------------|--------|
| ≥ 5 | 10 |
| ≥ 3 | 7 |
| ≥ 1 | 3 |
| 0 | 0 |

#### Factor 3: Data Variance — Coefficient of Variation (0–30 pts)

```
mean     = average(psfValues)
variance = sum( (psfᵢ - mean)² ) / (n - 1)
stdDev   = sqrt(variance)
CV       = stdDev / mean
```

| CV (coefficient of variation) | Points |
|-------------------------------|--------|
| CV < 0.05 | 30 |
| CV < 0.10 | 25 |
| CV < 0.15 | 18 |
| CV < 0.25 | 10 |
| CV ≥ 0.25 | 3 |

#### Factor 4: Data Recency (0–20 pts)

| Most recent DLD transaction | Points |
|-----------------------------|--------|
| ≤ 6 months ago | 20 |
| > 6 months ago or none | 5 |

#### Total Score

```
confidence = volumePoints + transactionPoints + variancePoints + recencyPoints
             (maximum: 100)
```

---

## End-to-End Valuation Flow

```
Client
  │
  ├─ opens valuation link: https://domain.com/v/{linkId}
  │
  ▼
GET /api/public/v/{token}/meta
  │  Validates: status=ACTIVE, not expired, usedCount < maxUses
  │  Returns: project name, location, currency, default property type
  │
  ▼
3-step wizard:
  Step 1 — Contact:  name + phone + email
  Step 2 — Property: type + bedrooms + area (sqft) + asking price
  Step 3 — Results:  instant verdict + price range + confidence
  │
  ▼
POST /api/public/v/{token}/submit
  │  [1] Rate limit: 5 requests / minute / IP
  │  [2] Validate link (status, expiry, usage)
  │  [3] Validate input (Zod schema)
  │  [4] Run Area Valuation    → benchmarkPsf + verdict + confidence + range
  │  [5] Run Project Valuation → projectValuationData
  │  [6] Atomic DB write:
  │        Lead + ValuationResult + Report{status: QUEUED}
  │  [7] usedCount += 1
  │  [8] Enqueue PDF job → BullMQ (Redis)
  │  [9] Return result to client immediately
  │
  ▼
BullMQ Worker (background)
  │  renderHtml.ts  → build HTML from data + branding settings
  │  generatePdf.ts → Puppeteer → PDF buffer (A4)
  │  Report.pdfData = buffer  |  Report.status = READY
  │
  ▼
GET /api/public/v/report/{leadId}
  Download PDF (no authentication required)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Admin dashboard (running in parallel):
  Lead appears in /admin/leads with status NEW
  Agent reviews: Area card + Project card
  Agent adds: Specialist Assessment (optional)
  Lead pipeline: NEW → CONTACTED → QUALIFIED → APPOINTMENT_SET → WON / LOST
```

---

## Roles & Permissions (RBAC)

**File:** `src/auth/rbac.ts`

### Roles

| Role | Code | Description |
|------|------|-------------|
| Administrator | `ADMIN` | Unrestricted access — team, settings, audit |
| Manager | `MANAGER` | Manage projects, leads, reports, analytics |
| Agent | `AGENT` | Create links, manage assigned leads |
| Viewer | `VIEWER` | Read-only access |

### Permission Matrix

| Permission | ADMIN | MANAGER | AGENT | VIEWER |
|-----------|:-----:|:-------:|:-----:|:------:|
| **Projects** | | | | |
| View | ✅ | ✅ | ✅ | ✅ |
| Create / Edit | ✅ | ✅ | ✅ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ |
| **Comparable Entries** | | | | |
| View | ✅ | ✅ | ✅ | ✅ |
| Create / Edit | ✅ | ✅ | ✅ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ |
| **Valuation Links** | | | | |
| View | ✅ | ✅ | ✅ | ❌ |
| Create / Edit | ✅ | ✅ | ✅ | ❌ |
| Delete / Disable | ✅ | ✅ | ❌ | ❌ |
| **Leads** | | | | |
| View all leads | ✅ | ✅ | ❌ | ❌ |
| View assigned leads | ✅ | ✅ | ✅ | ❌ |
| Update lead status | ✅ | ✅ | ✅ | ❌ |
| Assign to agent | ✅ | ✅ | ❌ | ❌ |
| **Reports** | | | | |
| View all reports | ✅ | ✅ | ❌ | ❌ |
| View assigned reports | ✅ | ✅ | ✅ | ❌ |
| Generate PDF | ✅ | ✅ | ✅ | ❌ |
| Add specialist assessment | ✅ | ✅ | ✅ | ❌ |
| **Settings** | | | | |
| View | ✅ | ✅ | ❌ | ❌ |
| Edit | ✅ | ❌ | ❌ | ❌ |
| **Team Management** | | | | |
| Manage users | ✅ | ❌ | ❌ | ❌ |
| **Analytics** | | | | |
| View | ✅ | ✅ | ❌ | ❌ |
| **Audit Log** | | | | |
| View | ✅ | ❌ | ❌ | ❌ |

### Route Protection

**File:** `middleware.ts`

```
Authenticated (login required):       /admin/*

ADMIN-only:                            /admin/settings
                                       /admin/audit
                                       /admin/team

Public (no authentication):            /v/[token]
                                       /login
                                       /api/public/*
                                       /api/auth/*
                                       /api/health
```

---

## Valuation Links

### Link Lifecycle

```
Create link (ADMIN / MANAGER / AGENT)
  │  Options: label, expiresAt, maxUses, agentId
  ▼
Public URL: https://domain.com/v/{linkId}
  │
  ▼
Client opens URL
  │  Checks: status = ACTIVE
  │           has not passed expiresAt
  │           usedCount < maxUses  (or maxUses is null → unlimited)
  ▼
Client submits form
  │  usedCount += 1
  ▼
New Lead attributed to this link and the creating agent
```

### Per-Link Options

| Option | Description | Example |
|--------|-------------|---------|
| `label` | Descriptive name | "Instagram Campaign — Oct" |
| `expiresAt` | Expiry date | 2024-12-31 |
| `maxUses` | Usage cap | 100 |
| `agentId` | Attribute leads to a specific agent | — |

---

## PDF Report Generation

**Files:** `src/pdf/`

### Generation Pipeline

```
[1] Client submits form
      → Report { status: QUEUED } created in DB
[2] Job enqueued to BullMQ (Redis)
[3] Worker picks up job:
      renderHtml.ts:
        → Load Lead + ValuationResult + SpecialistAssessment from DB
        → Load Branding settings (logo, colors, disclaimer)
        → buildReportHtml() → complete HTML string
[4] generatePdf.ts:
      → Puppeteer launches headless Chrome
      → HTML → PDF (A4 format, no margins, print background enabled)
      → Compute SHA-256 checksum
      → Return buffer + checksum + fileSize
[5] Report { status: READY, pdfData: buffer } updated in DB
```

### Report Sections

| Section | Content |
|---------|---------|
| Header | Company logo, name, contact info |
| Property summary | Type, bedrooms, area, client asking price |
| Verdict & confidence | Verdict label + confidence score (0–100) |
| Listing comparables | Location, price, area, PSF for each comp |
| DLD transaction comparables | Date, price, area, PSF |
| Project-level valuation | Area vs project comparison |
| Specialist assessment | If added by admin/agent |
| Explanations | Plain-language verdict rationale |
| Footer | Generation timestamp + legal disclaimer |

### Chrome Resolution Order

```
[1] PUPPETEER_EXECUTABLE_PATH   (env var — highest priority)
[2] @sparticuz/chromium          (for restricted Linux / Docker)
[3] System Chrome                (/usr/bin/google-chrome-stable, etc.)
[4] Full puppeteer package       (Chrome downloaded during npm install)
```

---

## Full API Reference

### Authentication

| Path | Method | Description |
|------|--------|-------------|
| `/api/auth/[...nextauth]` | GET/POST | NextAuth.js — sign in / sign out / session |
| `/api/auth/forgot-password` | POST | Initiate password reset |
| `/api/auth/reset-password` | POST | Complete reset with token |

### Projects

| Path | Method | Auth | Description |
|------|--------|------|-------------|
| `/api/projects` | GET | All roles | List projects — supports `search`, `isActive`, `category`, `page`, `pageSize`, `sort` |
| `/api/projects` | POST | ADMIN, MANAGER | Create project |
| `/api/projects/[id]` | GET | All roles | Project details |
| `/api/projects/[id]` | PATCH | ADMIN, MANAGER | Update project |
| `/api/projects/[id]` | DELETE | ADMIN | Soft-delete project |

### Comparable Entries

| Path | Method | Auth | Description |
|------|--------|------|-------------|
| `/api/projects/[id]/entries` | GET | All roles | List entries — supports `sourceType`, `propertyType`, `bedrooms`, `isActive` |
| `/api/projects/[id]/entries` | POST | ADMIN, MANAGER, AGENT | Create entry |
| `/api/projects/[id]/entries/import` | POST | ADMIN, MANAGER, AGENT | Bulk import |
| `/api/projects/[id]/entries/[eId]` | GET | All roles | Entry details |
| `/api/projects/[id]/entries/[eId]` | PATCH | ADMIN, MANAGER, AGENT | Update (recalculates PSF) |
| `/api/projects/[id]/entries/[eId]` | DELETE | ADMIN, MANAGER | Soft-delete |

### Valuation Links

| Path | Method | Auth | Description |
|------|--------|------|-------------|
| `/api/projects/[id]/links` | GET | ADMIN, MANAGER, AGENT | List links |
| `/api/projects/[id]/links` | POST | ADMIN, MANAGER, AGENT | Create link |
| `/api/projects/[id]/links/[lId]` | GET | ADMIN, MANAGER, AGENT | Link details |
| `/api/projects/[id]/links/[lId]` | PATCH | ADMIN, MANAGER, AGENT | Update link |
| `/api/projects/[id]/links/[lId]` | DELETE | ADMIN, MANAGER | Delete link |

### Public Valuation (unauthenticated)

| Path | Method | Description |
|------|--------|-------------|
| `/api/public/v/[token]/meta` | GET | Project metadata to pre-fill the form |
| `/api/public/v/[token]/submit` | POST | **Main valuation endpoint** — rate-limited (5 req/min/IP) |
| `/api/public/v/report/[leadId]` | GET | Download PDF report |

### Leads

| Path | Method | Auth | Description |
|------|--------|------|-------------|
| `/api/leads` | GET | ADMIN, MANAGER | List — supports `status`, `verdict`, `projectId`, `assignedAgentId`, `search`, `dateFrom`, `dateTo`, `page`, `pageSize` |
| `/api/leads/[id]` | GET | ADMIN, MANAGER, AGENT | Lead details + valuation result |
| `/api/leads/[id]` | PATCH | ADMIN, MANAGER, AGENT | Update contact info / notes |
| `/api/leads/[id]/status` | PATCH | ADMIN, MANAGER, AGENT | Update pipeline status |
| `/api/leads/[id]/assign` | PATCH | ADMIN, MANAGER | Assign to agent |
| `/api/leads/[id]/revalue` | POST | ADMIN, MANAGER | Re-run valuation engine |
| `/api/leads/[id]/specialist-assessment` | GET/POST | ADMIN, MANAGER, AGENT | Read / create specialist override |
| `/api/leads/[id]/report` | GET | ADMIN, MANAGER, AGENT | Report status |
| `/api/leads/[id]/report` | POST | ADMIN, MANAGER, AGENT | Trigger PDF generation immediately |

### Analytics

| Path | Method | Auth | Description |
|------|--------|------|-------------|
| `/api/dashboard/kpis` | GET | ADMIN, MANAGER | Key performance indicators |
| `/api/analytics/market` | GET | ADMIN, MANAGER | Market summary KPIs + top areas |
| `/api/analytics/price-trends` | GET | ADMIN, MANAGER | PSF trend over time by price bracket |
| `/api/analytics/price-change` | GET | ADMIN, MANAGER | YoY & MoM price change by area |
| `/api/analytics/deal-segments` | GET | ADMIN, MANAGER | Deal size & bedroom distribution |
| `/api/analytics/price-matrix` | GET | ADMIN, MANAGER | Area × Bedroom PSF heatmap |
| `/api/analytics/property-mix` | GET | ADMIN, MANAGER | Property type & off-plan breakdown |
| `/api/analytics/volume` | GET | ADMIN, MANAGER | Monthly transaction volume calendar |
| `/api/analytics/valuations` | GET | ADMIN, MANAGER | Lead funnel & verdict distribution |
| `/api/analytics/areas` | GET | ADMIN, MANAGER | PSF analysis by location |
| `/api/analytics/areas-breakdown` | GET | ADMIN, MANAGER | Detailed area statistics |
| `/api/analytics/projects` | GET | ADMIN, MANAGER | Per-project performance |
| `/api/analytics/report` | GET | ADMIN, MANAGER | Comprehensive analytics report |

### Settings & Team

| Path | Method | Auth | Description |
|------|--------|------|-------------|
| `/api/settings/valuation-rules` | GET/PUT | ADMIN | Engine config (tolerance, thresholds, benchmark…) |
| `/api/settings/branding` | GET/PUT | ADMIN | Company branding (logo, colors, disclaimer) |
| `/api/team` | GET, POST | ADMIN | List / create users |
| `/api/team/[uId]` | GET, PATCH, DELETE | ADMIN | Manage user |
| `/api/audit` | GET | ADMIN | Audit log |

### Utilities

| Path | Method | Auth | Description |
|------|--------|------|-------------|
| `/api/tools/pf-scrape` | POST | ADMIN, MANAGER, AGENT | Scrape listings from PropertyFinder (hostname-validated) |
| `/api/tools/dld-import` | POST | ADMIN, MANAGER | Bulk import DLD transaction entries |
| `/api/health` | GET | Public | Health check (DB + Redis + Chrome status) |

---

## Admin Dashboard

| Section | Path | Description | Required Role |
|---------|------|-------------|--------------|
| Dashboard | `/admin` | KPIs + recent leads | All |
| Leads | `/admin/leads` | List with advanced filters | All |
| Lead Detail | `/admin/leads/[id]` | Triple valuation cards + pipeline | All |
| Projects | `/admin/projects` | List + create + stats | All |
| Entries | `/admin/projects/[id]/entries` | Manage listing & transaction comps | ADMIN, MANAGER, AGENT |
| Valuation Links | `/admin/projects/[id]/links` | Create / manage public links | ADMIN, MANAGER, AGENT |
| Analytics | `/admin/analytics` | Market overview + 9 sub-pages | ADMIN, MANAGER |
| Analytics — Price Matrix | `/admin/analytics/price-matrix` | Area × Bedroom PSF heatmap | ADMIN, MANAGER |
| Analytics — Market Trends | `/admin/analytics/market-trends` | Weekly PSF trend chart | ADMIN, MANAGER |
| Analytics — Area Comparison | `/admin/analytics/area-comparison` | Sortable area ranking table | ADMIN, MANAGER |
| Analytics — Property Mix | `/admin/analytics/property-mix` | Type & off-plan breakdown | ADMIN, MANAGER |
| Analytics — Volume Tracker | `/admin/analytics/volume` | Monthly transaction calendar | ADMIN, MANAGER |
| Analytics — Valuation Insights | `/admin/analytics/valuations` | Lead funnel & verdict distribution | ADMIN, MANAGER |
| Analytics — Price Trends | `/admin/analytics/price-trends` | PSF by price bracket over time | ADMIN, MANAGER |
| Analytics — Price Changes | `/admin/analytics/price-change` | YoY & MoM area price shifts | ADMIN, MANAGER |
| Analytics — Deal Segments | `/admin/analytics/deal-segments` | Deal size & bedroom distribution | ADMIN, MANAGER |
| Reports | `/admin/reports` | View / download PDFs | ADMIN, MANAGER, AGENT |
| Import Listings | `/admin/tools/import-listings` | Bulk import from PropertyFinder | ADMIN, MANAGER, AGENT |
| Import DLD | `/admin/tools/import-dld` | Bulk import DLD transactions | ADMIN, MANAGER |
| Team | `/admin/team` | Manage users & roles | ADMIN |
| Settings | `/admin/settings` | Valuation rules + branding | ADMIN |
| Audit Log | `/admin/audit` | Immutable activity log | ADMIN |

### Lead Pipeline

```
NEW ──► CONTACTED ──► QUALIFIED ──► APPOINTMENT_SET ──► WON
                                                    └──► LOST
                                                    └──► ARCHIVED
```

---

## Environment Variables

```env
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Application
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXT_PUBLIC_APP_URL=https://yourdomain.com

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Database
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DATABASE_URL="mysql://user:password@host:3306/ist_valuation"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Authentication (NextAuth.js)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=minimum-32-character-random-secret

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Background Jobs (BullMQ)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REDIS_URL=redis://localhost:6379

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Email
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EMAIL_FROM=noreply@yourcompany.com

# Option A: Resend (recommended)
EMAIL_API_KEY=re_xxxxxxxxxxxxxxxxxxxx

# Option B: Generic SMTP
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PDF Generation (optional)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Override Chrome/Chromium binary path
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# S3 / Cloudflare R2 (optional)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
S3_BUCKET=ist-reports
S3_REGION=auto
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
```

---

## Installation & Running

### Prerequisites

- Node.js ≥ 18
- MySQL 8+
- Redis ≥ 6

### Local Development

```bash
# 1. Clone the repository
git clone https://github.com/mertsadekist/propintels.git
cd ist-valuation-platform

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env with your actual values

# 4. Create database tables
npx prisma db push

# 5. Start development server
npm run dev        # http://localhost:3000

# 6. Run tests
npm test

# 7. Production build
npm run build
npm start
```

### Docker / Coolify Deployment

The project is configured for Next.js standalone output:

```bash
# Build image
docker build -t ist-valuation .

# Run container
docker run -p 3000:3000 \
  -e DATABASE_URL="mysql://..." \
  -e NEXTAUTH_SECRET="..." \
  -e REDIS_URL="redis://..." \
  -e NEXT_PUBLIC_APP_URL="https://yourdomain.com" \
  ist-valuation
```

For **Coolify**: connect the `mertsadekist/propintels` repository to the `master` branch — Docker builds and deploys automatically on every `git push`.

---

## Project Structure

```
ist-valuation-platform/
│
├── app/                                  # Next.js App Router
│   ├── (admin)/admin/                    # Admin dashboard (authenticated)
│   │   ├── analytics/                    # Market overview + 9 sub-pages
│   │   │   ├── price-matrix/             # Area × Bedroom PSF heatmap
│   │   │   ├── market-trends/            # Weekly PSF trend chart
│   │   │   ├── area-comparison/          # Sortable area ranking
│   │   │   ├── property-mix/             # Type & off-plan breakdown
│   │   │   ├── volume/                   # Monthly transaction calendar
│   │   │   ├── valuations/               # Lead funnel & verdicts
│   │   │   ├── price-trends/             # PSF by price bracket over time
│   │   │   ├── price-change/             # YoY & MoM area price shifts
│   │   │   └── deal-segments/            # Deal size & bedroom distribution
│   │   ├── audit/                        # Immutable audit log
│   │   ├── leads/[leadId]/               # Lead detail (triple valuation cards)
│   │   ├── projects/[projectId]/
│   │   │   ├── entries/                  # Comparable entry management
│   │   │   └── links/                    # Valuation link management
│   │   ├── reports/                      # PDF report list + download
│   │   ├── settings/
│   │   │   ├── branding/                 # Company branding settings
│   │   │   └── valuation-rules/          # Engine configuration
│   │   ├── team/                         # User management
│   │   └── tools/
│   │       ├── import-listings/          # PropertyFinder bulk import
│   │       └── import-dld/               # DLD transaction bulk import
│   ├── (auth)/                           # Login & password reset pages
│   ├── (public)/v/[token]/               # Public 3-step valuation form
│   └── api/                              # API routes
│       ├── auth/                         # NextAuth.js + password reset
│       ├── analytics/                    # Market statistics
│       ├── dashboard/                    # KPI endpoints
│       ├── leads/[leadId]/               # Lead management
│       ├── projects/[projectId]/         # Projects + entries + links
│       ├── public/v/                     # Unauthenticated endpoints
│       ├── settings/                     # Configuration endpoints
│       ├── team/                         # Team management
│       └── tools/                        # Utility endpoints (pf-scrape)
│
├── src/
│   ├── auth/
│   │   ├── auth.config.ts                # NextAuth.js configuration
│   │   └── rbac.ts                       # Role & permission definitions
│   ├── components/
│   │   ├── admin/                        # Admin UI components
│   │   ├── public/                       # Public form components
│   │   └── ui/                           # shadcn/ui (Radix-based)
│   ├── db/                               # Prisma client + repository layer
│   ├── jobs/                             # BullMQ workers (PDF queue)
│   ├── notifications/
│   │   ├── mail.ts                       # Resend / SMTP adapter
│   │   └── templates/                    # Email templates
│   ├── pdf/
│   │   ├── generatePdf.ts                # Puppeteer → PDF buffer
│   │   ├── renderHtml.ts                 # Data + branding → HTML string
│   │   └── templates/report.template.ts  # PDF report HTML template
│   ├── valuation/
│   │   ├── engine.ts                     # Core valuation algorithm
│   │   ├── matching.ts                   # Two-pass comparable selection
│   │   ├── outliers.ts                   # Trim10 / IQR outlier removal
│   │   ├── scoring.ts                    # Confidence score (0–100)
│   │   ├── stats.ts                      # Descriptive stats + benchmark
│   │   └── verdict.ts                    # Price verdict computation
│   └── validation/                       # Zod schemas
│
├── prisma/
│   └── schema.prisma                     # MySQL database schema
│
├── public/                               # Static assets
├── middleware.ts                          # Route protection
├── next.config.mjs                       # Next.js config (standalone output)
└── package.json
```

---

## License

This project is proprietary software owned by **IST Valuation**. All rights reserved.

---

*Last updated: 2026-03-26 — v0.20.0*
