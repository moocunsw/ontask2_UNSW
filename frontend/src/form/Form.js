import React from "react";
import { Link } from "react-router-dom";
import {
  Layout,
  Icon,
  Spin,
  Table,
  Divider,
  Select,
  message,
  Dropdown,
  Button,
  Menu,
  Upload,
  notification
} from "antd";
import _ from "lodash";

import apiRequest from "../shared/apiRequest";
import Field from "../shared/Field";
import ContentTable from "../shared/ContentTable";

import "./Form.css";

const { Content } = Layout;

class Form extends React.Component {
  state = { fetching: true, singleRecordIndex: 0, saved: {} };

  componentWillMount() {
    const { match, history } = this.props;

    apiRequest(`/form/${match.params.id}/access/`, {
      method: "GET",
      onSuccess: form => {
        const columnNames = [
          ...new Set([
            form.primary,
            ...form.visibleFields,
            ...form.fields.map(field => field.name)
          ])
        ];

        this.setState({
          fetching: false,
          form,
          columnNames,
          tableColumns: this.generateColumns(form, columnNames),
          grouping: form.default_group,
          searchField: form.primary
        });
      },
      onError: (error, status) => {
        if (status === 403) {
          history.replace("/forbidden");
          return;
        }

        // this.setState({
        //   fetching: false,
        //   error: error.detail
        // });
        history.replace("/error");
      }
    });
  }

  generateColumns = (form, columnNames) => {
    const { singleRecordIndex } = this.state;

    if (!form || !columnNames) { return [] }
    // console.log(columnNames);

    if (form.layout === "table") {
      return columnNames.map((column, columnIndex) => ({
        title: column,
        dataIndex: column,
        key: columnIndex,
        sorter: (a, b) => String(a[column] || "").localeCompare(String(b[column] || "")),
        render: (value, record, index) => {
          const field = form.fields.find(field => field.name === column);
          const editable =
            form.is_active &&
            form.editable_records.includes(_.get(record, form.primary)) &&
            field;


          if (field && field.type === "checkbox-group")
            value = _.pick(record, field.columns.map(column => `${field.name}__${column}`));


          // console.log(column); // Column Name
          // console.log(record); // Row Info (Object)
          // console.log(field); // Field Info
          // console.log(value); // Value of the Field (if checkbox, then object)
          // console.log(editable); // Undefined if non editable, otherwise same as field

          return (
            <Field
              readOnly={!editable}
              field={field}
              value={value}
              onSave={(value, column) =>
                this.handleSubmit(
                  record[form.primary],
                  column ? column : field.name,
                  value,
                  index,
                  field.name
                )
              }
            />
          );
        }
      }));
    } else if (form.layout === "vertical") {
      return [
        {
          title: "Field",
          dataIndex: "column"
        },
        {
          title: "Value",
          dataIndex: "value",
          render: (value, record) => {
            const primary = _.get(record.item, form.primary);

            const field = form.fields.find(
              field => field.name === record.column
            );
            const editable =
              form.is_active &&
              form.editable_records.includes(primary) &&
              field;

            if (field && field.type === "checkbox-group")
              value = _.pick(record, field.columns.map(column => `${field.name}__${column}`));

            return (
              <Field
                primaryKey={primary}
                readOnly={!editable}
                field={field}
                value={value}
                onSave={(value, column) =>
                  this.handleSubmit(
                    primary,
                    column ? column : field.name,
                    value,
                    singleRecordIndex,
                    field.name
                  )
                }
              />
            );
          }
        }
      ];
    }
  };

