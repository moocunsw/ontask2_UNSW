import numpy as np
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
        return list(map(lambda x: {'text': x[:10], 'value': x}, sorted(df[column_name].replace('', np.nan).dropna().unique())))
    else:
        # Text, Number, Non-fields
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
            else:
                if not any(row[column_name] == item for item in filter_list): return True
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
    else:
        if sort_field not in x: return ''      # Applies to forms with no data entered
        elif x[sort_field] is None: return ''
        return str(x[sort_field])

def paginate_data(data, pagination):
    """Utility function for get_filtered_data"""
    pageSize = pagination['pageSize']
    page = min(pagination['current'], math.ceil(len(data) / pageSize)) # Handle case where current page exceeds maximum possible pages resulting in no data loaded
    start = (page - 1) * pageSize
    end = start + pageSize
    return data[start:end]
