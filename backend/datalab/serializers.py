from rest_framework import serializers
from rest_framework_mongoengine.serializers import (
    DocumentSerializer,
    EmbeddedDocumentSerializer,
)

from .models import Datalab, Column
from datasource.models import Datasource
from form.models import Form
from form.serializers import FormSerializer
from workflow.models import Workflow, EmailJob, Email


class EmailSerializer(EmbeddedDocumentSerializer):
    class Meta:
        model = Email
        exclude = ["content"]


class EmailJobSerializer(EmbeddedDocumentSerializer):
    emails = EmailSerializer(many=True, allow_null=True, read_only=True)

    class Meta:
        model = EmailJob
        fields = "__all__"


class ActionSerializer(DocumentSerializer):
    emailJobs = EmailJobSerializer(many=True, allow_null=True, read_only=True)
    emailField = serializers.SerializerMethodField()

    class Meta:
        model = Workflow
        fields = ["id", "name", "emailJobs", "emailField"]

    def get_emailField(self, action):
        if "emailSettings" in action:
            return action.emailSettings.field

        return None


class DatasourceSerializer(DocumentSerializer):
    class Meta:
        model = Datasource
        fields = ["id", "name", "fields"]


class OrderItemSerializer(EmbeddedDocumentSerializer):
    details = serializers.SerializerMethodField()

    def get_details(self, order_item):
        if not "objects" in self.context:
            self.context["objects"] = {}

        module = self.context["steps"][order_item.stepIndex]

        details = {"label": order_item.field, "module_type": module.type}

        if module.type == "datasource":
            if module.datasource.id in self.context["objects"]:
                datasource = self.context["objects"][module.datasource.id]
            else:
                try:
                    datasource = Datasource.objects.get(id=module.datasource.id)
                except:
                    pass

                try:
                    datasource = Datalab.objects.get(id=module.datasource.id)
                except:
                    pass

                self.context["objects"][module.datasource.id] = datasource

            details["from"] = datasource.name
            details["label"] = module.datasource.labels.get(order_item.field)
            details["field_type"] = module.datasource.types.get(order_item.field)

            if details["field_type"] in ["checkbox-group", "list"]:
                # Identify which form the field comes from
                form_module_index = next(
                    item for item in datasource.order if item.field == order_item.field
                ).stepIndex
                form_module_id = datasource.steps[form_module_index].form

                if form_module_id in self.context["objects"]:
                    form = self.context["objects"][form_module_id]
                else:
                    form = Form.objects.get(id=form_module_id)
                    self.context["objects"][form_module_id] = form

                details["from"] = form.name
                for field in form.fields:
                    if field.name == order_item.field:
                        details["field_type"] = field.type

                        if field.type == "checkbox-group":
                            details["fields"] = field.columns

                        if field.type == "list":
                            details["options"] = [
                                {"label": option.label, "value": option.value}
                                for option in field.options
                            ]

        elif module.type == "form":
            if module.form in self.context["objects"]:
                form = self.context["objects"][module.form]
            else:
                form = Form.objects.get(id=module.form)
                self.context["objects"][module.form] = form

            details["from"] = form.name
            for field in form.fields:
                if field.name == order_item.field:
                    details["field_type"] = field.type

                    if field.type == "checkbox-group":
                        details["fields"] = field.columns

                    if field.type == "list":
                        details["options"] = [
                            {"label": option.label, "value": option.value}
                            for option in field.options
                        ]

        elif module.type == "computed":
            for field in module.computed.fields:
                if field.name == order_item.field:
                    details["field_type"] = field.type

        return details

    class Meta:
        model = Column
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super(OrderItemSerializer, self).__init__(*args, **kwargs)

        if self.context.get("restricted"):
            disallowed_fields = ["stepIndex", "field"]
            for field in disallowed_fields:
                self.fields.pop(field)


class OtherDatalabSerializer(DocumentSerializer):
    columns = serializers.SerializerMethodField()

    def get_columns(self, datalab):
        serializer = OrderItemSerializer(
            datalab.order, many=True, context={"steps": datalab.steps}
        )
        return serializer.data

    class Meta:
        model = Datalab
        fields = ["id", "name", "columns"]


class DatalabSerializer(DocumentSerializer):
    datasources = serializers.SerializerMethodField()
    dataLabs = serializers.SerializerMethodField()
    forms = serializers.SerializerMethodField()
    actions = serializers.SerializerMethodField()
    columns = serializers.SerializerMethodField()
    data = serializers.ReadOnlyField()
    filter_details = serializers.SerializerMethodField()

    def get_datasources(self, datalab):
        datasources = Datasource.objects(container=datalab["container"].id)
        serializer = DatasourceSerializer(datasources, many=True)
        return serializer.data

    def get_dataLabs(self, datalab):
        datalabs = Datalab.objects(container=datalab["container"].id, id__ne=datalab.id)
        serializer = OtherDatalabSerializer(datalabs, many=True)
        return serializer.data

    def get_forms(self, datalab):
        forms = Form.objects(datalab=datalab.id)
        serializer = FormSerializer(forms, many=True)
        return serializer.data

    def get_actions(self, datalab):
        actions = Workflow.objects(datalab=datalab.id)
        serializer = ActionSerializer(actions, many=True)
        return serializer.data

    def get_columns(self, datalab):
        return OrderItemSerializer(
            datalab.order, many=True, context={"steps": datalab.steps}
        ).data

    def get_filter_details(self, datalab):
        return datalab.filter_details(filters=self.context.get("filters"))

    class Meta:
        model = Datalab
        fields = "__all__"


class RestrictedDatalabSerializer(DocumentSerializer):
    columns = serializers.SerializerMethodField()
    data = serializers.SerializerMethodField()
    filter_details = serializers.SerializerMethodField()
    default_group = serializers.SerializerMethodField()

    def get_columns(self, datalab):
        return OrderItemSerializer(
            datalab.order,
            many=True,
            context={"steps": datalab.steps, "restricted": True},
        ).data

    def get_data(self, datalab):
        return self.context.get("data", datalab.data)

    def get_filter_details(self, datalab):
        return datalab.filter_details(filters=self.context.get("filters"))

    def get_default_group(self, datalab):
        return self.context.get("default_group")

    class Meta:
        model = Datalab
        fields = ["name", "columns", "data", "filter_details", "groupBy", "default_group"]

class FilteredDatalabSerializer(DocumentSerializer):
    """
    Use-case - When the user changes table filters
    """
    filter_details = serializers.SerializerMethodField()

    def get_filter_details(self, datalab):
        return datalab.filter_details(filters=self.context.get("filters"))

    class Meta:
        model = Datalab
        fields = ["filter_details"]