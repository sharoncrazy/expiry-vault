from datetime import date, datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class ReminderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    expiry_date: date
    cost: Decimal | None = None


class ReminderOut(BaseModel):
    id: int
    name: str
    expiry_date: date
    cost: Decimal | None
    created_at: datetime

    model_config = {"from_attributes": True}