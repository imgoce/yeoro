from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.place import Place
    from app.models.user import User


class Review(TimestampMixin, Base):
    __tablename__ = "reviews"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    place_id: Mapped[int] = mapped_column(ForeignKey("places.id"), nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    visit_season: Mapped[str | None] = mapped_column(String(30), nullable=True)

    user: Mapped["User"] = relationship(back_populates="reviews")
    place: Mapped["Place"] = relationship()