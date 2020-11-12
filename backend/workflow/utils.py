import re
from dateutil import parser
import time
from collections import defaultdict
from datetime import datetime, timedelta

import jwt

from ontask.settings import (
    SECRET_KEY,
    BACKEND_DOMAIN,
    FRONTEND_DOMAIN
)


def transform(value, param_type):
    try:
        if param_type == "number":
            value = float(value)

        elif param_type == "date":
            value = parser.parse(value)
            value = int(time.mktime(value.timetuple()))

        return value

    except:
        return None


def did_pass_test(test, value, param_type):
    value = transform(value, param_type)
    if "comparator" in test:
        comparator = transform(test["comparator"], param_type)
    else:
        test["rangeFrom"] = transform(test["rangeFrom"], param_type)
        test["rangeTo"] = transform(test["rangeTo"], param_type)

    operator = test["operator"]

    try:
        if operator == "==":
            return value == comparator
        elif operator == "!=":
            return value != comparator
        elif operator == "IS_NULL":
            return value == "" or value is None
        elif operator == "IS_NOT_NULL":
            return value != "" and value is not None
        elif operator == "IS_TRUE" or operator == "IS_FALSE":
            return bool(value)
        elif operator == "<":
            return value < comparator
        elif operator == "<=":
            return value <= comparator
        elif operator == ">":
            return value > comparator
        elif operator == ">=":
            return value >= comparator
        elif operator == "between":
            return value >= test["rangeFrom"] and value <= test["rangeTo"]
        elif operator == "contains":
            return comparator.lower() in (item.lower() for item in value)
        else:
            return False
    except:
        return False


def replace_link(match, item, order, action_id, job_id, email_id, style="new"):
    """Generates new HTML replacement string for attribute with the attribute value and mark styles"""

    # style refers to the old link style which only accomodates for one parameter,
    if style == "old":
        [href, param, field, label] = [match.group(
            1), match.group(2), match.group(3), match.group(5)]
        if param and field:
            href += f'?{param}={item.get(field)}'

        tracking_token = jwt.encode(
            {
                "action_id": str(action_id),
                "job_id": str(job_id),
                "email_id": str(email_id),
                "href": str(href)
            },
            SECRET_KEY,
            algorithm="HS256",
        ).decode("utf-8")
        tracking_link = f"{BACKEND_DOMAIN}/workflow/link_click/?token={tracking_token}"

        return f'<a href="{tracking_link}">{label}</a>'
    else:
        [href, params, label] = [match.group(
            1), match.group(2), match.group(4)]
        # split_params = re.findall(r"\?.*=.*", params)
        split_params = re.split(r"\?", params)
        for index, current_param in enumerate(split_params):
            if current_param == '':
                continue

            [param, field] = current_param.split("=")
            if param and field:
                if index == 1:
                    href += f'?{param}={item.get(field)}'
                else:
                    href += f'&{param}={item.get(field)}'

        print('href', href)

        tracking_token = jwt.encode(
            {
                "action_id": str(action_id),
                "job_id": str(job_id),
                "email_id": str(email_id),
                "href": str(href)
            },
            SECRET_KEY,
            algorithm="HS256",
        ).decode("utf-8")
        tracking_link = f"{BACKEND_DOMAIN}/workflow/link_click/?token={tracking_token}"

        return f'<a href="{tracking_link}">{label}</a>'


def parse_link(html, item, order, action_id, job_id, email_id):
    """
    Parse <hyperlink> ... </hyperlink> in html string based on student.
    Only checks for
        - bold,italic,underline,code,span inlines and may need to be modified
    """

    # check if it contains old style, so param and field.
    if "param" in html and "field" in html:
        return re.sub(
            r"<hyperlink href=\"(.*?)\" param=\"(.*?)\" field=\"(.*?)\">((?:<(?:strong|em|u|pre|code|span.*?)>)*)(.*?)((?:</(?:strong|em|u|pre|code|span)>)*)</hyperlink>",
            lambda match: replace_link(
                match, item, order, action_id, job_id, email_id, 'old'),
            html
        )
    else:
        return re.sub(
            r"<hyperlink href=\"(.*?)\" params=\"(.*?)\">((?:<(?:strong|em|u|pre|code|span.*?)>)*)(.*?)((?:</(?:strong|em|u|pre|code|span)>)*)</hyperlink>",
            lambda match: replace_link(
                match, item, order, action_id, job_id, email_id, 'new'),
            html
        )


def simple_replace_link(match, item, order, style):
    if style == 'old':
        [href, param, field, label] = [match.group(
            1), match.group(2), match.group(3), match.group(5)]
        if param and field:
            href += f'?{param}={item.get(field)}'

        return f'<a href="{href}">{label}</a>'

    else:
        [href, params, label] = [match.group(
            1), match.group(2), match.group(4)]
        split_params = re.split(r"\?", params)
        for index, current_param in enumerate(split_params):
            if current_param == '':
                continue

            [param, field] = current_param.split("=")
            if param and field:
                if index == 1:
                    href += f'?{param}={item.get(field)}'
                else:
                    href += f'&{param}={item.get(field)}'
        
        return f'<a href="{href}">{label}</a>'

