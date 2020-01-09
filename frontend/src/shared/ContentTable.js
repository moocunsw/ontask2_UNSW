import React, { useState, useEffect } from "react";
import { Checkbox, Divider, Input, Switch, Table } from "antd";
import _ from "lodash";

import Field from "./Field";

const { Search } = Input;

// TODO: Boolean column named <checkbox_group column>__<checkbox_group group> issue
// TODO: Custom Filter Selection Close to boundary does not select checkbox

// TODO: Potentially (implement table + vertical view)
// TODO: Optional Search -> Pass props to callback function in parent
// TODO: GROUP BY -> Pass props to callback function in parent
// TODO: EXPORT

// Manage State with 

// function initialiseData(data, searchTerm, setTableData) {
//   if (!data) return [];

//   const term = searchTerm.trim().toLowerCase();

//   const tableData = (
//     term === ""
//       ? data
//       : data.filter(row =>
//           String(Object.values(row))
//             .toLowerCase()
//             .includes(term)
//         )
//   );
//   if (setTableData) setTableData(tableData); // Pass Data to parent (Data.js for visualisation)

//   return tableData.map((row, i) => {return {key: i, ...row}})
// };

// const handleSearch = (e, setSearchTerm, data, setTableData, updateTableData) => {
//   const searchTerm = e.target.value;
//   setSearchTerm(searchTerm);
//   var newTableData;

