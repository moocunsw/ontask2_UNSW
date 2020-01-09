import React, { useState } from "react";
import { Checkbox, Divider, Input, Switch, Table } from "antd";
import _ from "lodash";

import Field from "./Field";

const { Search } = Input;

// TODO: Boolean column named <checkbox_group column>__<checkbox_group group> issue
// TODO: Potentially (implement table + vertical view)
// TODO: Performance Improvements **
// TODO: Search Enter (depends on performance)
// TODO: Fix sort can only be ascending????
// TODO: CLEANUP
/*
  TODO: TESTING
    - GROUP?
    - Single Columns?
    - Restricted Users
    - TODO: testing
*/

// Generate Initial Filters for every checkboxgroup field
const initialiseFilterStates = (columns) => {
  const checkboxGroupColumnNames =
    columns
      .filter(column => column.field.type === 'checkbox-group')
      .map(column => column.dataIndex);

  return [
    _.zipObject(checkboxGroupColumnNames, _.map(checkboxGroupColumnNames, () => [])),
    _.zipObject(checkboxGroupColumnNames, _.map(checkboxGroupColumnNames, () => false))
  ];
};

const ContentTable = (props) => {
  const {
    showSearch,
    columns,
    dataSource,
    isPreview,
    filters,
    fetchData,
    isReadOnly,
    onFieldUpdate
  } = props;

  // Note that columns, dataSource, pagination, onChange are excluded
  const antdTableProps = _.pick(props, [
    'tableLayout',
    'bordered',
    'childrenColumnName',
    'components',
    'defaultExpandAllRows',
    'defaultExpandedRowKeys',
    'expandedRowKeys',
    'expandedRowRender',
    'expandIcon',
    'expandRowByClick',
    'footer',
    'indentSize',
    'loading',
    'locale',
    'rowClassName',
    'rowKey',
    'rowSelection',
    'scroll',
    'showHeader',
    'size',
    'title',
    'onExpand',
    'onExpandedRowsChange',
    'onHeaderRow',
    'onRow',
    'getPopupContainer'
  ]);


  // Handle CheckboxGroup Filtering
  const [initialFilters, initialFilterModes] = initialiseFilterStates(columns);

  // Allows single update to state when modifying multiple states
  const [tableState, setTableState] = useState(
    {
      filterOptions: {
        pagination: {
          current: 1,
          pageSize: 10,
          showSizeChanger: true,
          pageSizeOptions: ["10", "25", "50", "100"]
        },
        sorter: {},
        filters: {},
        search: "",
        checkboxFilters: initialFilters,         // Fields selected
        checkboxFilterModes: initialFilterModes, // False: OR; True: AND
      },
      loading: false
    }
  );

  const { filterOptions, loading } = tableState;
  const { pagination, search } = filterOptions;

  const handleSearch = (search) => {
    const filterOptions = {...tableState.filterOptions, search};

    fetchData(filterOptions, setTableState);
  };

  const handleFilterChange = (pagination, filters, sorter) => {
    const filterOptions = {
      ...tableState.filterOptions,
      pagination,
      sorter: {
        field: sorter.field,
        order: sorter.order
      },
      filters
    };

    fetchData(filterOptions, setTableState);
  }
  // console.log(filterOptions);

  // const totalDataAmount = dataSource ? dataSource.length : 0;
  // const tableDataAmount = tableData.length; // TODO: Fix based on filtering as well

  const newColumns = columns.map(column => {
    const { dataIndex, field } = column;
    const { type, columns } = field;

    if (type === "checkbox-group") {
      const customFilter =
      (type === "checkbox-group" && !isPreview) ?
        {
          filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) =>
            renderCheckboxGroupFilter({
              setSelectedKeys,
              selectedKeys,
              confirm,
              clearFilters,
              setTableState,
              tableState,
              columnName: dataIndex,
              columns,
            })
        }
      : {};

      return {
        ...column,
        ...customFilter,
        sorter: !isPreview,
        render: (value, record, index) => {
          value = _.pick(record, columns.map(column => `${dataIndex}__${column}`));
          return (
            <Field
              readOnly={isReadOnly(record, column.dataIndex)}
              field={field}
              value={value}
              onSave={(value, column) => onFieldUpdate(record, value, dataIndex, column, index)}
            />
          )
        }
      }
    }

    else {
      return {
        ...column,
        filters: (!isPreview && filters) ? filters[dataIndex] : null,
        sorter: (isPreview || ['checkbox', 'list'].includes(type)) ? null : true,
        render: (value, record, index) => {
          return (
            <Field
              readOnly={isReadOnly(record, column.dataIndex)}
              field={field}
              value={value}
              onSave={(value, column) => onFieldUpdate(record, value, dataIndex, column, index)}
            />
          );
        }
      }
    }
  });

  return (
    <div>
      { showSearch &&
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Search
            style={{ width: "auto", marginRight: '15px' }}
            placeholder="Search..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {/* <div>
            {tableDataAmount} records selected out of {totalDataAmount} (
            {totalDataAmount - tableDataAmount} filtered out)
          </div> */}
        </div>
      }
      <Divider />
      <Table
        {...antdTableProps}
        columns={newColumns}
        dataSource={dataSource}
        loading={loading}
        pagination={pagination}
        onChange={handleFilterChange}
      />
    </div>
  );
};

