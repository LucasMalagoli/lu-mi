from redis.asyncio import Redis
from .config import settings

redis: Redis | None = None


async def connect_redis() -> None:
    global redis
    redis = Redis.from_url(
        settings.redis_url,
        decode_responses=True,
    )


async def close_redis() -> None:
    if redis:
        await redis.close()
