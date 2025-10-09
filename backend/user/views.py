
import logging
from rest_framework.views import APIView #type: ignore
from rest_framework.response import Response #type: ignore
from rest_framework.permissions import IsAuthenticated  #type: ignore
from rest_framework import status #type: ignore
from rest_framework.throttling import UserRateThrottle
from django.utils.decorators import method_decorator
from django.views.decorators.cache import cache_page
from .models import UserPreferences

logger = logging.getLogger('django.security')

class SensitiveUserOperationThrottle(UserRateThrottle):
    scope = 'sensitive'

class ThemePreferencesView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [UserRateThrottle]

    @method_decorator(cache_page(60 * 15))  # Cache per 15 minuti
    def get(self, request):
        user_preferences, _ = UserPreferences.objects.get_or_create(user=request.user)
        return Response({'theme': user_preferences.theme})

    def put(self, request):
        theme = request.data.get('theme', 'system')

        # Validazione input
        valid_themes = ['light', 'dark', 'system']
        if theme not in valid_themes:
            logger.warning(f"User {request.user.username} attempted to set invalid theme: {theme}")
            return Response(
                {'error': f'Invalid theme. Must be one of: {valid_themes}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user_preferences, _ = UserPreferences.objects.get_or_create(user=request.user)
        user_preferences.theme = theme
        user_preferences.save()

        logger.info(f"User {request.user.username} changed theme to {theme}")
        return Response({'status': 'success', 'theme': theme}, status=status.HTTP_200_OK)    