//   if (!data) newTableData = [];
//   else {
//     const term = searchTerm.trim().toLowerCase();
//     newTableData = (
//       term === ""
//         ? data
//         : data.filter(row =>
//             String(Object.values(row))
//               .toLowerCase()
//               .includes(term)
//           )
//     );
//   }
//   // console.log(newTableData);
//   if (updateTableData) updateTableData(newTableData); // Pass Data to parent (Data.js for visualisation)
//   setTableData(newTableData);
// }

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

  // TODO: Implement all functionalities
  const [ filterOptions, setFilterOptions ] = useState({
    pagination: {
      showSizeChanger: true,
      pageSizeOptions: ["10", "25", "50", "100"]
    },
    sort: {},
    filter: {},
    search: "",
    groupBy: null
  });

  const { search } = filterOptions;
  // CheckboxGroup Items
  const [ customFilters, setCustomFilters ] = useState(initialFilters);
  // AND OR Filtering for CheckboxGroup
  const [ filterModes, setFilterModes ] = useState(initialFilterModes);
  const [ loading, setLoading ] = useState(false);

  const handleFilterChange = (pagination, filters, sorter) => {
    const currPagination = filterOptions.pagination;
    currPagination.current = pagination.current;
    setFilterOptions({
      ...filterOptions,
      pagination: currPagination
    });

    // Fetch Data
    const payload = {
      results: pagination.pageSize,
      page: pagination.current,
      sortField: !!sorter.field ? sorter.field : null,
      sortOrder: !!sorter.order ? sorter.order: null,
      search: search,
      checkboxGroupFilterModes: filterModes,
      checkboxGroupFilter: customFilters,
      filters: filters
    };

    // console.log(payload);
    // Refresh Data based on new filters; return pagination total
    fetchData(payload, setLoading, filterOptions, setFilterOptions);
    // console.log(data);
  }
  console.log(dataSource);

  // const totalDataAmount = dataSource ? dataSource.length : 0;
  // const tableDataAmount = tableData.length; // TODO: Fix based on filtering as well

  const newColumns = columns.map(column => {
    const { dataIndex, field } = column;
    const { type, columns } = field;

    if (type === "checkbox-group") {
      const customFilter =
      type === "checkbox-group" ?
        {
          filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) =>
            renderCheckboxGroupFilter({
              setSelectedKeys,
              selectedKeys,
              confirm,
              clearFilters,
              setFilterModes,
              filterModes,
              setCustomFilters,
              customFilters,
              columnName: dataIndex,
              columns,
            })
        }
      : {};

      return {
        ...column,
        ...customFilter,
        sorter: true,
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
        filters: filters && filters[dataIndex], // TODO - BACKEND
        sorter: ['checkbox', 'list'].includes(type) ? null : true,
        render: (value, record, index) => {
          return (
            <Field
              // primaryKey={}
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

  //   const filters = null; // Whatever Backend sends back
  //   const sorter = ['checkbox', 'list'].includes(column.fieldType) ? null : true;
  //   const render = 

  //   /*
  //   filters -> Backend
  //   sorter ->
  //   render
  //   */
  //   const columnName = column.dataIndex;
  //   const { fieldType } = column;

  //   // if (isPreview) {
  //   //   filters = null;
  //   //   sorter = null;
  //   // }
  //   else {
  //     switch (fieldType) {
  //       case "text":
  //       case "number":
  //         const filters =
  //         _.uniqBy(
  //           dataSource
  //             .filter(row => row[columnName] != null)
  //             .map(row => {return {text: row[columnName], value: row[columnName]}})
  //         , 'value');
  //         const sorter = true;
  //         break;
  //       case "date":
  //         // Remove null values & duplicates
  //         const filters =
  //           _.uniqBy(
  //             dataSource
  //               .filter(row => row[columnName] != null)
  //               .map(row => {return {text: row[columnName].slice(0, 10), value: row[columnName]}})
  //           , 'value');
  //         const sorter = true;
  //         break;
  //         // onFilter = (value, record) => record[columnName] && record[columnName] === value;
  //         // sorter = (a, b) => {
  //         //   const str_a = String(a[columnName]) || "";
  //         //   const str_b = String(b[columnName]) || "";
  //         //   if (str_a === "") return 1;
  //         //   else if (str_b === "") return -1;
  //         //   else return str_a.localeCompare(str_b);
  //         // };
  //       case "list":
  //         const filters = fieldItem.options.map(option => {return {text: option.label, value: option.value}});
  //         // onFilter = (value, record) => record[columnName] && record[columnName] === value;
  //         const sorter = null;
  //         break;
  //       case "checkbox":
  //         const filters = [{text: 'True', value: true}, {text: 'False', value: false}];
  //         // onFilter = (value, record) => !!record[columnName] === value;
  //         const sorter = null;
  //         break;
  //       case "checkbox-group":
  //         customFilter = {
  //           filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) =>
  //             renderCheckboxGroupFilter({
  //               setSelectedKeys,
  //               selectedKeys,
  //               confirm,
  //               clearFilters,
  //               setFilterModes,
  //               filterModes,
  //               setCustomFilters,
  //               customFilters,
  //               columnName,
  //               fieldItem,
  //             })
  //         }
  //         onFilter = (value, record) => {
  //           const filterGroups = customFilters[columnName];
  //           if (filterModes[columnName]) return filterGroups.every(group => record[`${columnName}__${group}`]);
  //           else return filterGroups.some(group => record[`${columnName}__${group}`]);
  //         };
  //         sorter = (a, b) => {
  //           const count_a = fieldItem.columns.map(column => a[`${columnName}__${column}`]).filter(v => v).length;
  //           const count_b = fieldItem.columns.map(column => b[`${columnName}__${column}`]).filter(v => v).length;
  //           return count_b - count_a;
  //         }
  //         break;
  //       default:
  //         // TODO (code shouldnt reach here)
  //         console.log("ERROR - Code shouldnt reach here");
  //         break;
  //     }
  //   }
    
  //     // TEXT
  //   // else {
  //   //   // Non Form Field Item
  //   //   filters =
  //   //     _.uniqBy(
  //   //       dataSource
  //   //         .filter(row => row[columnName] != null)
  //   //         .map(row => {return {text: row[columnName], value: row[columnName]}})
  //   //     , 'value');
  //   //   onFilter = (value, record) => record[columnName] === value;
  //   //   sorter = (a, b) => String(a[columnName] || "").localeCompare(String(b[columnName] || ""));
  //   // }
  //   render = (value, record, index) => {
  //     if (fieldItem && fieldItem.type === "checkbox-group")
  //       value = _.pick(record, fieldItem.columns.map(column => `${fieldItem.name}__${column}`));

  //     const editable =
  //       !readOnly && fieldItem && ( !form || (
  //         form &&
  //         form.is_active &&
  //         form.editable_records.includes(_.get(record, form.primary))
  //       ));

  //     return (
  //       <Field
  //         // primaryKey={}
  //         readOnly={!editable}
  //         field={fieldItem}
  //         value={value}
  //         onSave={(value, column) =>
  //           handleSubmit && handleSubmit(
  //             record[form.primary],
  //             column ? column : fieldItem.name,
  //             value,
  //             index,
  //             fieldItem.name
  //           )
  //         }
  //       />
  //     );
  //   };
  //   return {
  //     ...customFilter,
  //     title: column.title,
  //     dataIndex: columnName,
  //     filters: filters,
  //     onFilter: onFilter,
  //     sorter: sorter,
  //     render: render
  //     // key: column.key // This breaks the onFilter
  //   }
  // });

  // console.log(newColumns);
  // console.log(fields);
  // console.log(dataSource);
  // console.log(dataSource);


  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Search
          style={{ width: "auto", marginRight: '15px' }}
          placeholder="Search..."
          value={search}
          onChange={(e) => setFilterOptions({...filterOptions, search: e.target.value})}
        />
        {/* <div>
          {tableDataAmount} records selected out of {totalDataAmount} (
          {totalDataAmount - tableDataAmount} filtered out)
        </div> */}
      </div>
      <Divider />
      <Table
        {...antdTableProps}
        columns={newColumns}
        dataSource={dataSource}
        loading={loading}
        pagination={filterOptions.pagination}
        // onChange={(pagination, filter, sort) => {
        //   console.log(pagination, filter, sort);
        // }}
        onChange={handleFilterChange}
        // onChange={(pagination, filter, sort, extra) => {
        //   console.log(pagination, filter, sort, extra);
        //   setFilterOptions({...filterOptions, pagination: pagination, filter: filter, sort: sort});
        // }}
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
    setFilterModes,
    filterModes,
    setCustomFilters,
    customFilters,
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
            setFilterModes({...filterModes, [columnName]: !!selectedKeys[0]});
            setCustomFilters({...customFilters, [columnName]: columns.filter((column, i) => !!selectedKeys[i+1])});
            confirm();
          }}
        >
          OK
        </a>
        <a
          className="ant-table-filter-dropdown-link clear"
          onClick={() => {
            clearFilters();
            setFilterModes({...filterModes, [columnName]: !!selectedKeys[0]});
            setCustomFilters({...customFilters, [columnName]: [] });
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