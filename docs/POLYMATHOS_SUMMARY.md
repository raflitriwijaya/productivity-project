# Polymath OS Home Server — Complete Infrastructure Summary
> **Maintainer:** Rafli Triwijaya (`might_guy`) | **Server:** `192.168.1.69`  
> **Domain:** `mightguy.my.id` | **Completed:** June 16, 2026  
> **Repository:** https://github.com/raflitriwijaya/productivity-project  
> **Built with:** Linux · Docker · Open-Source · Self-hosted · Zero Cloud Dependency

---

## Philosophy & Mission

This project is a deliberate, incremental journey toward **full digital sovereignty** — replacing every proprietary cloud service with open-source, self-hosted alternatives running on personal hardware under complete personal control.

The motivation is not anti-technology. It is about **data ownership**: your data lives on your machine, in open formats, migrateable at any time without asking permission from any corporation. No algorithmic manipulation. No data harvesting. No subscription fees. No vendor lock-in.

> *"What truly survives decades is not the tools themselves, but your data, your operational discipline (backups, documentation, consistent updates), and your own understanding of Linux, networking, containers, and databases. Every decision is measured by one question: does this make me more capable and the system easier for me to maintain alone?"*

This entire stack was built and is maintained by a **single person** — a student of Agricultural Automation & Machinery Engineering who also works as an IoT Project Manager. It proves that professional-grade self-hosted infrastructure is achievable with a used laptop, an internet connection, and the will to learn.

---

## Hardware — The Real Constraint

| Component | Specification |
|---|---|
| **Machine** | Asus A455LF laptop (used/repurposed) |
| **CPU** | Intel Core i5-5200U — 2 cores / 4 threads @ 2.2GHz |
| **RAM** | 8GB DDR3 (~7.2GB usable) |
| **Boot Drive** | SSD 128GB (`/dev/sda`) — OS + legacy Docker volumes |
| **Data Drive** | HDD 512GB (`/dev/sdb4`, mounted at `/mnt/data`, 87GB usable) — Phase 5 service data |
| **Operating System** | Ubuntu Server 26.04 LTS |
| **Local Static IP** | `192.168.1.69` |
| **Admin User** | `might_guy` (sudo) |

**Hardware philosophy:** The weakest link is always storage I/O (spinning HDD) and the CPU's 2-core limitation for parallel workloads. Every architectural decision accounts for this — lightweight images, strict `mem_limit` on every container, SQLite preferred over PostgreSQL where supported, and heavy ML workloads (Immich) deferred to a hardware upgrade.

---

## Network Architecture

```
Internet
    │
    ▼
Cloudflare Edge Network
(DNS · SSL/TLS termination · DDoS protection · CDN)
    │
    ▼
Cloudflare Zero Trust Tunnel (cloudflared container)
    │  No open inbound ports — outbound-only connection
    ▼
Docker Bridge Network: productivity-project_default
    │
    ├── nginx           → React frontend (port 80)
    ├── api             → Express.js backend (port 3000)
    ├── vaultwarden     → Password manager (port 80)
    ├── miniflux        → RSS reader (port 8080)
    ├── wallabag        → Read-later service (port 80)
    ├── nextcloud       → File cloud (port 80)
    ├── gitea           → Git server (port 3000)
    ├── grafana         → Metrics dashboard (port 3000)
    ├── uptime-kuma     → Uptime monitor (port 3001)
    └── [all other internal services]
```

### Security Principles
- **Zero open ports to the internet** — no port 80, 443, or 22 exposed externally
- **SSH restricted to LAN only** (`192.168.1.x` subnet)
- **All external traffic** routes through Cloudflare Tunnel → Zero Trust
- **UFW firewall** active on host
- **Fail2ban** active — maxretry=5, bantime=3600s
- **SSH key authentication only** — password login permanently disabled
- **All secrets** stored in `.env` files, never committed to version control
- **Passwords generated** via `openssl rand -base64 32` or `openssl rand -hex 32`

