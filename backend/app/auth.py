from datetime import datetime, timedelta
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from .models import User

SECRET_KEY = "super-secret-change-me"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain, hashed):
    # return pwd_context.verify(plain, hashed)
    return plain == hashed


async def authenticate_user(session: AsyncSession, username: str, password: str):
    statement = select(User).where(User.username == username)
    result = await session.execute(statement)
    user = result.scalars().first()

    if not user:
        return None
    if not verify_password(password, user.password):
        return None
    return user


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
