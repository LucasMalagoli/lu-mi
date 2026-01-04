import logging
import asyncio
import smtplib
from email.message import EmailMessage
from datetime import datetime, date
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from jose import jwt, JWTError
from contextlib import asynccontextmanager
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlmodel import select, func, or_, desc, asc, case
from pydantic import BaseModel

from app.auth import authenticate_user, create_access_token, SECRET_KEY, ALGORITHM
from .models import (
    User, Resolution, ResolutionCreate, ResolutionUpdate,
    FinancialRecord, FinancialRecordCreate, FinancialRecordUpdate,
    FinancialRecordRead, Category, CategoryRead, TransactionType,
    FinancialRecordStatus, FinancialRecordCategoryLink
)
from .database import init_db, get_session, engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SMTP_EMAIL_FROM = "mpslucas14@gmail.com"
SMTP_EMAIL_TO = "kleinmilena@live.com"
SMTP_PASSWORD = "bpsklyfjtbhqhgjv"
SMTP_SERVER = "smtp.gmail.com"
SMTP_PORT = 587


def send_email_alert(payload: str):
    msg = EmailMessage()
    msg.set_content(f"New database connection detected:\n\n{payload}")
    msg["Subject"] = "New Database Connection Alert"
    msg["From"] = SMTP_EMAIL_FROM
    msg["To"] = SMTP_EMAIL_TO

    try:
        logger.info("Trying to send email alert...")
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.send_message(msg)
            logger.info("Email alert sent successfully")
    except Exception as e:
        logger.error(f"Failed to send email alert: {e}")


async def monitor_database_connections():
    """
    Background task to monitor DB connections.
    It listens for 'new_connection' notifications and periodically triggers the check.
    """
    while True:
        try:
            async with engine.connect() as conn:
                raw_conn = await conn.get_raw_connection()
                driver_conn = raw_conn.driver_connection
                loop = asyncio.get_running_loop()

                def on_notify(conn, pid, channel, payload):
                    logger.info(f"New DB Connection detected: {payload}")
                    loop.run_in_executor(None, send_email_alert, payload)

                await driver_conn.add_listener("new_connection", on_notify)
                logger.info("Started monitoring database connections...")

                while True:
                    await conn.execute(text("SELECT notify_new_connections()"))
                    await conn.commit()
                    await asyncio.sleep(60)
        except asyncio.CancelledError:
            logger.info("Stopping database connection monitor...")
            break
        except Exception as e:
            logger.error(f"Error in database connection monitor: {e}")
            await asyncio.sleep(60)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    monitor_task = asyncio.create_task(monitor_database_connections())
    yield
    monitor_task.cancel()
    try:
        await monitor_task
    except asyncio.CancelledError:
        pass


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
            category = Category(name=cat_name, user_id=user.id)
            session.add(category)
            await session.commit()
            await session.refresh(category)
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
                    category = Category(name=cat_name, user_id=user.id)
                    session.add(category)
                    await session.commit()
                    await session.refresh(category)
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
