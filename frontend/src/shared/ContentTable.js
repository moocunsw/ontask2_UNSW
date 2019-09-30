import React, { useState } from "react";
import { Button, Checkbox, Divider, Dropdown, Icon, Input, Menu, Switch, Table } from "antd";
import _ from "lodash";

const { Search } = Input;

// TODO: Change Structure of Form Storage
// TODO: Boolean column named <checkbox_group column>__<checkbox_group group> issue
// TODO: Custom Filter Selection Close to boundary does not select checkbox
// TODO: Preview Form Field Changes are reflected in sort,filter,search,etc?
// TODO: Disable Sorting/Filtering for Fields in DataLAB preview

function initialiseData(data, searchTerm) {
  if (!data) return [];

  const term = searchTerm.trim().toLowerCase();

  const tableData = (
    term === ""
      ? data
      : data.filter(row =>
          String(Object.values(row))
            .toLowerCase()
            .includes(term)
        )
  ).map((row, i) => {return {key: i, ...row}})

  return tableData;
};

const initialiseFilterStates = (columns, fields) => {
  const checkboxGroupColumnNames = columns.filter(column => {
    const fieldItem = fields.find(field => field.name === column.title);
    return fieldItem && fieldItem.type === "checkbox-group";
  }).map(column => column.dataIndex);

  return [
    _.zipObject(checkboxGroupColumnNames, _.map(checkboxGroupColumnNames, () => [])),
    _.zipObject(checkboxGroupColumnNames, _.map(checkboxGroupColumnNames, () => false))
  ];
};

const ContentTable = (props) => {
  const { columns, dataSource, fields } = props;
  const [initialFilters, initialFilterModes] = initialiseFilterStates(columns, fields);
  const [ searchTerm, setSearchTerm ] = useState("");
  const [ customFilters, setCustomFilters ] = useState(initialFilters);
  const [ filterModes, setFilterModes ] = useState(initialFilterModes);

  const tableData = initialiseData(dataSource, searchTerm);
  const totalDataAmount = dataSource ? dataSource.length : 0;
  const tableDataAmount = tableData.length;

  const newColumns = columns.map(column => {
    const columnName = column.title;
    var { filters, onFilter, sorter } = column;
    var customFilter = {};
    // TODO CHANGE LOGIC
    if (!filters) {
      const fieldItem = fields.find(field => field.name === columnName);
      if (fieldItem) {
        switch (fieldItem.type) {
          case "text":
          case "number":
          case "date":
            // Remove null values & duplicates
            if (fieldItem.type === "date") {
              filters = _.uniqBy(tableData.filter(row => row[columnName] != null).map(row => {return {text: row[columnName].slice(0, 10), value: row[columnName]}}), 'value');
            }
            else {
              filters = _.uniqBy(tableData.filter(row => row[columnName] != null).map(row => {return {text: row[columnName], value: row[columnName]}}), 'value');

            }
            onFilter = (value, record) => record[columnName] && record[columnName] === value;
            sorter = (a, b) => {
              const str_a = String(a[columnName]) || "";
              const str_b = String(b[columnName]) || "";
              if (str_a === "") {
                return 1;
              }
              else if (str_b === "") {
                return -1;
              }
              else {
                return str_a.localeCompare(str_b);
              }
            }
            break;
          case "list":
            filters = fieldItem.options.map(option => {return {text: option.label, value: option.value}});
            onFilter = (value, record) => record[columnName] && record[columnName] === value;
            sorter = null;
            break;
          case "checkbox":
            filters = [{text: 'True', value: true}, {text: 'False', value: false}];
            onFilter = (value, record) => !!record[columnName] === value;
            sorter = null;
            break;
          case "checkbox-group":
            customFilter = {
              filterDropdown: ({ setSelectedKeys, selectedKeys, confirm, clearFilters }) => (
                // Render a near-identical antd table filter but with a Switch Component
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
                    {fieldItem.columns.map((filter, i) => (
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
                        setCustomFilters({...customFilters, [columnName]: fieldItem.columns.filter((column, i) => !!selectedKeys[i+1])});
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
              ),
            }

            onFilter = (value, record) => {
              const filterGroups = customFilters[columnName];
              if (filterModes[columnName]) {
                // AND
                return filterGroups.every(group => record[`${columnName}__${group}`]);
              }
              else {
                // OR
                return filterGroups.some(group => record[`${columnName}__${group}`]);
              }
            };
            sorter = (a, b) => {
              const count_a = fieldItem.columns.map(column => a[`${columnName}__${column}`]).filter(v => v).length;
              const count_b = fieldItem.columns.map(column => b[`${columnName}__${column}`]).filter(v => v).length;
              return count_b - count_a;
            }
            break;
          default:
            // TODO (code shouldnt reach here)
            console.log("ERROR - Code shouldnt reach here");
            break;
        }
      }
      else {
        // Non Form Field Item
        filters = _.uniqBy(tableData.filter(row => row[columnName] != null).map(row => {return {text: row[columnName], value: row[columnName]}}), 'value')
        onFilter = (value, record) => record[columnName] === value
      }
    }
    return {
      ...customFilter,
      title: columnName,
      dataIndex: column.dataIndex,
      filters: filters,
      onFilter: onFilter,
      sorter: sorter,
      render: column.render
      // key: column.key // This breaks the onFilter
    }
  });

  // console.log(newColumns);
  // console.log(fields);
  // console.log(dataSource);
  console.log(tableData);


  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <Search
          style={{ width: "auto", marginRight: '15px' }}
          placeholder="Search..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        <div>
          {tableDataAmount} records selected out of {totalDataAmount} (
          {totalDataAmount - tableDataAmount} filtered out)
        </div>
      </div>
      <Divider />
      <Table {...props} columns={newColumns} dataSource={tableData} />
    </div>
  );
};

export default ContentTable;