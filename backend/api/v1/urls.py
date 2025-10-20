 # Centralizzare qui tutti gli endpoint API v1
from django.urls import path, include

urlpatterns = [
    path('core/', include('core.urls')),  # Include the CORE dir URLs
    path('user/', include('user.urls')),  # Include the user management URLs
    path('dashboard/', include('dashboard.urls')),
    # path('mqtt/', include('mqtt.urls')),  # MQTT URLs removed - will be rewritten
    path('site/', include('sites.urls')),  # Include site URLs
]
    