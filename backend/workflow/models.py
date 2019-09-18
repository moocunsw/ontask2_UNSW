from mongoengine import Document, EmbeddedDocument
from mongoengine.fields import (
    ReferenceField,
    EmbeddedDocumentField,
    EmbeddedDocumentListField,
    StringField,
    DateTimeField,
    IntField,
    ListField,
    DictField,
    BooleanField,
    SequenceField,
    ObjectIdField,
    BaseField,
)
from datetime import datetime
from collections import defaultdict
from bson.objectid import ObjectId
import jwt

from container.models import Container
from datalab.models import Datalab
from datasource.models import Datasource
from form.models import Form

from .utils import (
    did_pass_test,
    parse_attribute,
    generate_condition_tag_locations,
    replace_tags,
    delete_html_by_indexes
)
from scheduler.tasks import workflow_send_email

from ontask.settings import SECRET_KEY, BACKEND_DOMAIN, FRONTEND_DOMAIN

import re

class Formula(EmbeddedDocument):
    comparator = BaseField()
    operator = StringField()
    rangeFrom = BaseField()
    rangeTo = BaseField()


class Condition(EmbeddedDocument):
    conditionId = ObjectIdField(default=ObjectId)
    formulas = EmbeddedDocumentListField(Formula)


class Rule(EmbeddedDocument):
    name = StringField(required=True)
    parameters = ListField(StringField())
    conditions = EmbeddedDocumentListField(Condition)
    catchAll = ObjectIdField(default=ObjectId)


class Filter(EmbeddedDocument):
    parameters = ListField(StringField())
    conditions = EmbeddedDocumentListField(Condition)


class Schedule(EmbeddedDocument):
    active_from = DateTimeField(null=True)
    active_to = DateTimeField(null=True)
    time = DateTimeField(required=True)
    frequency = StringField(required=True, choices=("daily", "weekly", "monthly"))
    # List of shorthand day names, e.g. ['mon', 'wed', 'fri']
    day_of_week = ListField(StringField())
    # Number representing the date in the month, e.g. 1 is the 1st
    day_of_month = DateTimeField()
    task_name = StringField()  # The name of the celery task


class Option(EmbeddedDocument):
    label = StringField(required=True)
    value = StringField(required=True)


class EmailSettings(EmbeddedDocument):
    subject = StringField(required=True)
    field = StringField(required=True)
    fromName = StringField(null=True)
    replyTo = StringField(required=True)
    include_feedback = BooleanField()
    feedback_list = BooleanField()
    list_question = StringField()
    list_options = EmbeddedDocumentListField(Option)
    list_type = StringField(choices=("dropdown", "radio"))
    feedback_textbox = BooleanField()
    textbox_question = StringField()


class Email(EmbeddedDocument):
    email_id = StringField()
    recipient = StringField()
    content = StringField()
    list_feedback = StringField()
    textbox_feedback = StringField()
    feedback_datetime = DateTimeField()
    track_count = IntField(default=0)
    first_tracked = DateTimeField()
    last_tracked = DateTimeField()


class EmailJob(EmbeddedDocument):
    job_id = ObjectIdField()
    subject = StringField()
    emails = EmbeddedDocumentListField(Email)
    type = StringField(choices=["Manual", "Scheduled"])
    initiated_at = DateTimeField(default=datetime.utcnow)
    included_feedback = BooleanField()


