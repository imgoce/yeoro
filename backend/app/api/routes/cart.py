from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db
from app.models.cart_item import CartItem
from app.models.place import Place
from app.models.user import User
from app.schemas.cart import CartEnvelope, CartItemCreateRequest, CartItemResponse, CartPlaceResponse

router = APIRouter(prefix="/cart", tags=["cart"])


def serialize_cart_item(cart_item: CartItem) -> CartItemResponse:
    return CartItemResponse(
        id=cart_item.id,
        place=CartPlaceResponse.model_validate(cart_item.place),
    )


@router.get("", response_model=CartEnvelope)
def list_cart_items(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CartEnvelope:
    cart_items = db.scalars(
        select(CartItem)
        .options(joinedload(CartItem.place))
        .where(CartItem.user_id == current_user.id)
        .order_by(CartItem.created_at.asc())
    ).unique().all()
    items = [serialize_cart_item(cart_item) for cart_item in cart_items]
    return CartEnvelope(items=items, total_count=len(items))


@router.post("", response_model=CartItemResponse, status_code=status.HTTP_201_CREATED)
def add_cart_item(
    payload: CartItemCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CartItemResponse:
    place = db.get(Place, payload.place_id)
    if place is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="장소를 찾을 수 없습니다.")

    existing_item = db.scalar(
        select(CartItem).where(
            CartItem.user_id == current_user.id,
            CartItem.place_id == payload.place_id,
        )
    )
    if existing_item:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 장바구니에 담긴 장소입니다.")

    cart_item = CartItem(user_id=current_user.id, place_id=payload.place_id)
    db.add(cart_item)
    db.commit()
    db.refresh(cart_item)
    cart_item.place = place
    return serialize_cart_item(cart_item)


@router.delete("/{cart_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cart_item(
    cart_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Response:
    cart_item = db.scalar(
        select(CartItem).where(
            CartItem.id == cart_item_id,
            CartItem.user_id == current_user.id,
        )
    )
    if cart_item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="장바구니 항목을 찾을 수 없습니다.")

    db.delete(cart_item)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)