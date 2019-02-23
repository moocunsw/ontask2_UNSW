from rest_framework.response import Response
from rest_framework.status import HTTP_201_CREATED, HTTP_200_OK
from rest_framework.views import APIView
from rest_framework.decorators import api_view
from rest_framework.exceptions import PermissionDenied, ValidationError

import pandas as pd
from datetime import datetime as dt

from .serializers import FormSerializer, RestrictedFormSerializer
from .models import Form

from accounts.models import lti
from datalab.utils import get_relations
from datalab.models import Datalab, Column
from datalab.serializers import DatalabSerializer


class ListForms(APIView):
    def post(self, request):
        datalab = Datalab.objects.get(id=request.data.get("datalab"))
        if not datalab.container.has_full_permission(request.user):
            raise PermissionDenied()

        request.data["container"] = str(datalab.container.id)

        serializer = FormSerializer(data=request.data)
        serializer.is_valid()
        form = serializer.save()

        datalab = form.datalab
        datalab.relations = get_relations(datalab)
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

        datalab.relations = get_relations(datalab)
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

        return Response(status=HTTP_200_OK)


class AccessForm(APIView):
    def get_data(self, id):
        try:
            form = Form.objects.get(id=id)
        except:
            raise NotFound()

        accessible_records = (
            pd.DataFrame(data=form.datalab.relations)
            .set_index(form.primary)
            .filter(items=[form.primary, form.permission])
        )

        if form.container.has_full_permission(self.request.user):
            editable_records = accessible_records.index.values
        else:
            user_values = []
            if form.emailAccess:
                user_values.append(self.request.user.email)
            if form.ltiAccess:
                try:
                    lti_object = lti.objects.get(user=self.request.user.id)
                    user_values.extend(lti_object.payload.values())
                except:
                    pass

            if form.primary == form.permission:
                editable_records = accessible_records[
                    accessible_records.index.isin(user_values)
                ]
            else:
                editable_records = accessible_records[
                    accessible_records[form.permission].isin(user_values)
                ]   

            if not len(editable_records):
                # User does not have access to any records, so return a 403
                raise PermissionDenied()

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
        if form.primary in form_data:
            form_data.set_index(form.primary, inplace=True)

        data = datalab_data.join(form_data).reset_index()

        if form.restriction == "private":
            # Limit the records to only those which the user has permission against
            data = data[data[form.primary].isin(editable_records)]

        # Replace NaN values with None
        data.replace({pd.np.nan: None}, inplace=True)

        data = data.to_dict("records")

        if (
            form.activeFrom is not None
            and form.activeFrom > dt.utcnow()
            or form.activeTo is not None
            and form.activeTo < dt.utcnow()
        ):
            editable_records = []

        return [form, data, editable_records]

    def get(self, request, id):
        [form, data, editable_records] = self.get_data(id)

        serializer = RestrictedFormSerializer(
            form, context={"data": data, "editable_records": editable_records}
        )

        return Response(serializer.data)

    def patch(self, request, id):
        [form, data, editable_records] = self.get_data(id)

        primary = request.data.get("primary")
        if primary not in editable_records:
            raise PermissionDenied()

        field = request.data.get("field")
        value = request.data.get("value")

        data = pd.DataFrame(data=form.data)
        if form.primary in data.columns:
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

        # TODO: return the data more efficiently than going through this whole process again
        [form, data, editable_records] = self.get_data(id)
        serializer = RestrictedFormSerializer(
            form, context={"data": data, "editable_records": editable_records}
        )

        return Response(serializer.data)
