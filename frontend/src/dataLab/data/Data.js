import React from "react";
import {
  Table,
  Icon,
  Menu,
  Dropdown,
  Popover,
  Tooltip,
  Button,
  Input,
  notification,
  Radio,
  Select
} from "antd";
import memoize from "memoize-one";
import _ from "lodash";

import Visualisation from "./Visualisation";
import Details from "../details/Details";

import apiRequest from "../../shared/apiRequest";
import Field from "../../shared/Field";

const Search = Input.Search;

class Data extends React.Component {
  constructor(props) {
    super(props);
    const { defaultGroup } = this.props;

    this.state = {
      sort: {},
      editable: {},
      edit: { field: null, primary: null },
      saved: {},
      searchTerm: "",
      visualisation: false,
      view: "data",
      grouping: defaultGroup
    };
  }

  initialiseData = memoize((data, searchTerm) => {
    if (!data) return [];

    const term = searchTerm.trim().toLowerCase();

    const tableData =
      term === ""
        ? data
        : data.filter(row =>
            String(Object.values(row))
              .toLowerCase()
              .includes(term)
          );

    return tableData;
  });

  initialiseColumns = () => {
    const { steps, columns, data } = this.props;

    if (data.length > 1)
      return columns
        .filter(column => column.visible)
        .map(column => ({
          fixed: column.pin ? "left" : false,
          className: "column",
          dataIndex: column.details.label,
          key: column.details.label,
          sorter: (a, b) =>
            (a[column.details.label] || "")
              .toString()
              .localeCompare((b[column.details.label] || "").toString()),
          title: (
            <span
              className={`column_header ${_.get(
                steps,
                `${column.stepIndex}.type`,
                ""
              )}`}
            >
              {this.TruncatedLabel(column.details.label)}
            </span>
          ),
          render: (value, record) => {
            if (column.details.field_type === "checkbox-group")
              value = _.pick(record, column.details.fields);

            return (
              <Field
                readOnly
                field={{
                  type: column.details.field_type,
                  columns: column.details.fields,
                  options: column.details.options
                }}
                value={value}
              />
            );
          }
        }));

    return [
      {
        title: "Field",
        dataIndex: "column.details.label"
      },
      {
        title: "Value",
        dataIndex: "value",
        render: (value, record) => {
          if (record.column.details.field_type === "checkbox-group")
            value = _.pick(record.item, record.column.details.fields);

          return (
            <Field
              readOnly
              field={{
                type: record.column.details.field_type,
                columns: record.column.details.fields,
                options: record.column.details.options
              }}
              value={value}
            />
          );
        }
      }
    ];
  };

  TruncatedLabel = label =>
    label.length > 25 ? (
      <Popover content={label}>{`${label.slice(0, 25)}...`}</Popover>
    ) : (
      label
    );

  DatasourceColumns = stepIndex => {
    const { steps } = this.props;

    const step = steps[stepIndex]["datasource"];
    const columns = [];

    step.fields.forEach(field => {
      const label = step.labels[field];
      const truncatedLabel = this.TruncatedLabel(label);

      columns.push({
        className: "column",
        stepIndex,
        field,
        dataIndex: label,
        key: label,
        sorter: (a, b) => {
          a = label in a && a[label] !== null ? a[label] : "";
          b = label in b && b[label] !== null ? b[label] : "";
          return a.toString().localeCompare(b.toString());
        },
        title: (
          <span className="column_header datasource">{truncatedLabel}</span>
        ),
        render: text => (
          <Field readOnly field={{ type: step.types[field] }} value={text} />
        )
      });
    });

    return columns;
  };

