# Changelog — IST Valuation Platform

All notable changes to this project are documented in this file.
Versioning follows **Semantic Versioning** (MAJOR.MINOR.PATCH).
The project has not yet reached a stable v1.0 release.

---

## [Unreleased]
- Prisma `db push` on production to create `SpecialistAssessment` table and new `ValuationResult` columns
- End-to-end test of triple valuation cards on live Coolify deployment
- Full PDF report validation on Coolify (Puppeteer + @sparticuz/chromium)

---

## [0.20.0] — 2026-03-26

### Added
- **Analytics dashboard quick-links** — Price Trends, Price Changes, and Deal Segments cards added to the analytics overview page quick-link grid. All three pages were already accessible via the sidebar but were not surfaced from the analytics landing card (`analytics-dashboard.tsx`).
- Analytics grid responsive layout updated from `lg:grid-cols-6` (6 items) to `lg:grid-cols-4 xl:grid-cols-5` (9 items).

### Fixed (Security)
- **AGENT ownership enforcement on report endpoints** — `GET` and `POST /api/leads/[leadId]/report` now verify that an agent-role user is only accessing reports for leads assigned to them. Previously, any authenticated AGENT could read or regenerate any lead's PDF report.
- **Async Redis-backed rate limiter on submit** — `POST /api/public/v/[token]/submit` now calls the async `checkRateLimit()` (Redis pipeline, with in-memory fallback) instead of the synchronous `checkRateLimitSync()`. Rate-limit state is now durable across process restarts.
- **Rate limiting on public PDF download** — `GET /api/public/v/report/[leadId]` enforces 20 downloads per IP per minute to prevent lead ID enumeration and PDF harvesting.
- **Strict hostname validation in PropertyFinder scraper** — URL check changed from a substring match (`url.includes("propertyfinder.ae")`) to a strict set-based hostname check (`ALLOWED_PROPERTYFINDER_HOSTS`), closing a path-injection bypass where a URL like `https://evil.com/?x=propertyfinder.ae` would have passed.
- **CSS injection prevention in PDF templates** — `buildReportHtml()` and `buildMarketReportHtml()` now route all branding color values through `sanitizeCssColor()`, which accepts only `#hex`, `rgb()`, and `rgba()` formats. Maliciously crafted branding config values can no longer inject arbitrary CSS into generated PDFs.

---

## [0.19.0] — 2026-03-17

### Added
- `CHANGELOG.md` — this file

### Changed
- `README.md` translated to English, replacing Arabic version with identical content

---

## [0.18.0] — 2026-03-17

### Added
- `README.md` — comprehensive technical documentation covering:
  - Full valuation engine math (PSF, area tolerance, outlier removal, confidence scoring, verdict thresholds)
  - Complete database schema with all tables, fields, and FK relationships
  - RBAC permission matrix (4 roles × every operation)
  - Full API reference (every endpoint with method, role, and description)
  - End-to-end valuation flow diagram
  - PDF generation pipeline
  - Valuation Link lifecycle
  - Environment variables reference
  - Docker / Coolify deployment guide
  - Project file structure

---

## [0.17.0] — 2026-03-17

### Fixed
- **Copy button does not work on HTTP** (`app/(admin)/admin/projects/[projectId]/links/page.tsx`, `src/components/admin/links/create-link-dialog.tsx`)
  - Root cause: `navigator.clipboard` API requires a **Secure Context (HTTPS)**. The deployment URL was served over HTTP, making `navigator.clipboard` `undefined` and causing a silent uncaught error on every click.
  - Solution: added `copyToClipboard()` helper that tries `navigator.clipboard.writeText()` first, then falls back to `document.execCommand('copy')` via a temporary hidden `<textarea>` for non-HTTPS environments.
  - Added `try/catch` around both copy functions to surface a toast error if all methods fail.
  - Affects both the links table copy button and the copy button inside the Create Link dialog.

---

## [0.16.0] — 2026-03-17

