
from rest_framework.views import APIView #type: ignore
from rest_framework.response import Response #type: ignore
from rest_framework.permissions import IsAuthenticated  #type: ignore
from rest_framework import status #type: ignore
from .models import UserPreferences

class ThemePreferencesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_preferences, _ = UserPreferences.objects.get_or_create(user=request.user)
        return Response({'theme': user_preferences.theme})

    def put(self, request):
        theme = request.data.get('theme', 'system')
        user_preferences, _ = UserPreferences.objects.get_or_create(user=request.user)
        user_preferences.theme = theme
        user_preferences.save()

        return Response({'status': 'success', 'theme': theme}, status=status.HTTP_200_OK)    