// Render Custom Filter for Checkbox Group Field
const renderCheckboxGroupFilter = (props) => {
  const {
    setSelectedKeys,
    selectedKeys,
    confirm,
    clearFilters,
    setTableState,
    tableState,
    columnName,
    columns,
  } = props;
  return (
    <div>
      <div style={{ display: 'flex', flexFlow: 'column', alignItems: 'center', borderBottom: '1px solid #e8e8e8', padding: '7px 8px' }}>
        <p style={{ margin: 0 }}>Filter Mode</p>
        <Switch
          checkedChildren="AND"
          unCheckedChildren="OR"
          checked={selectedKeys[0]}
          onChange={(checked) => {
            let selectedKeyCopy = [...selectedKeys];
            selectedKeyCopy[0] = checked;
            setSelectedKeys(selectedKeyCopy);
          }}
        />
      </div>
      <ul
        className="ant-dropdown-menu  ant-dropdown-menu-root ant-dropdown-menu-vertical"
      >
        {columns.map((filter, i) => (
          <li
            className="ant-dropdown-menu-item"
            key={i}
          >
            <Checkbox
              style={{ width: '100%' }}
              checked={selectedKeys[i+1]}
              onChange={(e) => {
                let selectedKeyCopy = [...selectedKeys];
                selectedKeyCopy[i+1] = e.target.checked;
                setSelectedKeys(selectedKeyCopy);
              }}
            >
              {filter}
            </Checkbox>
          </li>
        ))}
      </ul>
      <div
        className="ant-table-filter-dropdown-btns"
      >
        <a
          className="ant-table-filter-dropdown-link confirm"
          onClick={() => {
            const { filterOptions } = tableState;
            filterOptions.checkboxFilters = {
              ...filterOptions.checkboxFilters,
              [columnName]: columns.filter((column, i) => !!selectedKeys[i+1])
            };
            filterOptions.checkboxFilterModes = {
              ...filterOptions.checkboxFilterModes,
              [columnName]: !!selectedKeys[0]
            };
            setTableState({...tableState, filterOptions})
            confirm();
          }}
        >
          OK
        </a>
        <a
          className="ant-table-filter-dropdown-link clear"
          onClick={() => {
            clearFilters();
            const { filterOptions } = tableState;
            filterOptions.checkboxFilters = {...filterOptions.checkboxFilters, [columnName]: [] };
            filterOptions.checkboxFilterModes = {...filterOptions.checkboxFilterModes, [columnName]: !!selectedKeys[0]};
            confirm();
          }}
        >
          Reset
        </a>
      </div>
    </div>
  );
};

export default ContentTable;