---

## Phase 1 — Core Application Stack ✅

A full-stack personal productivity web application, built from scratch and self-hosted.

### Application Services

| Service | Image | Function | Notes |
|---|---|---|---|
| `db` | `pgvector/pgvector:pg16` | PostgreSQL 16 + pgvector extension | Dedicated — not shared with Phase 5 |
| `api` | custom `./server` | Express.js REST API, exposes `/metrics` | Node.js 22 |
| `nginx` | custom `./client` | React 19 SPA + reverse proxy | Vite build |
| `db_backup` | `postgres:16-alpine` | pg_dump cron job at 02:00 → backup volume | Compressed SQL dumps |
| `cloudflared` | `cloudflare/cloudflared:latest` | Outbound tunnel to Cloudflare Zero Trust | Stateless |

### Application Features
The core application is a personal productivity suite with the following modules:

**Dashboard** — unified activity overview across all modules  
**Todo** — daily task management with priority tracking  
**Finance** — transaction recording, general ledger reports, budgeting, investment portfolio, accounts receivable & payable  
**Research** — research entry logging and progress tracking  
**Learning** — structured learning notes and progress monitoring  

### Technology Stack
**Frontend:** React 19 · Vite · Tailwind CSS · React Router DOM · Axios · Lucide React  
**Backend:** Node.js · Express 5 · PostgreSQL 16 · Express Session · bcrypt · Zod (input validation)  
**Infrastructure:** Docker Compose · Nginx reverse proxy · Cloudflare Tunnel  

### Security Implementation
- All credentials in `.env` — excluded from Git via `.gitignore`
- `.env.docker.example` provided as public template (no real values)
- Session secrets generated via `openssl rand -base64 32`
- Input validation on all API endpoints via Zod schemas
- bcrypt password hashing for user authentication

---

## Phase 2 — Observability & Monitoring Stack ✅

Full observability with real-time alerting via Telegram, providing instant notification on any service failure.

### Monitoring Services

| Service | Image | Function | RAM Limit | RAM Usage |
|---|---|---|---|---|
| `prometheus` | `prom/prometheus:v2.52.0` | Time-series metrics collector | 200MB | ~54MB |
| `node-exporter` | `prom/node-exporter:v1.8.1` | Host system metrics (CPU, RAM, disk, network) | 30MB | ~10MB |
| `cadvisor` | `gcr.io/cadvisor/cadvisor:v0.49.1` | Per-container metrics | 100MB | ~39MB |
| `grafana` | `grafana/grafana:11.1.0` | Visualization dashboards | 150MB | ~59MB |
| `uptime-kuma` | `louislam/uptime-kuma:1` | HTTP uptime monitoring + alerting | 150MB | ~111MB |

### Observability Coverage
- **System metrics:** CPU usage, memory consumption, disk I/O, network throughput (via Node Exporter)
- **Container metrics:** Per-container CPU, memory, and network (via cAdvisor)
- **Application metrics:** Custom `/metrics` endpoint on Express API (scraped by Prometheus)
- **Uptime monitoring:** HTTP checks every 60 seconds on all public endpoints (via Uptime Kuma)
- **Alerting:** Telegram bot sends instant alerts on downtime — retry logic: 3 retries, 20s interval, 30s timeout

### Dashboard & Access
- **Grafana Dashboard ID 1860** (Node Exporter Full) — comprehensive host metrics visualization
- `grafana.mightguy.my.id` — Grafana web interface
- `status.mightguy.my.id` — Uptime Kuma public status page

### Total Monitoring Stack Footprint
~190MB RAM idle — remarkably lean for full-stack observability.

---

## Phase 3 — Self-hosted Git Server (Gitea) ✅

A personal GitHub alternative for private repositories and version control independence.

| Service | Image | RAM Limit | RAM Usage |
|---|---|---|---|
| `gitea` | `gitea/gitea:1.22` | 256MB | ~105MB |

