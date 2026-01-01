import logging

from fastapi import FastAPI, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt, JWTError
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select
from pydantic import BaseModel

from app.auth import authenticate_user, create_access_token, SECRET_KEY, ALGORITHM
from .models import User
from .database import init_db, get_session

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="proj-lu-mi-api",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/login")
async def login(form: OAuth2PasswordRequestForm = Depends(), session: AsyncSession = Depends(get_session)):
    user = await authenticate_user(session, form.username, form.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token({"sub": user.username})
    return {"access_token": token, "token_type": "bearer", "username": user.username}


class RegisterRequest(BaseModel):
    username: str
    password: str


@app.post("/register", status_code=201)
async def register(user_data: RegisterRequest, session: AsyncSession = Depends(get_session)):
    statement = select(User).where(User.username == user_data.username)
    result = await session.execute(statement)
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken")

    new_user = User(username=user_data.username, password=user_data.password)
    session.add(new_user)
    await session.commit()
    return {"message": "User created successfully"}


@app.get("/health")
async def health():
    return {"status": "ok"}


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401)
        return username
    except JWTError:
        raise HTTPException(status_code=401)


@app.get("/me")
def read_me(user: str = Depends(get_current_user)):
    return {"username": user}