  handleSubmit = (primary, field, value, index, loadingKey) => {
    const { match } = this.props;
    const { saved, form } = this.state;

    // const { fields } = form;
    // const item = fields.find(field => field.name === loadingKey);
    // Boolean value to determine if field should be passed as {loadingKey__field}
    // const addColumn = item && item.type === "checkbox-group";
    // console.log(addColumn);

    // console.log(primary);
    // console.log(field);
    // console.log(value);
    // console.log(index);
    // console.log(loadingKey);

    // console.log(form);
    // const columnField = `${loadingKey}_${field}`;

    const data = form.data;
    data.forEach(item => {
      if (item[form.primary] === primary) item[field] = value;
    });
    this.setState({ form: { ...form, data } });

    const loading = message.loading("Saving form...", 0);
    apiRequest(`/form/${match.params.id}/access/`, {
      method: "PATCH",
      payload: { primary, field, value },
      onSuccess: () => {
        const savedRecord = _.get(saved, primary, {});
        savedRecord[loadingKey] = true;
        this.setState({ saved: { ...saved, [primary]: savedRecord } }, () => {
          this.updateSuccess = setTimeout(() => {
            savedRecord[loadingKey] = false;
            this.setState({ saved: { ...saved, [primary]: savedRecord } });
          }, 1500);
        });
        loading();
        message.success("Form saved");
      },
      onError: () => {
        loading();
        message.error("Failed to save form");
        // Revert the form data using the original form state
        // (const is instantiated at the start of handleSubmit, before the setState)
        this.setState({ form });
      }
    });
  };

  componentWillUnmount() {
    clearTimeout(this.updateSuccess);
  }

  Tools = () => {
    const { match } = this.props;

    return (
      <Menu
        onClick={e => {
          if (e.key === "export") {
            this.setState({ loading: true });

            apiRequest(`/form/${match.params.id}/export_structure/`, {
              method: "POST",
              onSuccess: () => {
                this.setState({ loading: false });
              },
              onError: () => {
                this.setState({ loading: false });
              }
            });
          } else if (e.key === "import") {
            this.setState({ upload: true });
          }
        }}
      >
        <Menu.Item key="export">Export structure</Menu.Item>
        <Menu.Item key="import">Import form data</Menu.Item>
      </Menu>
    );
  };

  uploadData = e => {
    const { match } = this.props;

    const file = e.file;
    const payload = new FormData();
    payload.append("file", file, file.name);

    this.setState({ loading: true });
    apiRequest(`/form/${match.params.id}/import_data/`, {
      method: "POST",
      payload,
      isJSON: false,
      onSuccess: () => {
        apiRequest(`/form/${match.params.id}/access/`, {
          method: "GET",
          onSuccess: form => {
            this.setState({ loading: false, upload: false, form });
            notification["success"]({
              message: "Successfully imported form data"
            });
          }
        });
      },
      onError: () => {
        notification["error"]({
          message: "Failed to import form data"
        });
      }
    });
  };

