from rest_framework_mongoengine.validators import ValidationError
from collections import defaultdict
from datetime import datetime
import numexpr as ne
import pandas as pd
import numpy as np

from .models import Datalab
from datasource.models import Datasource
from workflow.models import Workflow
from form.models import Form
from datalab.serializers import OtherDatalabSerializer


def bind_column_types(steps):
    for step in steps:
        if step["type"] == "datasource":
            step = step["datasource"]
            datasource = None
            datalab = None
            datalab_fields = None

            fields = step["fields"]
            types = step["types"] if "types" in step else {}

            for field in fields:
                if field not in types:
                    if not datasource:
                        try:
                            datasource = Datasource.objects.get(id=step["id"])
                        except:
                            pass

                    if datasource:
                        if field in datasource["types"]:
                            types[field] = datasource["types"][field]
                        else: 
                            print("Field: ", field, " does not exist")

                    if not datalab:
                        try:
                            datalab = Datalab.objects.get(id=step["id"])
                            datalab_fields = OtherDatalabSerializer(datalab).data[
                                "columns"
                            ]
                        except:
                            pass

                    if datalab and datalab_fields:
                        for datalab_field in datalab_fields:
                            if datalab_field["details"]["label"] == field:
                                types[field] = datalab_field["details"]["field_type"]

            step["types"] = types

        elif step["type"] == "computed":
            step = step["computed"]
            for field in step["fields"]:
                if "type" not in field or field["type"] is None:
                    field_type = "number"
                    nodes = field["formula"]["document"]["nodes"]
                    for node in nodes:
                        if node["type"] == "aggregation":
                            aggregation_type = node["data"]["type"]
                            if aggregation_type == "list":
                                field_type = "list"
                            elif aggregation_type == "concat":
                                field_type = "text"
                            elif aggregation_type == "last" and not len(nodes) > 2:
                                field_type = "text"
                    field["type"] = field_type

    return steps


def calculate_computed_field(formula, record, build_fields, tracking_feedback_data):
    calculated_value = 0

    populated_formula = []

    def cast_float(value):
        try:
            return float(value) if not pd.isna(value) else 0
        except (ValueError, TypeError) as Error:
            return 0

    def tracking_feedback_value(action_id, job_id, data_type, record):
        email_field = tracking_feedback_data[action_id]["email_field"]
        data = tracking_feedback_data[action_id]["jobs"][job_id][data_type]
        return (
            data[record[email_field]]
            if email_field in record and record[email_field] in data
            else 0
        )

    def iterate_aggregation(columns, is_numerical=True, is_checkbox_group=False):
        values = []

        for column in columns:
            split_column = column.split("_")

            if split_column[0] in ["tracking", "feedback"]:
                data_type = split_column[0]

                if len(split_column) == 1:
                    for action in tracking_feedback_data:
                        for email_job in tracking_feedback_data[action]["jobs"]:
                            values.append(
                                tracking_feedback_value(
                                    action, email_job, data_type, record
                                )
                            )

                if len(split_column) == 2:
                    action_id = split_column[1]
                    for email_job in tracking_feedback_data[action_id]["jobs"]:
                        values.append(
                            tracking_feedback_value(
                                action_id, email_job, data_type, record
                            )
                        )

                if len(split_column) == 3:
                    action_id = split_column[1]
                    job_id = split_column[2]
                    values.append(
                        tracking_feedback_value(action_id, job_id, data_type, record)
                    )

            else:
                if len(split_column) == 1:
                    step_index = int(split_column[0])
                    if is_checkbox_group is True:
                        prefix = build_fields[step_index][0]
                        # get all fields with this title in its name
                        # for field in record:
                            # print(record[field])
                        for field in list(record.keys()):
                            if prefix in field and record[field] is True:
                                values.append(1)

                    for field in build_fields[step_index]:
                        value = record[field] if field in record else None
                        values.append(cast_float(value) if is_numerical else value)

                elif len(split_column) == 2:
                    step_index, field_index = [int(i) for i in split_column]
                    if step_index in build_fields:
                        if field_index in build_fields[step_index]:
                            field = build_fields[step_index][field_index]
                            value = record[field] if field in record else None
                            values.append(cast_float(value) if is_numerical else value)

        return values

    # Populate values on first pass-through
    for node in formula["document"]["nodes"]:
        node_type = node["type"]

        if node_type == "open-bracket":
            populated_formula.append("(")

        if node_type == "close-bracket":
            populated_formula.append(")")

        if node_type == "operator":
            populated_formula.append(node["data"]["type"])

        if node_type == "field":
            field = node["data"]["name"]
            if field in record:
                populated_formula.append(cast_float(record[field]))

        if node_type == "constant":
            value = node["data"]["value"]
            populated_formula.append(cast_float(value))

        if node_type == "aggregation":
            aggregation_type = node["data"]["type"]
            columns = node["data"]["columns"]
            aggregation_value = 0

            if aggregation_type == "sum_checkbox_group":
                aggregation_value = sum(iterate_aggregation(columns, is_checkbox_group=True))

            if aggregation_type == "sum":
                aggregation_value = sum(iterate_aggregation(columns))

            if aggregation_type == "average":
                values = iterate_aggregation(columns)
                aggregation_value = sum(values) / len(values) if len(values) else 0

            if aggregation_type == "last":
                # If the "last" aggregation is part of a larger formula, then treat
                # it as numerical, since it must be part of a computation
                values = iterate_aggregation(columns, is_numerical=False)
                # If the number of nodes is 2, then the aggregation is standalone
                # It's 2 and not 1, because Slate.js blockmap always starts with a paragraph block
                if len(formula["document"]["nodes"]) > 2:
                    aggregation_value = cast_float(values[-1]) if len(values) else 0
                else:
                    return values[-1] if len(values) else None

            if aggregation_type == "list":
                return iterate_aggregation(columns, is_numerical=False)

            if aggregation_type == "concat":
                delimiter = node["data"]["delimiter"]
                aggregation_value = iterate_aggregation(columns, is_numerical=False)
                # Join values even if they are null, as this would be the expected
                # functionality if the user is trying to construct a .csv
                # I.e. the number of delimiters should be constant for all rows
                # Regardless of whether a given column has a value or not
                return delimiter.join(
                    [str(x) if x is not None else "" for x in aggregation_value]
                )

            populated_formula.append(cast_float(aggregation_value))
            
    populated_formula = "".join([str(x) for x in populated_formula])


    try:
        return ne.evaluate(populated_formula).item()
    except (ZeroDivisionError, AttributeError, TypeError, KeyError, SyntaxError):
        return None


