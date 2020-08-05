from django.urls import path
from .views import *

urlpatterns = [
    path("<id>/access/", AccessDataLab),
    path("<id>/filter/", FilterData),
    path("<id>/csv/", ExportToCSV),
    path("create/", CreateDataLab)
]
