from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "postgresql://postgres:nimisha123@localhost:5432/fastsales"

# Increase pool size to reduce connection timeouts under concurrent load
# Adjust these values if you have many concurrent requests or background jobs
engine = create_engine(
	DATABASE_URL,
	# Increased pool size to handle background jobs + concurrent requests
	pool_size=20,
	max_overflow=40,
	pool_timeout=30,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()