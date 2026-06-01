# Productivity Project

Aplikasi produktivitas personal berbasis web yang menggabungkan manajemen tugas, keuangan, riset, dan pembelajaran dalam satu platform.

## Fitur

- **Dashboard** — ringkasan aktivitas terkini dari semua modul
- **Todo** — manajemen daftar tugas harian
- **Finance** — pencatatan transaksi keuangan, laporan buku besar, anggaran, portofolio, piutang, dan utang
- **Research** — pencatatan dan pelacakan entri riset
- **Learning** — pencatatan materi pembelajaran

## Tech Stack

**Frontend**
- React 19 + Vite
- Tailwind CSS
- React Router DOM
- Axios
- Lucide React (icons)

**Backend**
- Node.js + Express 5
- PostgreSQL (`pg`)
- Express Session + bcrypt (autentikasi)
- Zod (validasi input)

## Prasyarat

- Node.js >= 18
- PostgreSQL database

## Instalasi

### 1. Clone repository

```bash
git clone https://github.com/raflitriwijaya/productivity-project.git
cd productivity-project
```

### 2. Setup Server

```bash
cd server
npm install
```

Salin file environment dan isi nilainya:

```bash
cp .env.example .env
```

| Variabel | Keterangan |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL |
| `SESSION_SECRET` | String acak minimal 32 karakter |
| `CLIENT_ORIGIN` | URL frontend (default: `http://localhost:5173`) |
| `PORT` | Port server (default: `3000`) |

Jalankan migrasi database:

```bash
npm run migrate
```

### 3. Setup Client

```bash
cd ../client
npm install
```

Salin file environment:

```bash
cp .env.example .env
```

| Variabel | Keterangan |
|---|---|
| `VITE_API_URL` | URL backend (default: `http://localhost:3000`) |

## Menjalankan Aplikasi

Buka dua terminal secara bersamaan:

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

Buka browser di `http://localhost:5173`

## Struktur Project

```
productivity-project/
├── client/             # Frontend React
│   ├── src/
│   │   ├── components/ # Komponen UI dan fitur
│   │   ├── pages/      # Halaman aplikasi
│   │   ├── hooks/      # Custom hooks
│   │   └── lib/        # Utilitas (API client, formatter)
│   └── package.json
├── server/             # Backend Express
│   ├── db/             # Migrasi database
│   ├── middleware/     # Auth, validasi, error handler
│   ├── models/         # Query database
│   ├── routes/         # API routes
│   └── package.json
└── README.md
```

## License

MIT
