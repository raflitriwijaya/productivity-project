# Productivity Project

A personal web-based productivity suite that combines task management, finance tracking, research logging, learning notes, and an engineering toolkit in a single platform.

## Features

### Core Modules (Wave 1-2)
- **Dashboard** — today's briefing across all modules: tasks due, finance summary, active learning, research stats, engineering issues
- **Todo** — daily task management with priorities, due dates, and status tracking
- **Finance** — multi-account ledger (Cash, ATM, DANA, ShopeePay, GoPay, Investment) with transactions, receivables, payables, portfolio, budgets, and revenue tracking

### Knowledge & Learning (Wave 3)
- **Research** — journal entries with markdown, topics, tags, attachments, semantic search, and AI auto-tagging
- **Learning** — learning tracker with progress, hours, and status
- **Reading** — book tracker with shelves (Want to Read / Reading / Finished), progress, ratings, and notes linked to research

### Business & Startup (Wave 4)
- **Contacts** — client, partner, supplier, investor CRM with links to projects and receivables
- **Ideas** — capture impulsive ideas before they evaporate; convert to projects, research, or tasks
- **Revenue Tracking** — founder income categorization alongside expense tracking

### Engineering Toolkit
- **Projects** — IoT/embedded/robotics project tracker with templates, budget vs actual, and timer
- **Snippets** — syntax-highlighted code snippet library
- **Docs** — per-project markdown documentation
- **Check-ins** — weekly engineering check-ins with health indicators
- **Issues** — P0-P3 issue tracker with component and assignee
- **Roadmap** — 12-month skills roadmap with progress tracking

### Reflection & Growth (Wave 5)
- **Time Tracking** — start/stop timer on any entity (research, reading, engineering, tasks)
- **Weekly Review** — auto-generated summary across all modules
- **Goals/OKRs** — cross-module goals with progress derived from linked entities
- **Annual Report** — yearly polymath report: books, papers, projects, hours

### Intelligence (Wave 6-7)
- **Polymath Dashboard** — multi-year growth visualization across all disciplines
- **AI Chat** — DeepSeek-powered chatbox (cloud V4 Flash/Pro + local R1 via Ollama) with streaming, context injection from your data, and save-to-research
- **Semantic Search** — find research by meaning, not just keywords (pgvector)
- **PWA** — installable, works offline
- **Quick Capture** — ⌘K command palette for instant task/idea/research capture and cross-module search

### Cross-Module
- **Universal Links** — connect anything to anything (22 entity types)
- **Universal Export** — download all your data as ZIP of JSON or CSV
- **Unified Search** — search across todos, research, learning, transactions, projects, and books

## Tech Stack

**Frontend**
- React 19 + Vite
- Tailwind CSS
- React Router DOM
- Axios
- Lucide React
- prism-react-renderer (code snippet highlighting)
- @uiw/react-md-editor (Markdown docs editor)
- rehype-sanitize (markdown XSS sanitization)
- @sentry/react (error reporting — optional, gated on `VITE_SENTRY_DSN`)
- @axe-core/playwright (a11y testing — dev only)

**Backend**
- Node.js + Express 5
- PostgreSQL
- Express Session + bcryptjs (authentication)
- Zod (input validation)
- Helmet (security headers) + express-rate-limit (brute-force protection)
- Pino (structured logging)
- prom-client (Prometheus metrics — `/metrics` endpoint)
- archiver (ZIP streaming for Universal Export)
- pgvector (semantic search / embeddings)
- @sentry/node (error reporting — optional, gated on `SENTRY_DSN`)

## Project Structure

