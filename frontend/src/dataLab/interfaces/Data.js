import React from "react";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import { Table, Icon, Menu, Dropdown, Popover, Tooltip, Button } from "antd";
import moment from "moment";
import _ from "lodash";

import * as DataLabActionCreators from "../DataLabActions";

import VisualisationModal from "../visualisation/VisualisationModal";

import EditableField from "../data-manipulation/EditableField";

class Data extends React.Component {
  constructor(props) {
    super(props);
    const { dispatch } = props;

    this.boundActionCreators = bindActionCreators(
      DataLabActionCreators,
      dispatch
    );

    this.state = {
      sort: {},
      editable: {},
      edit: { field: null, primary: null },
      saved: {}
    };
  }

  initialiseData = () => {
    const { data } = this.props;

    if (!data) return [];

    // Add unique keys to each of the data records, to be consumed by the data table
    const tableData = data.map((data, i) => ({ ...data, key: i }));

    return tableData;
  };

  initialiseColumns = () => {
    const { build } = this.props;

    if (!build) return [];

    // Initialise the columns of the data table
    const columns = [];
    build.steps.forEach((step, stepIndex) => {
      if (step.type === "datasource")
        columns.push(...this.DatasourceColumns(stepIndex));

      if (step.type === "form") columns.push(...this.FormColumns(stepIndex));
    });

    // Order the columns
    const orderedColumns = [];
    build.order.forEach(orderItem => {
      const column = columns.find(
        column =>
          column.stepIndex === orderItem.stepIndex &&
          column.field === orderItem.field
      );
      if (column && orderItem.visible) orderedColumns.push(column);
    });

    // Identify the first non-primary field
    const firstNonPrimaryField = orderedColumns.find(column => {
      const step = build.steps[column.stepIndex];
      return column.field !== step[step.type].primary;
    });

    // Only show the row-wise visualisations column if we have at
    // least one non-primary field in the dataset
    if (firstNonPrimaryField) {
      const defaultVisualisation = {
        stepIndex: firstNonPrimaryField.stepIndex,
        field: firstNonPrimaryField.field
      };

      orderedColumns.unshift({
        title: "Action",
        fixed: "left",
        dataIndex: 0,
        key: 0,
        render: (index, value) => (
          <a>
            <Icon
              type="area-chart"
              onClick={() =>
                this.boundActionCreators.openVisualisationModal(
                  defaultVisualisation,
                  true,
                  value
                )
              }
            />
          </a>
        )
      });
    }

    return orderedColumns;
  };

  handleHeaderClick = (e, stepIndex, field, primary) => {
    switch (e.key) {
      case "visualise":
        this.boundActionCreators.openVisualisationModal({ stepIndex, field });
        break;

      case "edit":
        this.setState({ edit: { field: field.name, primary } });
        break;

      default:
        break;
    }
  };

  TruncatedLabel = label =>
    label.length > 15 ? (
      <Popover content={label}>{`${label.slice(0, 15)}...`}</Popover>
    ) : (
      label
    );

  DatasourceColumns = stepIndex => {
    const { build } = this.props;
    const { sort } = this.state;

    const step = build.steps[stepIndex]["datasource"];
    const columns = [];

    step.fields.forEach(field => {
      const label = step.labels[field];
      const truncatedLabel = this.TruncatedLabel(label);

      const isPrimaryOrMatching = [step.matching, step.primary].includes(field);

      const title = isPrimaryOrMatching ? (
        truncatedLabel
      ) : (
        <div className="column_header">
          <Dropdown
            trigger={["click"]}
            overlay={
              <Menu onClick={e => this.handleHeaderClick(e, stepIndex, field)}>
                <Menu.Item key="visualise">
                  <Icon type="area-chart" style={{ marginRight: 5 }} />Visualise
                </Menu.Item>
              </Menu>
            }
          >
            <a className="datasource">{label}</a>
          </Dropdown>
        </div>
      );

      columns.push({
        stepIndex,
        field,
        dataIndex: label,
        key: label,
        sorter: (a, b) => {
          a = label in a ? a[label] : "";
          b = label in b ? b[label] : "";
          return a.localeCompare(b);
        },
        sortOrder: sort && sort.field === label && sort.order,
        title,
        render: text => text
      });
    });

    return columns;
  };