def get_relations(steps, datalab_id=None, skip_last=False, permission=None):
    required_fields = set()

    if permission:
        required_fields.add(permission)

    # Identify the fields used in any associated forms or actions
    if datalab_id:
        forms = Form.objects(datalab=datalab_id)
        for form in forms:
            required_fields.add(form.primary)
            required_fields.add(form.permission)

    # Identify the fields used as matching keys for datasource modules
    datasource_steps = [
        step["datasource"] for step in steps if step["type"] == "datasource"
    ]

    for step_index, step in enumerate(datasource_steps):
        # Always add the primary key of the first module
        # Use its label if provided, otherwise just use the field name
        if step_index == 0:
            required_fields.add(step["labels"].get(step["primary"], step["primary"]))
        else:
            required_fields.add(step["matching"])

    if skip_last:
        datasource_steps = datasource_steps[:-1]

    relations = pd.DataFrame()
    for step_index, step in enumerate(datasource_steps):
        try:
            datasource = Datasource.objects.get(id=step["id"])
        except:
            pass

        try:
            datasource = Datalab.objects.get(id=step["id"])
        except:
            pass

        # If this datasource has fields that are used by forms, actions, or datasources,
        # then ensure that these fields are included in the relation table
        used_fields = []
        for field, label in step["labels"].items():
            if label in required_fields:
                used_fields.append(field)

        data = (
            pd.DataFrame(data=datasource.data)
            .set_index(step["primary"])
            .filter(items=used_fields)  # Only include required fields
            .rename(columns={field: step["labels"][field] for field in used_fields})
        )

        # Ensure that there are no duplicate values
        if any(data.index.duplicated()):
            raise ValidationError(
                f'Field \"{step["primary"]}\" cannot be used as a primary \
                    key in "{datasource.name}" because it contains duplicate values.'
            )

        if step_index == 0:
            relations = data.reset_index().rename(
                columns={
                    step["primary"]: step["labels"].get(
                        step["primary"], step["primary"]
                    )
                }  # Rename the primary key if it has a label
            )
        else:
            if step["discrepencies"]["primary"] and step["discrepencies"]["matching"]:
                # Full outer join
                how = "outer"
            elif step["discrepencies"]["primary"]:
                how = "right"
            elif step["discrepencies"]["matching"]:
                how = "left"
            else:
                how = "inner"

            relations = relations.merge(
                data, how=how, left_on=step["matching"], right_index=True
            ).reset_index(drop=True)

    # Replace NaN values with None to make it storable in MongoDB
    relations.replace({pd.np.nan: None}, inplace=True)

    return relations.to_dict("records")
