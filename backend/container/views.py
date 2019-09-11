from mongoengine.queryset.visitor import Q
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied
from rest_framework.status import HTTP_201_CREATED, HTTP_200_OK

from .serializers import ContainerSerializer, TermSerializer, DashboardSerializer
from .models import Container, Term

from form.models import Form
from datalab.models import Datalab
from accounts.permissions import CanCreateObjects

from datetime import datetime as dt

import logging

logger = logging.getLogger("ontask")


@api_view(["POST"])
def Dashboard(request):
    if len(request.data) == 0:
        return Response([])

    related_containers = set()

    access_context = {}
    for obj in [(Datalab, "datalabs"), (Form, "forms")]:
        db_model = obj[0]
        accessible_objects = db_model.objects.filter(
            (Q(ltiAccess=True) | Q(emailAccess=True))
            & Q(permitted_users__in=request.user.permission_values)
        )
        related_containers.update(item.container.id for item in accessible_objects)

        context_key = obj[1]
        access_context[f"accessible_{context_key}"] = accessible_objects

    filterIds = [term["id"] for term in request.data]
    if request.user.is_superuser:
        containers = Container.objects.filter(term__in=filterIds).order_by("code")
    else:
        containers = Container.objects.filter(
            Q(owner=request.user.email)
            | Q(sharing__contains=request.user.email)
            | Q(id__in=related_containers)
            | Q(term__in=filterIds)
        ).order_by("code")

    response = []
    for container in containers:
        serializer = DashboardSerializer(
            container,
            context={
                "has_full_permission": container.has_full_permission(request.user),
                **access_context,
            },
        )
        response.append(serializer.data)

    return Response(response)


@api_view(["GET"])
def Terms(request):
    """All Terms and Current Terms in Semester using DateTime.now()"""

    # All Terms
    terms = Term.objects.all().order_by("-term_id")
    allTerms = [TermSerializer(term).data for term in terms]

    # Current Terms
    terms = Term.objects.filter(Q(start__lte=dt.utcnow()) & Q(end__gte=dt.utcnow())).order_by("-term_id")
    currentTerms = [TermSerializer(term).data for term in terms]

    response = {
        "terms": allTerms,
        "currentTerms": currentTerms
    }

    return Response(response)


@api_view(["POST"])
@permission_classes([CanCreateObjects])
def CreateContainer(request):
    # Ensure that the container code is not a duplicate for this user
    if Container.objects.filter(
        owner=request.user.email, code=request.data["code"]
    ).first():
        raise ValidationError("A container with this code already exists")

    container = Container(owner=request.user.email)
    serializer = ContainerSerializer(container, data=request.data)
    serializer.is_valid()
    serializer.save()

    logger.info(
        "container.create", extra={"user": request.user.email, "payload": request.data}
    )

    return Response(serializer.data, status=HTTP_201_CREATED)


class DetailContainer(APIView):
    def get_object(self, id):
        try:
            form = Container.objects.get(id=id)
        except:
            raise NotFound()

        return form

    def patch(self, request, id):
        container = self.get_object(id)

        # Only owner or users with shared access can edit a container
        if not container.has_full_permission(request.user):
            raise PermissionDenied()

        # Ensure that the owner cannot be changed by a malicious payload
        if "owner" in request.data:
            del request.data["owner"]

        # Ensure that only the owner can edit sharing permissions
        if request.user.email != container.owner and "sharing" in request.data:
            del request.data["sharing"]

        # Ensure that the container code is not a duplicate for this user
        if "code" in request.data:
            if Container.objects.filter(
                id__ne=container.id, owner=request.user.email, code=request.data["code"]
            ).first():
                raise ValidationError("A container with this code already exists")
        serializer = ContainerSerializer(container, data=request.data, partial=True)
        serializer.is_valid()
        serializer.save()

        logger.info(
            "container.update",
            extra={"user": request.user.email, "payload": request.data},
        )

        return Response(status=HTTP_200_OK)

    def delete(self, request, id):
        container = self.get_object(id)

        # Only owner can delete a container
        if not container.is_owner(request.user):
            raise PermissionDenied()

        container.delete()

        logger.info(
            "container.delete",
            extra={"user": request.user.email, "container": str(container.id)},
        )

        return Response(status=HTTP_200_OK)


@api_view(["POST"])
def SurrenderAccess(request, id):
    try:
        container = Container.objects.get(id=id)
    except:
        raise NotFound()

    if request.user.email in container.sharing:
        container.sharing.remove(request.user.email)
        container.save()

    logger.info(
        "container.surrender_access",
        extra={"user": request.user.email, "container": str(container.id)},
    )

    return Response(status=HTTP_200_OK)
