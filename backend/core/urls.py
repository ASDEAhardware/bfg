from django.urls import path #type: ignore
from .views import PublicKeyView

urlpatterns = [
    path('auth/public-key/', PublicKeyView.as_view(), name='public_key'),
]

