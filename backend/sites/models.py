from decimal import Decimal
from django.db import models
from django.contrib.auth import get_user_model
from django.core.validators import MinValueValidator, MaxValueValidator


User = get_user_model()


class SiteType(models.TextChoices):
    BRIDGE = 'bridge', 'Bridge'
    BUILDING = 'building', 'Building'
    TUNNEL = 'tunnel', 'Tunnel'
    DAM = 'dam', 'Dam'
    TOWER = 'tower', 'Tower'
    PIPELINE = 'pipeline', 'Pipeline'
    OTHER = 'other', 'Other'


class Site(models.Model):
    name = models.CharField(max_length=255, unique=True)
    code = models.CharField(max_length=50, unique=True, null=True, help_text="Unique immutable site code for database queries")
    site_type = models.CharField(
        max_length=20,
        choices=SiteType.choices,
        default=SiteType.OTHER
    )
    latitude = models.DecimalField(
        max_digits=17,
        decimal_places=12,
        default=Decimal(42.445341640630),
        validators=[
            MinValueValidator(-90.0),
            MaxValueValidator(90.0)
        ],
        help_text="Latitude coordinate (-90 to 90 degrees)"
    )
    longitude = models.DecimalField(
        max_digits=17,
        decimal_places=12,
        default=Decimal(14.198652738540),
        validators=[
            MinValueValidator(-180.0),
            MaxValueValidator(180.0)
        ],
        help_text="Longitude coordinate (-180 to 180 degrees)"
    )
    customer_name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Site'
        verbose_name_plural = 'Sites'
        indexes = [
            models.Index(fields=['customer_name']),
            models.Index(fields=['site_type']),
            models.Index(fields=['is_active']),
        ]

    def _generate_code_from_name(self, name):
        """
        Genera codice dalle consonanti del nome (senza spazi, in maiuscolo)
        Esempio: "Ponte Cardarelli" -> "PNTCRDRLL"
        """
        vowels = 'aeiouAEIOUàèéìòùÀÈÉÌÒÙ'
        # Rimuovi spazi e tieni solo lettere
        letters = [char.upper() for char in name if char.isalpha()]
        # Filtra solo le consonanti
        consonants = [char for char in letters if char not in vowels]
        # Se non ci sono consonanti, usa tutto il nome (solo lettere)
        if not consonants:
            consonants = letters
        # Se ancora vuoto, usa un placeholder
        if not consonants:
            return 'SITE'
        return ''.join(consonants)

    def _get_unique_code(self):
        """
        Genera un codice univoco basato sul nome.
        Se il codice base esiste già, aggiunge un numero incrementale (1, 2, 3...)
        """
        base_code = self._generate_code_from_name(self.name)

        # Controlla se il codice base è disponibile
        code = base_code
        counter = 1

        # Query che esclude l'istanza corrente se stiamo facendo update
        queryset = Site.objects.filter(code=code)
        if self.pk:
            queryset = queryset.exclude(pk=self.pk)

        # Incrementa finché non trova un codice univoco
        while queryset.exists():
            code = f"{base_code}{counter}"
            counter += 1
            queryset = Site.objects.filter(code=code)
            if self.pk:
                queryset = queryset.exclude(pk=self.pk)

        return code

    def save(self, *args, **kwargs):
        # Genera automaticamente il code se non è stato fornito
        if not self.code:
            self.code = self._get_unique_code()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.customer_name})"


class UserSiteAccess(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='site_accesses')
    site = models.ForeignKey(Site, on_delete=models.CASCADE, related_name='user_accesses')
    granted_at = models.DateTimeField(auto_now_add=True)
    granted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='granted_site_accesses'
    )

    class Meta:
        unique_together = ('user', 'site')
        ordering = ['site__name']
        verbose_name = 'User Site Access'
        verbose_name_plural = 'User Site Accesses'

    def __str__(self):
        return f"{self.user.username} - {self.site.name}"


