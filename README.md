# Visthar Admin (Standalone)

This is a separate admin platform created outside `Visthar-DL`.

## Structure

- `backend/` - Express admin backend
- `frontend/` - React + Vite admin frontend

Both connect to the same MongoDB database used by the main Visthar app via `MONGO_URL` + `DB_NAME`.

## Admin Access Rule

Only users with email domain `@visthar-lifestyle.com` can log in.

Backend enforces this in `backend/src/middleware/auth.js` and `backend/src/routes/auth-routes.js`.

## Backend Features

- Admin auth (`/api/auth/login`, `/api/auth/logout`, `/api/auth/me`)
- Dashboard stats (`/api/admin/stats`)
- Operational list endpoints (`/api/admin/list/:name`)
- Site settings read/update (`/api/admin/site-settings`)
- Inventory CRUD (`/api/admin/inventory`)
- Structured logs, request IDs, latency metrics
- Seeds admin user in `users` collection if missing

## Frontend Features

- Admin-only login screen
- Dashboard stats
- Operational lists viewer
- Site settings editor
- Inventory manager (create/update stock/delete)

## Setup

### 1) Backend

Copy `backend/.env.example` to `backend/.env` and set values.

```bash
cd backend
npm install
npm run dev
```

### 2) Frontend

Copy `frontend/.env.example` to `frontend/.env`.

```bash
cd frontend
npm install
npm run dev
```

Frontend default URL: `http://localhost:5173`
Backend default URL: `http://localhost:4100`

## Notes

- Keep `DB_NAME` same as your main app database to share data.
- If backend appears to hang on startup, validate MongoDB connectivity for `MONGO_URL`.

## Docker

### Backend Image

Build backend image:

```bash
cd backend
docker build -t visthar-admin-backend:latest .
```

Run backend container:

```bash
docker run --rm -p 4100:4100 \
	--env-file .env \
	visthar-admin-backend:latest
```

### Frontend Image

Build frontend image:

```bash
cd frontend
docker build -t visthar-admin-frontend:latest .
```

Run frontend container:

```bash
docker run --rm -p 5173:80 visthar-admin-frontend:latest
```

### Docker Compose (Recommended)

Run both admin backend and admin frontend together:

```bash
docker compose up --build
```

Stop services:

```bash
docker compose down
```

Compose file location:

- `docker-compose.yml`
