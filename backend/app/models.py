from datetime import datetime, date
from typing import Optional, List
from enum import Enum
from sqlmodel import Field, SQLModel, Relationship
from sqlalchemy import UniqueConstraint


class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    username: str = Field(index=True, unique=True)
    password: str


class FinancialRecordCategoryLink(SQLModel, table=True):
    financial_record_id: Optional[int] = Field(default=None, foreign_key="financialrecord.id", primary_key=True)
    category_id: Optional[int] = Field(default=None, foreign_key="category.id", primary_key=True)


class FinancialRecordStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"


class ResolutionStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"


class TransactionType(str, Enum):
    INCOME = "income"
    EXPENSE = "expense"


class Category(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("name", "user_id", name="unique_category_user"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
    
    records: List["FinancialRecord"] = Relationship(back_populates="categories", link_model=FinancialRecordCategoryLink)


class CategoryBudget(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("category_id", "user_id", "month", name="unique_category_budget_month"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    category_id: int = Field(foreign_key="category.id")
    user_id: int = Field(foreign_key="user.id")
    month: date
    planned_value: float

class CategoryCreate(SQLModel):
    name: str


class CategoryRead(SQLModel):
    id: int
    name: str
    user_id: int


class FinancialRecord(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    title: str = Field(max_length=50)
    description: Optional[str] = Field(default=None)
    value: float
    type: TransactionType
    bill_date: date
    status: FinancialRecordStatus = Field(default=FinancialRecordStatus.PENDING)
    categories: List[Category] = Relationship(back_populates="records", link_model=FinancialRecordCategoryLink)
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")


class FinancialRecordRead(SQLModel):
    id: int
    created_at: datetime
    updated_at: datetime
    title: str
    description: Optional[str]
    value: float
    type: TransactionType
    bill_date: date
    status: FinancialRecordStatus
    categories: List[CategoryRead]
    user_id: int


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


class FinancialRecordCreate(SQLModel):
    title: str
    description: Optional[str] = None
    value: float
    type: TransactionType
    bill_date: date = Field(alias="billDate")
    category_names: List[str] = Field(default_factory=list, alias="categoryNames")
    status: FinancialRecordStatus = Field(default=FinancialRecordStatus.PENDING)


class FinancialRecordUpdate(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    value: Optional[float] = None
    type: Optional[TransactionType] = None
    bill_date: Optional[date] = Field(default=None, alias="billDate")
    category_names: Optional[List[str]] = Field(default=None, alias="categoryNames")
    status: Optional[FinancialRecordStatus] = None

class ResolutionUpdate(SQLModel):
    title: Optional[str] = None
    description: Optional[str] = None
    target_date: Optional[date] = Field(default=None, alias="targetDate")
    status: Optional[ResolutionStatus] = None

class CategoryBudgetCreate(SQLModel):
    category_id: int
    month: date
    planned_value: float
