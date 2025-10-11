from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from .models import Career, Department
from .serializers import CareerSerializer, DepartmentSerializer
from apps.api.v2.mixins import SlugModelViewSetMixin


class BaseViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (AllowAny,)


class DepartmentViewSet(BaseViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer


class CareerViewSet(SlugModelViewSetMixin, BaseViewSet):
    queryset = Career.objects.all()
    serializer_class = CareerSerializer