**Purpose:** Version control for all personal and project code without dependency on GitHub, GitLab, or any third-party Git hosting. All repositories remain on the personal server, in open Git format, exportable at any time.

---

## Phase 4 — Offsite Backup & Disaster Recovery ✅

Automated, encrypted, deduplicated offsite backup to Cloudflare R2. The foundational safety net that makes all subsequent phases safe to implement.

### Backup Strategy

| Decision | Choice | Rationale |
|---|---|---|
| **Storage target** | Cloudflare R2 | No egress fees from Indonesia, S3-compatible, 10GB free tier, same ecosystem as Cloudflare Tunnel |
| **Backup tool** | Restic 0.17.3 | AES-256 encryption built-in, block-level deduplication, integrity verification |
| **Encryption** | Restic native | Data encrypted client-side before leaving the server |
| **Base image** | Alpine 3.20 + restic + curl | Minimal footprint; official restic image lacks shell and curl |

### Backup Pipeline
```
[02:00 daily] db_backup container
    └── pg_dump → gzip → volume: postgres_backups

[03:00 daily] restic-backup container
    ├── Read-only mounts:
    │   ├── postgres_backups   (PostgreSQL daily dumps)
    │   ├── gitea_data         (Git repositories + SQLite)
    │   ├── grafana_data       (dashboard configurations)
    │   ├── uptime_kuma_data   (monitor configs + history)
    │   ├── vaultwarden        (password vault — CRITICAL)
    │   ├── miniflux-db        (RSS database)
    │   ├── wallabag           (read-later articles)
    │   ├── nextcloud          (all cloud files)
    │   └── nextcloud-db       (Nextcloud MariaDB)
    ├── restic backup → AES-256 encryption
    ├── Upload → Cloudflare R2 (bucket: homelab-backup)
    ├── restic forget → apply retention policy + prune
    └── curl → Telegram alert (✅ success / ❌ failure)
```

### Retention Policy
| Category | Snapshots Retained |
|---|---|
| Daily | 7 (past week) |
| Weekly | 4 (past month) |
| Monthly | 3 (past 3 months) |

### Restore Test Results (June 16, 2026) — PASSED ✅
```
Restored: 112 files/dirs (6.017 MiB) in 0:01 seconds
Verified: gitea_data ✓  grafana_data ✓  postgres_backups ✓  uptime_kuma_data ✓
```
A backup that has never been tested is not a backup. This test confirmed the full restore pipeline works end-to-end, from Cloudflare R2 back to the filesystem.

### Critical Security Note
`RESTIC_PASSWORD` is the sole decryption key for all backups. It must be stored outside the server (physical paper, separate password manager). Loss of this password means all backups become permanently unrecoverable.

---

## Phase 5 — Self-hosted Cloud Services (Digital Sovereignty) ✅

Systematically replacing proprietary cloud services with open-source alternatives, running entirely on personal hardware. Every service listed below eliminates a dependency on a corporation that previously had access to personal data.

### Storage Architecture

```
/dev/sda2  (SSD 128GB, mounted /)
└── OS + Docker engine + legacy named volumes

/dev/sdb4  (HDD 512GB partition, mounted /mnt/data, 87GB usable)
├── vaultwarden/     → SQLite password vault
├── miniflux-db/     → PostgreSQL for RSS reader
├── wallabag/        → SQLite read-later storage
├── nextcloud/       → Nextcloud files + application data
└── nextcloud-db/    → MariaDB for Nextcloud

Cloudflare R2 (offsite)
└── Encrypted restic repository (all above, backed up nightly)
```

---

### Wave 1 — Lightweight, High Value

#### 🔐 Vaultwarden — Password Manager
**Replaces:** Bitwarden Cloud · 1Password · LastPass

