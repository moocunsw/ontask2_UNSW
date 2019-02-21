from celery import shared_task
from celery.execute import send_task
from django_celery_beat.models import PeriodicTask

from bson.objectid import ObjectId
import json
from datetime import datetime
import jwt
import uuid

from datasource.models import Datasource

# from datasource.utils import retrieve_sql_data, retrieve_file_from_s3
from .utils import create_crontab, send_email

from ontask.settings import NOSQL_DATABASE, SECRET_KEY, BACKEND_DOMAIN, FRONTEND_DOMAIN


@shared_task
def instantiate_periodic_task(task, task_type, task_name, schedule, arguments):
    crontab = create_crontab(schedule)

    try:
        if task_type == "interval":
            periodic_task = PeriodicTask.objects.create(
                interval=crontab, name=task_name, task=task, kwargs=arguments
            )
            send_task(task, kwargs=json.loads(arguments))

        else:
            periodic_task = PeriodicTask.objects.create(
                crontab=crontab, name=task_name, task=task, kwargs=arguments
            )

        response_message = "Instantiated periodic task  - %s" % task_name
    except Exception as exception:
        response_message = exception
    return response_message


@shared_task
def remove_periodic_task(task_name):
    try:
        task = PeriodicTask.objects.get(name=task_name)
        task.delete()
        response_message = "Removed task  - %s" % task_name
    except Exception as exception:
        response_message = exception
    return response_message


@shared_task
def refresh_datasource_data(datasource_id):
    """ Reads the query data from the external source and
        inserts the data into the datasource """
    datasource = Datasource.objects.get(id=ObjectId(datasource_id))
    datasource.refresh_data()

    return "Data imported successfully"


@shared_task
def workflow_send_email(action_id, job_type="Scheduled"):
    """ Send email based on the schedule in workflow model """
    print("Email job initiated")

    from workflow.models import Workflow, EmailJob, Email

    action = Workflow.objects.get(id=ObjectId(action_id))

    populated_content = action.populate_content()
    email_settings = action.emailSettings

    job_id = ObjectId()
    job = EmailJob(
        job_id=job_id,
        subject=email_settings.subject,
        type=job_type,
        included_feedback=email_settings.include_feedback and True,
        emails=[],
    )

    successes = []
    failures = []

    for index, item in enumerate(action.data["records"]):
        recipient = item.get(email_settings.field)
        email_content = populated_content[index]

        email_id = uuid.uuid4().hex
        tracking_token = jwt.encode(
            {
                "action_id": str(action.id),
                "job_id": str(job_id),
                "email_id": str(email_id),
            },
            SECRET_KEY,
            algorithm="HS256",
        ).decode("utf-8")

        tracking_link = (
            f"{BACKEND_DOMAIN}/workflow/read_receipt/?email={tracking_token}"
        )
        tracking_pixel = f"<img src='{tracking_link}'/>"
        email_content += tracking_pixel

        if email_settings.include_feedback:
            feedback_link = (
                f"{FRONTEND_DOMAIN}/feedback/{action.id}/?job={job_id}&email={email_id}"
            )
            email_content += (
                "<p>Did you find this correspondence useful? Please provide your "
                f"feedback by <a href='{feedback_link}'>clicking here</a>.</p>"
            )

        print(f"Sending email to {recipient}")

        email_sent = send_email(
            recipient,
            email_settings.subject,
            email_content,
            from_name=email_settings.fromName,
            reply_to=email_settings.replyTo,
        )

        if email_sent:
            job.emails.append(
                Email(
                    email_id=email_id,
                    recipient=recipient,
                    # Content without the tracking pixel
                    content=populated_content[index],
                )
            )
            successes.append(recipient)
        else:
            failures.append(recipient)

    action.emailJobs.append(job)

    action.save()
    if len(failures) == 0:
        send_email(
            email_settings.replyTo,
            "Email job completed",
            f"All {len(successes)} emails were successfully sent",
        )
    else:
        failures_concat = ", ".join(failures)
        send_email(
            email_settings.replyTo,
            "Email job completed",
            f"""
                The following {len(failures)} emails were unsuccessful: {failures_concat}
                <br><br>
                The other {len(successes)} emails were successfully sent
            """,
        )

    return "Email job completed"
