from typing import TYPE_CHECKING

from sqlalchemy import String, Table, Column, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.place import Place


place_theme_association = Table(
    "place_themes",
    Base.metadata,
    Column("place_id", ForeignKey("places.id"), primary_key=True),
    Column("theme_id", ForeignKey("themes.id"), primary_key=True),
)


course_theme_association = Table(
    "course_themes",
    Base.metadata,
    Column("course_id", ForeignKey("courses.id"), primary_key=True),
    Column("theme_id", ForeignKey("themes.id"), primary_key=True),
)


class Theme(TimestampMixin, Base):
    __tablename__ = "themes"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)

    places: Mapped[list["Place"]] = relationship(
        secondary=place_theme_association,
        back_populates="themes",
    )
    courses: Mapped[list["Course"]] = relationship(
        secondary=course_theme_association,
        back_populates="themes",
    )
