Quick dev run instructions

1. Create and activate Python virtualenv (Windows PowerShell)

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

2. Install Python dependencies

```powershell
venv\Scripts\python -m pip install -r requirements.txt
```

3. Start backend (use provided script to avoid typos)

```powershell
.\run_backend.ps1
```

4. Start frontend

```powershell
.\run_frontend.ps1
```

5. Database schema bootstrap

- The project now uses SQLAlchemy declarative models as the schema source of truth.
- Run the bootstrap script whenever you want to ensure the database schema matches the current models:

```powershell
# from project root
venv\Scripts\python -m database.schema_bootstrap
```

- The design reference is documented in [database/SCHEMA_DESIGN.md](database/SCHEMA_DESIGN.md).
- If you still use Alembic in a sub-project, keep it isolated there; the main app now prefers the declarative bootstrap path.

6. Notes
- To test JWT-auth features, create a JWT containing `user_id` and `organization_id` and put it into `localStorage.jwt` in the browser console for local dev.
- For production, configure `config.JWT_SECRET` or `config.CRM_JWT_PUBLIC_KEY` and `config.CRM_JWT_ISSUER` as appropriate.
