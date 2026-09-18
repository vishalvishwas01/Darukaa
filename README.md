# Darukaa.Earth

Darukaa.Earth is a geospatial data analytics platform for coordinating restoration work across living landscapes.

## Architecture

Darukaa.Earth follows a modern decoupled three-tier architecture:

### Request Flow

1. **Authentication Flow**:
   - User registers at POST /api/v1/auth/register (no token required)
   - User logs in at POST /api/v1/auth/login (no token required)
   - Backend returns JWT access token
   - Frontend includes token in Authorization: Bearer <token> header
   - Backend validates JWT on each protected request
   - Protected endpoints return 401 if token is missing/invalid

2. **API Request Flow**:
   - React UI calls API functions in client/src/api/
   - Axios sends HTTPS requests to FastAPI backend
   - FastAPI validates data with Pydantic, verifies auth/ownership
   - SQLAlchemy/GeoAlchemy2 executes queries
   - PostGIS handles spatial operations
   - Backend returns JSON to React

3. **Data Flow**:
   - Site boundaries: GeoJSON Polygon -> PostGIS GEOMETRY (SRID 4326)
   - Metrics: Numeric values with units, aggregated for analytics

## Tech Stack

- **Frontend**: React 19, React Router 7, Vite 8, Tailwind CSS 4, Mapbox GL JS 3, Chart.js 4, Axios
- **Backend**: FastAPI, SQLAlchemy 2, GeoAlchemy2, PostgreSQL/PostGIS, Alembic, Pydantic, python-jose, bcrypt, Uvicorn
- **Testing**: Vitest, React Testing Library, jsdom; unittest
- **Infrastructure**: Node.js 20, Python 3.13, PostgreSQL 16, PostGIS 3.4, Docker, GitHub Actions

## Project Structure

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

## Database and Schema

PostgreSQL 16 + PostGIS 3.4. Alembic migrations in server/migrations/versions/.

### Entities
- **Users**: id (UUID), name, email (unique), password_hash (bcrypt), role, is_active, timestamps
- **Projects**: id (UUID), owner_id (UUID, FK users), name, description, project_type, status (active/archived/draft), timestamps
- **Sites**: id (UUID), project_id (UUID, FK projects, cascade), name, description, boundary (PostGIS POLYGON SRID 4326), area_hectares (numeric 12,4), timestamps
- **Site Metrics**: id (UUID), site_id (UUID, FK sites, cascade), metric_name, metric_value (numeric 15,4), unit, recorded_at, created_at

## Local Setup

### Prerequisites
Node.js 20+, Python 3.13+, PostgreSQL 16+PostGIS 3.4, npm

### 1. Clone
`ash
git clone https://github.com/vishalvishwas01/Darukaa.git && cd Darukaa
`

### 2. Frontend Dependencies
`ash
cd client && npm ci
`

### 3. Backend Dependencies
`ash
cd ../server && python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux/macOS
source .venv/bin/activate

pip install -r requirements.txt
`

### 4. Environment Configuration

Copy example files:
`ash
# Backend
cd server
copy .env.example .env        # Windows
# cp .env.example .env        # Linux/macOS

# Frontend
cd ../client
copy .env.example .env        # Windows
# cp .env.example .env        # Linux/macOS
`

**Backend .env variables** (see server/.env.example):

| Variable | Required | Description |
|----------|----------|------------- |
| APP_NAME | No | Application name |
| APP_VERSION | No | Version string |
| DEBUG | No | Debug mode |
| DATABASE_URL | Yes | PostgreSQL+PostGIS connection URL |
| FRONTEND_URL | No | Frontend URL for CORS |
| JWT_SECRET_KEY | Yes | JWT secret (min 32 chars) |
| JWT_ALGORITHM | No | JWT algorithm (default HS256) |
| ACCESS_TOKEN_EXPIRE_MINUTES | No | Token expiry in minutes |

**Frontend .env variables** (see client/.env.example):

