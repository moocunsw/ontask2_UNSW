from django.http import HttpResponse
from rest_framework.response import Response
from rest_framework.status import HTTP_201_CREATED, HTTP_200_OK
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, IsAdminUser

import pandas as pd
from datetime import datetime as dt
import csv

from .serializers import FormSerializer, RestrictedFormSerializer
from .models import Form
from .utils import get_filters, get_column_filter, get_filtered_data

from accounts.models import lti
from datalab.utils import get_relations
from datalab.models import Datalab, Column
from datalab.serializers import DatalabSerializer

from jwt import decode
from ontask.settings import SECRET_KEY

import logging

logger = logging.getLogger("ontask")

class ListForms(APIView):
    def post(self, request):
        datalab = Datalab.objects.get(id=request.data.get("datalab"))
        if not datalab.container.has_full_permission(request.user):
            raise PermissionDenied()

        request.data["container"] = str(datalab.container.id)
        serializer = FormSerializer(data=request.data)
        serializer.is_valid()
        form = serializer.save()

        logger.info(
            "form.create", extra={"user": request.user.email, "payload": request.data}
        )

        datalab = form.datalab
        datalab.relations = get_relations(
            datalab.steps, datalab_id=datalab.id, permission=datalab.permission
        )
        datalab.save()

        form.refresh_access()

        return Response(serializer.data, status=HTTP_201_CREATED)


class DetailForm(APIView):
    def get_object(self, id):
        try:
            form = Form.objects.get(id=id)
        except:
            raise NotFound()

        request_user = self.request.user.email
        if not form.container.has_full_permission(self.request.user):
            raise PermissionDenied()

        return form

    def patch(self, request, id):
        form = self.get_object(id)

        if "container" in request.data:
            del request.data["container"]
        if "datalab" in request.data:
            del request.data["datalab"]

        # If the primary key has changed, then reset the form data
        if form.primary != request.data["primary"]:
            form.data = []

        # Check if the form is being used in the DataLab
        datalab = form.datalab
        form_fields = [field.get("name") for field in request.data.get("fields", [])]
        order_items = [item.field for item in datalab.order]

        for step_index, step in enumerate(datalab.steps):
            # The form is being used by the DataLab
            if step.type == "form" and step.form == id:
                for item in datalab.order:
                    # If a form field was removed, then remove it from the DataLab order items
                    if item.stepIndex == step_index and item.field not in form_fields:
                        datalab.order = [
                            x
                            for x in datalab.order
                            if not (
                                x.field == item.field and x.stepIndex == item.stepIndex
                            )
                        ]

                for field in form_fields:
                    # If a form field was added, then add it to the DataLab order items
                    if field not in order_items:
                        datalab.order.append(
                            Column(
                                stepIndex=step_index,
                                field=field,
                                visible=True,
                                pinned=False,
                            )
                        )

                break

        serializer = FormSerializer(form, data=request.data, partial=True)
        serializer.is_valid()
        serializer.save()

        logger.info(
            "form.edit",
            extra={"id": id, "user": request.user.email, "payload": request.data},
        )

        datalab.relations = get_relations(
            datalab.steps, datalab_id=datalab.id, permission=datalab.permission
        )
        datalab.save()

        form.refresh_access()

        serializer = FormSerializer(
            form, context={"updated_datalab": DatalabSerializer(datalab).data}
        )

        return Response(serializer.data, status=HTTP_200_OK)

    def delete(self, request, id):
        form = self.get_object(id)

        for step in form.datalab.steps:
            if step.type == "form" and step.form == id:
                raise ValidationError("Form is being used by a DataLab")

        form.delete()

        logger.info("form.delete", extra={"id": id, "user": request.user.email})

        return Response(status=HTTP_200_OK)