```
productivity-project/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI and feature components
│   │   ├── pages/          # Application pages
│   │   ├── hooks/          # Custom hooks
│   │   └── lib/            # Utilities (API client, formatters)
│   ├── Dockerfile
│   └── package.json
├── server/                 # Express backend
│   ├── db/                 # Migrations
│   ├── middleware/         # Auth, validation, error handler
│   ├── models/             # Database queries
│   ├── routes/             # API routes
│   ├── scripts/            # Developer scripts (OpenAPI generation)
│   ├── Dockerfile
│   └── package.json
├── docs/                   # Project documentation
│   ├── openapi.json        # Generated OpenAPI 3.1 spec (npm run openapi)
│   ├── ARCHITECTURE.md     # Routes, DB schema, data flow, design decisions
│   └── RUNBOOK.md          # Backup/restore, secret rotation, incident runbooks
├── deploy/                 # Deployment configs (Nginx, Cloudflare Tunnel)
├── CHANGELOG.md
├── CONTRIBUTING.md
├── SECURITY.md
├── docker-compose.yml
└── ecosystem.config.cjs    # PM2 config
```

---

## Local Development

### Prerequisites

- Node.js >= 18
- PostgreSQL

### 1. Clone the repository

```bash
git clone https://github.com/raflitriwijaya/productivity-project.git
cd productivity-project
```

### 2. Setup the backend

```bash
cd server
npm install
cp .env.example .env
```

Edit `.env` and fill in the values:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SESSION_SECRET` | yes | Random string, minimum 32 characters |
| `CLIENT_ORIGIN` | yes | Frontend URL (default: `http://localhost:5173`) |
| `PORT` | no | Server port (default: `3000`) |
| `SENTRY_DSN` | no | Sentry DSN for server-side error reporting — omit to disable |

Run database migrations:

```bash
npm run migrate
```

### 3. Setup the frontend

```bash
cd ../client
npm install
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | no | Backend URL (default: `http://localhost:3000`) |
| `VITE_SENTRY_DSN` | no | Sentry DSN for client-side error reporting — omit to disable |

### 4. Run the app

Open two terminals simultaneously:

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```

Open your browser at `http://localhost:5173`

---

## Production Deployment

### Option A — Docker (recommended)

The simplest way to run the full stack in production. Requires only Docker installed on the server — no need to manually install Node.js, PostgreSQL, or Nginx.

**1. Install Docker**

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

**2. Clone and configure**

```bash
git clone https://github.com/raflitriwijaya/productivity-project.git
cd productivity-project
cp .env.docker.example .env
nano .env
```

Fill in `.env`:

| Variable | Required | Description |
|---|---|---|
| `DB_PASSWORD` | yes | PostgreSQL password — generate with `openssl rand -base64 24` |
| `SESSION_SECRET` | yes | Random string ≥ 32 chars — generate with `openssl rand -hex 32` |
| `SENTRY_DSN` | no | Server-side Sentry DSN — omit to disable |
| `VITE_SENTRY_DSN` | no | Client-side Sentry DSN — baked into the bundle at build time; omit to disable |
| `CLIENT_ORIGIN` | no | Browser origin the API allows via CORS (default: `https://raflitriwijaya.my.id`) |
| `VITE_API_URL` | no | API base URL baked into the client bundle (default: `https://raflitriwijaya.my.id`; requires rebuild to change) |
| `BACKUP_S3_BUCKET` | no | S3 / R2 bucket name — omit to keep local-only backups |
| `BACKUP_S3_ENDPOINT` | no | R2: `https://<account>.r2.cloudflarestorage.com`; AWS S3: leave blank |
| `BACKUP_S3_ACCESS_KEY_ID` | no | Object storage access key |
| `BACKUP_S3_SECRET_ACCESS_KEY` | no | Object storage secret key |
| `BACKUP_S3_REGION` | no | `auto` for R2; e.g. `ap-southeast-1` for AWS S3 |

> **Security:** never reuse a development `SESSION_SECRET` or `DB_PASSWORD` in production — treat the dev values as compromised. See [docs/RUNBOOK.md §3](docs/RUNBOOK.md) for the rotation procedure.

**3. Build and start all containers**

```bash
docker compose up --build -d
```

This starts four containers: `db` (PostgreSQL), `api` (Express), `nginx` (React + reverse proxy), and `db_backup` (scheduled `pg_dump` sidecar — dumps land in the `postgres_backups` volume and, when `BACKUP_S3_BUCKET` is set, are also pushed off-host to S3/R2). **Migrations run automatically** on every `api` startup — no manual step required.

**4. Verify**