| Property | Value |
|---|---|
| Image | `vaultwarden/server:1.36.0` |
| Language | Rust (extremely memory-efficient) |
| Database | SQLite at `/mnt/data/vaultwarden` |
| RAM | ~18MB actual / 150MB limit |
| Public URL | `https://vault.mightguy.my.id` |
| Client | Bitwarden browser extension (self-hosted server URL) |
| Registrations | `SIGNUPS_ALLOWED=false` — invite-only |
| Admin Panel | Protected by Argon2-hashed admin token |

**Why this matters:** A password manager is the most sensitive service in any personal infrastructure. Running it self-hosted means the encrypted vault never leaves your server. Bitwarden's official clients (browser extensions, mobile apps) are fully compatible with Vaultwarden — you get the same UX with zero corporate data access.

**Technical insight:** Vaultwarden enforces HTTPS because it uses the Web Crypto API for client-side encryption. Cloudflare Tunnel provides automatic TLS. However, running behind a reverse proxy requires explicit trusted proxy configuration — without `overwriteprotocol=https`, the service generates incorrect `http://` redirect URLs after login, causing authentication loops.

**Docker networking lesson:** Cloudflared and Vaultwarden must share the same Docker network (`productivity-project_default`) and communicate via container name (`vaultwarden:80`), not `localhost:8080`. The `localhost` approach fails because cloudflared resolves it to `[::1]` (IPv6 loopback), which the container does not listen on.

---

#### 📰 Miniflux — RSS Feed Reader
**Replaces:** Google News · Feedly · Inoreader

| Property | Value |
|---|---|
| Image | `miniflux/miniflux:2.2.5` |
| Language | Go (statically compiled, minimal dependencies) |
| Database | PostgreSQL 16 Alpine (`miniflux-db`) |
| RAM | ~20MB app / 100MB limit · ~30MB DB / 150MB limit |
| Public URL | `https://rss.mightguy.my.id` |
| Data | `/mnt/data/miniflux-db` |

**Why this matters:** News algorithms curate what you read to maximize engagement, not to inform. RSS is the original chronological, algorithm-free news format — you subscribe to sources you trust, and everything appears in order, unfiltered. Miniflux makes this self-hosted and permanently private.

**Technical insight:** Miniflux requires PostgreSQL (no SQLite support). Database passwords used in PostgreSQL connection string URLs must not contain URL-reserved characters (`/`, `@`, `?`, `#`). Using `openssl rand -base64 32` risks generating passwords with slashes, causing URL parse failures at startup. The safe alternative is `openssl rand -hex 32` — hexadecimal output is URL-safe by definition.

---

### Wave 2 — Medium Complexity

#### 📖 Wallabag — Read-Later Service
**Replaces:** Pocket · Instapaper · Readwise Reader

| Property | Value |
|---|---|
| Image | `wallabag/wallabag:2.6.9` |
| Language | PHP (Symfony framework) |
| Database | SQLite at `/mnt/data/wallabag` |
| RAM | ~80MB actual / 256MB limit |
| Public URL | `https://read.mightguy.my.id` |
| Default Credentials | `wallabag / wallabag` (must change immediately after install) |

**Why this matters:** Read-later services track your reading habits, interests, and attention patterns. Wallabag keeps your saved articles private, accessible offline (via export), and free from advertising profiling.

**Technical note:** Wallabag's PHP/Symfony stack takes 60–90 seconds on first startup to compile Symfony cache, generate optimized autoload files, and initialize the SQLite database. The `wallabag is ready!` log message confirms successful initialization. Deprecation warnings about abandoned Composer packages are cosmetic — they do not affect functionality.

---

### Wave 3a — Heavy Services

#### ☁️ Nextcloud — Personal Cloud Storage
**Replaces:** Google Drive · Google Docs · Dropbox · iCloud

| Property | Value |
|---|---|
| Image | `nextcloud:28-apache` |
| Language | PHP 8.2 + Apache |
| Database | MariaDB 10.11 (`nextcloud-db`) |
| Cache | Redis 7 Alpine (`nextcloud-redis`) |
| RAM | ~147MB app / 512MB · ~125MB DB / 256MB · ~4MB Redis / 50MB |
| Public URL | `https://cloud.mightguy.my.id` |
| Storage allocation | 50GB cap (learning phase) |
| Data paths | `/mnt/data/nextcloud` · `/mnt/data/nextcloud-db` |