### Fixed
- **Target Project dropdown missing projects in Import Listings** (`app/api/projects/route.ts`, `app/(admin)/admin/tools/import-listings/page.tsx`)
  - Root cause: `pageSize` was capped at `Math.min(input, 100)` — the API silently returned only the 100 most recently created projects. Older projects (e.g. "Binghatti Vintage") never appeared regardless of what the frontend requested.
  - Solution (partial): raised API cap from 100 → 1000.
  - Solution (full): rewrote `ProjectCombobox` component from client-side filtering over a pre-loaded array to **server-side search with a 250 ms debounce** (`?search=...&pageSize=50`). The component is now fully self-contained — it fetches its own data and no longer requires a `projects` prop from the parent.
  - Removed the old `useEffect` + `projects` state from `ImportListingsPage` that loaded 500 projects on mount.
  - Added spinner icon while searching and a clear (×) button to reset selection.
  - Supports searching all 2,507+ projects by name or location.

---

## [0.15.0] — 2026-03-16

### Added
- `next.config.mjs` — `output: 'standalone'` enabled for Next.js standalone build, required by the multi-stage Dockerfile (`COPY --from=builder /app/.next/standalone`).
- `public/.gitkeep` — empty placeholder file so Git tracks the `public/` directory; without it the directory was absent from the build context and Docker failed with `"/app/public": not found`.

### Fixed
- **Coolify Docker build failure #1** (`package-lock.json`) — `npm ci` requires the lock file to be in exact sync with `package.json`. Moving `tailwindcss` and `autoprefixer` from `devDependencies` to `dependencies` had left the lock file stale, causing `npm error Missing: autoprefixer@10.4.27 from lock file`. Regenerated by running `npm install` locally.
- **Coolify Docker build failure #2** (`next.config.mjs`) — `.next/standalone` directory was not generated because `output: 'standalone'` was missing. Dockerfile `COPY` instruction failed.
- **Coolify Docker build failure #3** (`public/`) — empty `public/` directory was not tracked by Git. Docker build context lacked the directory entirely.

---

## [0.14.0] — 2026-03-16

### Added
- HTML rendering fallback when Chrome / Puppeteer is unavailable — returns rendered HTML with an appropriate message instead of crashing the PDF endpoint (`src/pdf/generatePdf.ts`).
- `PUPPETEER_SKIP_DOWNLOAD=1` support to prevent Chrome download at build time on memory-constrained hosts.

### Changed
- Valuation link public URL changed from one-time hash tokens to **link `id` as the stable public token** (`/v/{linkId}`). Eliminates token expiry issues and simplifies link management.
- Client `clientPrice` validation maximum raised from `999,999,999` to `999,000,000,000` (999B AED) to support high-value commercial and off-plan properties.

### Fixed
- **Call Now button — white text on white background** (`src/components/public/results-step.tsx`)
  - Root cause: `shadcn/ui Button variant="outline"` sets `bg-background` (a CSS variable that resolves to white), which overrides `!bg-transparent` in production builds.
  - Solution: replaced the `<Button>` wrapper with a plain `<a>` element styled directly with Tailwind utilities, bypassing the CSS variable conflict entirely.
- **PDF generation fails with 500** — multiple Chrome binary resolution issues on shared hosting; added fallback chain: env var → @sparticuz/chromium → system Chrome paths → full puppeteer.
- **PDF error messages** — surfaced meaningful error text in the UI instead of a generic 500 response.
- Public PDF polling removed from the results page (was hammering the server on slow PDF queues).

---

## [0.13.0] — 2026-03-14

### Added
- **Triple Valuation System** (`app/(admin)/admin/leads/[leadId]/page.tsx`, `src/valuation/engine.ts`, `app/api/public/v/[token]/submit/route.ts`)
  - **Area Valuation card** — market-wide comparable analysis using all listings and DLD transactions in the geographic location filtered by area tolerance, property type, and bedroom count (two-pass).
  - **Project Valuation card** — identical algorithm restricted to project-only entries; result stored as `projectValuationData` JSON in `ValuationResult`.
  - **Specialist Assessment card** — manual price estimate entered by an admin/agent via a dedicated form in the lead detail page; stored in a new `SpecialistAssessment` table with `estimatedPrice`, `estimatedPsf`, and `notes`.
  - All three cards displayed side-by-side on the lead detail page for immediate comparison.
- `SpecialistAssessment` Prisma model — `leadId`, `specialistId`, `estimatedPrice`, `estimatedPsf`, `notes`.
- `projectValuationData` and `projectCompsUsed` columns added to `ValuationResult`.
- `POST /api/leads/[leadId]/specialist-assessment` and `GET /api/leads/[leadId]/specialist-assessment` endpoints.

