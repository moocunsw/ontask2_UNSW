from django.contrib.auth.models import User
from django.contrib import messages
from django.views.generic import TemplateView
from django.views.generic.list import ListView
from django.views.generic.edit import FormView
from django.shortcuts import redirect
from rest_framework.views import APIView
from rest_framework.response import Response
from django_celery_beat.models import CrontabSchedule, PeriodicTask
from uuid import uuid4

from .forms import GenerateRandomUserForm
from .tasks import update_data_in_data_container
from .utils import send_email


class DataSourceUpdateTaskView(APIView):
    ''' Container for the Ontask Task Scheduler methods'''
    # Assigns the authentication permissions
    authentication_classes = ()
    permission_classes = ()
    
    def post(self, request, format=None):
        '''Post handle to create a schedule'''

        task_name = "data_source_update_task_" + str(uuid4())
        arguments= '{"data_source_container_id":"' + request.data['data_source_container_id'] + '"}'
        
        schedule, _ = CrontabSchedule.objects.get_or_create(
            minute = request.data['schedule']['minute'],
            hour = request.data['schedule']['hour'],
            day_of_week = request.data['schedule']['day_of_week'],
            day_of_month = request.data['schedule']['day_of_month'],
            month_of_year = request.data['schedule']['month_of_year'],
        )

        periodic_task = PeriodicTask.objects.create(
           crontab=schedule,
           name=task_name,
           task='ontask.tasks.update_data_in_data_container',
           kwargs=arguments
        )

        print("################ {Periodic Task} ###################")
        print(periodic_task)

        return Response({'task_name': task_name})
    
    def delete(self, request, format=None):
        '''DELETE handle to remove a scheduler from the beat schedule'''
        print(self.request.data)
        task = PeriodicTask.objects.get(name=request.data['name'])
        print(task)
        task.delete()

        return Response({'task_name':task.name,'message':'Periodic task deleted'})


class SendEmailTaskView(APIView):
    # Assigns the authentication permissions
    authentication_classes = ()
    permission_classes = ()
    
    def post(self, request, format=None):
        '''Post handle to send an email once-off'''
        result = send_email(
            'zLNTLada@ad.unsw.edu.au', # TODO: Provide a config variable for specifying this, and the SMTP credentials
            request.data['recipient_address'],
            request.data['email_subject'],
            request.data['text_content'],
            request.data['html_content']
        )

        # Return 1 or 0 to the backend indicating whether the email was sent successfully or not
        return Response({ 'success': result })