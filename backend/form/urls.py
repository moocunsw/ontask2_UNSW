from django.urls import path
from .views import *

urlpatterns = [
    path("", ListForms.as_view()),
    path("<id>/", DetailForm.as_view()),
    path("<id>/access/", AccessForm.as_view()),
    path("<id>/access/<token>/", AccessForm.as_view()),
    path("<id>/export_structure/", ExportStructure),
    path("<id>/import_data/", ImportData),
]