### Fixed
- Build dependency resolution for Hostinger CI: moved `tailwindcss`, `postcss`, `autoprefixer`, `typescript`, `eslint`, `@types/*` from `devDependencies` to `dependencies` so they are available during the `npm run build` step on the remote host.
- ESLint disabled during production builds (`eslint: { ignoreDuringBuilds: true }` in `next.config.mjs`) to prevent CI failures from lint warnings.
- `vitest.config.ts` excluded from `tsconfig.json` to prevent TypeScript compilation errors during build.

---

## [0.12.0] — 2026-03-13

### Added
- PropertyFinder scraper (`app/api/tools/pf-scrape/route.ts`) enhanced to extract additional listing fields: `reference`, `furnished`, `completionStatus`, `listedDate`.
- **Date Listed** column added to the Import Listings review table (`app/(admin)/admin/tools/import-listings/page.tsx`).
- Frontend `ParsedListing` interface updated to match all API scraper output fields.

### Fixed
- **Prisma "timer has gone away" panic** (`src/db/prisma.ts`) — MySQL connection dropped on idle shared hosting connections after a few minutes; added `connection_limit=1` and ping-before-query logic to prevent Prisma from crashing the Node.js process.
- **High server load** (`datasource` override removed from `schema.prisma`) — a debug `datasource` block was forcing a second connection pool, doubling database load; removed.
- PropertyFinder scraper now handles cases where `bedrooms`, `bathrooms`, and `size` fields are returned as strings or nested objects instead of plain numbers.
- **Build script — permission denied** on shared hosting: switched from `npx prisma` / `npx next` to `node ./node_modules/.bin/prisma` and `node ./node_modules/.bin/next`.
- `prisma` moved from `devDependencies` to `dependencies`; `prisma generate` moved to `postinstall` to run automatically after `npm install`.
- `server.js` forced into production mode (`NODE_ENV=production`) to prevent Next.js from loading dev overlays under the Hostinger Node.js runner.
- Prisma binary targets reduced to only necessary targets to cut install size and deploy time.

---

## [0.11.0] — 2026-03-10

### Added
- `server.js` — custom Node.js entry point for Hostinger Node.js hosting environment (process manager does not capture stdout/stderr from `next start`; `server.js` wraps the Next.js server and explicitly logs to a file).
- `@sparticuz/chromium` integration for PDF generation on Linux shared hosting (no system Chrome available).
- `/api/health` endpoint — returns JSON with Node.js version, Chrome binary status, Redis connectivity, and DB ping result. Used by Coolify / Render health checks.
- Chrome/Puppeteer detection added to health endpoint for debugging PDF issues.
- Render.com `render.yaml` worker configuration added for background PDF queue.

### Changed
- PDF binary data migrated from S3/R2 object storage to **MySQL `LongBlob`** (`Report.pdfData`). Eliminates S3 credentials requirement and simplifies deployment on hosts without outbound S3 access.

### Fixed
- `next.config.mjs` — corrected for Next.js 14 App Router compatibility.
- Prisma client `generate` step added to build pipeline so the generated client is available at runtime on CI/CD deployments.
- Redis queue made **lazily initialized** — the BullMQ worker now connects to Redis only when a job is enqueued, preventing the process from crashing on startup when `REDIS_URL` is not set.
- Prisma binary targets: `debian-openssl-1.1.x` added for Hostinger Debian hosts; invalid `linux-musl-openssl-1.1.x` target removed.
- PropertyFinder scraper — data normalization for `bedrooms` / `bathrooms` returned as strings, and `size` returned as a nested object `{ value, unit }`.

---

## [0.10.0] — 2026-03-10

### Added — Initial Platform Release

Full-stack real estate valuation platform built with **Next.js 14 App Router**, **Prisma + MySQL**, **NextAuth.js**, **BullMQ + Redis**, and **Puppeteer**.

