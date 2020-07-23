from django.http import JsonResponse, HttpResponse
from rest_framework_mongoengine import viewsets
from rest_framework_mongoengine.validators import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action, list_route, detail_route, api_view
from rest_framework.response import Response
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.status import HTTP_401_UNAUTHORIZED, HTTP_200_OK
from mongoengine.queryset.visitor import Q
from rest_framework.views import APIView

import pandas as pd
import zipfile
import json
from io import BytesIO
from bson import ObjectId

from .serializers import (
    OtherDatalabSerializer,
    DatasourceSerializer,
    DatalabSerializer,
    OrderItemSerializer,
    RestrictedDatalabSerializer,
    FilteredDatalabSerializer
)
from .permissions import DatalabPermissions
from .models import Datalab
from .utils import bind_column_types, get_relations

from container.models import Container
from datasource.models import Datasource
from form.models import Form

import logging

logger = logging.getLogger("ontask")


class DatalabViewSet(viewsets.ModelViewSet):
    lookup_field = "id"
    serializer_class = DatalabSerializer
    permission_classes = [IsAuthenticated, DatalabPermissions]

    def get_queryset(self):
        # Get the containers this user owns or has access to
        containers = Container.objects.filter(
            Q(owner=self.request.user.email)
            | Q(sharing__contains=self.request.user.email)
        )

        # Retrieve only the DataLabs that belong to these containers
        datalabs = Datalab.objects(container__in=containers)

        return datalabs

    def perform_create(self, serializer):
        self.check_object_permissions(self.request, None)

        steps = self.request.data["steps"]
        steps = bind_column_types(steps)

        order = []
        for (step_index, step) in enumerate(steps):
            module_type = step["type"]
            for field in step[module_type]["fields"]:
                order.append(
                    {
                        "stepIndex": step_index,
                        "field": field["name"]
                        if step["type"] in ["form", "computed"]
                        else field,
                    }
                )

        relations = get_relations(steps, permission=self.request.data.get("permission"))

        datalab = serializer.save(steps=steps, order=order, relations=relations)
        datalab.refresh_access()

        logger.info(
            "datalab.create",
            extra={"user": self.request.user.email, "payload": self.request.data},
        )

    def perform_update(self, serializer):
        datalab = self.get_object()
        self.check_object_permissions(self.request, datalab)

        steps = self.request.data["steps"]
        steps = bind_column_types(steps)

        order = [
            {
                "stepIndex": item["stepIndex"],
                "field": item["field"],
                "visible": item["visible"],
                "pinned": item["pinned"],
            }
            for item in datalab.order
        ]

        fields = {}
        for step_index, step in enumerate(steps):
            if step["type"] == "datasource":
                fields[step_index] = step["datasource"]["fields"]

            elif step["type"] == "form":
                form_fields = Form.objects.get(id=step["form"]).fields
                fields[step_index] = [field["name"] for field in form_fields]

            elif step["type"] == "computed":
                fields[step_index] = [
                    field["name"] for field in step["computed"]["fields"]
                ]

        # Check for any removed fields and remove from order list
        for item in order:
            step_fields = fields.get(item["stepIndex"], [])
            if item["field"] not in step_fields:
                order = [
                    x
                    for x in order
                    if not (
                        x["field"] == item["field"]
                        and x["stepIndex"] == item["stepIndex"]
                    )
                ]

        for step_index, step_fields in fields.items():
            for field in step_fields:
                order_item = next(
                    (
                        item
                        for item in order
                        if item["stepIndex"] == step_index and item["field"] == field
                    ),
                    None,
                )
                if not order_item:
                    order.append({"stepIndex": step_index, "field": field})

        relations = get_relations(
            steps, datalab_id=datalab.id, permission=self.request.data.get("permission")
        )

        datalab = serializer.save(steps=steps, order=order, relations=relations)
        datalab.refresh_access()

        logger.info(
            "datalab.update",
            extra={"user": self.request.user.email, "payload": self.request.data},
        )

    def perform_destroy(self, datalab):
        self.check_object_permissions(self.request, datalab)
        datalab.delete()

        logger.info(
            "datalab.delete",
            extra={"user": self.request.user.email, "datalab": str(datalab.id)},
        )

    @action(detail=False, methods=["post"])
    def check_discrepencies(self, request):
        datalab_id = request.data.get("dataLabId")

        if datalab_id:
            try:
                datalab = Datalab.objects.get(id=request.data.get("dataLabId"))
                self.check_object_permissions(self.request, datalab)
            except:
                raise NotFound()

        steps = request.data.get("partial", [])

        # Use all steps to calculate the required_fields, but skip the last step
        # when actually constructing the relations table. This is only done when
        # checking for discrepencies, as we want to compare the joined table
        # against this step's primary key.
        data = get_relations(steps, datalab_id=datalab_id, skip_last=True)

        check_module = steps[-1]["datasource"]
        try:
            datasource = Datasource.objects.get(id=check_module["id"])
        except:
            pass

        try:
            datasource = Datalab.objects.get(id=check_module["id"])
        except:
            pass

        primary_records = {item[check_module["primary"]] for item in datasource.data}
        matching_records = {
            item[check_module["matching"]]
            for item in data
            if check_module["matching"] in item
        }

        # Values which are in the primary datasource but not the matching
        primary_discrepencies = primary_records - matching_records
        # Values which are in the matching datasource but not the primary
        matching_discrepencies = matching_records - primary_records

        if request.data.get("isExport"):
            primary_discrepencies = pd.DataFrame(
                list(primary_discrepencies),
                columns=[f"{check_module['primary']}_discrepencies"],
            )
            matching_discrepencies = pd.DataFrame(
                list(matching_discrepencies),
                columns=[f"{check_module['matching']}_discrepencies"],
            )
            name = datasource.name

            output = BytesIO()
            csv_zip = zipfile.ZipFile(output, "w", zipfile.ZIP_DEFLATED)
            if len(primary_discrepencies > 0):
                csv_zip.writestr(
                    f"{check_module['primary']}_discrepencies.csv",
                    primary_discrepencies.to_csv(index=False),
                )
            if len(matching_discrepencies > 0):
                csv_zip.writestr(
                    f"{check_module['matching']}_discrepencies.csv",
                    matching_discrepencies.to_csv(index=False),
                )
            csv_zip.close()
            output.seek(0)

            response = HttpResponse(output, content_type="application/zip")
            response[
                "Content-Disposition"
            ] = f"attachment; filename={name}_discrepencies.zip"
            response["Access-Control-Expose-Headers"] = "Content-Disposition"

            return response

        else:
            return Response(
                {
                    "primary": list(primary_discrepencies)
                    if len(primary_discrepencies) > 0
                    else [],
                    "matching": list(matching_discrepencies)
                    if len(matching_discrepencies) > 0
                    else [],
                }
            )

    @detail_route(methods=["patch"])
    def change_column_order(self, request, id=None):
        datalab = self.get_object()
        self.check_object_permissions(self.request, datalab)

        order = [
            {
                "stepIndex": item["stepIndex"],
                "field": item["field"],
                "visible": item["visible"],
                "pinned": item["pinned"],
            }
            for item in datalab.order
        ]
        drag_index = request.data["dragIndex"]
        hover_index = request.data["hoverIndex"]

        field = order.pop(drag_index)
        order.insert(hover_index, field)

        serializer = DatalabSerializer(
            instance=datalab, data={"order": order}, partial=True
        )
        serializer.is_valid()
        serializer.save()

        logger.info(
            "datalab.reorder_columns",
            extra={"user": self.request.user.email, "payload": self.request.data},
        )

        return JsonResponse(serializer.data)

    @detail_route(methods=["patch"])
    def change_column_visibility(self, request, id=None):
        datalab = self.get_object()
        self.check_object_permissions(self.request, datalab)

        column_index = request.data["columnIndex"]
        visible = request.data["visible"]

        order = [
            {
                "stepIndex": item["stepIndex"],
                "field": item["field"],
                "visible": item["visible"],
                "pinned": item["pinned"],
            }
            for item in datalab.order
        ]
        order[column_index]["visible"] = visible

        serializer = DatalabSerializer(
            instance=datalab, data={"order": order}, partial=True
        )
        serializer.is_valid()
        serializer.save()

        logger.info(
            "datalab.change_column_visibility",
            extra={"user": self.request.user.email, "payload": self.request.data},
        )

        return Response(status=HTTP_200_OK)

    @detail_route(methods=["patch"])
    def change_pinned_status(self, request, id=None):
        datalab = self.get_object()
        self.check_object_permissions(self.request, datalab)

        column_index = request.data["columnIndex"]
        pinned = request.data["pinned"]

        order = [
            {
                "stepIndex": item["stepIndex"],
                "field": item["field"],
                "visible": item["visible"],
                "pinned": item["pinned"],
            }
            for item in datalab.order
        ]
        order[column_index]["pinned"] = pinned

        serializer = DatalabSerializer(
            instance=datalab, data={"order": order}, partial=True
        )
        serializer.is_valid()
        serializer.save()

        logger.info(
            "datalab.change_column_pinned",
            extra={"user": self.request.user.email, "payload": self.request.data},
        )

        return Response(status=HTTP_200_OK)

    @detail_route(methods=["patch"])
    def update_field_type(self, request, id=None):
        datalab = self.get_object()
        self.check_object_permissions(self.request, datalab)

        step_index = request.data["stepIndex"]
        field_name = request.data["field"]
        field_type = request.data["type"]

        module_type = datalab.steps[step_index].type

        if module_type == "datasource":
            datalab.steps[step_index].datasource.types[field_name] = field_type

        elif module_type == "computed":
            field = next(
                (
                    field
                    for field in datalab.steps[step_index].computed.fields
                    if field.name == field_name
                ),
                None,
            )
            if field:
                field.type = field_type

        datalab.save()

        logger.info(
            "datalab.update_column_type",
            extra={"user": self.request.user.email, "payload": self.request.data},
        )

        return Response(status=HTTP_200_OK)

    @detail_route(methods=["patch"])
    def update_chart(self, request, id=None):
        datalab = self.get_object()
        self.check_object_permissions(self.request, datalab)

        charts = datalab["charts"]

        for i in range(len(charts)):
            charts[i] = json.loads(charts[i].to_json())

        charts.append(request.data)

        serializer = DatalabSerializer(
            instance=datalab, data={"charts": charts}, partial=True
        )
        serializer.is_valid()
        serializer.save()

        return JsonResponse(serializer.data)

    @detail_route(methods=["post"])
    def clone_datalab(self, request, id=None):
        datalab = self.get_object()
        self.check_object_permissions(self.request, datalab)

        datalab = datalab.to_mongo()
        datalab["name"] = datalab["name"] + "_cloned"
        datalab.pop("_id")

        serializer = DatalabSerializer(data=datalab)
        serializer.is_valid()
        serializer.save()

        logger.info(
            "datalab.clone",
            extra={"user": self.request.user.email, "datalab": str(id)},
        )

        return JsonResponse({"success": 1})