  FormColumns = stepIndex => {
    const { build } = this.props;
    const { sort, edit } = this.state;

    const step = build.steps[stepIndex]["form"];
    const columns = [];

    let isActive = true;
    if (step.activeFrom && !moment().isAfter(step.activeFrom)) isActive = false;
    if (step.activeTo && !moment().isBefore(step.activeTo)) isActive = false;

    step.fields.forEach(field => {
      const label = field.name;
      const truncatedLabel = this.TruncatedLabel(label);

      const title = (
        <div className="column_header">
          <Dropdown
            trigger={["click"]}
            overlay={
              <Menu
                onClick={e =>
                  this.handleHeaderClick(e, stepIndex, field, step.primary)
                }
              >
                <Menu.Item key="edit" disabled={!isActive}>
                  <Tooltip
                    title={
                      !isActive &&
                      "This column cannot be edited as it belongs to a form that is no longer active"
                    }
                  >
                    <Icon type="edit" style={{ marginRight: 5 }} />Enter data
                  </Tooltip>
                </Menu.Item>

                <Menu.Item key="visualise">
                  <Icon type="area-chart" style={{ marginRight: 5 }} />Visualise
                </Menu.Item>
              </Menu>
            }
          >
            <a className="form">{truncatedLabel}</a>
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
        stepIndex,
        field: label,
        title,
        dataIndex: label,
        key: label,
        sorter: (a, b) => {
          a = label in a ? a[label] : "";
          b = label in b ? b[label] : "";
          return a.localeCompare(b);
        },
        sortOrder: sort && sort.field === label && sort.order,
        render: (text, record) =>
          this.renderFormField(stepIndex, field, text, record[step.primary])
      });
    });

    return columns;
  };

  renderFormField = (stepIndex, field, text, primary) => {
    const { edit } = this.state;
    const value = _.get(edit, `values[${primary}]`, text);

    return edit.field === field.name ? (
      <div className="editable-field">
        <EditableField
          field={field}
          value={value}
          onChange={e =>
            this.setState({
              edit: _.merge(edit, { values: { [primary]: e } })
            })
          }
          onOk={() => {
            if (value !== text) {
              const payload = { stepIndex, field: field.name, primary, value };
              this.handleFormUpdate(payload);
            }
          }}
        />
      </div>
    ) : (
      text
    );
  };

  handleFormUpdate = payload => {
    const { selectedId } = this.props;
    const { saved } = this.state;

    this.boundActionCreators.updateDataLabForm({
      dataLabId: selectedId,
      payload,
      onFinish: () => {
        this.setState({ saved: { ...saved, [payload.primary]: true } }, () => {
          setTimeout(
            () =>
              this.setState({ saved: { ...saved, [payload.primary]: false } }),
            1500
          );
        });
      }
    });
  };

  handleChange = (pagination, filter, sort) => {
    this.setState({ filter, sort });
  };

  render() {
    const { visualisation, edit, saved } = this.state;

    // Columns are initialised on every render, so that changes to the sort
    // in local state can be reflected in the table columns. Otherwise the
    // columns would ideally only be initialised when receiving the build
    // for the first time
    const orderedColumns = this.initialiseColumns();

    // Similarly, the table data is initialised on every render, so that
    // changes to values in form columns can be reflected
    const tableData = this.initialiseData();

    return (
      <div className="data_manipulation">
        <VisualisationModal
          {...visualisation}
          closeModal={() =>
            this.setState({ visualisation: { visible: false } })
          }
        />

        <Table
          columns={orderedColumns}
          dataSource={orderedColumns.length > 0 ? tableData : []}
          scroll={{ x: (orderedColumns.length - 1) * 175 }}
          onChange={this.handleChange}
          pagination={{
            showSizeChanger: true,
            pageSizeOptions: ["10", "25", "50", "100"]
          }}
          rowClassName={record =>
            edit.primary in record && saved[record[edit.primary]] ? "saved" : ""
          }
        />
      </div>
    );
  }
}

const mapStateToProps = state => {
  const { build, data, selectedId } = state.dataLab;

  return {
    build,
    data,
    selectedId
  };
};

export default connect(mapStateToProps)(Data);