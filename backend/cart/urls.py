from django.urls import path

from .views import (
    CartView,
    AddToCartView,
    UpdateCartItemView,
    RemoveCartItemView
)

urlpatterns = [
    path('', CartView.as_view(), name='cart-detail'),
    path('add/', AddToCartView.as_view(), name='add-to-cart'),
    path(
        'update/<int:pk>/',
        UpdateCartItemView.as_view(),
        name='update-cart-item'
    ),
    path(
        'remove/<int:pk>/',
        RemoveCartItemView.as_view(),
        name='remove-cart-item'
    ),
]