from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class CartItemCreateRequest(BaseModel):
    place_id: int = Field(gt=0)


class CartPlaceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    category: str
    address: str
    summary: str | None
    latitude: Decimal | None
    longitude: Decimal | None


class CartItemResponse(BaseModel):
    id: int
    place: CartPlaceResponse


class CartEnvelope(BaseModel):
    items: list[CartItemResponse]
    total_count: int