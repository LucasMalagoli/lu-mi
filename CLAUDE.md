# lu-mi — Project Guide

Personal finance + resolutions app. Portuguese UI throughout.

## Stack

| Layer | Tech |
|---|---|
| Backend | FastAPI, SQLModel, AsyncSession (asyncpg), python-jose, PostgreSQL |
| Frontend | React 19, TypeScript, Vite, Tailwind v4, React Router v7 |
| Infra | Docker Compose (postgres + backend + frontend/nginx) |
| Package manager | pnpm (frontend) |

---

## Backend (`backend/`)

### Structure
All routes live in a single `app/main.py`. No route splitting — keep adding endpoints there.

```
backend/app/
  main.py      # all FastAPI routes
  models.py    # SQLModel table + schema classes
  auth.py      # JWT helpers, password verify
  config.py    # pydantic-settings (ASYNC_DATABASE_URL from .env)
  database.py  # engine, get_session, init_db
```

### Models pattern
- Table models use `SQLModel, table=True` with `Optional[int]` primary keys
- Schema models (Create/Update/Read) are plain `SQLModel` subclasses
- Many-to-many via explicit link model (`FinancialRecordCategoryLink`)
- Unique constraints via `__table_args__ = (UniqueConstraint(...),)`
- Aliases on Create/Update fields map camelCase JSON → snake_case Python: `Field(alias="billDate")`

### Session & auth dependencies
```python
# Session
async def get_session() -> AsyncGenerator[AsyncSession, None]: ...

# Username from JWT
def get_current_user(token: str = Depends(oauth2_scheme)) -> str: ...

# Full User ORM object
async def get_current_user_obj(username, session) -> User: ...
```

Always scope DB queries to `user.id` — no resource belongs across users.

### Eager loading
Use `selectinload` when returning models with relationships:
```python
stmt = select(FinancialRecord).options(selectinload(FinancialRecord.categories))
```

### IntegrityError handling
Categories can be created concurrently; catch `IntegrityError`, rollback, then re-fetch:
```python
try:
    session.add(category); await session.commit()
except IntegrityError:
    await session.rollback()
    # re-select the already-existing row
```

### Running locally
```bash
# requires .env with ASYNC_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/app_db
cd backend
uvicorn app.main:app --reload
```

---

## Frontend (`frontend/`)

### Structure
```
src/
  app/router.tsx          # route tree (AppLayout > ProtectedRoute > pages)
  components/layout/      # AppLayout.tsx wraps every route
  components/             # shared UI components
  context/                # NotificationContext
  lib/auth.ts             # isAuthenticated() helper
  pages/                  # one file per page, all logic self-contained
  config.ts               # API_URL resolution
```

### Routing
- `AppLayout` wraps all routes (layout shell)
- `ProtectedRoute` wraps authenticated pages; redirects to `/login` if no token
- Routes in Portuguese paths: `/resolucoes`, `/orcamento`, `/financeiro`, `/configuracoes`

### API calls
All calls are raw `fetch` — no axios or query library.

```ts
const token = localStorage.getItem("access_token")
const res = await fetch(`${config.API_URL}/some-endpoint`, {
  headers: { "Authorization": `Bearer ${token}` }
})
```

`config.API_URL` resolves from `window._env_?.VITE_API_URL` → `import.meta.env.VITE_API_URL` → `http://localhost:8000`.

### Request JSON casing
- Send camelCase keys: `billDate`, `categoryNames`, `targetDate`
- Receive snake_case keys: `bill_date`, `category_names`

### Notifications
```ts
const { notify } = useNotify()
notify("Mensagem de sucesso!", "success")   // "info" | "success" | "error"
```
Max 3 visible at once; older ones are evicted automatically.

### State management
No external store. Each page owns its state with `useState`/`useEffect`. Interfaces are defined locally per page — no shared types folder.

### UI conventions
- **Color palette**: `bg-slate-950` (page bg), `bg-slate-900` (cards), `bg-slate-800` (hover), `border-slate-800`
- **Action buttons**: `bg-blue-600 hover:bg-blue-700`
- **Income**: green-400/green-500; **Expense**: red-400/red-500
- **Modals**: `fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50`
- **Loading spinner**: `animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500`
- All user-facing text is Portuguese

### LocalStorage keys
| Key | Purpose |
|---|---|
| `access_token` | JWT bearer token |
| `budget_hidden_categories` | JSON array of hidden category IDs |

### Currency formatting
```ts
new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
```

### Running locally
```bash
cd frontend
pnpm install
pnpm dev      # http://localhost:5173
```

---

## Docker
```bash
docker compose up --build   # postgres + backend (8000) + frontend (3000)
```

Backend reads `./backend/.env` for `ASYNC_DATABASE_URL`. Frontend nginx proxies to backend via `window._env_` injected by `env.sh`.
