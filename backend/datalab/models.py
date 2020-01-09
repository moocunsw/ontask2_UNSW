from mongoengine import Document, EmbeddedDocument
from mongoengine.fields import (
    StringField,
    DictField,
    ListField,
    EmbeddedDocumentListField,
    IntField,
    ReferenceField,
    BooleanField,
    EmbeddedDocumentField,
    DateTimeField,
    FloatField,
)
import pandas as pd

from container.models import Container
from datasource.models import Datasource

from pprint import pprint
import logging

class Column(EmbeddedDocument):
    stepIndex = IntField()
    field = StringField()
    visible = BooleanField(default=True)
    pinned = BooleanField(default=False)


class Discrepencies(EmbeddedDocument):
    matching = BooleanField()
    primary = BooleanField()


class DatasourceModule(EmbeddedDocument):
    id = StringField(required=True)
    primary = StringField(required=True)
    matching = StringField(null=True)
    fields = ListField(StringField())
    labels = DictField()
    types = DictField()
    discrepencies = EmbeddedDocumentField(Discrepencies)
    source_type = StringField(
        choices=("datasource", "datalab"), required=True, default="datasource"
    )


class ComputedField(EmbeddedDocument):
    name = StringField(required=True)
    type = StringField(null=True)
    formula = DictField(required=True)


class ComputedModule(EmbeddedDocument):
    fields = EmbeddedDocumentListField(ComputedField)


class Module(EmbeddedDocument):
    type = StringField(choices=("datasource", "computed", "form"), required=True)
    datasource = EmbeddedDocumentField(DatasourceModule)
    form = StringField(null=True)  # a Form model object ID will be passed in
    computed = EmbeddedDocumentField(ComputedModule)


class Chart(EmbeddedDocument):
    chartType = StringField(
        choices=("barChart", "pieChart", "boxPlot", "table"), required=True
    )
    colNameSelected = StringField(required=True)
    interval = FloatField(null=True)
    range = ListField(FloatField(), null=True)
    groupByCol = StringField(null=True)
    numBins = IntField(null=True)
    visibleField = StringField(null=True)
    onSameChart = BooleanField(null=True)
    percentageAxis = BooleanField(null=True)
    selections = ListField(StringField())
    filterCols = ListField(StringField())


class Datalab(Document):
    # Cascade delete if container is deleted
    container = ReferenceField(Container, required=True, reverse_delete_rule=2)
    name = StringField(required=True)
    description = StringField(null=True)
    steps = EmbeddedDocumentListField(Module)
    order = EmbeddedDocumentListField(Column)
    charts = EmbeddedDocumentListField(Chart)

    relations = ListField(DictField())
    permitted_users = ListField(StringField())
    ltiAccess = BooleanField(default=False)
    emailAccess = BooleanField(default=False)
    permission = StringField(null=True)
    restriction = StringField(choices=("private", "open"), default="private")
    groupBy = StringField(null=True)

    @property
    def data(self):
        from form.models import Form
        from .utils import calculate_computed_field

        from datetime import datetime
        now = datetime.now()

        build_fields = []
        combined_data = pd.DataFrame(self.relations)

        # # Gather all tracking and feedback data for associated actions
        # # Consumed by the computed column
        # tracking_feedback_data = {}
        # if datalab_id:
        #     actions = Workflow.objects(datalab=datalab_id)
        #     for action in actions:
        #         action_id = str(action.id)
        #         if not "emailSettings" in action or not len(action["emailJobs"]):
        #             continue

        #         tracking_feedback_data[action_id] = {
        #             "email_field": action["emailSettings"]["field"],
        #             "jobs": {},
        #         }
        #         for email_job in action["emailJobs"]:
        #             job_id = str(email_job.job_id)

        #             tracking_feedback_data[action_id]["jobs"][job_id] = {
        #                 "tracking": {
        #                     email["recipient"]: email["track_count"]
        #                     for email in email_job["emails"]
        #                 }
        #             }

        for step_index, step in enumerate(self.steps):
            if step.type == "datasource":
                step = step.datasource
                try:
                    datasource = Datasource.objects.get(id=step.id)
                except:
                    pass

                try:
                    datasource = Datalab.objects.get(id=step.id)
                except:
                    pass

                build_fields.append([step.labels[field] for field in step.fields])

                included_fields = []
                for field in step.fields:
                    # Skip columns that are already included in the relations table
                    if step.labels[field] in list(combined_data):
                        continue

                    if step.types.get(field) != "checkbox-group":
                        included_fields.append(field)
                        continue

                    # Identify which form the field comes from
                    form_module_index = next(
                        item for item in datasource.order if item.field == field
                    ).stepIndex
                    form_module_id = datasource.steps[form_module_index].form

                    form = Form.objects.get(id=form_module_id)
                    for form_field in form.fields:
                        if form_field.name == field:
                            included_fields.extend(form_field.columns)

                data = (
                    pd.DataFrame(data=datasource.data)
                    .set_index(step.primary)
                    .filter(items=included_fields)
                    .rename(
                        columns={field: step.labels[field] for field in step.fields}
                    )
                )

                combined_data = combined_data.join(
                    data,
                    on=step.matching
                    if step_index != 0
                    else step.labels.get(step.primary, step.primary),
                )

            elif step.type == "form":
                form = Form.objects.get(id=step.form)
                data = pd.DataFrame(data=form.data)

                build_fields.append([field.name for field in form.fields])

                if form.primary in data:
                    data.set_index(form.primary, inplace=True)
                    combined_data = combined_data.join(data, on=form.primary)

            elif step.type == "computed":
                step = step.computed

                build_fields.append([field.name for field in step.fields])

                computed_fields = {
                    field.name: combined_data.apply(
                        lambda item: calculate_computed_field(
                            field.formula, item, build_fields, {}
                        ),
                        axis=1,
                    ).values
                    for field in step.fields
                }
                combined_data = combined_data.assign(**computed_fields)

        combined_data.replace({pd.np.nan: None}, inplace=True)
        print(datetime.now() - now)

        return combined_data.to_dict("records")

    def filter_details(self, filters):
        data = self.data
        df = pd.DataFrame.from_dict(data)

        from datalab.serializers import OrderItemSerializer
        columns = OrderItemSerializer(
            self.order, many=True, context={"steps": self.steps}
        ).data

        # filter_list = get_filters(df, columns)
        filtered_data, pagination_total = get_filtered_data(data, columns, filters)

        return {
            'dataNum': len(data),
            'paginationTotal': pagination_total,
            'filters': get_filters(df, columns),
            'filteredData': filtered_data
        }


    # Flat representation of which users should see this DataLab when they load the dashboard
    def refresh_access(self):
        users = set(
            record.get(self.permission, "").lower() for record in self.relations
        )
        for invalid_value in [None, ""]:
            if invalid_value in users:
                users.remove(invalid_value)

        self.permitted_users = list(users)
        self.save()