def simple_parse_link(html, item, order):
    # check if it contains old style, so param and field.
    if "param" in html and "field" in html:
        return re.sub(
            r"<hyperlink href=\"(.*?)\" param=\"(.*?)\" field=\"(.*?)\">((?:<(?:strong|em|u|pre|code|span.*?)>)*)(.*?)((?:</(?:strong|em|u|pre|code|span)>)*)</hyperlink>",
            lambda match: simple_replace_link(match, item, order, 'old'),
            html
        )
    else:
        return re.sub(
            r"<hyperlink href=\"(.*?)\" params=\"(.*?)\">((?:<(?:strong|em|u|pre|code|span.*?)>)*)(.*?)((?:</(?:strong|em|u|pre|code|span)>)*)</hyperlink>",
            lambda match: simple_replace_link(match, item, order, 'new'),
            html
        )


def replace_attribute(match, item, order, forms):
    """Generates new HTML replacement string for attribute with the attribute value and mark styles"""
    field = match.group(2)

    prefix, field = field.split(":", 1)
    if prefix == 'link':
        # Anonymous Form Link
        form = forms.filter(name=field)[0]
        if form.emailAccess:
            email = item[form.permission]

            iat = datetime.utcnow()
            exp = iat + timedelta(days=90)
            token = jwt.encode(
                {'email': email, 'iat': iat, 'exp': exp}, SECRET_KEY, algorithm='HS256').decode()
            link = f'{FRONTEND_DOMAIN}/form/{form.id}/?token={token}'

            link_html = f'<a href={link}>{link}</a>'
            return link_html
        else:
            # No Form emailAccess granted, remove block
            return ''
    elif prefix == 'field':
        value = item.get(field)

        for item in order:
            if item["details"]["label"] == field:
                if item["details"]["field_type"] == "checkbox":
                    value = value if value else "False"

                elif item["details"]["field_type"] == "list":
                    if not isinstance(value, list):
                        value = [value]

                    mapping = {
                        option["value"]: option["label"]
                        for option in item["details"]["options"]
                    }
                    value = [mapping.get(value, "") for value in value]

            elif field in item["details"].get("fields", []):
                value = "False" if not value else value

        if isinstance(value, list):
            value = ", ".join(value if value else "")
        elif not isinstance(value, str):
            value = str(value)

        return match.group(1) + value + match.group(3)
    else:
        # Code should not reach here
        return ''


def parse_attribute(html, item, order, forms):
    """
    Parse <attribute>field: ... </attribute> in html string based on student.
    Only checks for
        - bold,italic,underline,code,span inlines and may need to be modified
    """
    return re.sub(
        r"<attribute>((?:<(?:strong|em|u|pre|code|span.*?)>)*)(.*?)((?:</(?:strong|em|u|pre|code|span)>)*)</attribute>",
        lambda match: replace_attribute(match, item, order, forms),
        html
    )


def generate_condition_tag_locations(html):
    """Generates a dictionary of lists representing a list of (start,stop) indices for each condition in the html string

    Arguments:
        html {string} -- Serialized HTML String of content editor

    Returns:
        [dict{list((start,stop))}] -- Dictionary of condition tag locations
    """
    tagPattern = r"<condition conditionid=\"(.*?)\" ruleid=\"(.*?)\"(?: label=\"else\")?>|<\/condition>"
    conditionTagLocations = defaultdict(list)
    stack = []
    for match in re.finditer(tagPattern, html):
        if match.group(1) is not None:
            # Match Opening Tag
            # (Start Index,Condition ID)
            stack.append((match.start(0), match.group(1)))
        else:
            start, cid = stack.pop()
            conditionTagLocations[cid].append((start, match.end(0)))
            # Match Closing Tag
    return conditionTagLocations


def delete_html_by_indexes(html, indexes):
    """Deletes from HTML string based on a list of indexes.

    Arguments:
        html {string} -- Serialized HTML String of content editor
        indexes {list(start,stop)} -- List of slices to remove from string
    """

    # Sort by stop index in descending order to allow filtering & deletion to work
    indexes = sorted(indexes, key=lambda slice: slice[1], reverse=True)

    # Filter out "redundant index pairs" assuming clean HTML structure
    cleanIndexes = []
    for currStart, currStop in indexes:
        add = True
        for (start, stop) in cleanIndexes:
            # Checks for "nested" html structure
            if start < currStart < currStop < stop:
                add = False
        if add:
            cleanIndexes.append((currStart, currStop))

    # Perform Deletion
    for start, stop in cleanIndexes:
        html = html[:start] + html[stop:]

    return html


def replace_tags(html, old, new):
    """Replaces all instances of <old ...> and </old> with <new ...> </new>

    Arguments:
        html {string} -- Serialized HTML String of content editor

    Returns:
        string -- New HTML String
    """
    tagPattern = r"(<\s*\/?\s*)" + old + r"(\s*([^>]*)?\s*>)"
    return re.sub(tagPattern, r"\g<1>" + new + r"\g<2>", html)


def strip_tags(html, old):
    """Removes all instances of <old ...> and </old>

    Arguments:
        html {string} -- Serialized HTML String of content editor

    Returns:
        string -- New HTML String
    """
    tagPattern = r"(<\s*\/?\s*)" + old + r"(\s*([^>]*)?\s*>)"
    return re.sub(tagPattern, "", html)