@api_view(["GET"])
def AccessDataLab(request, id):
    try:
        datalab = Datalab.objects.get(id=id)
    except:
        raise NotFound()

    if datalab.container.has_full_permission(request.user):
        # request.data is equivalent of no filters
        serializer = DatalabSerializer(datalab, context={"filters": request.data})
        return Response(serializer.data)

    user_values = []
    if datalab.emailAccess:
        user_values.append(request.user.email.lower())
    if datalab.ltiAccess:
        try:
            lti_object = lti.objects.get(user=request.user.id)
            user_values.extend([value.lower() for value in lti_object.payload.values()])
        except:
            pass

    data = pd.DataFrame(data=datalab.data)
    accessible_records = data[data[datalab.permission].str.lower().isin(user_values)]

    if not len(accessible_records):
        # User does not have access to any records, so return a 403
        raise PermissionDenied()

    if datalab.restriction == "private":
        data = accessible_records

    default_group = (
        accessible_records[datalab.groupBy].iloc[0] if datalab.groupBy else None
    )

    data.replace({pd.np.nan: None}, inplace=True)
    serializer = RestrictedDatalabSerializer(
        datalab,
        context={"data": data.to_dict("records"), "default_group": default_group},
    )

    logger.info(
        "datalab.access",
        extra={"user": request.user.email, "datalab": str(datalab.id)},
    )

    return Response(serializer.data)


