import numpy as np
import pandas as pd
import math

def get_filters(df, columns):
    """Gets a list of filter options for each column in the dataframe."""
    filters = {}
    for column in columns:
        # Generate list of filters
        filters[column['details']['label']] = get_column_filter(df, column)
    return filters

def get_column_filter(df, column):
    if column is None: return []
    column_name = column['details']['label']
    field_type = column['details']['field_type']

    if field_type != 'checkbox-group' and column_name not in df: return [] # Applies to forms with no data entered

    elif field_type == 'list':
        options = sorted(column['details']['options'], key=lambda x: x['label'])
        return list(map(lambda x: {'text': x['label'], 'value': x['value']}, options))
    elif field_type == 'checkbox':
        return [
            {'text': 'False', 'value': False},
            {'text': 'True', 'value': True},
        ]
    elif field_type == 'checkbox-group':
        existing_fields = filter(lambda x: f'{column_name}__{x}' in df, sorted(column['details']['fields'])) # Applies to checkbox-group fields with no data entered
        return list(map(lambda x: {'text': x, 'value': x}, existing_fields))
    elif field_type == 'date':
        date_rows = pd.to_datetime(df[column_name].unique(), errors='coerce').dropna()
        return list(map(lambda x: {'text': x.strftime("%Y-%m-%d"), 'value': x}, sorted(date_rows)))
    elif field_type == 'number':
        numeric_rows =  pd.to_numeric(df[column_name], errors='coerce').dropna().unique()
        return list(map(lambda x: {'text': x, 'value': x}, sorted(numeric_rows)))
    elif field_type == 'text':
        return list(map(lambda x: {'text': x, 'value': x}, sorted(df[column_name].replace('', np.nan).dropna().unique().astype(str))))
    else:
        # Default
        return list(map(lambda x: {'text': x, 'value': x}, sorted(df[column_name].replace('', np.nan).dropna().unique().astype(str))))

def get_filtered_data(data, columns, filters, groupby):
    """Retrieves the filtered data after performing the table filter, search, sort, paginate"""
    if filters is None: return (data, len(data))
    if len(filters.keys()) == 0: return (data, len(data))

    filtered_data = data.copy()

    # Group
    if 'grouping' in filters and groupby is not None:
        group_column = next(column for column in columns if column['details']['label'] == groupby)
        filtered_data = list(filter(lambda row: not remove_row_filter(row, filters, [group_column], mode='group'), filtered_data))
    # filtered_data = list(filter(lambda row: not remove_row_filter(row, filters, [group]), data))
    filtered_data = list(filter(lambda row: not remove_row_filter(row, filters, columns, mode='filter'), filtered_data))

    # Search
    if filters['search'] != '':
        filtered_data = list(filter(lambda row: not remove_row_search(row, filters, columns), filtered_data))

    # Sort
    if not len(filters['sorter']) == 0:
        sort_field = filters['sorter']['field']
        sort_order = filters['sorter']['order']
        if sort_field is not None and sort_order is not None:
            column = next((item for item in columns if item['details']['label'] == sort_field), None)
            filtered_data.sort(key=lambda x: sort_column_key(x, sort_field, column), reverse=sort_order=='descend')

    pagination_total = len(filtered_data)

    # Pagination
    filtered_data = paginate_data(filtered_data, filters['pagination'])
    return filtered_data, pagination_total

def remove_row_filter(row, filters, columns, mode='filter'):
    """
    Utility function for get_filtered_data.
    Filtering algorithm.
    Returns True to remove row; False to keep row of dataset
    """
    res = False
    for item in columns:
        column_name = item['details']['label']
        field_type = item['details']['field_type']

        if field_type == 'checkbox-group':
            if mode == 'filter':
                mode_and = filters['checkboxFilterModes'][column_name]
                filter_list = filters['checkboxFilters'][column_name]
            else:
                # Occurs in the rare case when a checkbox-group field was selected in groupby
                mode_and = False
                filter_list = [filters['grouping']]
            if len(filter_list) == 0:
                continue
            else:
                # Check if remove row
                if mode_and:
                    # AND
                    if not all(row[f'{column_name}__{item}'] for item in filter_list): return True
                else:
                    # OR
                    if not any(row[f'{column_name}__{item}'] for item in filter_list): return True
        else:
            if mode == 'filter':
                if column_name not in filters['filters']: continue
                filter_list = filters['filters'][column_name]
            else:
                # Handle group-by filtering
                filter_list = [filters['grouping']]

            if len(filter_list) == 0: continue
            if field_type == 'list':
                if row[column_name] is None: return True
                if not any(item in row[column_name] for item in filter_list): return True
            elif field_type == 'checkbox':
                if not any(row[column_name] == item for item in filter_list): return True
            elif field_type == 'date':
                # Convert row field and filters to %Y-%m-%d and check for equality
                try:
                    row_date = pd.to_datetime(row[column_name], errors='raise')
                    if row_date is None: return True # Applies to 'None'
                    row_date = row_date.strftime("%Y-%m-%d")
                except ValueError as e: # Applies to cells which are not of date format
                    return True
                filter_dates = pd.to_datetime(pd.Series(filter_list)).apply(lambda x: x.strftime("%Y-%m-%d"))
                if not any(row_date == item for item in filter_dates): return True
            elif field_type == 'number':
                if row[column_name] is None: return True
                if row[column_name] == '': return True
                if not any(float(row[column_name]) == float(item) for item in filter_list): return True
            else:
                if not any(str(row[column_name]) == str(item) for item in filter_list): return True
    return False

def remove_row_search(row, filters, columns):
    """
    Utility function for get_filtered_data.
    Searching algorithm.
    """
    return not (filters['search'].lower() in str(row).lower())

def sort_column_key(x, sort_field, column):
    """
    Utility function for get_filtered_data.
    Sorting algorithm by column field type.
    """
    if column['details']['field_type'] == 'checkbox-group':
        checkbox_fields = column['details']['fields']
        return len(list(filter(lambda field: f'{sort_field}__{field}' in x and x[f'{sort_field}__{field}'], checkbox_fields)))
    elif column['details']['field_type'] == 'date':
        # Date Form Field + Standard Date
        if sort_field not in x: return ''
        if x[sort_field] is None: return ''
        try:
            return pd.to_datetime(x[sort_field], errors='raise').strftime("%Y-%m-%d")
        except ValueError as e: return ''
    elif column['details']['field_type'] == 'number':
        # Number Form Field + Standard Number
        if sort_field not in x: return float('-inf')
        if x[sort_field] is None: return float('-inf') # Missing Values
        try:
            return float(x[sort_field])
        except ValueError as e:
            # Usually '' values would fall here
            return float('-inf')
    else:
        # Text Form Field + Standard Text
        if sort_field not in x: return ''
        if x[sort_field] is None: return ''
        return str(x[sort_field])

def paginate_data(data, pagination):
    """Utility function for get_filtered_data"""
    pageSize = pagination['pageSize']
    page = min(pagination['current'], math.ceil(len(data) / pageSize)) # Handle case where current page exceeds maximum possible pages resulting in no data loaded
    start = (page - 1) * pageSize
    end = start + pageSize
    return data[start:end]
