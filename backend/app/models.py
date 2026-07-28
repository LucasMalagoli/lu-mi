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


# ── Buscar Vagas ────────────────────────────────────────────────────────────────

class Company(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    created_at: datetime = Field(default_factory=datetime.now)
    gupy_slug: Optional[str] = None
    gupy_confirmed_at: Optional[datetime] = None
    inhire_slug: Optional[str] = None
    inhire_confirmed_at: Optional[datetime] = None


class CompanyCreate(SQLModel):
    name: str


class CompanyRead(SQLModel):
    id: int
    name: str
    gupy_slug: Optional[str]
    gupy_confirmed_at: Optional[datetime]
    inhire_slug: Optional[str]
    inhire_confirmed_at: Optional[datetime]
    interesse: bool = False


class UserCompanyInterest(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("user_id", "company_id", name="unique_user_company_interest"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    company_id: int = Field(foreign_key="company.id")
    created_at: datetime = Field(default_factory=datetime.now)


class SearchHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="user.id")
    terms: str  # JSON-encoded list[str]
    terms_signature: str = Field(index=True)
    company_ids: str  # JSON-encoded list[int]
    status: str = Field(default="running")  # running | done
    total: int = 0
    completed: int = 0
    created_at: datetime = Field(default_factory=datetime.now)


class SearchCache(SQLModel, table=True):
    """Tracks the last time a (company, platform, terms) combination was actually
    fetched live, independent of how many jobs it returned — a plain JobListing
    lookup can't tell "fresh, zero results" apart from "never fetched"."""
    __table_args__ = (UniqueConstraint("company_id", "platform", "terms_signature", name="unique_search_cache_entry"),)
    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: int = Field(foreign_key="company.id")
    platform: str  # gupy | inhire
    terms_signature: str = Field(index=True)
    last_search_id: int = Field(foreign_key="searchhistory.id")
    fetched_at: datetime = Field(default_factory=datetime.now)


class SearchHistoryRead(SQLModel):
    id: int
    terms: List[str]
    status: str
    total: int
    completed: int
    created_at: datetime
    job_count: int = 0


class JobListing(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    search_id: int = Field(foreign_key="searchhistory.id")
    company_id: int = Field(foreign_key="company.id")
    platform: str  # gupy | inhire
    title: str
    url: str
    location: Optional[str] = None
    workplace_type: Optional[str] = None
    published_date: Optional[str] = None
    fetched_at: datetime = Field(default_factory=datetime.now)


class JobListingRead(SQLModel):
    id: int
    company_id: int
    company_name: str
    platform: str
    title: str
    url: str
    location: Optional[str]
    workplace_type: Optional[str]
    published_date: Optional[str]
    fetched_at: datetime


class SearchStatusRead(SQLModel):
    id: int
    status: str
    total: int
    completed: int
    jobs: List[JobListingRead]


class SearchRequest(SQLModel):
    terms: List[str]
    company_ids: List[int] = Field(alias="companyIds")


class SearchKickoffRead(SQLModel):
    search_id: int
    total: int


class SuggestTermsRequest(SQLModel):
    cargo: str


class SuggestTermsRead(SQLModel):
    terms: List[str]


class CronogramaDay(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    day_number: int = Field(index=True)
    week_number: int
    type: str  # study | sim | rev | noc | prova
    mat: str
    study_date: Optional[date] = None

    topics: List["CronogramaTopic"] = Relationship(back_populates="day")
    checks: List["CronogramaCheck"] = Relationship(back_populates="day")


class CronogramaTopic(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    day_id: int = Field(foreign_key="cronogramaday.id")
    label: str
    order: int = 0

    day: Optional[CronogramaDay] = Relationship(back_populates="topics")


class CronogramaCheck(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    day_id: int = Field(foreign_key="cronogramaday.id")
    key: str
    label: str
    color: Optional[str] = None
    is_checked: bool = False
    order: int = 0

    day: Optional[CronogramaDay] = Relationship(back_populates="checks")