**Why this matters:** Google Drive is free because your files are used to train models, improve search, and build advertising profiles. Nextcloud gives you identical functionality — file sync, sharing, document collaboration, calendar, contacts — with zero corporate data access.

**Critical technical insight — Reverse Proxy Configuration:**  
Nextcloud deployed behind Cloudflare Tunnel requires four explicit `occ` configuration commands. Without these, the login flow succeeds server-side but generates an `http://` redirect URL. Since the login cookie is set with the `Secure` flag (HTTPS-only), browsers reject it on `http://`, creating a permanent login loop that appears indistinguishable from wrong credentials.

```bash
# Tell Nextcloud to trust Docker's internal network as a proxy
docker exec -u www-data nextcloud php occ \
  config:system:set trusted_proxies 0 --value="172.18.0.0/16"

# Force all generated URLs to use HTTPS scheme
docker exec -u www-data nextcloud php occ \
  config:system:set overwriteprotocol --value="https"

# Set the canonical base URL
docker exec -u www-data nextcloud php occ \
  config:system:set overwrite.cli.url --value="https://cloud.mightguy.my.id"

# Read the real client IP from Cloudflare's forwarded header
docker exec -u www-data nextcloud php occ \
  config:system:set forwarded-for-headers 0 --value="HTTP_X_FORWARDED_FOR"
```

**Startup race condition:** Nextcloud attempts to connect to MariaDB immediately on start. MariaDB needs ~15 seconds to initialize on first run. The solution is sequential startup with deliberate sleep intervals (`docker compose up -d nextcloud-db && sleep 15`). Nextcloud handles this gracefully with `Retrying install...` log messages.

**Upload limitation:** Cloudflare's free plan limits upload size to ~100MB per request through the tunnel. For large file uploads, use LAN direct access (`192.168.1.69:port`) or set up a VPN/mesh network (WireGuard, Headscale, Netbird). Nextcloud's chunked upload feature partially mitigates this for desktop sync clients.

---

### Wave 3b — Deferred to Phase 6

#### 📸 Immich — Photo & Video Backup
**Would replace:** Google Photos · iCloud Photos

**Status: Deferred — hardware insufficient**

Immich's machine learning pipeline (face recognition, object detection, CLIP semantic search) requires significant CPU and RAM resources. The Immich project itself recommends ample RAM. On the current i5-5200U with 8GB RAM shared across 19 containers, running Immich would severely degrade all other services.

**Deferred until Phase 6** (hardware upgrade to i7-8700T + 32GB RAM), after which Immich can run with full ML features enabled.

---

## Complete RAM Budget — Current State

| Container | Actual RAM | Limit | % of Limit |
|---|---|---|---|
| `nextcloud` | 147MB | 512MB | 29% |
| `gitea` | 105MB | 256MB | 41% |
| `uptime-kuma` | 111MB | 150MB | 74% ⚠️ |
| `wallabag` | 80MB | 256MB | 31% |
| `grafana` | 59MB | 150MB | 39% |
| `prometheus` | 54MB | 200MB | 27% |
| `nextcloud-db` | 125MB | 256MB | 49% |
| `api` | 67MB | — | — |
| `cadvisor` | 39MB | 100MB | 39% |
| `miniflux-db` | 30MB | 150MB | 20% |
| `cloudflared` | 21MB | — | — |
| `vaultwarden` | 18MB | 150MB | 12% |
| `miniflux` | 20MB | 100MB | 20% |
| `node-exporter` | 10MB | 30MB | 33% |
| `nginx` | 6MB | — | — |
| `nextcloud-redis` | 4MB | 50MB | 8% |
| `db` | 30MB | — | — |
| `db_backup` | 1MB | — | — |
| `restic-backup` | <1MB | 256MB | <1% |
| **TOTAL** | **~937MB** | **7.2GB available** | **~13%** |
| **Headroom** | **~6.3GB free** | | |