#### Core Valuation Engine (`src/valuation/`)
- `engine.ts` — primary valuation algorithm combining listing and DLD transaction comparables.
- `matching.ts` — two-pass comparable selection (strict + relaxed bedroom filter) with configurable area tolerance window.
- `outliers.ts` — pluggable outlier removal: Trim 10% (default) and IQR methods with linear-interpolation percentile calculation.
- `stats.ts` — mean, median, min, max aggregates + configurable benchmark PSF selection (listing median vs transaction median with automatic fallback).
- `verdict.ts` — price verdict computation (`BELOW_MARKET`, `ALIGNED`, `SLIGHTLY_ABOVE`, `ABOVE_MARKET`, `INSUFFICIENT_DATA`) based on `clientPsf / benchmarkPsf` ratio against configurable thresholds.
- `scoring.ts` — 0–100 confidence score from four weighted factors: comparable volume (40 pts), DLD transaction presence (10 pts), coefficient of variation (30 pts), data recency (20 pts).

#### Public Valuation Flow
- `/v/[token]` — 3-step client wizard (contact info → property details → results) served without authentication.
- `GET /api/public/v/[token]/meta` — validates link and returns project metadata for form pre-fill.
- `POST /api/public/v/[token]/submit` — validates token, runs valuation engine, creates Lead + ValuationResult + queued Report atomically, enqueues PDF job. Rate-limited to 5 requests/minute/IP.
- `GET /api/public/v/report/[leadId]` — public PDF download endpoint.

#### Database Schema (Prisma / MySQL)
- `User`, `Role`, `UserRole` — authentication and RBAC.
- `PasswordResetToken` — secure password reset flow.
- `Project` — real estate project with location, category, area tolerance, and currency.
- `Entry` — comparable data (listings and DLD transactions) with computed `askPsf`, `lowPsf`, `transactionPsf`.
- `ValuationLink` — shareable public links with optional expiry, usage cap, and agent attribution.
- `Lead` — client valuation requests with full property and contact data.
- `ValuationResult` — complete engine output snapshot including statistics, verdict, confidence, comparables JSON.
- `Report` — PDF artifact (binary LongBlob, SHA-256 checksum, generation status).
- `Setting` — JSON-value configuration rows for branding and valuation rules.
- `AuditLog` — immutable before/after mutation log for all admin operations.

#### Admin Dashboard (`/admin/`)
- **Dashboard** — KPI cards (total leads, verdict distribution, confidence distribution).
- **Leads** — paginated list with filters by status, verdict, project, agent, date range, and full-text search. Lead detail page with valuation result, comparables table, status pipeline, and agent assignment.
- **Projects** — full CRUD, filter by category / active status, stats per project.
- **Comparable Entries** — per-project listing and transaction management; bulk import endpoint.
- **Valuation Links** — create, toggle, copy, and delete shareable links per project.
- **Analytics** — market trend charts, area PSF breakdown, project performance (Recharts).
- **Reports** — list generated PDFs, retry failed reports.
- **Import Listings** — 3-step PropertyFinder URL scraper: enter URL → review & filter table → import as entries.
- **Team** — user management with role assignment (ADMIN only).
- **Settings** — valuation rules (thresholds, tolerance, outlier method) and branding (logo, colors, disclaimer) (ADMIN only).
- **Audit Log** — full immutable event log with actor, entity, before/after JSON (ADMIN only).

#### RBAC (`src/auth/rbac.ts`)
Four roles: `ADMIN`, `MANAGER`, `AGENT`, `VIEWER` with fine-grained permission checks on every API route and middleware protection on all `/admin/*` paths.

#### PDF Report Pipeline (`src/pdf/`)
- `renderHtml.ts` — loads lead, valuation result, branding settings, and comparable data; builds full HTML report string.
- `generatePdf.ts` — multi-source Chrome resolution (env var → @sparticuz/chromium → system Chrome → puppeteer); A4 PDF with print background.
- Report template includes: header with company branding, property summary, verdict + confidence, listing comparables, DLD transaction comparables, market explanations, footer with legal disclaimer.
- Background job queue via BullMQ + Redis; PDF stored as `LongBlob` in MySQL `Report` table.

#### Email Notifications (`src/notifications/`)
- Dual SMTP support: **Resend** (API key) or generic SMTP (Nodemailer).
- Templates: password reset, report ready notification, welcome email.

---

*This changelog is maintained manually. Each version corresponds to a meaningful development milestone rather than individual commits.*
