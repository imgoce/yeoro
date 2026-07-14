from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.theme import place_theme_association

if TYPE_CHECKING:
    from app.models.course_place import CoursePlace
    from app.models.region import Region
    from app.models.theme import Theme
    from app.models.travel_log import TravelLog


class Place(TimestampMixin, Base):
    __tablename__ = "places"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), nullable=False)
    address: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    opening_hours: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact: Mapped[str | None] = mapped_column(String(50), nullable=True)
    region_id: Mapped[int] = mapped_column(ForeignKey("regions.id"), nullable=False)

    region: Mapped["Region"] = relationship(back_populates="places")
    themes: Mapped[list["Theme"]] = relationship(
        secondary=place_theme_association,
        back_populates="places",
    )
    course_places: Mapped[list["CoursePlace"]] = relationship(back_populates="place")
    travel_logs: Mapped[list["TravelLog"]] = relationship()