⚠️ `uptime-kuma` at 74% of its limit — monitor but not yet critical.

---

## All Active Public Subdomains

| Subdomain | Service | Replaces |
|---|---|---|
| `mightguy.my.id` | Personal Productivity App | — (self-built) |
| `status.mightguy.my.id` | Uptime Kuma | StatusPage, Freshping |
| `grafana.mightguy.my.id` | Grafana | Datadog, New Relic |
| `vault.mightguy.my.id` | Vaultwarden | 1Password, LastPass |
| `rss.mightguy.my.id` | Miniflux | Google News, Feedly |
| `read.mightguy.my.id` | Wallabag | Pocket, Instapaper |
| `cloud.mightguy.my.id` | Nextcloud | Google Drive, Dropbox |

---

## Docker Volumes & Data Mapping

| Volume / Path | Contents | Location | Backed Up |
|---|---|---|---|
| `postgres_data` | Core app PostgreSQL | SSD (Docker managed) | ✅ via pg_dump |
| `uploads_data` | App file uploads | SSD (Docker managed) | ✅ |
| `postgres_backups` | pg_dump archives | SSD (Docker managed) | ✅ |
| `prometheus_data` | Metrics history | SSD (Docker managed) | ✅ |
| `grafana_data` | Dashboard configs | SSD (Docker managed) | ✅ |
| `uptime_kuma_data` | Monitor configs | SSD (Docker managed) | ✅ |
| `gitea_data` | Git repositories + SQLite | SSD (Docker managed) | ✅ |
| `/mnt/data/vaultwarden` | SQLite vault database | HDD | ✅ |
| `/mnt/data/miniflux-db` | PostgreSQL RSS data | HDD | ✅ |
| `/mnt/data/wallabag` | SQLite articles | HDD | ✅ |
| `/mnt/data/nextcloud` | Files + Nextcloud app | HDD | ✅ |
| `/mnt/data/nextcloud-db` | MariaDB database | HDD | ✅ |

**Backup coverage: 9/9 data stores** — all user-generated data is included in the nightly restic backup to Cloudflare R2. Coverage verified by restore test on June 16, 2026 — PASSED. *(Note: V10 audit found the original script only covered 4/9 stores; expanded to 9/9 in the post-V10 infrastructure sprint.)*

---

## Operational Runbook

### Daily Checks
```bash
# Confirm nightly backup succeeded (also sent via Telegram)
docker exec restic-backup cat /var/log/restic.log | tail -5

# Quick health check
docker compose ps
```

### Weekly Checks
```bash
# RAM budget — ensure no container is near its limit
docker stats --no-stream

# Disk usage on HDD data partition
df -h /mnt/data

# Verify backup repository integrity
docker exec restic-backup restic check
```

### Monthly Checks
```bash
# Check Cloudflare R2 storage usage in dashboard
# Review: https://dash.cloudflare.com → R2 → homelab-backup

# List all snapshots
docker exec restic-backup restic snapshots
```

### Every 6 Months
```bash
# Test restore to /tmp (non-destructive — proves backup works)
docker run --rm \
  -e AWS_ACCESS_KEY_ID="..." \
  -e AWS_SECRET_ACCESS_KEY="..." \
  -e RESTIC_REPOSITORY="..." \
  -e RESTIC_PASSWORD="..." \
  -v /tmp/restore-test:/restore \
  homelab-restic:latest \
  restic restore latest --target /restore

ls -lh /tmp/restore-test/data/

# Update Docker images (read changelogs first, backup before major version jumps)
docker compose pull <service>
docker compose up -d <service>
```

