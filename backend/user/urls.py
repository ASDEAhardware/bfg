from django.urls import path, include
from .views import (
    ThemePreferencesView, 
    UserPreferencesView,
    ResizeHandlePreferenceView,
    AccelerometerUnitPreferenceView,
    InclinometerUnitPreferenceView,
    LanguagePreferenceView
)

urlpatterns = [
    path("", include("dj_rest_auth.urls")),
    #path("registration/", include("dj_rest_auth.registration.urls")),
    path("theme-preferences/", ThemePreferencesView.as_view(), name="theme-preferences"),
    path("preferences/", UserPreferencesView.as_view(), name="user-preferences"),
    path("preferences/resize-handle/", ResizeHandlePreferenceView.as_view(), name="update-resize-handle"),
    path("preferences/accelerometer-unit/", AccelerometerUnitPreferenceView.as_view(), name="update-accelerometer-unit"),
    path("preferences/inclinometer-unit/", InclinometerUnitPreferenceView.as_view(), name="update-inclinometer-unit"),
    path("preferences/language/", LanguagePreferenceView.as_view(), name="update-language"),
]
#ENDPOINTS AUTH:
# /user/login/ - Login
# /user/logout/ - Logout
# /user/user/ - Dettagli utente
# /user/password/change/ - Cambia password
# /user/password/reset/ - Reset password (invia email)
# /user/password/reset/confirm/ - Conferma reset password
# /user/registration/ - Registrazione (se abilitata)
# /user/token/refresh/ - Refresh token JWT
