# faqs/views.py
from rest_framework import generics
from .models import FAQ
from .serializers import FAQSerializer

# View to list all FAQs or create a new FAQ


class FAQListView(generics.ListCreateAPIView):
    queryset = FAQ.objects.filter(is_active=True).order_by(
        '-created_at')
    serializer_class = FAQSerializer