### Essential Commands
```bash
# Validate docker-compose before applying changes
docker compose config --quiet && echo "Config OK"

# Start a single service without touching others
docker compose up -d <service_name>

# Restart a single service
docker compose restart <service_name>

# View recent logs
docker logs <container_name> --tail 50 -f

# Trigger manual backup
docker exec restic-backup /bin/sh /restic-backup.sh

# Check backup snapshots in R2
docker exec restic-backup restic snapshots

# Emergency: check what's consuming RAM
docker stats --no-stream | sort -k4 -rh
```

---

## Technical Lessons Learned

### 1. Docker Networking — Container DNS
Containers communicate via **service name**, not `localhost`. When cloudflared tries to reach Vaultwarden, the correct URL is `vaultwarden:80`, not `localhost:8080`. The latter resolves to `[::1]` (IPv6) which the container does not bind to, causing `connection refused`.

### 2. Reverse Proxy Headers — The Silent Authentication Breaker
Applications behind Cloudflare Tunnel don't natively know they're accessed via HTTPS. Without explicit `trusted_proxies` and `overwriteprotocol` configuration, Nextcloud generates `http://` redirect URLs after login. Since session cookies are `Secure`-flagged (HTTPS-only), browsers silently reject them — the user sees a login loop with no error message.

### 3. URL-Safe Password Generation
Database passwords embedded in PostgreSQL connection string URLs (`postgres://user:PASSWORD@host/db`) must not contain URL-reserved characters. `openssl rand -base64 32` may generate passwords with `/`, causing `invalid port` parse errors at startup. **Always use `openssl rand -hex 32`** for any password that will appear in a connection string URL.

### 4. fstab `nofail` — The Boot Safety Net
Secondary disks must be mounted with the `nofail` option in `/etc/fstab`. Without it, if the HDD fails to appear at boot (loose cable, disk failure), the entire server hangs indefinitely waiting for the mount, taking down all services including the primary application.

### 5. Restore Tests Are Non-Negotiable
A backup system that has never been restored is not a backup system — it is an untested hypothesis. Running `restic restore latest --target /tmp/restore-test` and verifying the files exist took 90 seconds and confirmed the entire pipeline works: encryption, upload, download, decryption, and filesystem restoration.

### 6. Container Memory Limits — Mandatory on Constrained Hardware
Without `mem_limit`, a single misbehaving container can OOM-kill critical services. On 8GB RAM shared across 19 containers, every service must declare its memory budget. This also forces disciplined choices about which services to run.

### 7. Docker Image Tagging — Pin, Don't Float
Using `latest` for stateful services (databases, file storage, password managers) is dangerous. A breaking schema migration or API change can silently corrupt data on the next `docker pull`. Pin to `major.minor` tags (e.g., `nextcloud:28-apache`, `vaultwarden/server:1.36.0`) to receive patch-level security fixes without unexpected major version jumps.

### 8. Sequential Service Startup
Services with database dependencies need explicit startup sequencing. MariaDB requires ~15 seconds to initialize its data directory on first run. Starting `nextcloud` immediately after `nextcloud-db` results in connection failures. `docker compose up -d nextcloud-db && sleep 15 && docker compose up -d nextcloud` is simple and reliable.

---

## Technical Debt

| Item | Priority | Notes |
|---|---|---|
| `nginx` app container missing `mem_limit` | Medium | Add during next maintenance window |
| `api` app container missing `mem_limit` | Medium | Add during next maintenance window |
| `restic check` not automated weekly | Medium | Add weekly cron job to restic-backup container |
| `BACKUP_S3_*` vars in `.env` unfilled | Low | Optional redundancy for pg_dump direct-to-S3 |
| Immich not yet deployed | Planned | Requires Phase 6 hardware upgrade |
| `uptime-kuma` approaching 74% memory limit | Monitor | Consider increasing limit to 256MB |

---

## Phase 6 Roadmap — Hardware Upgrade

The current i5-5200U laptop has served well as a learning platform. The next evolution is a **dedicated mini PC** designed for always-on server workloads.

