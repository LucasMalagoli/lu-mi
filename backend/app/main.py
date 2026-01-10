import logging
import calendar
from datetime import datetime, date
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt, JWTError
from contextlib import asynccontextmanager
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select, func, or_, desc, asc, case
from pydantic import BaseModel

from app.auth import authenticate_user, create_access_token, SECRET_KEY, ALGORITHM
from .models import (
    User, Resolution, ResolutionCreate, ResolutionUpdate,
    FinancialRecord, FinancialRecordCreate, FinancialRecordUpdate,
    FinancialRecordRead, Category, CategoryRead, TransactionType,
    FinancialRecordStatus, FinancialRecordCategoryLink,
    CategoryBudget, CategoryBudgetCreate, CategoryCreate
)
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
    user_dict = user.model_dump()
    user_dict.pop("password")
    return {"access_token": token, "token_type": "bearer", "user": user_dict}


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


async def get_current_user_obj(
    username: str = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> User:
    statement = select(User).where(User.username == username)
    result = await session.execute(statement)
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@app.post("/resolutions", response_model=Resolution, status_code=201)
async def create_resolution(
    resolution_data: ResolutionCreate,
    user: User = Depends(get_current_user_obj),
    session: AsyncSession = Depends(get_session),
):
    new_resolution = Resolution(
        title=resolution_data.title,
        description=resolution_data.description,
        target_date=resolution_data.target_date,
        user_id=user.id,
    )
    session.add(new_resolution)
    await session.commit()
    await session.refresh(new_resolution)
    return new_resolution


@app.get("/resolutions", response_model=list[Resolution])
async def get_resolutions(
    user: User = Depends(get_current_user_obj),
    session: AsyncSession = Depends(get_session),
):
    statement = select(Resolution).where(Resolution.user_id == user.id)
    result = await session.execute(statement)
    return result.scalars().all()


@app.get("/resolutions/{resolution_id}", response_model=Resolution)
async def get_resolution(
    resolution_id: int,
    user: User = Depends(get_current_user_obj),
    session: AsyncSession = Depends(get_session),
):
    statement = select(Resolution).where(
        Resolution.id == resolution_id, Resolution.user_id == user.id
    )
    result = await session.execute(statement)
    resolution = result.scalars().first()
    if not resolution:
        raise HTTPException(status_code=404, detail="Resolution not found")
    return resolution


@app.patch("/resolutions/{resolution_id}", response_model=Resolution)
async def update_resolution(
    resolution_id: int,
    resolution_update: ResolutionUpdate,
    user: User = Depends(get_current_user_obj),
    session: AsyncSession = Depends(get_session),
):
    statement = select(Resolution).where(
        Resolution.id == resolution_id, Resolution.user_id == user.id
    )
    result = await session.execute(statement)
    resolution = result.scalars().first()
    if not resolution:
        raise HTTPException(status_code=404, detail="Resolution not found")

    resolution_data = resolution_update.model_dump(exclude_unset=True)
    for key, value in resolution_data.items():
        setattr(resolution, key, value)

    resolution.updated_at = datetime.now()
    session.add(resolution)
    await session.commit()
    await session.refresh(resolution)
    return resolution


@app.delete("/resolutions/{resolution_id}")
async def delete_resolution(
    resolution_id: int,
    user: User = Depends(get_current_user_obj),
    session: AsyncSession = Depends(get_session),
):
    statement = select(Resolution).where(
        Resolution.id == resolution_id, Resolution.user_id == user.id
    )
    result = await session.execute(statement)
    resolution = result.scalars().first()
    if not resolution:
        raise HTTPException(status_code=404, detail="Resolution not found")

    await session.delete(resolution)
    await session.commit()
    return {"message": "Resolution deleted successfully"}


@app.post("/financial-records", response_model=FinancialRecordRead, status_code=201)
async def create_financial_record(
    record_data: FinancialRecordCreate,
    user: User = Depends(get_current_user_obj),
    session: AsyncSession = Depends(get_session),
):
    categories = []
    for cat_name in record_data.category_names:
        statement = select(Category).where(Category.name == cat_name, Category.user_id == user.id)
        result = await session.execute(statement)
        category = result.scalars().first()
        
        if not category:
            try:
                category = Category(name=cat_name, user_id=user.id)
                session.add(category)
                await session.commit()
                await session.refresh(category)
            except IntegrityError:
                await session.rollback()
                statement = select(Category).where(Category.name == cat_name, Category.user_id == user.id)
                result = await session.execute(statement)
                category = result.scalars().first()
                if not category:
                    raise HTTPException(status_code=500, detail="Failed to create or retrieve category")
        categories.append(category)
    
    new_record = FinancialRecord(
        title=record_data.title,
        description=record_data.description,
        value=record_data.value,
        type=record_data.type,
        bill_date=record_data.bill_date,
        status=record_data.status,
        user_id=user.id,
        categories=categories
    )
    session.add(new_record)
    await session.commit()
    await session.refresh(new_record)
    
    # Re-fetch to ensure relationships are loaded for response
    stmt = select(FinancialRecord).where(FinancialRecord.id == new_record.id).options(selectinload(FinancialRecord.categories))
    result = await session.execute(stmt)
    return result.scalars().first()


class FinancialRecordsResponse(BaseModel):
    items: list[FinancialRecordRead]
    total: int
    total_income: float
    total_expense: float


@app.get("/financial-records", response_model=FinancialRecordsResponse)
async def get_financial_records(
    user: User = Depends(get_current_user_obj),
    session: AsyncSession = Depends(get_session),
    skip: int = 0,
    limit: int = 100,
    type: Optional[TransactionType] = None,
    category_ids: Optional[list[int]] = Query(None, alias="category_ids"),
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    search: Optional[str] = None,
    sort_by: str = "billDate",
):
    query = select(FinancialRecord).where(FinancialRecord.user_id == user.id)

    # Filters
    if type:
        query = query.where(FinancialRecord.type == type)
    if category_ids:
        query = query.where(FinancialRecord.categories.any(Category.id.in_(category_ids)))
    if start_date:
        query = query.where(FinancialRecord.bill_date >= start_date)
    if end_date:
        query = query.where(FinancialRecord.bill_date <= end_date)
    if search:
        search_filter = or_(
            FinancialRecord.title.ilike(f"%{search}%"),
            FinancialRecord.description.ilike(f"%{search}%")
        )
        query = query.where(search_filter)

    # Calculate totals before pagination
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await session.execute(count_query)
    total = total_result.scalar_one()

    # Calculate sums
    # We need to execute the query to get sums. 
    # A more efficient way in SQL would be aggregation, but reusing the filtered query is safer for consistency.
    # Let's use a separate aggregation query based on the same filters.
    income_query = query.where(FinancialRecord.type == TransactionType.INCOME).with_only_columns(func.sum(FinancialRecord.value))
    expense_query = query.where(FinancialRecord.type == TransactionType.EXPENSE).with_only_columns(func.sum(FinancialRecord.value))
    
    income_result = await session.execute(income_query)
    expense_result = await session.execute(expense_query)
    
    total_income = income_result.scalar_one() or 0.0
    total_expense = expense_result.scalar_one() or 0.0

    # Sorting
    if sort_by == "value":
        # Sort by signed value (Income positive, Expense negative)
        signed_value = case((FinancialRecord.type == TransactionType.INCOME, FinancialRecord.value), else_=-FinancialRecord.value)
        query = query.order_by(desc(signed_value))
    elif sort_by == "created":
        query = query.order_by(desc(FinancialRecord.created_at))
    else: # billDate
        query = query.order_by(asc(FinancialRecord.bill_date))

    # Pagination
    query = query.offset(skip).limit(limit)
    
    # Eager load categories
    query = query.options(selectinload(FinancialRecord.categories))
    
    result = await session.execute(query)
    items = result.scalars().all()

    return {
        "items": items,
        "total": total,
        "total_income": total_income,
        "total_expense": total_expense
    }


@app.delete("/financial-records/{record_id}")
async def delete_financial_record(
    record_id: int,
    user: User = Depends(get_current_user_obj),
    session: AsyncSession = Depends(get_session),
):
    statement = select(FinancialRecord).where(FinancialRecord.id == record_id, FinancialRecord.user_id == user.id)
    result = await session.execute(statement)
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    await session.delete(record)
    await session.commit()
    return {"message": "Record deleted successfully"}


@app.patch("/financial-records/{record_id}", response_model=FinancialRecordRead)
async def update_financial_record(
    record_id: int,
    record_update: FinancialRecordUpdate,
    user: User = Depends(get_current_user_obj),
    session: AsyncSession = Depends(get_session),
):
    statement = select(FinancialRecord).where(FinancialRecord.id == record_id, FinancialRecord.user_id == user.id).options(selectinload(FinancialRecord.categories))
    result = await session.execute(statement)
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    update_data = record_update.model_dump(exclude_unset=True)
    
    if "category_names" in update_data:
        cat_names = update_data.pop("category_names")
        new_categories = []
        if cat_names is not None:
            for cat_name in cat_names:
                cat_stmt = select(Category).where(Category.name == cat_name, Category.user_id == user.id)
                cat_result = await session.execute(cat_stmt)
                category = cat_result.scalars().first()
                
                if not category:
                    try:
                        category = Category(name=cat_name, user_id=user.id)
                        session.add(category)
                        await session.commit()
                        await session.refresh(category)
                    except IntegrityError:
                        await session.rollback()
                        cat_stmt = select(Category).where(Category.name == cat_name, Category.user_id == user.id)
                        cat_result = await session.execute(cat_stmt)
                        category = cat_result.scalars().first()
                        if not category:
                            raise HTTPException(status_code=500, detail="Failed to create or retrieve category")
                new_categories.append(category)
            record.categories = new_categories

    for key, value in update_data.items():
        setattr(record, key, value)

    record.updated_at = datetime.now()
    session.add(record)
    await session.commit()
    await session.refresh(record)
    return record


@app.get("/categories", response_model=list[CategoryRead])
async def get_categories(
    user: User = Depends(get_current_user_obj),
    session: AsyncSession = Depends(get_session),
):
    statement = (
        select(Category)
        .outerjoin(FinancialRecordCategoryLink, Category.id == FinancialRecordCategoryLink.category_id)
        .where(Category.user_id == user.id)
        .group_by(Category.id)
        .order_by(desc(func.count(FinancialRecordCategoryLink.financial_record_id)), Category.name)
    )
    result = await session.execute(statement)
    return result.scalars().all()


@app.delete("/categories/{category_id}")
async def delete_category(
    category_id: int,
    user: User = Depends(get_current_user_obj),
    session: AsyncSession = Depends(get_session),
):
    statement = select(Category).where(Category.id == category_id, Category.user_id == user.id)
    result = await session.execute(statement)
    category = result.scalars().first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    # Remove category from all records (M2M link)
    # We need to fetch records that have this category and remove it from their list
    # However, deleting the category should cascade to the link table if configured, 
    # or we can rely on SQLModel/SQLAlchemy default behavior for M2M deletion.
    # Since we are deleting the Category object, the links in FinancialRecordCategoryLink should be removed.
    
    await session.delete(category)
    await session.commit()
    return {"message": "Category deleted successfully"}


@app.post("/budgets", response_model=CategoryBudget)
async def set_category_budget(
    budget_data: CategoryBudgetCreate,
    user: User = Depends(get_current_user_obj),
    session: AsyncSession = Depends(get_session),
):
    # Normalize month to 1st day
    normalized_month = budget_data.month.replace(day=1)
    
    statement = select(CategoryBudget).where(
        CategoryBudget.category_id == budget_data.category_id,
        CategoryBudget.user_id == user.id,
        CategoryBudget.month == normalized_month
    )
    result = await session.execute(statement)
    budget = result.scalars().first()
    
    if budget:
        budget.planned_value = budget_data.planned_value
    else:
        budget = CategoryBudget(
            category_id=budget_data.category_id,
            user_id=user.id,
            month=normalized_month,
            planned_value=budget_data.planned_value
        )
        session.add(budget)
    
    await session.commit()
    await session.refresh(budget)
    return budget


class BudgetSummaryItem(BaseModel):
    category_id: int
    category_name: str
    planned: float
    confirmed: float
    expected: float


@app.get("/budgets/summary", response_model=list[BudgetSummaryItem])
async def get_budget_summary(
    month: date,
    user: User = Depends(get_current_user_obj),
    session: AsyncSession = Depends(get_session),
):
    start_date = month.replace(day=1)
    last_day = calendar.monthrange(start_date.year, start_date.month)[1]
    end_date = start_date.replace(day=last_day)
    
    cat_stmt = select(Category).where(Category.user_id == user.id)
    cat_result = await session.execute(cat_stmt)
    categories = cat_result.scalars().all()
    
    bud_stmt = select(CategoryBudget).where(
        CategoryBudget.user_id == user.id,
        CategoryBudget.month == start_date
    )
    bud_result = await session.execute(bud_stmt)
    budgets = {b.category_id: b.planned_value for b in bud_result.scalars().all()}
    
    rec_stmt = select(FinancialRecord).where(
        FinancialRecord.user_id == user.id,
        FinancialRecord.bill_date >= start_date,
        FinancialRecord.bill_date <= end_date
    ).options(selectinload(FinancialRecord.categories))
    rec_result = await session.execute(rec_stmt)
    records = rec_result.scalars().all()
    
    cat_stats = {c.id: {"confirmed": 0.0, "expected": 0.0} for c in categories}
    for record in records:
        val = -record.value if record.type == TransactionType.EXPENSE else record.value
        is_confirmed = record.status == FinancialRecordStatus.COMPLETED
        for cat in record.categories:
            if cat.id in cat_stats:
                if is_confirmed:
                    cat_stats[cat.id]["confirmed"] += val
                cat_stats[cat.id]["expected"] += val
                
    return [
        {
            "category_id": cat.id,
            "category_name": cat.name,
            "planned": budgets.get(cat.id, 0.0),
            "confirmed": cat_stats[cat.id]["confirmed"],
            "expected": cat_stats[cat.id]["expected"]
        }
        for cat in categories
    ]


@app.post("/categories", response_model=CategoryRead)
async def create_category(
    category_data: CategoryCreate,
    user: User = Depends(get_current_user_obj),
    session: AsyncSession = Depends(get_session),
):
    statement = select(Category).where(Category.name == category_data.name, Category.user_id == user.id)
    result = await session.execute(statement)
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Category already exists")
    
    category = Category(name=category_data.name, user_id=user.id)
    session.add(category)
    try:
        await session.commit()
        await session.refresh(category)
    except IntegrityError:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Category already exists")
    return category


class CopyBudgetRequest(BaseModel):
    source_month: date
    target_month: date
    category_id: Optional[int] = None


@app.post("/budgets/copy")
async def copy_budgets(
    data: CopyBudgetRequest,
    user: User = Depends(get_current_user_obj),
    session: AsyncSession = Depends(get_session),
):
    source_date = data.source_month.replace(day=1)
    target_date = data.target_month.replace(day=1)
    
    query = select(CategoryBudget).where(
        CategoryBudget.user_id == user.id,
        CategoryBudget.month == source_date
    )
    if data.category_id:
        query = query.where(CategoryBudget.category_id == data.category_id)
        
    result = await session.execute(query)
    source_budgets = result.scalars().all()
    
    copied_count = 0
    for src in source_budgets:
        stmt = select(CategoryBudget).where(
            CategoryBudget.user_id == user.id,
            CategoryBudget.category_id == src.category_id,
            CategoryBudget.month == target_date
        )
        existing = (await session.execute(stmt)).scalars().first()
        
        if existing:
            existing.planned_value = src.planned_value
        else:
            new_budget = CategoryBudget(
                category_id=src.category_id,
                user_id=user.id,
                month=target_date,
                planned_value=src.planned_value
            )
            session.add(new_budget)
        copied_count += 1
        
    await session.commit()
    return {"message": f"Copied {copied_count} budgets"}