"""UTILITY FUNCTIONS"""
def get_filters(df, columns):
    filters = {}
    for item in columns:
        # Generate list of filters
        column_name = item['field']
        field_type = item['details']['field_type']
        if field_type == 'list':
            options = item['details']['options']
            filters[column_name] = list(map(lambda x: {'text': x['label'], 'value': x['value']}, options))
        elif field_type == 'checkbox':
            filters[column_name] = [
                {'text': 'False', 'value': False},
                {'text': 'True', 'value': True},
            ]
        elif field_type == 'checkbox-group':
            fields = item['details']['fields']
            filters[column_name] = list(map(lambda x: {'text': x, 'value': x}, fields))
        elif field_type == 'date':
            filters[column_name] = list(map(lambda x: {'text': x[:10], 'value': x}, df[column_name].dropna().unique()))
        else:
            # Text, Number, Non-fields
            filters[column_name] = list(map(lambda x: {'text': x, 'value': x}, df[column_name].dropna().unique()))
    return filters


def get_filtered_data(data, columns, filters):
    # TODO MAYBE FIX Everything empty
    if len(filters.keys()) == 0: return (data, len(data))
    filtered_data = list(filter(lambda row: not remove_row_filter(row, filters, columns), data))

    # Search
    if not filters['search'] == '':
        filtered_data = list(filter(lambda row: not remove_row_search(row, filters, columns), filtered_data))

    # Sort
    if not len(filters['sorter']) == 0:
        sort_field = filters['sorter']['field']
        sort_order = filters['sorter']['order']
        if sort_field is not None and sort_order is not None:
            # TODO TEST DESCEND + NEUTRAL
            column = next((item for item in columns if item['field'] == sort_field), None)
            filtered_data.sort(key=lambda x: sort_column_key(x, sort_field, column), reverse=sort_order=='descend')

    pagination_total = len(filtered_data)

    # Pagination
    # TODO: TEST
    filtered_data = paginate_data(filtered_data, filters['pagination'])
    # pprint(filtered_data)
    return filtered_data, pagination_total

def remove_row_filter(row, filters, columns):
    """True to remove row; False to keep row"""
    res = False
    for item in columns:
        column_name = item['field']
        field_type = item['details']['field_type']

        if field_type == 'checkbox-group':
            mode_and = filters['checkboxFilterModes'][column_name]
            filter_list = filters['checkboxFilters'][column_name]
            if len(filter_list) == 0:
                continue
            else:
                # Check if remove row
                if mode_and:
                    # AND
                    if not all(row[f'{column_name}__{item}'] for item in filter_list): return True
                else:
                    # OR
                    if not any(row[f'{column_name}__{item}'] for item in filter_list): return True
        else:
            if column_name not in filters['filters']: continue
            filter_list = filters['filters'][column_name]
            if len(filter_list) == 0: continue

            if field_type == 'list':
                if row[column_name] is None: return True
                if not any(item in row[column_name] for item in filter_list): return True
            elif field_type == 'checkbox':
                if not any(row[column_name] == item for item in filter_list): return True
            else:
                if not any(row[column_name] == item for item in filter_list): return True
    return False

def remove_row_search(row, filters, columns):
    # TODO: Can improve
    return not (filters['search'].lower() in str(row).lower())

def sort_column_key(x, sort_field, column):
    if column['details']['field_type'] == 'checkbox-group':
        checkbox_fields = column['details']['fields']
        return len(list(filter(lambda field: x[f'{sort_field}__{field}'], checkbox_fields)))
    else:
        return x[sort_field]

def paginate_data(data, pagination):
    page = pagination['current']
    pageSize = pagination['pageSize']
    start = (page - 1) * pageSize
    end = start + pageSize
    return data[start:end]