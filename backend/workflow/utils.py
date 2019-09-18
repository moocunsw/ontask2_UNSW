import re
from dateutil import parser
import time
from collections import defaultdict

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

def replace_attribute(match, item, order):
    """Generates new HTML replacement string for attribute with the attribute value and mark styles"""
    field = match.group(2)
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

def parse_attribute(html, item, order):
    """
    Parse <attribute> ... </attribute> in html string based on student.
    Only checks for
        - bold,italic,underline,code,span inlines and may need to be modified
    """
    return re.sub(
        r"<attribute>((?:<(?:strong|em|u|pre|code|span.*?)>)*)(.*?)((?:</(?:strong|em|u|pre|code|span)>)*)</attribute>",
        lambda match: replace_attribute(match, item, order),
        html
    )

def generate_condition_tag_locations(html):
    """Generates a dictionary of lists representing a list of (start,stop) indices for each condition in the html string

    Arguments:
        html {string} -- Serialized HTML String of content editor

    Returns:
        [dict{list((start,stop))}] -- Dictionary of condition tag locations
    """
    tagPattern = r"<condition conditionid=\"(.*?)\" index=\"\d+\"(?: label=\"else\")?>|<\/condition>"
    conditionTagLocations = defaultdict(list)
    stack = []
    for match in re.finditer(tagPattern, html):
        if match.group(1) is not None:
            # Match Opening Tag
            stack.append((match.start(0),match.group(1))) # (Start Index,Condition ID)
        else:
            start, cid = stack.pop()
            conditionTagLocations[cid].append((start,match.end(0)))
            # Match Closing Tag
    return conditionTagLocations

def delete_html_by_indexes(html,indexes):
    """Deletes from HTML string based on a list of indexes.

    Arguments:
        html {string} -- Serialized HTML String of content editor
        indexes {list(start,stop)} -- List of slices to remove from string
    """

    # Sort by stop index in descending order to allow filtering & deletion to work
    indexes = sorted(indexes, key=lambda slice:slice[1], reverse=True)

    # Filter out "redundant index pairs" assuming clean HTML structure
    cleanIndexes = []
    for currStart,currStop in indexes:
        add = True
        for (start,stop) in cleanIndexes:
            # Checks for "nested" html structure
            if start < currStart < currStop < stop:
                add = False
        if add:
            cleanIndexes.append((currStart,currStop))

    # Perform Deletion
    for start,stop in cleanIndexes:
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