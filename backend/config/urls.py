from django.http import JsonResponse
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

def health_check(request):
    return JsonResponse({"status": "ok"})
urlpatterns = [
    path('', health_check),
    path('admin/', admin.site.urls),
    path('api/accounts/', include('accounts.urls')),
    path('api/products/', include('products.urls')),
    path('api/cart/', include('cart.urls')),
    path('api/orders/', include('orders.urls')),
    path('api/payments/', include('payments.urls')),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT
    )