| Variable | Required | Description |
|----------|----------|------------- |
| VITE_API_BASE_URL | Yes | Backend API URL (default: http://localhost:8000/api/v1) |
| VITE_MAPBOX_ACCESS_TOKEN | Yes | Mapbox public token for maps |

**Docker database defaults** (from docker-compose.yml):
- Database: darukaa_db
- User: darukaa_user
- Password: darukaa_password
- Port: 5432
- DATABASE_URL: postgresql+psycopg://darukaa_user:darukaa_password@localhost:5432/darukaa_db

Never commit .env files. Use strong random secrets in production.

### 5. Database

**Option A - Docker:**
`ash
cd .. && docker-compose up -d
`

**Option B - Manual:**
1. Install PostgreSQL 16 + PostGIS 3.4
2. Create database/user, grant privileges
3. Enable PostGIS: CREATE EXTENSION postgis;

### 6. Migrations
`ash
cd server && alembic upgrade head
`

### 7. Start Backend
`ash
cd server && uvicorn app.main:app --reload --port 8000
`
API: http://localhost:8000
Docs: http://localhost:8000/docs

### 8. Start Frontend
`ash
cd client && npm run dev
`
Frontend: http://localhost:5173

## API Overview

Base URL: /api/v1

### Authentication
- POST /auth/register - No token required - Create account
- POST /auth/login - No token required - Get JWT token
- GET /auth/me - Bearer token required - Get current user

### Health (No token required)
- GET /health - Basic check
- GET /health/database - Database check
- GET /health/postgis - PostGIS check

### Projects (Token required, ownership enforced)
- GET /projects - List user projects
- POST /projects - Create project
- GET/PATCH/DELETE /projects/{id} - Project CRUD
- GET /projects/{id}/sites - List sites
- POST /projects/{id}/sites - Create site with polygon
- GET/PATCH/DELETE /projects/{id}/sites/{siteId} - Site CRUD

### Metrics & Analytics (Token required, ownership enforced)
- GET/POST /projects/{pid}/sites/{sid}/metrics - List/create metrics
- GET/PATCH/DELETE /projects/{pid}/sites/{sid}/metrics/{mid} - Metric CRUD
- GET .../metrics/{mid}/timeseries - Time-series data
- GET /projects/{pid}/analytics/summary - Project summary
- GET .../sites/{sid}/analytics/summary - Site summary

All protected endpoints require Authorization: Bearer <token>.

## Docker Setup

docker-compose.yml provides PostgreSQL 16 + PostGIS 3.4:

`ash
docker-compose up -d   # Start
docker-compose down     # Stop
docker-compose down -v  # Stop and remove volume
`

Starts database only. Application runs locally.

## CI/CD

GitHub Actions (.github/workflows/ci.yml) on push/PR to main:

**Frontend job:**
1. Node 20 + npm cache
2. npm ci
3. Metric helper tests
4. Vitest tests (jsdom, mocked API, no Mapbox token)
5. ESLint
6. Production build

**Backend job:**
1. Python 3.13 + pip cache
2. pip install -r requirements.txt
3. Unit tests (79 tests, mocked DB)
4. Compile check

Permissions: contents: read. No deployment.

## Testing

**Frontend:**
`ash
cd client
npm run test      # Vitest
npm run test:all  # All tests
npm run lint      # ESLint
npm run build     # Build
`

**Backend:**
`ash
cd server
python -m unittest discover -s tests -v
`

- Frontend: 71 tests, jsdom, mocked API
- Backend: 79 tests, mocked DB sessions

## Deployment

Not specified in repository. Production needs:
- PostgreSQL 16 + PostGIS 3.4
- Production ASGI server
- Static file serving for built frontend
- Secure env vars (never commit .env)
- CORS configured for production URL
- Strong JWT_SECRET_KEY (32+ chars)
- alembic upgrade head during deploy

## Important Notes

- JWT tokens expire (default 30 min); /auth/me requires valid Bearer token
- Users can only access their own projects
- PostGIS required for site boundaries; must be valid GeoJSON Polygons
- Mapbox requires VITE_MAPBOX_ACCESS_TOKEN for production; tests use mocks
- CORS configured via FRONTEND_URL
- Backend tests use mocked DB; PostgreSQL only needed for runtime

## License

License information has not been specified.
