# Darukaa.Earth

Geospatial data analytics platform for restoration work coordination.

## CI

This repository uses GitHub Actions for continuous integration.

**Workflow file:** `.github/workflows/ci.yml`

**Triggers:**
- Push to `main`
- Pull request targeting `main`

### What CI validates

**Frontend job:**
- Installs dependencies with `npm ci`
- Runs metric helper verification tests
- Runs Vitest unit tests (jsdom, no real backend/browser/Mapbox)
- Runs ESLint
- Builds the production Vite bundle

**Backend job:**
- Installs Python dependencies from `server/requirements.txt`
- Runs the unittest suite (`python -m unittest discover -s tests -v`)
- Runs compileall verification (`python -m compileall -q app tests`)

### Frontend checks

All frontend tests run in jsdom and do not require:
- A real backend
- A real browser
- A real Mapbox token
- External API calls

CI provides safe placeholder environment values where needed. No real credentials are used.

### Backend checks

Backend tests use mocked database sessions and do not require a running PostgreSQL/PostGIS instance.

CI sets safe, non-production environment variables for the test run, including a placeholder `JWT_SECRET_KEY` that is not a real secret.

### Viewing results

CI status is visible on the GitHub Actions tab for the repository:
- https://github.com/vishalvishwas01/Darukaa/actions

### Badge

```markdown
![CI](https://github.com/vishalvishwas01/Darukaa/actions/workflows/ci.yml/badge.svg)
```

## Local verification

Frontend:
```bash
cd client
npm ci
npm run test:all
npm run lint
npm run build
```

Backend:
```bash
cd server
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate  # macOS/Linux
pip install -r requirements.txt
set DATABASE_URL=postgresql+psycopg://darukaa_test:darukaa_test@localhost:5432/darukaa_test
set JWT_SECRET_KEY=ci-only-placeholder-secret-key-minimum-32-chars
set DEBUG=true
python -m unittest discover -s tests -v
python -m compileall -q app tests
```

### Notes

- Backend tests use mocked database sessions and do not require PostgreSQL.
- Frontend tests use jsdom and do not require a real browser or Mapbox token.
- The workflow uses Node 20 and Python 3.13 on Ubuntu runners.
- This CI pipeline validates code quality only and does not deploy anything.

![CI](https://github.com/vishalvishwas01/Darukaa/actions/workflows/ci.yml/badge.svg)
