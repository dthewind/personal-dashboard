# Drop all budget tables and recreate them from the current models.
# Run: python reset_db.py
from app.core.database import engine, Base
from app.modules.budget import models  # noqa: F401 — registers all ORM classes

print("Dropping all tables...")
Base.metadata.drop_all(bind=engine)
print("Recreating tables from models...")
Base.metadata.create_all(bind=engine)
print("Done. Database is clean and ready.")
