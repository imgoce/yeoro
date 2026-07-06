from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

if TYPE_CHECKING:
    from app.models.course import Course
    from app.models.place import Place


class CoursePlace(Base):
    __tablename__ = "course_places"
    __table_args__ = (UniqueConstraint("course_id", "sequence", name="uq_course_place_sequence"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"), nullable=False)
    place_id: Mapped[int] = mapped_column(ForeignKey("places.id"), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    stay_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)

    course: Mapped["Course"] = relationship(back_populates="course_places")
    place: Mapped["Place"] = relationship(back_populates="course_places")
