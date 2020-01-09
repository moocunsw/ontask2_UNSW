from django.urls import path
from .views import *

urlpatterns = [
    path("<id>/access/", AccessDataLabTemp),
    path("<id>/csv/", ExportToCSV),
    path("create/", CreateDataLab)
]
