# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal dashboard — modular, Pi-hosted PWA. Budget module is first. Full planning context, schema, and design decisions are in the separate planning directory (`budget-app-planner`).

## Commands

**Frontend** (from `frontend/`):
```
npm run dev      # dev server at localhost:5173
npm run build    # production build
npm run lint     # lint
```

**Backend** (from `backend/`):
```
.venv/Scripts/uvicorn main:app --reload --port 8001   # Windows dev server at localhost:8001 (8000 blocked by OS)
.venv/Scripts/alembic upgrade head        # run migrations
.venv/Scripts/alembic revision --autogenerate -m "description"  # new migration
```

## Structure

```
frontend/src/
  shell/          ← Layout, Nav — shared across all modules
  modules/
    budget/       ← Budget module (active development)
    investing/    ← Placeholder
    collab/       ← Placeholder
    workout/      ← Placeholder

backend/app/
  core/           ← config.py, database.py, auth.py
  modules/
    budget/       ← routes.py, models.py, schemas.py
    ...
  alembic/        ← migrations
  main.py         ← FastAPI app entry point
```

Vite proxies `/api/*` → `localhost:8001` in dev.

## Auth

Tailscale identity headers — no passwords. The `tailscale_auth_middleware` in `backend/app/core/auth.py` reads `Tailscale-User-Login` and sets `request.state.is_owner`. In local dev (no Tailscale headers), defaults to owner access.

Set `OWNER_TAILSCALE_LOGIN` in `backend/.env` (copy from `.env.example`).

## Coding Standards

### Core priorities (in order)
1. **Performance** — fast on a Pi, fast on a phone. Profile before optimizing, but build with efficiency in mind from the start.
2. **Smallness** — the smallest correct solution wins. No speculative abstractions, no code for hypothetical future needs.
3. **Testability** — functions do one thing and take their dependencies as arguments. Pure functions for all business logic.

### Functions
- Keep functions small enough to understand at a glance — if it needs a scroll, split it.
- No side effects in business logic functions (waterfall math, card picker, rewards routing). Pure in, pure out.
- Name functions for what they return or do, not how they do it.

### Comments
- Comment the **why**, never the what. Well-named code explains itself.
- Required for: non-obvious math, workarounds, constraint explanations, anything that would surprise a reader.
- No block comments, no section headers, no "this function does X" docstrings.

### TypeScript (frontend)
- `strict: true` — no `any`, no type suppression.
- Colocate types with the code that owns them. Shared types live in `src/types/`.
- Use `const` assertions and discriminated unions over enums.
- `React.memo`, `useMemo`, `useCallback` where renders are measurably expensive — not by default.
- Lazy-load every module route (`React.lazy` + `Suspense`).
- Virtualize any list that can exceed ~50 items.

### Python (backend)
- Type hints on every function signature — Pydantic and SQLAlchemy enforce this at the boundaries.
- `async` on all route handlers and I/O-bound functions.
- Never do N+1 queries — use `selectinload` / `joinedload` explicitly.
- Multi-step writes use a single db transaction.
- Keep route handlers thin: validate input, call a service function, return output. Business logic lives in service layer, not routes.

### Database
- Index every foreign key and every column used in a `WHERE` or `ORDER BY`.
- Migrations are one-way and non-destructive. Never drop a column in the same migration that removes it from the model — deprecate first.
- Prefer `DECIMAL` over `FLOAT` for all money values.

### Testing
- Pure business logic functions (waterfall, card picker, reward routing) get unit tests — no DB, no HTTP.
- API endpoints get integration tests against a real test database.
- No mocking the database.

## Adding a New Module

1. Add a route in `frontend/src/App.tsx`
2. Add a nav entry in `frontend/src/shell/Nav.tsx`
3. Create `frontend/src/modules/<name>/index.tsx`
4. Create `backend/app/modules/<name>/` with `__init__.py`, `routes.py`, `models.py`, `schemas.py`
5. Register the router in `backend/main.py`
