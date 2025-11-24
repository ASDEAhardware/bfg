
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
    RESIZE_HANDLE_CHOICES = [
        ('show', 'Show'),
        ('hide', 'Hide'),
    ]
    ACCELEROMETER_UNIT_CHOICES = [
        ('ms2', 'm/s²'),
        ('g', 'g'),
    ]
    INCLINOMETER_UNIT_CHOICES = [
        ('deg', 'Degrees'),
        ('rad', 'Radians'),
    ]
    LANGUAGE_CHOICES = [
        ('it', 'Italiano'),
        ('en', 'English'),
    ]

    user = models.OneToOneField(CustomUser, on_delete=models.CASCADE)
    theme = models.CharField(max_length=6, choices=THEME_CHOICES, default='system')
    show_resize_handle = models.CharField(max_length=4, choices=RESIZE_HANDLE_CHOICES, default='show')
    accelerometer_unit = models.CharField(max_length=3, choices=ACCELEROMETER_UNIT_CHOICES, default='ms2')
    inclinometer_unit = models.CharField(max_length=3, choices=INCLINOMETER_UNIT_CHOICES, default='deg')
    language = models.CharField(max_length=2, choices=LANGUAGE_CHOICES, default='en')

    class Meta:
        # Sono dei vincoli per mantenere l'integrità dei dati, mentre le choices sono validazioni a livello di applicazione
        # i constraints sono validazioni che si applicano direttamente al motore del database, impedendo che vengano bypassate se si interagisce direttamente con il DB
        constraints = [
            models.CheckConstraint(
                check=models.Q(theme__in=['light', 'dark', 'system']),
                name='theme_must_be_valid_choice'
            ),
            models.CheckConstraint(
                check=models.Q(show_resize_handle__in=['show', 'hide']),
                name='resize_handle_must_be_valid_choice'
            ),
            models.CheckConstraint(
                check=models.Q(accelerometer_unit__in=['ms2', 'g']),
                name='accelerometer_unit_must_be_valid_choice'
            ),
            models.CheckConstraint(
                check=models.Q(inclinometer_unit__in=['deg', 'rad']),
                name='inclinometer_unit_must_be_valid_choice'
            ),
            models.CheckConstraint(
                check=models.Q(language__in=['it', 'en']),
                name='language_must_be_valid_choice'
            ),
        ]

    def __str__(self):
        return f"Preferences for {self.user.username} (Theme: {self.theme}, Resize: {self.show_resize_handle}, Accel: {self.accelerometer_unit}, Incl: {self.inclinometer_unit}, lang: {self.language})"
