from django.core.mail import get_connection
from celery import shared_task
from celery.execute import send_task
from django_celery_beat.models import PeriodicTask

from bson.objectid import ObjectId
import jwt
import uuid
from time import sleep
from datetime import datetime as dt
import boto3
import pandas as pd
from io import StringIO
import os
from contextlib import ExitStack

from datasource.models import Datasource
from administration.models import Dump
from datalab.models import Datalab

from .utils import create_crontab, send_email, should_run

from ontask.settings import (
    SECRET_KEY,
    BACKEND_DOMAIN,
    FRONTEND_DOMAIN,
    EMAIL_BATCH_SIZE,
    EMAIL_BATCH_PAUSE,
    AWS_PROFILE,
    DATALAB_DUMP_BUCKET,
)

import logging

logger = logging.getLogger("emails")


@shared_task
@should_run
def refresh_datasource_data(datasource_id=None, **kwargs):
    """ Reads the query data from the external source and
        inserts the data into the datasource """

    datasource = Datasource.objects.get(id=ObjectId(datasource_id))
    datasource.refresh_data()

    return "Data imported successfully"


@shared_task
def dump_datalab_data(**kwargs):
    from datalab.serializers import OrderItemSerializer

    dump = Dump.objects.all()
    if not len(dump) > 0:
        return "No DataLabs were marked for data dump"

    if not DATALAB_DUMP_BUCKET:
        return "No DataLab dump bucket has been specified"

    dump = dump[0]
    dump.last_run = dt.utcnow()
    dump.save()

    if AWS_PROFILE:
        session = boto3.Session(profile_name=AWS_PROFILE)
        s3 = session.resource("s3")
    else:
        s3 = boto3.resource("s3")

    for datalab in dump.datalabs:
        datalab = Datalab.objects.get(id=datalab.id)
        data = pd.DataFrame(datalab.data)
        csv_buffer = StringIO()

        # Re-order the columns to match the original datasource data
        order = OrderItemSerializer(
            datalab.order, many=True, context={"steps": datalab.steps}
        )
        reordered_columns = [
            item.get("details", {}).get("label") for item in order.data
        ]
        data = data.reindex(columns=reordered_columns)

        data.to_csv(csv_buffer, index=False)
        s3.Object(
            DATALAB_DUMP_BUCKET, f"{datalab.container.code}_{datalab.name}.csv"
        ).put(Body=csv_buffer.getvalue())

    return "DataLab data dumped successfully"


@shared_task
@should_run
def workflow_send_email(action_id=None, job_type="Scheduled", **kwargs):
    """ Send email based on the schedule in workflow model """
    logger.info("email.initiate", extra={"action": action_id, "job_type": job_type})

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
    null_recipients = 0

    messages = action.data["records"]
    batch_size = EMAIL_BATCH_SIZE if EMAIL_BATCH_SIZE else len(messages)
    batch_pause = EMAIL_BATCH_PAUSE if EMAIL_BATCH_PAUSE else 0

    email_batches = [
        messages[i : i + batch_size] for i in range(0, len(messages), batch_size)
    ]

    recipient_count = 0
    for batch_index, batch in enumerate(email_batches):
        logger.info(
            "email.batch",
            extra={
                "action": action_id,
                "current": batch_index + 1,
                "total": len(email_batches),
            },
        )
        # Conditionally use get_connection() based on ENV variables
        with ExitStack() as stack:
            if not os.environ.get("ONTASK_DEVELOPMENT"):
                # Open a connection to the SMTP server, which will be used for every email sent in this batch
                # It is done per batch to avoid the risk of the connection timing out if the batch_delay is long
                connection = stack.enter_context(get_connection())
            for index, item in enumerate(batch):
                recipient = item.get(email_settings.field)
                if recipient == "" or recipient is None:
                    null_recipients += 1
                else:
                    email_content = populated_content[recipient_count]

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

                    tracking_link = f"{BACKEND_DOMAIN}/workflow/read_receipt/?email={tracking_token}"
                    tracking_pixel = f"<img src='{tracking_link}'/>"
                    email_content += tracking_pixel

                    if email_settings.include_feedback:
                        feedback_link = f"{FRONTEND_DOMAIN}/feedback/{action.id}/?job={job_id}&email={email_id}"
                        email_content += (
                            "<p>Did you find this correspondence useful? Please provide your "
                            f"feedback by <a href='{feedback_link}'>clicking here</a>.</p>"
                        )

                    if os.environ.get("ONTASK_DEVELOPMENT"):
                        email_sent = True
                    else:
                        email_sent = send_email(
                            recipient,
                            email_settings.subject,
                            email_content,
                            from_name=email_settings.fromName,
                            reply_to=email_settings.replyTo,
                            connection=connection,
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

                    logger.info(
                        f"email.{'success' if email_sent else 'fail'}",
                        extra={
                            "action": action_id,
                            "batch": batch_index + 1,
                            "recipient": recipient,
                            "from": email_settings.fromName,
                            "reply-to": email_settings.replyTo,
                            "subject": email_settings.subject,
                            "content": email_content,
                        },
                    )

                recipient_count += 1

            if batch_index + 1 != len(email_batches) and batch_pause > 0:
                sleep(batch_pause)

    action.emailLocked = False

    action.emailJobs.append(job)

    action.save()

    if not os.environ.get("ONTASK_DEVELOPMENT"):
        if len(failures) == 0 and null_recipients == 0:
            send_email(
                action.container.owner,
                "Email job completed",
                f"All {len(successes)} emails were successfully sent",
            )
        else:
            failures_concat = ", ".join(failures)
            send_email(
                action.container.owner,
                "Email job completed",
                f"""
                    {f"The following {len(failures)} emails were unsuccessful: {failures_concat}<br><br>" if len(failures) else ""}
                    {f"There were {null_recipients} recipients without an email address<br><br>" if null_recipients > 0 else ""}
                    {f"The other {len(successes)} emails were successfully sent" if len(successes) else ""}
                """,
            )

    logger.info("email.complete", extra={"action": action_id, "job_type": job_type})

    return "Email job completed."
