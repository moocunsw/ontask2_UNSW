from rest_framework import serializers
from rest_framework_mongoengine.serializers import (
    DocumentSerializer,
    EmbeddedDocumentSerializer,
)
from mongoengine.queryset.visitor import Q

from .models import Container, Term
from datasource.models import Datasource
from datalab.models import Datalab, Module, DatasourceModule
from workflow.models import Workflow
from form.models import Form


class TermSerializer(DocumentSerializer):
    class Meta:
        model = Term
        fields = "__all__"


class ContainerSerializer(DocumentSerializer):
    class Meta:
        model = Container
        fields = "__all__"


class DatasourceSerializer(EmbeddedDocumentSerializer):
    class Meta:
        model = Datasource
        fields = ["id", "name", "connection", "schedule", "lastUpdated", "fields"]


class DatasourceModuleSerializer(EmbeddedDocumentSerializer):
    class Meta:
        model = DatasourceModule
        fields = ["id"]


class FormSerializer(DocumentSerializer):
    class Meta:
        model = Form
        fields = ["name", "data"]


class ModuleSerializer(EmbeddedDocumentSerializer):
    datasource = DatasourceModuleSerializer()
    form = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = ["type", "datasource", "form"]

    def get_form(self, module):
        return (
            FormSerializer(Form.objects.get(id=module.form)).data
            if "form" in module
            else None
        )


class DatalabSerializer(EmbeddedDocumentSerializer):
    steps = ModuleSerializer(many=True)

    class Meta:
        model = Datalab
        fields = ["id", "name", "steps"]


class ActionSerializer(EmbeddedDocumentSerializer):
    datalab = serializers.CharField()

    class Meta:
        model = Workflow
        fields = ["id", "name", "description", "datalab"]


class InformationSubmissionSerializer(DocumentSerializer):
    def __init__(self, *args, **kwargs):
        super(InformationSubmissionSerializer, self).__init__(*args, **kwargs)

        if not self.context.get("has_full_permission"):
            self.fields.pop("permitted_users")
            self.fields.pop("permission")

    class Meta:
        model = Form
        fields = ["id", "name", "description", "permitted_users", "permission"]


class SharedDataLabSerializer(DocumentSerializer):
    def __init__(self, *args, **kwargs):
        super(SharedDataLabSerializer, self).__init__(*args, **kwargs)

        if not self.context.get("has_full_permission"):
            self.fields.pop("permitted_users")
            self.fields.pop("permission")

    class Meta:
        model = Datalab
        fields = ["id", "name", "description", "permitted_users", "permission"]


class DashboardSerializer(DocumentSerializer):
    has_full_permission = serializers.SerializerMethodField()
    datasources = serializers.SerializerMethodField()
    datalabs = serializers.SerializerMethodField()
    actions = serializers.SerializerMethodField()
    information_submission = serializers.SerializerMethodField()
    shared_datalabs = serializers.SerializerMethodField()

    def get_has_full_permission(self, container):
        return self.context.get("has_full_permission", False)

    def get_datasources(self, container):
        datasources = Datasource.objects(container=container.id)
        serializer = DatasourceSerializer(datasources, many=True)
        return serializer.data

    def get_datalabs(self, container):
        datalabs = Datalab.objects(container=container.id)
        serializer = DatalabSerializer(datalabs, many=True)
        return serializer.data

    def get_actions(self, container):
        actions = Workflow.objects(container=container.id)

        for action in actions:
            action.datalab = action.datalab.name

        serializer = ActionSerializer(actions, many=True)
        return serializer.data

    def get_information_submission(self, container):
        has_full_permission = self.context.get("has_full_permission")
        if has_full_permission:
            forms = Form.objects.filter(
                Q(container=container) & (Q(ltiAccess=True) | Q(emailAccess=True))
            )
        else:
            forms = [
                form
                for form in self.context.get("accessible_forms")
                if form.container == container
            ]

        serializer = InformationSubmissionSerializer(
            forms, many=True, context={"has_full_permission": has_full_permission}
        )
        return serializer.data

    def get_shared_datalabs(self, container):
        has_full_permission = self.context.get("has_full_permission")
        if has_full_permission:
            datalabs = Datalab.objects.filter(
                Q(container=container) & (Q(ltiAccess=True) | Q(emailAccess=True))
            )
        else:
            datalabs = [
                datalab
                for datalab in self.context.get("accessible_datalabs")
                if datalab.container == container
            ]

        serializer = SharedDataLabSerializer(
            datalabs, many=True, context={"has_full_permission": has_full_permission}
        )
        return serializer.data

    def __init__(self, *args, **kwargs):
        super(DashboardSerializer, self).__init__(*args, **kwargs)

        if not self.context.get("has_full_permission"):
            allowed_fields = [
                "id",
                "code",
                "has_full_permission",
                "information_submission",
                "shared_datalabs",
            ]
            for field in set(self.fields) - set(allowed_fields):
                self.fields.pop(field)

    class Meta:
        model = Container
        fields = "__all__"