class Workflow(Document):
    container = ReferenceField(
        Container, required=True, reverse_delete_rule=2
    )  # Cascade delete if container is deleted
    datalab = ReferenceField(
        Datalab, required=True, reverse_delete_rule=2
    )  # Cascade delete if view is deleted
    name = StringField(required=True)
    description = StringField(null=True)
    filter = EmbeddedDocumentField(Filter)
    rules = EmbeddedDocumentListField(Rule)
    content = StringField()
    emailSettings = EmbeddedDocumentField(EmailSettings)
    schedule = EmbeddedDocumentField(Schedule, null=True, required=False)
    linkId = StringField(null=True)  # link_id is unique across workflow objects
    emailJobs = EmbeddedDocumentListField(EmailJob)

    @property
    def datalab_name(self):
        return self.datalab.name

    @property
    def options(self):
        modules = []
        types = {}
        labels = []

        # Create a "pseudo" module to hold the computed fields
        computed = {"type": "computed", "fields": []}

        # Iterate over the modules of the datalab
        for step in self.datalab.steps:
            module = {"type": step.type, "fields": []}
            module_labels = {}

            if step.type == "datasource":
                datasource = None
                try:
                    datasource = Datasource.objects.get(id=step.datasource.id)
                except:
                    pass

                try:
                    datasource = Datalab.objects.get(id=step.datasource.id)
                except:
                    pass

                if datasource:
                    module["name"] = datasource.name
                    for field in step.datasource.fields:
                        label = step.datasource.labels[field]
                        module["fields"].append(label)
                        types[label] = step.datasource.types[field]
                        module_labels[field] = label
                    modules.append(module)
                    labels.append(module_labels)

            if step.type == "form":
                form = Form.objects.get(id=step.form)
                module["name"] = form.name
                for field in form.fields:
                    if field.type == "checkbox-group":
                        for column in field.columns:
                            module["fields"].append(column)
                            types[column] = "checkbox"
                            module_labels[column] = column
                    else:
                        module["fields"].append(field.name)
                        types[field.name] = field.type
                        module_labels[field.name] = field.name
                modules.append(module)
                labels.append(module_labels)

            if step.type == "computed":
                for field in step.computed.fields:
                    computed["fields"].append(field.name)
                    types[field.name] = field.type
                    module_labels[field.name] = field.name
                    labels.append(module_labels)

        modules.append(computed)

        return {"modules": modules, "types": types, "labels": labels}

    @property
    def data(self):
        options = self.options

        if self.filter:
            filtered_data = []

            types = options["types"]
            parameters = self.filter.parameters
            condition = self.filter.conditions[0]

            for item in self.datalab.data:
                if all(
                    [
                        did_pass_test(
                            condition.formulas[parameter_index],
                            item.get(parameter),
                            types.get(parameter),
                        )
                        for parameter_index, parameter in enumerate(parameters)
                    ]
                ):
                    filtered_data.append(item)

        else:
            filtered_data = self.datalab.data

        column_order = []
        from datalab.serializers import OrderItemSerializer
        order = OrderItemSerializer(
            self.datalab.order, many=True, context={"steps": self.datalab.steps}
        ).data

        for item in order:
            if item["details"]["field_type"] == "checkbox-group":
                column_order.extend(item["details"]["fields"])
            else:
                column_order.append(item["details"]["label"])

        return {
            "records": filtered_data,
            "order": column_order,
            "unfilteredLength": len(self.datalab.data),
            "filteredLength": len(filtered_data),
        }

    def populate_content(self, content=None):
        if not content and not self.content:
            return []
        elif not content:
            content = self.content

        filtered_data = self.data["records"]
        types = self.options["types"]

        # Assign each student record to the rule groups
        populated_rules = defaultdict(set)
        for item_index, item in enumerate(filtered_data):
            for rule in self.rules:
                parameters = rule.parameters
                did_match = False

                for condition in rule.conditions:
                    if all(
                        [
                            did_pass_test(
                                condition.formulas[parameter_index],
                                item.get(parameter),
                                types.get(parameter),
                            )
                            for parameter_index, parameter in enumerate(parameters)
                        ]
                    ):
                        did_match = True
                        populated_rules[condition.conditionId].add(item_index)
                        break

                if not did_match:
                    populated_rules[rule.catchAll].add(item_index)

        result = []
        from datalab.serializers import OrderItemSerializer
        order = OrderItemSerializer(
            self.datalab.order, many=True, context={"steps": self.datalab.steps}
        ).data

        condition_ids = list(set(re.findall(r"conditionid=\"(.*?)\"", content)))
        condition_tag_locations = generate_condition_tag_locations(content)
        """
        Generate HTML string for each student based on conditions and attributes
        Algo:
        1. Delete condition blocks that do not match the student attributes
            - Get a list of deleteIndexes of (start,stop) slices of condition tags to delete
            - Perform the iterative deletion
        2. Clean the HTML (replace <attribute>, <condition>, <cwrapper>) to actual HTML tags
        """
        for item_index, item in enumerate(filtered_data):
            html = content

            # 1
            deleteIndexes = []
            for condition_id in condition_ids:
                if not item_index in populated_rules.get(ObjectId(condition_id), {}):
                    deleteIndexes += condition_tag_locations[condition_id]
            html = delete_html_by_indexes(html, deleteIndexes)

            # 2
            html = replace_tags(html, "condition", "div")
            html = replace_tags(html, "cwrapper", "div")
            html = parse_attribute(html, item, order)

            result.append(html)
        return result

    def clean_content(self, conditions):
        if not self.content:
            return

        blocks = self.content["blockMap"]["document"]["nodes"]
        new_blocks = list(
            filter(
                lambda block: block["data"].get("conditionId") not in conditions, blocks
            )
        )

        self.content["blockMap"]["document"]["nodes"] = new_blocks

        return self.content

    def send_email(self):
        workflow_send_email.delay(action_id=str(self.id), job_type="Manual")
