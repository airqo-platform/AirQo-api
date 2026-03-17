from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, ConfigDict

class CategoryBase(BaseModel):
    level: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=100)
    field1: Optional[str] = Field(None, max_length=100)
    field2: Optional[str] = Field(None, max_length=100)
    field3: Optional[str] = Field(None, max_length=100)
    field4: Optional[str] = Field(None, max_length=100)
    field5: Optional[str] = Field(None, max_length=100)
    field6: Optional[str] = Field(None, max_length=100)
    field7: Optional[str] = Field(None, max_length=100)
    field8: Optional[str] = Field(None, max_length=100)
    field9: Optional[str] = Field(None, max_length=100)
    field10: Optional[str] = Field(None, max_length=100)
    field11: Optional[str] = Field(None, max_length=100)
    field12: Optional[str] = Field(None, max_length=100)
    field13: Optional[str] = Field(None, max_length=100)
    field14: Optional[str] = Field(None, max_length=100)
    field15: Optional[str] = Field(None, max_length=100)
    metadata1: Optional[str] = Field(None, max_length=100)
    metadata2: Optional[str] = Field(None, max_length=100)
    metadata3: Optional[str] = Field(None, max_length=100)
    metadata4: Optional[str] = Field(None, max_length=100)
    metadata5: Optional[str] = Field(None, max_length=100)
    metadata6: Optional[str] = Field(None, max_length=100)
    metadata7: Optional[str] = Field(None, max_length=100)
    metadata8: Optional[str] = Field(None, max_length=100)
    metadata9: Optional[str] = Field(None, max_length=100)
    metadata10: Optional[str] = Field(None, max_length=100)
    metadata11: Optional[str] = Field(None, max_length=100)
    metadata12: Optional[str] = Field(None, max_length=100)
    metadata13: Optional[str] = Field(None, max_length=100)
    metadata14: Optional[str] = Field(None, max_length=100)
    metadata15: Optional[str] = Field(None, max_length=100)
    config1: Optional[str] = Field(None, max_length=100)
    config2: Optional[str] = Field(None, max_length=100)
    config3: Optional[str] = Field(None, max_length=100)
    config4: Optional[str] = Field(None, max_length=100)
    config5: Optional[str] = Field(None, max_length=100)
    config6: Optional[str] = Field(None, max_length=100)
    config7: Optional[str] = Field(None, max_length=100)
    config8: Optional[str] = Field(None, max_length=100)
    config9: Optional[str] = Field(None, max_length=100)
    config10: Optional[str] = Field(None, max_length=100)

class CategoryCreate(CategoryBase):
    name: str = Field(..., max_length=100)

class CategoryUpdate(CategoryBase):
    pass

class CategoryRead(CategoryBase):
    name: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CategoryResponse(BaseModel):
    categories: List[CategoryRead]
    total: int
    page: int
    page_size: int
    has_next: bool
