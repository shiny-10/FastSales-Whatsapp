import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base


def _load_env_file() -> None:
	"""Load environment variables from the backend .env file when present."""
	env_path = Path(__file__).resolve().parents[1] / ".env"
	if not env_path.exists():
		return

	for line in env_path.read_text().splitlines():
		line = line.strip()
		if not line or line.startswith("#") or "=" not in line:
			continue

		key, value = line.split("=", 1)
		key = key.strip()
		value = value.strip().strip('"').strip("'")
		os.environ.setdefault(key, value)


_load_env_file()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
	raise RuntimeError("DATABASE_URL is not set. Add it to backend/.env")

# Increase pool size to reduce connection timeouts under concurrent load
# Adjust these values if you have many concurrent requests or background jobs
engine = create_engine(
	DATABASE_URL,
	# Increased pool size to handle background jobs + concurrent requests
	pool_size=20,
	max_overflow=40,
	pool_timeout=30,
)

