import logging
import asyncio
from fastapi import FastAPI
from contextlib import asynccontextmanager

from . import redis as app_redis
from .redis import connect_redis, close_redis

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_redis()

    for i in range(3):
        try:
            logger.info("Trying to ping redis")
            await app_redis.redis.ping()
            logger.info("Pinged redis")
            break
        except Exception as e:
            logger.error("Failed to ping redis", exc_info=e)
            if i == 2:
                raise
            await asyncio.sleep(1)

    yield

    await close_redis()


app = FastAPI(
    title="proj-lu-mi-api",
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/redis-test")
async def redis_test():
    await app_redis.redis.set("ping", "pong")
    value = await app_redis.redis.get("ping")
    return {"redis": value}
