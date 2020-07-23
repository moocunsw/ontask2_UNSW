import React from "react";
import {
  Icon,
  Menu,
  Dropdown,
  Popover,
  Tooltip,
  Button,
  notification,
  Radio
} from "antd";
import _ from "lodash";

import Visualisation from "./Visualisation";
import Details from "../details/Details";

import apiRequest from "../../shared/apiRequest";
import Field from "../../shared/Field";
import ContentTable from "../../shared/ContentTable";

class Data extends React.Component {
  constructor(props) {
    super(props);
    const { defaultGroup } = this.props;

    this.state = {
      editable: {},
      edit: { field: null, primary: null },
      saved: {},
      visualisation: false,
      view: "data",
      grouping: defaultGroup,
    };
  }

  // initialiseColumns = () => {
  //   const { steps, columns, data } = this.props;

  //   if (data.length > 1)
  //     return columns
  //       .filter(column => column.visible)
  //       .map(column => ({
  //         fixed: column.pin ? "left" : false,
  //         className: "column",
  //         dataIndex: column.details.label,
  //         key: column.details.label,
  //         sorter: (a, b) =>
  //           (a[column.details.label] || "")
  //             .toString()
  //             .localeCompare((b[column.details.label] || "").toString()),
  //         title: (
  //           <span
  //             className={`column_header ${_.get(
  //               steps,
  //               `${column.stepIndex}.type`,
  //               ""
  //             )}`}
  //           >
  //             {this.TruncatedLabel(column.details.label)}
  //           </span>
  //         ),
  //         render: (value, record) => {
  //           if (column.details.field_type === "checkbox-group")
  //             value = _.pick(record, column.details.fields);

  //           return (
  //             <Field
  //               readOnly
  //               field={{
  //                 type: column.details.field_type,
  //                 columns: column.details.fields,
  //                 options: column.details.options
  //               }}
  //               value={value}
  //             />
  //           );
  //         }
  //       }));

  //   return [
  //     {
  //       title: "Field",
  //       dataIndex: "column.details.label"
  //     },
  //     {
  //       title: "Value",
  //       dataIndex: "value",
  //       render: (value, record) => {
  //         if (record.column.details.field_type === "checkbox-group")
  //           value = _.pick(record.item, record.column.details.fields);

  //         return (
  //           <Field
  //             readOnly
  //             field={{
  //               type: record.column.details.field_type,
  //               columns: record.column.details.fields,
  //               options: record.column.details.options
  //             }}
  //             value={value}
  //           />
  //         );
  //       }
  //     }
  //   ];
  // };

  initialiseColumns = () => {
    // Convert Columns into a suitable structure for ContentTable
    const { steps, columns } = this.props;
    return columns
      .filter(column => column.visible)
      .map(column => {
        return ({
          fixed: column.pin ? "left" : false,
          className: "column",
          dataIndex: column.details.label,
          field: {
            name: column.details.label,
            type: column.details.field_type,
            columns: column.details.fields,
            options: column.details.options
          },
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
        })
      });
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
        // sorter: (a, b) => {
        //   a = label in a && a[label] !== null ? a[label] : "";
        //   b = label in b && b[label] !== null ? b[label] : "";
        //   return a.toString().localeCompare(b.toString());
        // },
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
      filter_details,
      columns,
      updateDatalab,
      fetchData,
      selectedId,
      restrictedView
    } = this.props;
    const {
      visualisation,
      edit,
      saved,
      view,
      exporting
    } = this.state;

    const filterNum = filter_details && { total: filter_details.dataNum, filtered: filter_details.paginationTotal };
    const filters = filter_details && filter_details.filters;
    const groups = filter_details ? filter_details.groups: [];
    const filteredData = filter_details ? filter_details.filteredData : [];

    // Columns are initialised on every render, so that changes to the sort
    // in local state can be reflected in the table columns. Otherwise the
    // columns would ideally only be initialised when receiving the build
    // for the first time
    const orderedColumns = this.initialiseColumns();

    return (
      <div className="data" style={{ marginTop: 25 }}>
        {data.length > 1 && [
          <div className="filter" key="viz">
            <Button
              size="large"
              onClick={() => this.setState({ visualisation: true })}
              type="primary"
              disabled={!filteredData.length}
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
          </div>
        ]}

        <div className="data_manipulation">
          {filteredData.length > 1 && (
            <Visualisation
              visible={visualisation}
              columns={columns}
              data={filteredData}
              closeModal={() => this.setState({ visualisation: false })}
            />
          )}

          {view === "data" && (
            <ContentTable
              showSearch
              rowKey={(record, index) => index}
              columns={orderedColumns}
              dataSource={filteredData}
              filters={filters}
              groups={groups}
              scroll={{ x: (orderedColumns.length - 1) * 175 }}
              fetchData={fetchData}
              rowClassName={record =>
                edit.primary in record && saved[record[edit.primary]]
                  ? "saved"
                  : ""
              }
              isReadOnly={(record, column) => true}
              filterNum={filterNum}
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
