from rest_framework import serializers
from .models import Payment


class PaymentSerializer(serializers.ModelSerializer):

    class Meta:
        model = Payment
        fields = [
            'id',
            'order',
            'user',
            'amount',
            'payment_method',
            'transaction_reference',
            'status',
            'created_at'
        ]

        read_only_fields = [
            'id',
            'user',
            'amount',
            'transaction_reference',
            'status',
            'created_at'
        ]