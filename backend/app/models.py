from datetime import datetime, date
from typing import Optional
from enum import Enum
from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    username: str = Field(index=True, unique=True)
    password: str


class ResolutionStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"


class Resolution(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    title: str = Field(max_length=20)
    description: str
    target_date: date
    status: ResolutionStatus = Field(default=ResolutionStatus.PENDING)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")


class ResolutionCreate(SQLModel):
    title: str
    description: str
    target_date: date = Field(alias="targetDate")
    status: Optional[ResolutionStatus] = None


class ResolutionUpdate(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    target_date: Optional[date] = Field(default=None, alias="targetDate")
    status: Optional[ResolutionStatus] = None