@api_view(["POST"])
def FilterData(request, id):
    try:
        datalab = Datalab.objects.get(id=id)
    except:
        raise NotFound()

    serializer = FilteredDatalabSerializer(datalab, context={"filters": request.data})

    return Response(serializer.data)

@api_view(["POST"])
def ExportToCSV(request, id):
    try:
        datalab = Datalab.objects.get(id=id)
    except:
        raise NotFound()

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = f"attachment; filename={datalab.name}.csv"
    response["Access-Control-Expose-Headers"] = "Content-Disposition"

    data = pd.DataFrame(datalab.data)

    if not datalab.container.has_full_permission(request.user):
        user_values = []
        if datalab.emailAccess:
            user_values.append(request.user.email)
        if datalab.ltiAccess:
            try:
                lti_object = lti.objects.get(user=request.user.id)
                user_values.extend(lti_object.payload.values())
            except:
                pass
        accessible_records = data[data[datalab.permission].isin(user_values)]

        if not len(accessible_records):
            # User does not have access to any records, so return a 403
            raise PermissionDenied()

        if datalab.restriction == "private":
            data = accessible_records

    # Re-order the columns to match the original datasource data
    order = OrderItemSerializer(
        datalab.order, many=True, context={"steps": datalab.steps}
    )

    reordered_columns = []
    boolean_columns = []
    list_columns = []
    for item in order.data:
        if item["details"]["field_type"] == "checkbox-group":
            reordered_columns.extend(item["details"]["fields"])
            boolean_columns.extend(item["details"]["fields"])
        else:
            if item["details"]["field_type"] == "checkbox":
                boolean_columns.append(item["details"]["label"])
            elif item["details"]["field_type"] == "list":
                list_columns.append(item["details"]["label"])
            reordered_columns.append(item["details"]["label"])

    data = data.reindex(columns=reordered_columns)
    data[boolean_columns] = data[boolean_columns].fillna(False)
    data[list_columns] = data[list_columns].applymap(
        lambda x: ",".join(x) if isinstance(x, list) else x
    )

    data.to_csv(path_or_buf=response, index=False)

    logger.info(
        "datalab.export_to_csv",
        extra={"user": request.user.email, "datalab": str(datalab.id)},
    )

    return response


@api_view(["GET"])
def CreateDataLab(request):
    container_id = request.query_params.get("container")
    if not container_id:
        raise ValidationError("A container must be specified when creating a DataLab")

    try:
        container = Container.objects.get(id=ObjectId(container_id))
    except:
        raise NotFound()

    if not container.has_full_permission(request.user):
        raise PermissionDenied()

    response = {
        "datasources": DatasourceSerializer(
            Datasource.objects(container=container), many=True
        ).data,
        "dataLabs": OtherDatalabSerializer(
            Datalab.objects(container=container), many=True
        ).data,
    }

    logger.info(
        "datalab.create", extra={"user": request.user.email, "payload": request.data}
    )

    return Response(response, status=HTTP_200_OK)