```bash
docker compose ps          # all four services should show "(healthy)"
curl http://localhost/health
```

> **Security headers** — the nginx container emits `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a strict CSP on every response. Hashed JS/CSS/font assets are served with `Cache-Control: public, immutable` and a 1-year expiry so browsers cache them aggressively.

**Updating after code changes:**

```bash
git pull
docker compose up --build -d
```

**Restoring a backup:**

```bash
# List available backups
docker run --rm -v productivity_postgres_backups:/backups alpine ls /backups

# Restore a specific dump
docker run --rm \
  -v productivity_postgres_backups:/backups \
  -e PGPASSWORD=<DB_PASSWORD> \
  postgres:16-alpine \
  sh -c "gunzip -c /backups/<filename>.sql.gz | psql postgresql://productivity:<DB_PASSWORD>@db:5432/productivity_db"
```

---

### Option B — Manual (Nginx + PM2)

For setups without Docker. Requires Node.js, PostgreSQL, Nginx, and PM2 installed on the server.

**Install dependencies:**

```bash
sudo apt update && sudo apt install -y git nginx postgresql
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc && nvm install 22
npm install -g pm2
```

**Setup PostgreSQL:**

```bash
sudo -u postgres psql -c "CREATE USER productivity WITH PASSWORD 'your_password';"
sudo -u postgres psql -c "CREATE DATABASE productivity_db OWNER productivity;"
```

**Clone, configure, and build:**

```bash
git clone https://github.com/raflitriwijaya/productivity-project.git /var/www/productivity
cd /var/www/productivity

# Backend
cd server && npm install && cp .env.example .env
# Edit .env: set DATABASE_URL, CLIENT_ORIGIN, SESSION_SECRET, NODE_ENV=production
npm run migrate

# Frontend
cd ../client && npm install
echo "VITE_API_URL=https://yourdomain.com" > .env
npm run build
```

**Start with PM2:**

```bash
cd /var/www/productivity
pm2 start ecosystem.config.cjs --env production
pm2 save && pm2 startup
```

**Configure Nginx:**

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/productivity
sudo ln -s /etc/nginx/sites-available/productivity /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

### Exposing to the Internet — Cloudflare Tunnel

Both deployment options above run on `localhost:80`. To make the app accessible from anywhere without opening router ports, use Cloudflare Tunnel.

**1.** Go to [one.dash.cloudflare.com](https://one.dash.cloudflare.com) → **Networks → Tunnels → Create a tunnel**

**2.** Install and register `cloudflared` on your server using the token provided by Cloudflare:

```bash
curl -L -o cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
sudo cloudflared service install <YOUR_TUNNEL_TOKEN>
```

**3.** In the Cloudflare dashboard, add a public hostname:
- **Hostname:** `yourdomain.com`
- **Service:** `http://localhost:80`

Cloudflare handles SSL automatically — no certificate setup required.

---

## CI/CD

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs on every push and pull request to `main`:

| Job | Steps |
|---|---|
| **Server** | `npm ci` → security audit (`--audit-level=high`) → lint → migrate test DB → tests |
| **Client** | `npm ci` → security audit → lint → `npm run build` → tests |

The server CI job runs against a real `postgres:16-alpine` service container so integration tests (Phase 10) can exercise a fully-migrated schema. The existing mocked unit tests are unaffected.

Any high-severity npm advisory or build failure blocks the run. To enforce it as a merge gate: **Settings → Branches → Branch protection rules → Require status checks → select "Server" and "Client"**.

---

## Documentation

| File | Contents |
|------|----------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | **Canonical** — Stack, data flow, route map, full DB schema, middleware order, design decisions |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | DB backup/restore, migration rollback, secret rotation, object storage migration plan, incident runbooks |
| [docs/openapi.json](docs/openapi.json) | OpenAPI 3.1 spec — regenerate with `cd server && npm run openapi` |
| [CHANGELOG.md](CHANGELOG.md) | Version history (Keep a Changelog format) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Setup, lint/test commands, branch/PR conventions |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting, supported versions, hardening inventory |

---

## License

MIT
