from rest_framework import serializers
from rest_framework_mongoengine.serializers import DocumentSerializer
from datetime import datetime as dt

from .models import Form


class FormSerializer(DocumentSerializer):
    permitted_users = serializers.ReadOnlyField()
    updated_datalab = serializers.SerializerMethodField()

    def get_updated_datalab(self, form):
        return self.context.get("updated_datalab")

    class Meta:
        model = Form
        fields = "__all__"


class RestrictedFormSerializer(DocumentSerializer):
    data = serializers.SerializerMethodField()
    editable_records = serializers.SerializerMethodField()
    default_group = serializers.SerializerMethodField()
    is_active = serializers.SerializerMethodField()

    def get_data(self, form):
        return self.context.get("data")

    def get_editable_records(self, form):
        return self.context.get("editable_records")

    def get_default_group(self, form):
        return self.context.get("default_group")

    def get_is_active(self, form):
        return not (
            form.activeFrom is not None
            and form.activeFrom > dt.utcnow()
            or form.activeTo is not None
            and form.activeTo < dt.utcnow()
        )

    class Meta:
        model = Form
        fields = [
            "id",
            "name",
            "description",
            "primary",
            "visibleFields",
            "layout",
            "fields",
            "data",
            "editable_records",
            "is_active",
            "groupBy",
            "searchBy",
            "default_group",
        ]