class AccessForm(APIView):
    permission_classes = (AllowAny,)

    def get_data(self, id, token):
        try:
            form = Form.objects.get(id=id)
        except:
            raise NotFound()

        accessible_records = pd.DataFrame(data=form.datalab.data).set_index(
            form.primary
        )

        user_values = []

        # Get User Email from logged in user or jwt token
        if self.request.user.is_authenticated:
            email = self.request.user.email.lower()
            has_full_permission = form.container.has_full_permission(self.request.user)
        elif token is not None:
            has_full_permission = False
            try:
                decrypted_token = decode(token, SECRET_KEY, algorithm='HS256')
                email = decrypted_token['email'].lower()
            except:
                raise PermissionDenied()
        else:
            raise PermissionDenied()

        if has_full_permission:
            editable_records = accessible_records.index.values
            default_group = (
                accessible_records[form.groupBy].iloc[0] if form.groupBy else None
            )
        else:
            if form.emailAccess:
                user_values.append(email)
            if form.ltiAccess:
                try:
                    lti_object = lti.objects.get(user=self.request.user.id)
                    user_values.extend(
                        [value.lower() for value in lti_object.payload.values()]
                    )
                except:
                    pass

            if form.primary == form.permission:
                editable_records = accessible_records[
                    accessible_records.index.str.lower().isin(user_values)
                ]
            else:
                editable_records = accessible_records[
                    accessible_records[form.permission].str.lower().isin(user_values)
                ]

            if not len(editable_records):
                # User does not have access to any records, so return a 403
                raise PermissionDenied()

            default_group = (
                editable_records[form.groupBy].iloc[0] if form.groupBy else None
            )

            if form.restriction == "open":
                editable_records = accessible_records.index.values
            else:
                editable_records = editable_records.index.values

        datalab_data = (
            pd.DataFrame(data=form.datalab.data)
            .set_index(form.primary)
            .filter(items=[form.primary, *form.visibleFields])
        )

        form_data = pd.DataFrame(data=form.data)
        # Only include fields that are in the form design
        # (Some fields may have data, but were removed)
        form_fields = [form.primary]
        for field in form.fields:
            if field.type == "checkbox-group":
                form_fields.extend([f"{field.name}__{column}" for column in field.columns])
            else:
                form_fields.append(field.name)

        form_data = form_data.reindex(columns=form_fields)

        if form.primary in form_data:
            form_data.set_index(form.primary, inplace=True)

        data = datalab_data.join(form_data).reset_index()

        if form.restriction == "private":
            # Limit the records to only those which the user has permission against
            data = data[data[form.primary].isin(editable_records)]

        # Replace NaN values with None
        data.replace({pd.np.nan: None}, inplace=True)

        data = data.to_dict("records")

        if not has_full_permission and (
            (form.activeFrom is not None and form.activeFrom > dt.utcnow())
            or (form.activeTo is not None and form.activeTo < dt.utcnow())
        ):
            editable_records = []

        return [form, data, editable_records, default_group, email]

    def get_filter_details(self, form, data, filters={}):
        # Create Columns

        # Add Primary Field
        columns = [
            {
                'field': form.primary,
                'details': {
                    'label': form.primary,
                    'field_type': 'text',
                    'options': [],
                    'fields': []
                }
            }
        ]

        # Add Additional Fields
        for field in form.visibleFields:
            columns.append(
                {
                    'field': field,
                    'details': {
                        'label': field,
                        'field_type': 'text',
                        'options': [],
                        'fields': []
                    }
                }
            )

        for field in form.fields:
            columns.append(
                {
                    'field': field.name,
                    'details': {
                        'label': field.name,
                        'field_type': field.type,
                        'options': field.options,
                        'fields': field.columns
                    }
                }
            )

        df = pd.DataFrame.from_dict(data)
        group_column = next(column for column in columns if column['details']['label'] == form.groupBy) if form.groupBy is not None else None

        filtered_data, pagination_total = get_filtered_data(data, columns, filters, form.groupBy)

        return (
            {
                'dataNum': len(data),
                'paginationTotal': pagination_total,
                'filters': get_filters(df, columns),
                'filteredData': filtered_data,
                'groups': get_column_filter(df, group_column)
            }
        )


    def get(self, request, id, token=None):
        [form, data, editable_records, default_group, email] = self.get_data(id, token)

        serializer = RestrictedFormSerializer(
            form,
            context={
                "data": data,
                "editable_records": editable_records,
                "default_group": default_group,
            },
        )

        logger.info("form.access", extra={"id": id, "user": email})

        result = {
            **serializer.data,
            'filter_details': self.get_filter_details(form, data)
        }
        return Response(result)


    def patch(self, request, id, token=None):
        # Data is cleaned up version of form.data
        [form, data, editable_records, default_group, email] = self.get_data(id, token)

        primary = request.data.get("primary")
        if primary not in editable_records:
            raise PermissionDenied()

        field = request.data.get("field")
        value = request.data.get("value")

        data = pd.DataFrame(data=form.data)
        if form.primary in data.columns:
            # Sort dataframe by form.primary
            data.set_index(form.primary, inplace=True)
            data = data.T.to_dict()
            if primary in data:
                data[primary][field] = value
            else:
                data[primary] = {field: value}
            data = (
                pd.DataFrame.from_dict(data, orient="index")
                .rename_axis(form.primary)
                .reset_index()
            )
        else:
            data = pd.DataFrame(data=[{form.primary: primary, field: value}])

        # Replace NaN values with None
        data.replace({pd.np.nan: None}, inplace=True)
        data = data.to_dict("records")
        form.data = data
        form.save()

        logger.info(
            "form.input",
            extra={"id": id, "user": email, "payload": request.data},
        )

        # Get & Return New Filter Details
        [form, data, editable_records, default_group, email] = self.get_data(id, token)

        return Response(self.get_filter_details(form, data, request.data.get("filterOptions")), status=HTTP_200_OK)

    def post(self, request, id, token=None):
        """Apply Filter"""
        [form, data, editable_records, default_group, email] = self.get_data(id, token)

        return Response(self.get_filter_details(form, data, request.data), status=HTTP_200_OK)

