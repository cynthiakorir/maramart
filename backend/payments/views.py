from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny

from orders.models import Order
from .models import Payment
from .serializers import PaymentSerializer
from .mpesa import initiate_stk_push


class InitiatePaymentView(generics.GenericAPIView):
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        order_id = request.data.get('order_id')

        try:
            order = Order.objects.get(
                id=order_id,
                user=request.user
            )

            if order.status == 'cancelled':
                return Response(
                    {"error": "Cannot pay for a cancelled order."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            existing_payment = Payment.objects.filter(
                order=order,
                status='completed'
            ).exists()

            if existing_payment:
                return Response(
                    {"error": "This order has already been paid."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            phone_number = order.phone_number

            if not phone_number.startswith('254'):
                return Response(
                    {
                        "error": "Phone number must start with 254."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            stk_response = initiate_stk_push(
                phone_number=phone_number,
                amount=order.total_amount,
                account_reference=f"MaraMart-{order.id}",
                transaction_desc="MaraMart order payment"
            )

            payment = Payment.objects.create(
                order=order,
                user=request.user,
                amount=order.total_amount,
                payment_method='mpesa',
                transaction_reference=stk_response.get(
                    'CheckoutRequestID'
                ),
                status='pending'
            )

            return Response(
                {
                    "message": "STK Push request sent.",
                    "payment": PaymentSerializer(payment).data,
                    "safaricom_response": stk_response
                },
                status=status.HTTP_200_OK
            )

        except Order.DoesNotExist:
            return Response(
                {"error": "Order not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        
class MpesaCallbackView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        callback_data = request.data.get('Body', {}).get(
            'stkCallback', {}
        )

        checkout_request_id = callback_data.get(
            'CheckoutRequestID'
        )

        result_code = callback_data.get('ResultCode')

        if not checkout_request_id:
            return Response(
                {"error": "Missing checkout request ID."},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            payment = Payment.objects.get(
                transaction_reference=checkout_request_id
            )
        except Payment.DoesNotExist:
            return Response(
                {"error": "Payment record not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        if result_code == 0:
            payment.status = 'completed'
            payment.save()

            payment.order.status = 'processing'
            payment.order.save()

            return Response({"ResultCode": 0, "ResultDesc": "Accepted"})

        payment.status = 'failed'
        payment.save()

        return Response({"ResultCode": 0, "ResultDesc": "Accepted"})






