from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin
from app.models.theme import course_theme_association

if TYPE_CHECKING:
    from app.models.course_place import CoursePlace
    from app.models.theme import Theme
    from app.models.user import User


class Course(TimestampMixin, Base):
    __tablename__ = "courses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)
    difficulty_level: Mapped[str | None] = mapped_column(String(50), nullable=True)
    creator_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    creator: Mapped["User | None"] = relationship(back_populates="courses")
    themes: Mapped[list["Theme"]] = relationship(
        secondary=course_theme_association,
        back_populates="courses",
    )
    course_places: Mapped[list["CoursePlace"]] = relationship(
        back_populates="course",
        cascade="all, delete-orphan",
    )
