def get_filters(df, columns):
    filters = {}
    for item in columns:
        # Generate list of filters
        column_name = item['field']
        field_type = item['details']['field_type']
        if field_type == 'list':
            options = item['details']['options']
            filters[column_name] = list(map(lambda x: {'text': x['label'], 'value': x['value']}, options))
        elif field_type == 'checkbox':
            filters[column_name] = [
                {'text': 'False', 'value': False},
                {'text': 'True', 'value': True},
            ]
        elif field_type == 'checkbox-group':
            fields = item['details']['fields']
            filters[column_name] = list(map(lambda x: {'text': x, 'value': x}, fields))
        elif field_type == 'date':
            filters[column_name] = list(map(lambda x: {'text': x[:10], 'value': x}, df[column_name].dropna().unique()))
        else:
            # Text, Number, Non-fields
            filters[column_name] = list(map(lambda x: {'text': x, 'value': x}, df[column_name].dropna().unique()))
    return filters


def get_filtered_data(data, columns, filters):
    # TODO MAYBE FIX Everything empty
    if len(filters.keys()) == 0: return (data, len(data))
    filtered_data = list(filter(lambda row: not remove_row_filter(row, filters, columns), data))

    # Search
    if not filters['search'] == '':
        filtered_data = list(filter(lambda row: not remove_row_search(row, filters, columns), filtered_data))

    # Sort
    if not len(filters['sorter']) == 0:
        sort_field = filters['sorter']['field']
        sort_order = filters['sorter']['order']
        if sort_field is not None and sort_order is not None:
            # TODO TEST DESCEND + NEUTRAL
            print(sort_field, sort_order)
            column = next((item for item in columns if item['field'] == sort_field), None)
            filtered_data.sort(key=lambda x: sort_column_key(x, sort_field, column), reverse=sort_order=='descend')

    pagination_total = len(filtered_data)

    # Pagination
    # TODO: TEST
    filtered_data = paginate_data(filtered_data, filters['pagination'])
    # pprint(filtered_data)
    return filtered_data, pagination_total

def remove_row_filter(row, filters, columns):
    """True to remove row; False to keep row"""
    res = False
    for item in columns:
        column_name = item['field']
        field_type = item['details']['field_type']

        if field_type == 'checkbox-group':
            mode_and = filters['checkboxFilterModes'][column_name]
            filter_list = filters['checkboxFilters'][column_name]
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
            if column_name not in filters['filters']: continue
            filter_list = filters['filters'][column_name]
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
    # TODO: Can improve
    return not (filters['search'].lower() in str(row).lower())

def sort_column_key(x, sort_field, column):
    if column['details']['field_type'] == 'checkbox-group':
        checkbox_fields = column['details']['fields']
        return len(list(filter(lambda field: x[f'{sort_field}__{field}'], checkbox_fields)))
    else:
        if x[sort_field] is None: return ''
        return x[sort_field]

def paginate_data(data, pagination):
    page = pagination['current']
    pageSize = pagination['pageSize']
    start = (page - 1) * pageSize
    end = start + pageSize
    return data[start:end]
