from django.db import transaction
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Order, OrderItem
from .serializers import OrderSerializer
from cart.models import Cart

# Create your views here.
class CreateOrderView(generics.GenericAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):

        try:
            cart = Cart.objects.get(user=request.user)
            cart_items = cart.items.select_related('product')

            if not cart_items.exists():
                return Response(
                    {"error": "Your shopping cart is empty."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            full_name = request.data.get('full_name')
            phone_number = request.data.get('phone_number')
            delivery_address = request.data.get('delivery_address')

            if not all([full_name, phone_number, delivery_address]):
                return Response(
                    {"error": "All delivery details are required."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            with transaction.atomic():

                total_amount = 0

                for item in cart_items:
                    if item.quantity > item.product.stock:
                        return Response(
                            {
                                "error": f"Insufficient stock for {item.product.name}."
                            },
                            status=status.HTTP_400_BAD_REQUEST
                        )

                    total_amount += item.product.price * item.quantity

                order = Order.objects.create(
                    user=request.user,
                    full_name=full_name,
                    phone_number=phone_number,
                    delivery_address=delivery_address,
                    total_amount=total_amount
                )

                for item in cart_items:
                    OrderItem.objects.create(
                        order=order,
                        product=item.product,
                        quantity=item.quantity,
                        price=item.product.price
                    )

                    item.product.stock -= item.quantity
                    item.product.save()

                cart_items.delete()

            return Response(
                {
                    "message": "Order placed successfully.",
                    "order": OrderSerializer(order).data
                },
                status=status.HTTP_201_CREATED
            )

        except Cart.DoesNotExist:
            return Response(
                {"error": "Shopping cart not found."},
                status=status.HTTP_404_NOT_FOUND
            )


class OrderListView(generics.ListAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(
            user=self.request.user
        ).prefetch_related('items')


class OrderDetailView(generics.RetrieveAPIView):
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Order.objects.filter(
            user=self.request.user
        ).prefetch_related('items')