@api_view(["POST"])
@permission_classes([IsAdminUser])
def ExportStructure(request, id):
    try:
        form = Form.objects.get(id=id)
    except:
        raise NotFound()

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f"attachment; filename={form.name}.csv"
    response["Access-Control-Expose-Headers"] = "Content-Disposition"

    # Identify the form field names, include the form primary key as the
    # first field so that the join can be performed on the later import
    fields = [form.primary]
    for field in form.fields:
        if field.type == "checkbox-group":
            fields.extend(field.columns)
        else:
            fields.append(field.name)

    df = pd.DataFrame(data=form.data)

    datalab_data = (
        pd.DataFrame(data=form.datalab.data)
        .set_index(form.primary)
        .filter(items=[form.primary, *form.visibleFields])
    )

    form_data = pd.DataFrame(data=form.data)
    # Only include fields that are in the form design
    # (Some fields may have data, but were removed)
    form_fields = [form.primary]
    for field in form.fields:
        if field.type == "checkbox-group":
            form_fields.extend([f"{field.name}__{column}" for column in field.columns])
        else:
            form_fields.append(field.name)

    form_data = form_data.reindex(columns=form_fields)

    if form.primary in form_data:
        form_data.set_index(form.primary, inplace=True)

    data = datalab_data.join(form_data).reset_index()

    data.replace({pd.np.nan: False}, inplace=True)

    data.to_csv(path_or_buf=response, index=False)

    # pd.DataFrame(data=form.data).reindex(columns=fields).to_csv(
    #     path_or_buf=response, index=False
    # )

    logger.info("form.export", extra={"id": id, "user": request.user.email})

    return response


@api_view(["POST"])
@permission_classes([IsAdminUser])
def ImportData(request, id):
    try:
        form = Form.objects.get(id=id)
    except:
        raise NotFound()

    original_columns = [form.primary]
    
    for col in form.fields:
        original_columns.append(col.name)

    data = pd.DataFrame(form.data)

    form_data = pd.DataFrame(form.data).set_index(form.primary).T.to_dict()
    imported_data = (
        pd.read_csv(request.data["file"])
    )

    imported_data = (
        imported_data
        .replace({pd.np.nan: None})
        .set_index(imported_data.columns[0])
        .T.to_dict()
    )
    for primary, values in imported_data.items():
        form_data[primary] = values

    form_data = (
        pd.DataFrame.from_dict(form_data, orient="index")
        .rename_axis(form.primary)
        .reset_index()
    )

    # remove the data that isn't included?
    for col in form_data.columns:
        if col not in original_columns:
            form_data.drop([col], axis=1, inplace=True)

    # Replace NaN values with None
    form_data.replace({pd.np.nan: None}, inplace=True)

    form.data = form_data.to_dict("records")
    form.save()

    logger.info(
        "form.import",
        extra={
            "id": id,
            "user": request.user.email,
            "payload": imported_data
        },
    )

    return Response(status=HTTP_200_OK)