  FormColumns = stepIndex => {
    const { steps, forms } = this.props;
    // const { sort, edit } = this.state;
    const { edit } = this.state;

    const formId = steps[stepIndex]["form"];
    const columns = [];

    const form = forms.find(form => form.id === formId);

    form.fields.forEach(field => {
      const label = field.name;
      const truncatedLabel = this.TruncatedLabel(label);

      const title = (
        <div className="column_header">
          <Dropdown
            trigger={["click"]}
            overlay={
              <Menu
                onClick={e => {
                  if (e.key === "visualise")
                    this.setState({
                      visualisation: { visible: true, column: field.name }
                    });
                  else if (e.key === "edit")
                    this.setState({
                      edit: { field: field.name, primary: form.primary }
                    });
                }}
              >
                <Menu.Item key="edit">
                  <Icon type="edit" style={{ marginRight: 5 }} />
                  Enter data
                </Menu.Item>
              </Menu>
            }
          >
            <span style={{ cursor: "pointer" }} className="column_header form">
              {truncatedLabel}
            </span>
          </Dropdown>

          {edit.field === field.name && (
            <Tooltip title="Finish editing">
              <Button
                shape="circle"
                className="button"
                size="small"
                icon="check"
                style={{ marginLeft: 5 }}
                onClick={() =>
                  this.setState({ edit: { field: null, primary: null } })
                }
              />
            </Tooltip>
          )}
        </div>
      );

      columns.push({
        className: "column",
        stepIndex,
        field: label,
        title,
        dataIndex: label,
        key: label,
        // sorter: (a, b) => {
        // a = label in a ? a[label] : "";
        // b = label in b ? b[label] : "";
        // return a.toString().localeCompare(b.toString());
        // },
        render: (text, record, index) => {
          if (field && field.type === "checkbox-group")
            text = _.pick(record, field.columns.map(column => `${field.name}__${column}`));

          return (
            <div className="editable-field">
              <Field
                field={field}
                value={text}
                readOnly={edit.field !== field.name}
                onSave={(value, column) => {
                  const payload = {
                    field: column ? column : field.name,
                    primary: record[form.primary],
                    value
                  };
                  this.handleFormUpdate(formId, payload, index);
                }}
              />
            </div>
          );
        }
      });
    });

    return columns;
  };

  ComputedColumns = stepIndex => {
    const { steps } = this.props;

    const step = steps[stepIndex]["computed"];
    const columns = [];

    step.fields.forEach(field => {
      const label = field.name;
      const truncatedLabel = this.TruncatedLabel(label);

      columns.push({
        className: "column",
        stepIndex,
        field: label,
        title: <span className="column_header computed">{truncatedLabel}</span>,
        dataIndex: label,
        key: label,
        sorter: (a, b) => {
          a = label in a && a[label] !== null ? a[label] : "";
          b = label in b && b[label] !== null ? b[label] : "";
          return a.toString().localeCompare(b.toString());
        },
        render: text => {
          return <Field readOnly field={field} value={text} />;
        }
      });
    });

    return columns;
  };

  handleFormUpdate = (formId, payload, index) => {
    const { updateData, data } = this.props;
    const { saved } = this.state;

    updateData(index, payload.field, payload.value);

    apiRequest(`/form/${formId}/access/`, {
      method: "PATCH",
      payload,
      onSuccess: () => {
        this.setState({ saved: { ...saved, [payload.primary]: true } }, () => {
          this.updateSuccess = setTimeout(
            () =>
              this.setState({ saved: { ...saved, [payload.primary]: false } }),
            1500
          );
        });
      },
      onError: () => {
        notification["error"]({
          message: "Failed to update form"
        });
        // Revert the change
        updateData(index, payload.field, data[index][payload.field]);
      }
    });
  };

  handleChange = (pagination, filter, sort) => {
    this.setState({ filter, sort });
  };

  componentWillUnmount() {
    clearTimeout(this.updateSuccess);
  }

  exportToCSV = () => {
    const { selectedId } = this.props;

    this.setState({ exporting: true });

    apiRequest(`/datalab/${selectedId}/csv/`, {
      method: "POST",
      onSuccess: () => {
        this.setState({ exporting: false });
      },
      onError: () => this.setState({ exporting: false })
    });
  };

