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
import queryString from 'query-string';

import apiRequest from "../shared/apiRequest";
import Field from "../shared/Field";
import ContentTable from "../shared/ContentTable";

import "./Form.css";

const { Content } = Layout;

class Form extends React.Component {
  state = {
    fetching: true,
    singleRecordIndex: 0,
    saved: {},
  };

  componentWillMount() {
    // Parse Token in URL if any
    const { history } = this.props;

    const params = queryString.parse(history.location.search);
    const { token } = params;

    this.setState({ token: token });
  };

  componentDidMount() {
    const { match, history } = this.props;
    const { token } = this.state;

    const url = (!!token ? `/form/${match.params.id}/access/${token}/` : `/form/${match.params.id}/access/`);

    apiRequest(url, {
      method: "GET",
      isAuthenticated: !token,
      onSuccess: form => {
        const columnNames = [
          ...new Set([
            form.primary,
            ...form.visibleFields,
            ...form.fields.map(field => field.name)
          ])
        ];
        const { filter_details } = form;
        this.setState({
          fetching: false,
          form,
          filter_details,
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

  // ContentTable Function
  isReadOnly = (record, column) => {
    const { form } = this.state;
    const field = form.fields.find(field => field.name === column);
    return !(
      form.is_active &&
      form.editable_records.includes(_.get(record, form.primary)) &&
      field
    );
  };

  onFieldUpdate = (record, value, dataIndex, column, index, filterOptions) => {
    const { form } = this.state;
    const field = form.fields.find(field => field.name === dataIndex);

    this.handleSubmit(
      record[form.primary],
      column ? column: field.name,
      value,
      index,
      field.name,
      filterOptions
    )
  };

  generateColumns = (form, columnNames) => {
    const { singleRecordIndex } = this.state;

    if (!form || !columnNames) { return [] }

    if (form.layout === "table") {
      return columnNames.map((column, columnIndex) => {
        const field = form.fields.find(field => field.name === column);
        return ({
        title: column,
        dataIndex: column,
        field: !!field ?
          field
          : {
            type: 'text',
            columns: [],
            options: []
          },
      })});
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
              value = _.pick(record.item, field.columns.map(column => `${field.name}__${column}`));

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

  handleSubmit = (primary, field, value, index, loadingKey, filterOptions) => {
    const { match } = this.props;
    const { saved, form, token } = this.state;

    const data = form.data;
    data.forEach(item => {
      if (item[form.primary] === primary) item[field] = value;
    });
    this.setState({ form: { ...form, data } });

    const loading = message.loading("Saving form...", 0);

    const url = (!!token ? `/form/${match.params.id}/access/${token}/` : `/form/${match.params.id}/access/`);

    apiRequest(url, {
      method: "PATCH",
      isAuthenticated: !token,
      payload: { primary, field, value, filterOptions },
      onSuccess: (filter_details) => {
        const savedRecord = _.get(saved, primary, {});
        savedRecord[loadingKey] = true;
        this.setState({ filter_details, saved: { ...saved, [primary]: savedRecord } }, () => {
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

  fetchData = (payload, setTableState) => {
    setTableState && setTableState({filterOptions: payload, loading: true});
    const { match, history } = this.props;
    const { token } = this.state;

    const url = (!!token ? `/form/${match.params.id}/access/${token}/` : `/form/${match.params.id}/access/`);

    apiRequest(url, {
      method: "POST",
      isAuthenticated: !token,
      payload: payload,
      onSuccess: filter_details => {
        this.setState({filter_details});
        if (!!setTableState && !!payload) {
          payload.pagination.total = filter_details.paginationTotal;
          setTableState({filterOptions: payload, loading: false});
        }
      },
      onError: (error, status) => {
        setTableState && setTableState({filterOptions: payload, loading: false});
        if (status === 403) {
          history.replace("/forbidden");
          return;
        }
        history.replace("/error");
      }
    });
  }

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
            const { filter_details } = form;
            this.setState({ loading: false, upload: false, form, filter_details });
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
      filter_details,
      tableColumns,
      columnNames,
      singleRecordIndex,
      saved,
      grouping,
      searchField,
      loading,
      upload
    } = this.state;

    const filterNum = filter_details && { total: filter_details.dataNum, filtered: filter_details.paginationTotal };
    const filters = filter_details && filter_details.filters;
    const groups = filter_details ? filter_details.groups: [];
    const filteredData = filter_details ? filter_details.filteredData : [];

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
                    {!!sessionStorage.getItem("group") &&
                      <Link
                        to="/dashboard"
                        style={{ display: "inline-block", marginBottom: 20 }}
                      >
                        <Icon type="arrow-left" style={{ marginRight: 5 }} />
                        <span>Back to dashboard</span>
                      </Link>
                    }

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
                                {groups.map((group, i) => (
                                  <Select.Option value={group.value} key={i}>
                                    {group.text}
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
                        <ContentTable
                          showSearch
                          columns={tableColumns}
                          dataSource={filteredData}
                          scroll={{ x: (tableColumns.length - 1) * 175 }}
                          rowKey={(record, i) => i}
                          rowClassName={record => {
                            const primary = record[form.primary];
                            return primary in saved &&
                              Object.values(saved[primary]).includes(true)
                              ? "saved"
                              : "";
                          }}
                          isReadOnly={this.isReadOnly}
                          onFieldUpdate={this.onFieldUpdate}
                          fetchData={this.fetchData}
                          filters={filters}
                          groups={groups}
                          filterNum={filterNum}
                          paginationTotal={filter_details && filter_details.paginationTotal}
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
