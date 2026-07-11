from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from app.api.core.config import settings
from app.db.base import Base

# SQLite doesn't support pool_size/max_overflow; only pass for PostgreSQL
engine_kwargs = {
    "echo": settings.DEBUG,
    "future": True,
}
if "postgresql" in settings.DATABASE_URL:
    engine_kwargs.update({
        "pool_size": settings.DATABASE_POOL_SIZE,
        "max_overflow": settings.DATABASE_MAX_OVERFLOW,
    })

engine = create_async_engine(settings.DATABASE_URL, **engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_database_tables() -> None:
    """Create missing tables for the current SQLAlchemy metadata."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
