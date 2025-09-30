
import os
import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


def user_directory_path(instance, filename):
    
    #Genera un percorso univoco per ogni utente, es:
    #profile_images/user_42/uuid.jpg
    
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"
    return f'profile_images/user_{instance.id}/{filename}'


class CustomUser(AbstractUser):
    profile_image = models.ImageField(
        upload_to=user_directory_path,
        blank=True,
        null=True
    )

    def __str__(self):
        return self.username

class UserPreferences(models.Model):
    THEME_CHOICES = [
        ('light', 'Light'),
        ('dark', 'Dark'),
        ('system', 'System'),
    ]
    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    theme = models.CharField(max_length=10, choices=THEME_CHOICES, default='system')

    def __str__(self):
        return f"User Preferences for {self.user.username}, theme: {self.theme}"
