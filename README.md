# Productivity Project

A personal web-based productivity suite that combines task management, finance tracking, research logging, learning notes, and an engineering toolkit in a single platform.

## Features

- **Dashboard** — overview of recent activity across all modules
- **Todo** — daily task management
- **Finance** — transaction recording, ledger reports, budgeting, portfolio, receivables, and payables
- **Research** — research entry logging and tracking
- **Learning** — learning notes and progress tracking
- **Engineering** — IoT/embedded/robotics project tracker with scaffolding templates, a syntax-highlighted code snippet library, per-project Markdown docs, weekly check-ins, an issue tracker, and a 12-month skills roadmap

## Tech Stack

**Frontend**
- React 19 + Vite
- Tailwind CSS
- React Router DOM
- Axios
- Lucide React
- prism-react-renderer (code snippet highlighting)
- @uiw/react-md-editor (Markdown docs editor)

**Backend**
- Node.js + Express 5
- PostgreSQL
- Express Session + bcrypt (authentication)
- Zod (input validation)

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
│   ├── Dockerfile
│   └── package.json
├── deploy/                 # Deployment configs (Nginx, Cloudflare Tunnel)
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

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Random string, minimum 32 characters |
| `CLIENT_ORIGIN` | Frontend URL (default: `http://localhost:5173`) |
| `PORT` | Server port (default: `3000`) |

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

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend URL (default: `http://localhost:3000`) |

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

| Variable | Description |
|---|---|
| `DB_PASSWORD` | PostgreSQL password |
| `SESSION_SECRET` | Random string, minimum 32 characters |

**3. Build and start all containers**

```bash
docker compose up --build -d
```

This starts three containers: `db` (PostgreSQL), `api` (Express), and `nginx` (React + reverse proxy).

**4. Run migrations (first time only)**

```bash
docker compose exec api npm run migrate
```

**5. Verify**

```bash
docker compose ps
curl http://localhost/health
```

**Updating after code changes:**

```bash
git pull
docker compose up --build -d
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

## License

MIT