  render() {
    const {
      data,
      groupBy,
      columns,
      updateDatalab,
      selectedId,
      restrictedView
    } = this.props;
    const {
      visualisation,
      edit,
      saved,
      searchTerm,
      view,
      exporting,
      grouping
    } = this.state;

    // Columns are initialised on every render, so that changes to the sort
    // in local state can be reflected in the table columns. Otherwise the
    // columns would ideally only be initialised when receiving the build
    // for the first time
    const orderedColumns = this.initialiseColumns();

    // Similarly, the table data is initialised on every render, so that
    // changes to values in form columns can be reflected
    const tableData = this.initialiseData(data, searchTerm);
    const totalDataAmount = data ? data.length : 0;

    const tableDataAmount = tableData.length;

    const groups = groupBy ? new Set(data.map(item => item[groupBy])) : [];

    // console.log(data.length > 1
    //   ? grouping !== undefined
    //     ? tableData.filter(
    //         item => _.get(item, groupBy) === grouping
    //       )
    //     : tableData
    //   : columns.map((column, i) => ({
    //       column,
    //       value: _.get(data[0], column.details.label),
    //       item: data[0]
    //     })));

    return (
      <div className="data" style={{ marginTop: 25 }}>
        {data.length > 1 && [
          <div className="filter" key="viz">
            <Button
              size="large"
              onClick={() => this.setState({ visualisation: true })}
              type="primary"
              disabled={!tableData.length}
            >
              <Icon type="area-chart" size="large" />
              Visualise
            </Button>

            <Button
              size="large"
              onClick={this.exportToCSV}
              type="primary"
              icon="export"
              loading={exporting}
              style={{ marginLeft: 10 }}
            >
              Export to CSV
            </Button>

            <Radio.Group
              size="large"
              style={{ marginLeft: 10 }}
              value={view}
              onChange={e => this.setState({ view: e.target.value })}
            >
              <Radio.Button value="data">Data</Radio.Button>
              <Radio.Button value="details">Details</Radio.Button>
            </Radio.Group>
          </div>,

          <div className="filter" style={{ marginTop: 10 }} key="search">
            {groupBy && (
              <Select
                style={{ width: "100%", maxWidth: 225, marginRight: 15 }}
                placeholder="Group by"
                allowClear
                showSearch
                value={grouping}
                onChange={grouping => this.setState({ grouping })}
              >
                {[...groups].sort().map((group, i) => (
                  <Select.Option value={group} key={i}>
                    {group ? group : <i>No value</i>}
                  </Select.Option>
                ))}
              </Select>
            )}

            <Search
              placeholder="Search..."
              value={searchTerm}
              onChange={e => this.setState({ searchTerm: e.target.value })}
              style={{ width: "auto", marginRight: 15 }}
            />
            <div>
              {tableDataAmount} records selected out of {totalDataAmount} (
              {totalDataAmount - tableDataAmount} filtered out)
            </div>
          </div>
        ]}

        <div className="data_manipulation">
          {tableData.length > 1 && (
            <Visualisation
              visible={visualisation}
              columns={columns}
              data={tableData}
              closeModal={() => this.setState({ visualisation: false })}
            />
          )}

          {view === "data" && (
            <Table
              rowKey={(record, index) => index}
              columns={orderedColumns}
              dataSource={
                data.length > 1
                  ? grouping !== undefined
                    ? tableData.filter(
                        item => _.get(item, groupBy) === grouping
                      )
                    : tableData
                  : columns.map((column, i) => ({
                      column,
                      value: _.get(data[0], column.details.label),
                      item: data[0]
                    }))
              }
              scroll={{ x: (orderedColumns.length - 1) * 175 }}
              onChange={this.handleChange}
              pagination={
                data.length > 1
                  ? {
                      showSizeChanger: true,
                      pageSizeOptions: ["10", "25", "50", "100"]
                    }
                  : false
              }
              rowClassName={record =>
                edit.primary in record && saved[record[edit.primary]]
                  ? "saved"
                  : ""
              }
            />
          )}

          {view === "details" && (
            <Details
              selectedId={selectedId}
              columns={columns}
              updateDatalab={updateDatalab}
              restrictedView={restrictedView}
            />
          )}
        </div>
      </div>
    );
  }
}

export default Data;
