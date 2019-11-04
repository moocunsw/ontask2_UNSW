from mongoengine import Document
from mongoengine.fields import (
    ListField,
    StringField,
    IntField,
    DateTimeField,
    ReferenceField,
    BooleanField,
)

# TODO: Term Fixtures/Data Initialisation?
class Term(Document):
    code = IntField(required=True)
    name = StringField(required=True)
    start = DateTimeField()
    end = DateTimeField()


class Container(Document):
    owner = StringField()  # User's email
    sharing = ListField(StringField())  # List of user emails
    code = StringField(required=True)
    term = ReferenceField(Term, required=True)
    school = StringField(null=True)
    faculty = StringField(null=True)
    description = StringField(null=True)
    lti_resource = StringField(null=True)
    lti_context = StringField(null=True)

    def has_full_permission(self, user):
        if user.is_superuser:
            return True

        return user.email == self.owner or user.email in self.sharing

    def is_owner(self, user):
        return user.email == self.owner
