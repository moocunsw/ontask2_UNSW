# OnTask v2.5

## Running the application

### For development

1. Perform the configuration steps outlined [here](#general-configuration)
2. Install [Docker](https://store.docker.com/search?type=edition&offering=community) and [docker-compose](https://docs.docker.com/compose/install/#install-compose)
3. From your terminal, run `docker-compose build` followed by `docker-compose up` in the root OnTask directory
4. If this is the first time running, the following must be performed:
   - Attach to the backend container by running `docker-compose exec backend sh`
   - Initialise the database by running `python3 manage.py makemigrations accounts`, `python3 manage.py makemigrations` and lastly `python3 manage.py migrate`
   - Load data into user groups by running `python3 manage.py loaddata user_groups`
   - Create the first admin user by running `python manage.py createsuperuser`
   - Create a `Term` Table in the ontask Database (you can use a Database client like [MongoDB Compass](https://www.mongodb.com/products/compass)) and import `Term Codes.csv` (or create your own Terms). This is to ensure that you have Terms to search and create containers via the UI.
5. In order to work with LTI via localhost, the application runs in SSL mode with self-signed certs
   - This will require adding an exception in your browser for both https://localhost:3000 and https://localhost:8000

### For production

1. Complete steps 1-4 from above, however, instead run `docker-compose -f docker-compose.prod.yaml up` (in step 3)
2. Compile the frontend by running `npm run build` in the frontend directory
3. Serve the files in the `frontend/build/` directory as a static website (e.g. through S3 behind a CloudFront distribution)
4. Add a proxy pass in your webserver configuration from your backend domain (e.g. api.ontask.org) to http://localhost:8000 (not https)

## Configuration

### General configuration

1. Create an environment file `env.py` in the `backend/ontask/` directory
2. Run `pip install cryptography`
3. From a Python shell, run the following command:

```python
from cryptography.fernet import Fernet
# The following generated secret key will be used for encrypting sensitive data
# Loss or change of the secret key will result in the loss of all datasource passwords
# This is a breaking issue for dynamic data sources, as update attempts will fail
Fernet.generate_key().decode("utf-8")
```

4. Configure the environment file as follows:

```python
SECRET_KEY = "<SECRET_KEY_GENERATED_ABOVE>"

 # List of admins that will recieve user signup notifications via email
ADMINS = ["<ADMIN_EMAIL_1>"]

FRONTEND_DOMAIN = "https://<YOUR_FRONTEND_DOMAIN>"
BACKEND_DOMAIN = "https://<YOUR_BACKEND_DOMAIN>"
ALLOWED_HOSTS = ["<YOUR_FRONTEND_DOMAIN>"] # Without the protocol specified

# If uncommented, use the given named profile from your AWS credentials
# file (usually ~/.aws/credentials). Otherwise, boto3 will assume the AWS role
# of the server itself
# AWS_PROFILE = "<YOUR_AWS_NAMED_PROFILE>"
AWS_REGION = "<YOUR_AWS_REGION>"
ENABLE_CLOUDWATCH_LOGGING  = False
DEMO_BUCKET = "<YOUR_S3_BUCKET>"

# SMTP credentials to enable email sending from OnTask
EMAIL_HOST = "<YOUR_SMTP_HOST>"
EMAIL_PORT = 587
EMAIL_NAME = "OnTask" # Default name to appear in emails sent
EMAIL_ALIAS = "<YOUR_EMAIL_ALIAS>" # Default alias email to use in emails sent
EMAIL_HOST_USER = "<YOUR_SMTP_USER>" # SMTP login user
EMAIL_HOST_PASSWORD = "<YOUR_SMTP_PASSWORD>" # SMTP login password
EMAIL_USE_TLS = True
EMAIL_BATCH_SIZE = 50  # Maximum number of emails to send at a time (i.e. a batch)
EMAIL_BATCH_PAUSE = 300  # Minutes to wait between batches of emails

# Configuration for AAF Rapid Connect
AAF_CONFIG = {
    "secret_key": "<YOUR_AAF_SECRET>",
    "aaf.edu.au": {
        "iss": "https://rapid.aaf.edu.au", # https://rapid.test.aaf.edu.au for dev
        "aud": "https://<YOUR_DOMAIN>", # https://localhost:8000 for dev
        "idp": "<YOUR_AAF_IDP>",
    }
}

LTI_CONFIG = {
    "staff_role": "Instructor", # Role that will be added to the instructor group when coming from LTI
    "consumers": {
        "ontask": { # App name registered in LTI
            "secret": "<YOUR_LTI_SECRET>"
        }
    },
    "url": "<YOUR_LTI_URL>",
    "username_field": "<YOUR_LTI_USERNAME_FIELD>", # Specify which field in the LTI payload maps to your institution's user ID
    "auto_create_share_containers": True # Allows for the auto creation and sharing of containers in lti context.
}
```

5. Create environment files `.env.development` (for development) and/or `.env.production` (for production) in the `frontend/` directory
6. Configure the environment file(s) created above:

```javascript
REACT_APP_API_DOMAIN = "https://<YOUR_BACKEND_DOMAIN>";
REACT_APP_AWS_ID = "YOUR_AWS_ID";
REACT_APP_AAF_URL = "<YOUR_AAF_IDP>";
// If uncommented, show the Register Account interface
// REACT_APP_DEMO = True
```

## Packages Used

### Frontend Dependencies

| Package Name     | License                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| React.js         | [MIT](https://github.com/facebook/react/blob/master/LICENSE)              |
| create-react-app | [MIT](https://github.com/facebook/create-react-app/blob/next/LICENSE)     |
| react-router     | [MIT](https://github.com/ReactTraining/react-router/blob/master/LICENSE)  |
| Ant Design       | [MIT](https://github.com/ant-design/ant-design/blob/master/LICENSE)       |
| Slate            | [MIT](https://github.com/ianstormtaylor/slate/blob/master/License.md)     |
| is-hotkey        | [MIT](https://github.com/ianstormtaylor/is-hotkey/blob/master/License.md) |
| react-dnd        | [BSD](https://github.com/react-dnd/react-dnd/blob/master/LICENSE)         |
| react-draggable  | [MIT](https://github.com/mzabriskie/react-draggable/blob/master/LICENSE)  |
| lodash           | [MIT](https://github.com/lodash/lodash/blob/master/LICENSE)               |
| moment           | [MIT](https://github.com/moment/moment/blob/develop/LICENSE)              |
| query-string     | [MIT](https://github.com/sindresorhus/query-string/blob/master/license)   |
| sanitize-html    | [MIT](https://github.com/punkave/sanitize-html/blob/master/LICENSE)       |
| memoize-one      | [MIT](https://github.com/alexreardon/memoize-one/blob/master/LICENSE)     |
| highcharts       | [CC](https://shop.highsoft.com/highcharts)                                |
| d3               | [BSD](https://github.com/d3/d3/blob/master/LICENSE)                       |

### Backend Dependencies

| Package Name                      | License                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------- |
| Django                            | [BSD](https://github.com/django/django/blob/master/LICENSE)                                 |
| djangorestframework               | [BSD](https://github.com/encode/django-rest-framework/blob/master/LICENSE.md)               |
| mongoengine                       | [MIT](https://github.com/MongoEngine/mongoengine/blob/master/LICENSE)                       |
| django-rest-framework-mongoengine | [MIT](https://github.com/umutbozkurt/django-rest-framework-mongoengine/blob/master/LICENSE) |
| django-cors-headers               | [License](https://github.com/ottoyiu/django-cors-headers/blob/master/LICENSE)               |
| uWSGI                             | [GPL](https://github.com/unbit/uwsgi/blob/master/LICENSE)                                   |
| SQLAlchemy                        | [MIT](https://github.com/zzzeek/sqlalchemy/blob/master/LICENSE)                             |
| pyjwt                             | [MIT](https://github.com/jpadilla/pyjwt/blob/master/LICENSE)                                |
| boto3                             | [Apache](https://github.com/boto/boto3/blob/develop/LICENSE)                                |
| celery                            | [BSD](https://github.com/celery/celery/blob/master/LICENSE)                                 |
| django-celery-beat                | [BSD](https://github.com/celery/django-celery-beat/blob/master/LICENSE)                     |
| cryptography                      | [Apache/BSD](https://github.com/pyca/cryptography/blob/master/LICENSE)                      |
| python-dateutil                   | [Apache](https://github.com/dateutil/dateutil/blob/master/LICENSE)                          |
| xlrd                              | [License](https://github.com/python-excel/xlrd/blob/master/LICENSE)                         |
| numexpr                           | [MIT](https://github.com/pydata/numexpr/blob/master/LICENSE.txt)                            |
| pandas                            | [BSD](https://github.com/pandas-dev/pandas/blob/master/LICENSE)                             |
| djongo                            | [AGPL](https://github.com/nesdis/djongo/blob/master/LICENSE)                                |
| PyLTI                             | [BSD](https://github.com/mitodl/pylti/blob/master/LICENSE)                                  |