  render() {
    const {
      fetching,
      form,
      // tableColumns,
      columnNames,
      singleRecordIndex,
      saved,
      grouping,
      searchField,
      loading,
      upload
    } = this.state;

    const groups =
      form && form.groupBy
        ? new Set(form.data.map(item => item[form.groupBy]))
        : [];

    const tableColumns = this.generateColumns(form, columnNames);
    // console.log(tableColumns);
    return (
      <div className="form">
        <Content className="wrapper">
          <Layout className="layout">
            <Content className="content">
              <Layout className="content_body">
                {fetching ? (
                  <div style={{ textAlign: "left" }}>
                    <Spin size="large" />
                  </div>
                ) : (
                  <div>
                    <Link
                      to="/dashboard"
                      style={{ display: "inline-block", marginBottom: 20 }}
                    >
                      <Icon type="arrow-left" style={{ marginRight: 5 }} />
                      <span>Back to dashboard</span>
                    </Link>

                    {sessionStorage.getItem("group") === "admin" && (
                      <div style={{ marginBottom: 10 }}>
                        <Dropdown overlay={this.Tools} trigger={["click"]}>
                          <Button loading={loading} type="primary" icon="tool">
                            Tools <Icon type="down" />
                          </Button>
                        </Dropdown>

                        {upload && (
                          <Button
                            type="danger"
                            style={{ marginLeft: 5 }}
                            onClick={() => this.setState({ upload: false })}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    )}

                    {upload && (
                      <div style={{ maxWidth: 400, marginBottom: 10 }}>
                        <Upload.Dragger
                          accept="text/csv"
                          name="data"
                          listType="picture-card"
                          showUploadList={false}
                          customRequest={this.uploadData}
                          disabled={loading}
                        >
                          <p className="ant-upload-drag-icon">
                            <Icon type="inbox" />
                          </p>
                          <p className="ant-upload-text">
                            Click or drag CSV to this area to upload
                          </p>
                        </Upload.Dragger>
                      </div>
                    )}

                    <h1>{form.name}</h1>

                    <p>{form.description}</p>

                    {form.layout === "vertical" ? (
                      <div>
                        {form.data.length > 1 && (
                          <div>
                            {form.groupBy && [
                              <div style={{ marginBottom: 5 }} key="text">
                                Group by:
                              </div>,
                              <Select
                                key="groups"
                                style={{
                                  width: "100%",
                                  maxWidth: 350,
                                  marginBottom: 10
                                }}
                                allowClear
                                showSearch
                                value={grouping}
                                onChange={grouping =>
                                  this.setState({
                                    grouping,
                                    singleRecordIndex: grouping
                                      ? form.data.findIndex(
                                          item =>
                                            _.get(item, form.groupBy) ===
                                            grouping
                                        )
                                      : singleRecordIndex
                                  })
                                }
                              >
                                {[...groups].sort().map((group, i) => (
                                  <Select.Option value={group} key={i}>
                                    {group ? group : <i>No value</i>}
                                  </Select.Option>
                                ))}
                              </Select>
                            ]}

                            <div style={{ marginBottom: 5 }}>
                              Choose a record:
                            </div>

                            <div>
                              {form.searchBy.length > 0 && (
                                <Select
                                  style={{ marginRight: 10, minWidth: 150 }}
                                  onChange={searchField =>
                                    this.setState({ searchField })
                                  }
                                  value={searchField}
                                >
                                  {[
                                    <Select.Option key={form.primary}>
                                      {form.primary}
                                    </Select.Option>,
                                    ...form.searchBy.map((field, index) => (
                                      <Select.Option key={field}>
                                        {field}
                                      </Select.Option>
                                    ))
                                  ]}
                                </Select>
                              )}

                              <Select
                                showSearch
                                style={{ width: "100%", maxWidth: 350 }}
                                onChange={singleRecordIndex =>
                                  this.setState({ singleRecordIndex })
                                }
                                filterOption={(input, option) =>
                                  option.props.children
                                    .toLowerCase()
                                    .indexOf(input.toLowerCase()) >= 0
                                }
                                value={_.get(
                                  form.data,
                                  `${singleRecordIndex}.${searchField}`
                                )}
                              >
                                {form.data.map((record, index) =>
                                  grouping === undefined ||
                                  grouping === null ||
                                  _.get(record, form.groupBy) === grouping ? (
                                    <Select.Option key={index}>
                                      {record[searchField]}
                                    </Select.Option>
                                  ) : null
                                )}
                              </Select>
                            </div>

                            <Divider />
                          </div>
                        )}

                        <Table
                          bordered
                          columns={tableColumns}
                          dataSource={columnNames.map((column, i) => ({
                            column,
                            value: _.get(
                              form.data,
                              `${singleRecordIndex}.${column}`
                            ),
                            item: _.get(form.data, singleRecordIndex),
                            key: i
                          }))}
                          pagination={false}
                          rowClassName={record => {
                            const primary =
                              form.data[singleRecordIndex][form.primary];
                            return _.get(saved, `${primary}[${record.column}]`)
                              ? "saved"
                              : "";
                          }}
                        />
                      </div>
                    ) : (
                      <div>
                        {form.groupBy && [
                          <div style={{ marginBottom: 5 }} key="text">
                            Group by:
                          </div>,
                          <Select
                            style={{ width: "100%", maxWidth: 350 }}
                            key="groups"
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
                          </Select>,
                          <Divider key="divider" />
                        ]}

                        <ContentTable
                          fields={form.fields}
                          columns={tableColumns}
                          dataSource={
                            grouping !== undefined && grouping !== null
                              ? form.data.filter(
                                  item => _.get(item, form.groupBy) === grouping
                                )
                              : form.data
                          }
                          scroll={{ x: (tableColumns.length - 1) * 175 }}
                          pagination={{
                            showSizeChanger: true,
                            pageSizeOptions: ["10", "25", "50", "100"]
                          }}
                          rowKey={(record, i) => i}
                          rowClassName={record => {
                            const primary = record[form.primary];
                            return primary in saved &&
                              Object.values(saved[primary]).includes(true)
                              ? "saved"
                              : "";
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </Layout>
            </Content>
          </Layout>
        </Content>
      </div>
    );
  }
}

export default Form;