### Target Hardware Candidates (Indonesia Market, June 2026)

| Option | Specs | Est. Price (Used) | Best For |
|---|---|---|---|
| **Dell OptiPlex 7060 Micro** | i7-8700T · 16GB · NVMe + SATA | Rp 5–7 juta | Best value, enterprise build, easy to find |
| **Lenovo ThinkCentre M720q** | i7-8700T · 16GB · NVMe + SATA | Rp 5–7 juta | Identical specs, slightly smaller form factor |

### Why i7-8700T Specifically
- **6 cores / 12 threads** (Hyperthreading) — handles 20+ Docker containers in parallel without contention
- **TDP: 35W** — designed for 24/7 operation, ~Rp35,000/month in electricity
- **RAM: expandable to 32GB** — Immich ML + full Phase 5 stack runs comfortably
- **Storage:** 1× M.2 NVMe (OS) + 1× SATA port (data HDD) — clean separation of boot and data
- **Enterprise build quality** — these units were built for continuous office operation

### Storage Expansion Plan
```
M.2 NVMe 512GB → Ubuntu Server + Docker engine + named volumes
SATA HDD 2TB   → /mnt/data (all Phase 5 service data)
Cloudflare R2  → Offsite encrypted backup (unchanged)
```

### Services Unlocked in Phase 6
| Service | Replaces | Requirement |
|---|---|---|
| **Immich** | Google Photos | ML pipeline needs CPU + RAM headroom |
| **Jellyfin** | Netflix (personal library) | Video transcoding needs ≥4 real cores |
| **Node-RED** | Proprietary IoT platforms | Aligns with IoT PM background |
| **Mosquitto** | AWS IoT, Azure IoT Hub | MQTT broker — industry standard |
| **Outline** | Notion, Confluence | Knowledge base wiki |

### Migration Path
The entire stack migrates with minimal effort:
```bash
# On old server
docker compose down
tar -czf volumes-backup.tar.gz /var/lib/docker/volumes/
rsync /mnt/data/ new-server:/mnt/data/

# On new server
git clone https://github.com/raflitriwijaya/productivity-project
cp .env.backup .env
docker compose up -d
```
All configuration is in `docker-compose.yml` and `.env`. No application-level reconfiguration needed. Cloudflare Tunnel token simply gets re-registered on the new machine.

---

## Project Stats

| Metric | Value |
|---|---|
| **Total phases completed** | 5 of 6 |
| **Active Docker containers** | 19 |
| **Public subdomains** | 7 |
| **Proprietary services replaced** | 6 (and counting) |
| **Total RAM footprint** | ~937MB / 7,200MB (13%) |
| **HDD data used** | <5GB / 87GB available |
| **Backup coverage** | 100% of user data |
| **Offsite backup location** | Cloudflare R2 (encrypted, deduplicated) |
| **Last restore test** | June 16, 2026 — PASSED ✅ |
| **Monthly electricity cost (est.)** | ~Rp 7,000 (laptop i5-5200U @ ~6W) |
| **Monthly cloud service cost** | Rp 0 |

---

## Closing Note

This infrastructure was built by a single person — a student, not a professional DevOps engineer — using a repurposed laptop and an internet connection. Every error was debugged from scratch. Every architectural decision was understood before being applied.

The stack represents something larger than its technical components: **the knowledge that digital independence is achievable**. You do not need a cloud provider's permission to manage your own passwords, read your own news, save your own articles, or store your own files.

The tools are open. The knowledge is available. The only requirement is the willingness to learn.

> *"Bit by bit, freeing ourselves from the chains of digital capitalism."*

---

*This document was generated from implementation sessions spanning Phase 1–5, completed June 16, 2026.*  
*Last updated: June 16, 2026 (V10 audit corrections: Node.js 18+→22, gitea:latest→1.22, gcr.io/cadvisor image path, backup coverage claim corrected to 9/9) | Update this document with every significant stack change.*