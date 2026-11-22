from django.urls import path
from .views import InitiatePaymentView
from .views import MpesaCallbackView

urlpatterns = [
    path(
        'initiate/',
        InitiatePaymentView.as_view(),
        name='initiate-payment'
        
    ),
    path(
        'callback/',
        MpesaCallbackView.as_view(),
        name='mpesa-callback'
    )
]