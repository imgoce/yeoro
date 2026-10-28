from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.place import Place
    from app.models.user import User


class Bookmark(TimestampMixin, Base):
    __tablename__ = "bookmarks"
    __table_args__ = (UniqueConstraint("user_id", "place_id", name="uq_user_place_bookmark"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    place_id: Mapped[int] = mapped_column(ForeignKey("places.id"), nullable=False)

    user: Mapped["User"] = relationship(back_populates="bookmarks")
    place: Mapped["Place"] = relationship()
