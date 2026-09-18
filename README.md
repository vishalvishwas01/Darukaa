# Darukaa.Earth

Darukaa.Earth is a geospatial data analytics platform for coordinating restoration work across living landscapes.

## Tech Stack

- **Frontend**: React 19, React Router 7, Vite 8, Tailwind CSS 4, Mapbox GL JS 3, Chart.js 4
- **Backend**: FastAPI, SQLAlchemy 2, GeoAlchemy2, PostgreSQL/PostGIS, Alembic, Pydantic, python-jose, bcrypt
- **Testing**: Vitest, React Testing Library, jsdom (frontend); unittest (backend)
- **Build/Dev**: Node.js 20, Python 3.13, npm, pip, Uvicorn

## Project Structure

```
Darukaa/
├── .github/workflows/ci.yml
├── client/src/{api,assets,components,context,features,hooks,layouts,lib,pages,routes,services,test}
├── server/app/{api/v1/endpoints,core,db,models,schemas,services}
├── server/migrations/versions/
├── docker-compose.yml
└── README.md
```

## Database and Schema

PostgreSQL 16 with PostGIS 3.4 extension. Uses Alembic for migrations.

### Entities

- **Users**: id (UUID), name, email (unique), password_hash (bcrypt), role, is_active, timestamps
- **Projects**: id (UUID), owner_id (UUID, FK users), name, description, project_type, status (active/archived/draft), timestamps
- **Sites**: id (UUID), project_id (UUID, FK projects, cascade), name, description, boundary (PostGIS POLYGON SRID 4326), area_hectares (numeric), timestamps
- **Site Metrics**: id (UUID), site_id (UUID, FK sites, cascade), metric_name, metric_value (numeric 15,4), unit, recorded_at, created_at

## Local Setup

### Prerequisites
Node.js 20+, Python 3.13+, PostgreSQL 16+PostGIS 3.4, npm

### 1. Clone
```bash
git clone https://github.com/vishalvishwas01/Darukaa.git && cd Darukaa
```

### 2. Frontend Dependencies
```bash
cd client && npm ci
```

### 3. Backend Dependencies
```bash
cd ../server && python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt
```

### 4. Environment
```bash
copy .env.example .env
```
Edit `.env` with actual values (see [Environment Variables](#environment-variables)).

### 5. Database
**Option A - Docker:**
```bash
cd .. && docker-compose up -d
```
**Option B - Manual:**
1. Install PostgreSQL 16 + PostGIS 3.4
2. Create database and user, grant privileges
3. Enable PostGIS: `CREATE EXTENSION postgis;`

### 6. Migrations
```bash
cd server && alembic upgrade head
```

### 7. Start Backend
```bash
cd server && uvicorn app.main:app --reload --port 8000
```
API at `http://localhost:8000`, docs at `http://localhost:8000/docs`

### 8. Start Frontend
```bash
cd client && npm run dev
```
Frontend at `http://localhost:5173`

## Environment Variables

Backend `.env` file (see `.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_NAME` | No | Application name |
| `APP_VERSION` | No | Version string |
| `DEBUG` | No | Debug mode (true/false) |
| `DATABASE_URL` | **Yes** | PostgreSQL+PostGIS connection URL |
| `FRONTEND_URL` | No | Frontend URL for CORS |
| `JWT_SECRET_KEY` | **Yes** | JWT signing secret (min 32 chars) |
| `JWT_ALGORITHM` | No | JWT algorithm (default HS256) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Token expiry in minutes |

Never commit `.env` files. Use strong random secrets in production.

## API Overview

Base URL: `/api/v1`

### Authentication (No token required)
- `POST /auth/register` - Create account
- `POST /auth/login` - Get JWT token
- `GET /auth/me` - Get current user (requires token)

### Health (No token required)
- `GET /health` - Basic health check
- `GET /health/database` - Database check
- `GET /health/postgis` - PostGIS check

### Projects (Requires token, ownership enforced)
- `GET /projects` - List user's projects
- `POST /projects` - Create project
- `GET /projects/{id}` - Get project
- `PATCH /projects/{id}` - Update project
- `DELETE /projects/{id}` - Delete project
- `GET /projects/{id}/sites` - List sites
- `POST /projects/{id}/sites` - Create site with polygon
- `GET/PATCH/DELETE /projects/{id}/sites/{siteId}` - Site CRUD

### Metrics & Analytics (Requires token, ownership enforced)
- `GET/POST /projects/{pid}/sites/{sid}/metrics` - List/create metrics
- `GET/PATCH/DELETE /projects/{pid}/sites/{sid}/metrics/{mid}` - Metric CRUD
- `GET /projects/{pid}/sites/{sid}/metrics/{mid}/timeseries` - Time-series data
- `GET /projects/{pid}/analytics/summary` - Project analytics
- `GET /projects/{pid}/sites/{sid}/analytics/summary` - Site analytics

All protected endpoints require `Authorization: Bearer <token>` header.

## Docker Setup

`docker-compose.yml` provides PostgreSQL 16 + PostGIS 3.4:

```bash
docker-compose up -d
```

Starts database only. Application runs locally. Stop with `docker-compose down`.

## CI/CD

GitHub Actions workflow (`.github/workflows/ci.yml`) on push/PR to main:

**Frontend job:**
1. Node 20 setup
2. `npm ci`
3. Metric helper tests
4. Vitest unit tests (jsdom, no real backend/browser/Mapbox)
5. ESLint
6. Production build

**Backend job:**
1. Python 3.13 setup
2. `pip install -r requirements.txt`
3. Unit tests (79 tests, mocked DB, no PostgreSQL needed)
4. Compile check

Uses least-privilege permissions (`contents: read`). No deployment.

## Deployment

Not specified in the repository. Production deployment would need:
- PostgreSQL 16 + PostGIS 3.4
- Production WSGI server for backend
- Static file serving for built frontend
- Secure environment variables (never commit `.env`)
- CORS configured for production frontend URL
- Strong JWT secret (32+ chars)
- `alembic upgrade head` during deployment

## Important Notes

- Backend tests use mocked DB sessions; no PostgreSQL needed for tests
- Frontend tests use jsdom; no real browser or Mapbox token needed
- Mapbox integration exists but requires valid token for production
- CORS allows requests from `FRONTEND_URL`
- Site ownership enforced: users can only access their own projects

## License

License information has not been specified.

