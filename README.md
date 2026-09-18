# Darukaa.Earth

> **Live application:** [https://darukaa-five.vercel.app/login](https://darukaa-five.vercel.app/login)

Darukaa.Earth is a geospatial data analytics platform for coordinating restoration work across living landscapes.

## Architecture

Darukaa.Earth follows a modern decoupled three-tier architecture.

### Request Flow

1. **Authentication flow**
   - Users register with `POST /api/v1/auth/register`.
   - Users log in with `POST /api/v1/auth/login`.
   - The backend returns a JWT access token.
   - The frontend sends the token using the `Authorization: Bearer <token>` header.
   - The backend validates the JWT on protected requests.
   - Protected endpoints return `401` when the token is missing or invalid.

2. **API request flow**
   - The React UI calls API functions in `client/src/api/`.
   - Axios sends requests to the FastAPI backend.
   - FastAPI validates payloads with Pydantic and verifies authentication and ownership.
   - SQLAlchemy and GeoAlchemy2 execute database queries.
   - PostGIS handles spatial operations.
   - The backend returns JSON responses to React.

3. **Data flow**
   - Site boundaries are converted from GeoJSON polygons into PostGIS geometry with SRID 4326.
   - Metrics are stored as numeric values with units and aggregated for analytics.

## Tech Stack

- **Frontend:** React 19, React Router 7, Vite 8, Tailwind CSS 4, Mapbox GL JS 3, Chart.js 4, Axios
- **Backend:** FastAPI, SQLAlchemy 2, GeoAlchemy2, PostgreSQL/PostGIS, Alembic, Pydantic, python-jose, bcrypt, Uvicorn
- **Testing:** Vitest, React Testing Library, jsdom, unittest
- **Infrastructure:** Node.js 20, Python 3.13, PostgreSQL 16, PostGIS 3.4, Docker, GitHub Actions

## Project Structure

```text
Darukaa/
├── .github/workflows/ci.yml
├── client/.env.example
├── client/src/{api,assets,components,context,features,hooks,layouts,lib,pages,routes,services,test}
├── server/.env.example
├── server/app/{api/v1/endpoints,core,db,models,schemas,services}
├── server/migrations/versions/
├── server/alembic.ini
├── server/requirements.txt
├── docker-compose.yml
└── README.md
```

## Database and Schema

Darukaa.Earth uses PostgreSQL 16 with PostGIS 3.4. Alembic migrations are stored in `server/migrations/versions/`.

### Entities

- **Users:** `id` (UUID), `name`, `email` (unique), `password_hash` (bcrypt), `role`, `is_active`, timestamps
- **Projects:** `id` (UUID), `owner_id` (UUID, foreign key to users), `name`, `description`, `project_type`, `status` (`active`/`archived`/`draft`), timestamps
- **Sites:** `id` (UUID), `project_id` (UUID, foreign key to projects with cascade), `name`, `description`, `boundary` (PostGIS polygon, SRID 4326), `area_hectares` (numeric 12,4), timestamps
- **Site metrics:** `id` (UUID), `site_id` (UUID, foreign key to sites with cascade), `metric_name`, `metric_value` (numeric 15,4), `unit`, `recorded_at`, `created_at`

## Local Setup

### Prerequisites

- Node.js 20+
- Python 3.13+
- PostgreSQL 16 with PostGIS 3.4
- npm

### 1. Clone the repository

```bash
git clone https://github.com/vishalvishwas01/Darukaa.git
cd Darukaa
```

### 2. Install frontend dependencies

```bash
cd client
npm ci
```

### 3. Install backend dependencies

```bash
cd ../server
python -m venv .venv

# Windows
.venv\\Scripts\\activate

# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt
```

### 4. Configure environment variables

Copy the example files:

```bash
# Backend
cd server

# Windows
copy .env.example .env

# Linux/macOS
cp .env.example .env

# Frontend
cd ../client

# Windows
copy .env.example .env

# Linux/macOS
cp .env.example .env
```

#### Backend environment variables

See `server/.env.example`.

| Variable | Required | Description |
|---|---:|---|
| `APP_NAME` | No | Application name |
| `APP_VERSION` | No | Version string |
| `DEBUG` | No | Debug mode |
| `DATABASE_URL` | Yes | PostgreSQL/PostGIS connection URL |
| `FRONTEND_URL` | No | Frontend URL used for CORS |
| `JWT_SECRET_KEY` | Yes | JWT secret, minimum 32 characters |
| `JWT_ALGORITHM` | No | JWT algorithm, default `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Token expiry in minutes |

#### Frontend environment variables

See `client/.env.example`.

| Variable | Required | Description |
|---|---:|---|
| `VITE_API_BASE_URL` | Yes | Backend API URL, for example `http://localhost:8000/api/v1` |
| `VITE_MAPBOX_ACCESS_TOKEN` | Yes | Public Mapbox token used by the map interface |

#### Docker database defaults

The default values in `docker-compose.yml` are:

- Database: `darukaa_db`
- User: `darukaa_user`
- Password: `darukaa_password`
- Port: `5432`
- Connection URL: `postgresql+psycopg://darukaa_user:darukaa_password@localhost:5432/darukaa_db`

> Never commit `.env` files. Use strong, randomly generated secrets in production.

### 5. Start the database

#### Option A: Docker

```bash
cd ..
docker compose up -d
```

#### Option B: Manual installation

1. Install PostgreSQL 16 and PostGIS 3.4.
2. Create the database and user, then grant the required privileges.
3. Enable PostGIS:

```sql
CREATE EXTENSION postgis;
```

### 6. Run migrations

```bash
cd server
alembic upgrade head
```

### 7. Start the backend

```bash
cd server
uvicorn app.main:app --reload --port 8000
```

- API: http://localhost:8000
- API docs: http://localhost:8000/docs

### 8. Start the frontend

```bash
cd client
npm run dev
```

- Frontend: http://localhost:5173

## API Overview

Base URL: `/api/v1`

### Authentication

- `POST /auth/register` — Create an account; no token required
- `POST /auth/login` — Obtain a JWT token; no token required
- `GET /auth/me` — Get the current user; Bearer token required

### Health

- `GET /health` — Basic health check
- `GET /health/database` — Database health check
- `GET /health/postgis` — PostGIS health check

No token is required for health endpoints.

### Projects and sites

All of the following endpoints require a token and enforce ownership:

- `GET /projects` — List the user's projects
- `POST /projects` — Create a project
- `GET/PATCH/DELETE /projects/{id}` — Project CRUD
- `GET /projects/{id}/sites` — List sites
- `POST /projects/{id}/sites` — Create a site with a polygon
- `GET/PATCH/DELETE /projects/{id}/sites/{siteId}` — Site CRUD

### Metrics and analytics

All of the following endpoints require a token and enforce ownership:

- `GET/POST /projects/{pid}/sites/{sid}/metrics` — List or create metrics
- `GET/PATCH/DELETE /projects/{pid}/sites/{sid}/metrics/{mid}` — Metric CRUD
- `GET .../metrics/{mid}/timeseries` — Time-series data
- `GET /projects/{pid}/analytics/summary` — Project summary
- `GET .../sites/{sid}/analytics/summary` — Site summary

Protected endpoints require:

```http
Authorization: Bearer <token>
```

## Docker Setup

`docker-compose.yml` provides PostgreSQL 16 with PostGIS 3.4.

```bash
docker compose up -d   # Start
docker compose down     # Stop
docker compose down -v  # Stop and remove the volume
```

Docker starts the database only. The application runs locally.

## CI/CD

GitHub Actions in `.github/workflows/ci.yml` run on pushes and pull requests targeting `main`.

### Frontend job

1. Set up Node.js 20 and npm cache.
2. Run `npm ci`.
3. Run metric helper tests.
4. Run Vitest tests with jsdom and mocked APIs.
5. Run ESLint.
6. Build the production frontend.

### Backend job

1. Set up Python 3.13 and pip cache.
2. Install dependencies from `requirements.txt`.
3. Run unit tests with a mocked database.
4. Run the compile check.

The workflow has `contents: read` permissions and does not perform deployment.

## Testing

### Frontend

```bash
cd client
npm run test      # Vitest
npm run test:all  # All tests
npm run lint      # ESLint
npm run build     # Production build
```

### Backend

```bash
cd server
python -m unittest discover -s tests -v
```

The repository currently documents 71 frontend tests and 79 backend tests. Frontend tests use jsdom and mocked APIs; backend tests use mocked database sessions.

## Deployment

Production deployment details are not specified in the repository. A production deployment needs:

- PostgreSQL 16 with PostGIS 3.4
- A production ASGI server
- Static-file serving for the built frontend
- Secure environment variables; never commit `.env` files
- CORS configured for the production frontend URL
- A strong `JWT_SECRET_KEY` with at least 32 characters
- `alembic upgrade head` during deployment

## Important Notes

- JWT tokens expire after 30 minutes by default; `/auth/me` requires a valid Bearer token.
- Users can access only their own projects.
- PostGIS is required for site boundaries, which must be valid GeoJSON polygons.
- `VITE_MAPBOX_ACCESS_TOKEN` is required for production maps; tests use mocks.
- CORS is configured through `FRONTEND_URL`.
- Backend tests use a mocked database; PostgreSQL is required at runtime.

## License

License information has not been specified.
