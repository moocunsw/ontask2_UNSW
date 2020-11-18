from rest_framework.views import APIView
from rest_framework_mongoengine import viewsets
from rest_framework_mongoengine.validators import ValidationError
from rest_framework.decorators import detail_route, list_route
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from django.http import HttpResponse, JsonResponse, HttpResponseRedirect
from rest_framework.status import HTTP_200_OK, HTTP_400_BAD_REQUEST
from mongoengine.queryset.visitor import Q

import os
from json import dumps
from datetime import datetime
from bson import ObjectId
import base64
import jwt

from .serializers import ActionSerializer
from .models import Workflow, EmailSettings, EmailJob, Email, Rule, Filter, Schedule
from .permissions import WorkflowPermissions

from container.models import Container

from scheduler.utils import create_task, delete_task

from ontask.settings import SECRET_KEY, BACKEND_DOMAIN

import logging

logger = logging.getLogger("ontask")

PIXEL_GIF_DATA = base64.b64decode(
    b"R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
)


class WorkflowViewSet(viewsets.ModelViewSet):
    lookup_field = "id"
    serializer_class = ActionSerializer
    permission_classes = [IsAuthenticated, WorkflowPermissions]

    def get_queryset(self):
        # Get the containers this user owns or has access to
        containers = Container.objects.filter(
            Q(owner=self.request.user.email)
            | Q(sharing__contains=self.request.user.email)
        )

        # Retrieve only the DataLabs that belong to these containers
        actions = Workflow.objects(container__in=containers)

        return actions

    def perform_create(self, serializer):
        self.check_object_permissions(self.request, None)
        serializer.save()

        logger.info(
            "action.create",
            extra={"user": self.request.user.email, "payload": self.request.data},
        )

    def perform_update(self, serializer):
        self.check_object_permissions(self.request, self.get_object())
        serializer.save()

        logger.info(
            "action.update",
            extra={"user": self.request.user.email, "payload": self.request.data},
        )

    def perform_destroy(self, action):
        self.check_object_permissions(self.request, action)

        # If a schedule already exists for this action, then delete it
        if "schedule" in action and "taskName" in action["schedule"]:
            remove_scheduled_task(action["schedule"]["taskName"])

        if "schedule" in action and "asyncTasks" in action["schedule"]:
            remove_async_task(action["schedule"]["asyncTasks"])

        action.delete()

        logger.info(
            "action.delete",
            extra={"user": self.request.user.email, "action": str(action.id)},
        )

    @detail_route(methods=["post", "put", "delete"])
    def filter(self, request, id=None):
        action = self.get_object()
        self.check_object_permissions(request, action)

        if request.method in ["PUT", "POST"]:
            new_filter = Filter(**request.data.get("filter"))
            action.filter = new_filter
            logger.info(
                "action.create_filter"
                if request.method == "POST"
                else "action.update_filter",
                extra={"user": self.request.user.email, "payload": self.request.data},
            )

        elif request.method == "DELETE":
            action.filter = None
            logger.info(
                "action.delete_filter",
                extra={"user": self.request.user.email, "payload": self.request.data},
            )

        action.save()

        serializer = ActionSerializer(action)
        return Response(serializer.data)

    @detail_route(methods=["post", "put", "delete"])
    def rules(self, request, id=None):
        action = self.get_object()
        self.check_object_permissions(request, action)

        rule = request.data.get("rule")

        if request.method == "POST":
            action.rules += [Rule(**rule)]  # Add to end of list

            logger.info(
                "action.create_rule",
                extra={"user": self.request.user.email, "payload": self.request.data},
            )

        elif request.method == "PUT":
            updated_rule = Rule(**rule)

            for i, old_rule in enumerate(action.rules):
                if not str(old_rule.ruleId) == rule["ruleId"]:
                    continue

                updated_rule_conditions = {
                    str(condition.conditionId) for condition in updated_rule.conditions
                }
                old_rule_conditions = {
                    str(condition.conditionId) for condition in old_rule.conditions
                }

                deleted_conditions = old_rule_conditions - updated_rule_conditions

                action.rules[i] = updated_rule

                logger.info(
                    "action.update_rule",
                    extra={
                        "user": self.request.user.email,
                        "payload": self.request.data,
                    },
                )
                break

        elif request.method == "DELETE":
            for i, old_rule in enumerate(action.rules):
                if not str(old_rule.ruleId) == rule["ruleId"]:
                    continue

                deleted_conditions = [
                    str(condition.conditionId) for condition in old_rule.conditions
                ] + [str(old_rule.catchAll)]

                del action.rules[i]

                logger.info(
                    "action.delete_rule",
                    extra={
                        "user": self.request.user.email,
                        "payload": self.request.data,
                    },
                )
                break

        action.save()

        serializer = ActionSerializer(action)
        return Response(serializer.data)

    @detail_route(methods=["get", "post", "put"])
    def content(self, request, id=None):
        action = self.get_object()
        self.check_object_permissions(request, action)

        # Currently stored content is being previewed
        if request.method == "GET":
            populated_content = action.populate_content()
            return Response(populated_content)
        else:
            content = request.data.get("content")["html"]

            # User-provided content is being previewed
            if request.method == "POST":
                populated_content = action.populate_content(content)
                return Response(populated_content)

            # Content is being updated
            elif request.method == "PUT":
                action.content = content
                action.save()
                serializer = ActionSerializer(action)

                logger.info(
                    "action.update_content",
                    extra={
                        "user": self.request.user.email,
                        "payload": self.request.data,
                    },
                )

                return Response(serializer.data)

    @detail_route(methods=["put", "delete"])
    def schedule(self, request, id=None):
        action = self.get_object()
        self.check_object_permissions(request, action)

        # If a schedule already exists for this action, then delete it
        if "schedule" in action:
            delete_task(action.schedule.task_name)

        if request.method == "PUT":
            task_name = create_task(
                "workflow_send_email", request.data, {"action_id": id}
            )
            request.data["task_name"] = task_name

            action.schedule = Schedule(**request.data)

            logger.info(
                "action.update_schedule",
                extra={"user": self.request.user.email, "payload": self.request.data},
            )

        if request.method == "DELETE" and "schedule" in action:
            delete_task(action.schedule.task_name)
            action.schedule = None

            logger.info(
                "action.delete_schedule",
                extra={"user": self.request.user.email, "payload": self.request.data},
            )

        action.save()

        serializer = ActionSerializer(action)
        return Response(serializer.data)

    @detail_route(methods=["post"])
    def email(self, request, id=None):
        action = self.get_object()
        self.check_object_permissions(self.request, action)

        if os.environ.get("ONTASK_DEMO") is not None:
            raise ValidationError("Email sending is disabled in the demo")

        if not action.content:
            raise ValidationError("Email content cannot be empty.")

        action.emailLocked = True
        action.save()
        action.send_email()

        logger.info(
            "action.trigger_email_send",
            extra={"user": self.request.user.email, "payload": self.request.data},
        )

        return Response({"success": "true"})

    @detail_route(methods=["get"])
    def locked(self, request, id=None):
        action = self.get_object()
        self.check_object_permissions(self.request, action)

        action = ActionSerializer(action).data
        return Response(
            {"emailLocked": action["emailLocked"], "emailJobs": action["emailJobs"], "status": action["currentEmailJob"]}
        )

    @list_route(methods=["get"], permission_classes=[AllowAny])
    def read_receipt(self, request):
        token = request.GET.get("email")
        decrypted_token = None

        if token:
            try:
                decrypted_token = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            except Exception:
                # Invalid token, ignore the read receipt
                return HttpResponse(PIXEL_GIF_DATA, content_type="image/gif")

            action = Workflow.objects.get(id=decrypted_token["action_id"])

            did_update = False
            for job in action.emailJobs:
                if str(job.job_id) == decrypted_token["job_id"]:
                    for email in job.emails:
                        if email.email_id == decrypted_token["email_id"]:
                            if not email.first_tracked:
                                email.first_tracked = datetime.utcnow()
                            else:
                                email.last_tracked = datetime.utcnow()
                            email.track_count += 1
                            did_update = True
                            break
                    break

            if did_update:
                action.save()

        return HttpResponse(PIXEL_GIF_DATA, content_type="image/gif")

    @list_route(methods=["get"], permission_classes=[AllowAny])
    def link_click(self, request):
        token = request.GET.get("token")
        decrypted_token = None

        if token:
            try:
                decrypted_token = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
            except Exception:
                # Invalid token, ignore the read receipt
                return HttpResponse()

            action = Workflow.objects.get(id=decrypted_token["action_id"])
            print("decrypted token: ", decrypted_token)
            did_update = False
            for job in action.emailJobs:
                if str(job.job_id) == decrypted_token["job_id"]:
                    for email in job.emails:
                        if email.email_id == decrypted_token["email_id"]:
                            baseURL = decrypted_token["href"].split('?')
                            print('BASE URL: ', baseURL)
                            # email.first_tracked = datetime.utcnow()
                            links = email.link_clicks
                            if baseURL[0] in links:
                                links[str(baseURL[0].replace('.', '(dot)'))] += 1
                            else:
                                links[str(baseURL[0].replace('.', '(dot)'))] = 1
                            did_update = True
                            break
                    break

            if did_update:
                action.save()

        return HttpResponseRedirect(decrypted_token["href"])
    
    @detail_route(methods=["post"])
    def clone_action(self, request, id=None):
        action = self.get_object()
        self.check_object_permissions(self.request, action)

        action = action.to_mongo()
        action["name"] = action["name"] + "_cloned"
        action.pop("_id")
        # The scheduled tasks in Celery are not cloned, therefore remove the schedule
        # information from the cloned action
        action.pop("schedule")
        # Ensure that the new action is not bound to the original action's Moodle link Id
        action.pop("linkId")

        serializer = ActionSerializer(data=action)
        serializer.is_valid()
        serializer.save()

        logger.info(
            "action.clone", extra={"user": self.request.user.email, "action": str(id)}
        )

        return Response(status=HTTP_200_OK)

    # different as it copies to a different container.
    @detail_route(methods=["post"])
    def copy_action(self, request, id=None):
        action = self.get_object()
        self.check_object_permissions(self.request, action)

        data = request.data

        action = action.to_mongo().to_dict()

        action.pop("_id")
        action.pop("schedule")
        action.pop("linkId")
        action.pop("emailJobs")
        action.pop("datalab")

        action["container"] = data["containerId"]
        action["name"] = data["name"]
        action["datalab"] = data["datalabId"]
        # action["emailSettings"]["field"] = ""

        # action.container = data["containerId"]
        # action.datalab = data["datalabId"]
        # action.emailSettings["field"] = ""

        serializer = ActionSerializer(data=action)
        serializer.is_valid()
        serializer.save()

        logger.info(
            "action.clone", extra={"user": self.request.user.email, "action": str(id)}
        )

        return Response(serializer.data)

    @detail_route(methods=["post"])
    def unlock_action(self, request, id=None):
        try:
            action = self.get_object()
            self.check_object_permissions(self.request, action)
            action.emailLocked = False
            action.save()
        except:
            logger.error('Action could not be unlocked', extra={"user": self.request.user.email, "action": str(action.id)})
            return Response(status=HTTP_400_BAD_REQUEST)
        
        serializer = ActionSerializer(action).data
        return Response(
            {"emailLocked": action["emailLocked"]}
        )


class FeedbackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, format=None, *args, **kwargs):
        try:
            action = Workflow.objects.get(id=kwargs.get("datalab_id"))
        except:
            return JsonResponse({"error": "Correspondence does not exist"})

        job_id = request.GET.get("job")
        email_id = request.GET.get("email")

        payload = None
        for job in action.emailJobs:
            if str(job.job_id) == job_id and job.included_feedback:
                for email in job.emails:
                    if email.email_id == email_id:
                        payload = {
                            "dropdown": {
                                "enabled": action.emailSettings.feedback_list,
                                "question": action.emailSettings.list_question,
                                "type": action.emailSettings.list_type,
                                "options": [
                                    {"label": option.label, "value": option.value}
                                    for option in action.emailSettings.list_options
                                ],
                                "value": email.list_feedback,
                            },
                            "textbox": {
                                "enabled": action.emailSettings.feedback_textbox,
                                "question": action.emailSettings.textbox_question,
                                "value": email.textbox_feedback,
                            },
                            "subject": job.subject,
                            "email_datetime": job.initiated_at,
                            # "content": email.content,
                            "feedback_datetime": email.feedback_datetime,
                        }

        if not payload:
            return JsonResponse({"error": "Invalid feedback URL"})

        return JsonResponse(payload)

    def post(self, request, format=None, *args, **kwargs):
        action = Workflow.objects.get(id=kwargs.get("datalab_id"))
        job_id = request.GET.get("job")
        email_id = request.GET.get("email")

        dropdown = request.data["dropdown"]
        textbox = request.data["textbox"]

        if not dropdown and not textbox:
            return JsonResponse({"error": "Empty feedback cannot be submitted"})

        did_update = False
        for job in action.emailJobs:
            if str(job.job_id) == job_id and job.included_feedback:
                for email in job.emails:
                    if email.email_id == email_id:
                        email.textbox_feedback = textbox
                        email.list_feedback = dropdown
                        email.feedback_datetime = datetime.utcnow()
                        did_update = True

        if did_update:
            action.save()
        else:
            # None of the email recipients must have matched the request user's email
            return JsonResponse(
                {
                    "error": "You are not authorized to provide feedback for this correspondence"
                }
            )

        return JsonResponse({"success": 1})
