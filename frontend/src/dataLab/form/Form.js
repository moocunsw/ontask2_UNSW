import React from "react";
import {
  Form,
  Icon,
  Tooltip,
  Input,
  Select,
  Modal,
  Divider,
  Button,
  List,
  Checkbox,
  DatePicker,
  Alert,
  notification,
  Drawer,
  Table,
  Upload,
  message
} from "antd";
import _ from "lodash";
import moment from "moment";

import FieldDesign from "./FieldDesign";

import formItemLayout from "../../shared/FormItemLayout";
import apiRequest from "../../shared/apiRequest";
import Field from "../../shared/Field";

class DataLabForm extends React.Component {
  state = { singleRecordIndex: 0 };

  componentWillMount() {
    const { columns, formDetails } = this.props;

    const labels = columns.map(item => item.details.label);

    const fields = _.get(formDetails, "fields", []);

    this.setState({
      labels,
      fields,
      fieldKeys: fields.map(() => _.uniqueId())
    });
  }

  componentDidUpdate(prevProps) {
    const { formDetails, form } = this.props;

    if (prevProps.formDetails !== formDetails) {
      const fields = _.get(formDetails, "fields", []);
      this.setState({
        fields,
        fieldKeys: fields.map(() => _.uniqueId()),
        error: false
      });
      form.resetFields();
    }
  }

  addField = () => {
    const { fields, fieldKeys } = this.state;

    this.setState({
      fields: [...fields, {}],
      fieldKeys: [...fieldKeys, _.uniqueId()],
      error: false
    });
  };

  deleteField = fieldIndex => {
    const { form } = this.props;
    const { fieldKeys } = this.state;
    const { getFieldValue, setFieldsValue } = form;

    Modal.confirm({
      title: "Confirm field deletion",
      content: `Are you sure you want to delete this field from the form?
        Any data entered in the form for this field will be lost.`,
      onOk: () => {
        const fields = getFieldValue("fields");

        fieldKeys.splice(fieldIndex, 1);
        fields.splice(fieldIndex, 1);

        this.setState({ fieldKeys, fields });
        setFieldsValue({ fields });
      }
    });
  };

  exportField = () => {
    const { form } = this.props;

    form.validateFields(["name", "fields"], (err, payload) => {
      const hasNoFields = _.get(payload, "fields", []).length === 0;
      if (hasNoFields) this.setState({ error: true });

      if (err || hasNoFields) return;

      const downloadFile = async() => {
        const { name, fields } = payload;
        const fileName = `${name}.json`;
        const blob = new Blob([JSON.stringify(fields)], {type: 'application/json'});
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }

      downloadFile();

    });
  };

  onChangePrimary = primary => {
    const { form } = this.props;
    const { getFieldValue, setFieldsValue } = form;

    const currentPrimary = getFieldValue("primary");

    setFieldsValue({
      visibleFields: getFieldValue("visibleFields").filter(
        field => field !== primary
      )
    });

    // Check if the chosen primary key is unique
    const performCheck = () => {
      // const partial = getFieldValue("steps").slice(0, stepIndex);
      // apiRequest(`/datalab/check_uniqueness/`, {
      //   method: "POST",
      //   payload: { partial, primary },
      //   onSuccess: result => {
      //     const { isUnique } = result;
      //     if (!isUnique) {
      //       notification["error"]({
      //         message: "Invalid primary key",
      //         description: `"${primary}" cannot be used as a primary key
      //         because the values are not unique.`
      //       });
      //       setFieldsValue({
      //         [`steps[${stepIndex}].form.primary`]: null
      //       });
      //     }
      //   }
      // });
    };

    if (currentPrimary) {
      Modal.confirm({
        title: "Confirm primary key change",
        content: `All data in this form will be irreversably deleted if the 
          primary key is changed.`,
        okText: "Continue",
        okType: "danger",
        cancelText: "Cancel",
        onOk: () => {
          performCheck();
          setFieldsValue({ primary });
        }
      });
    } else {
      performCheck();
      return primary;
    }

    return currentPrimary;
  };

  handleSubmit = () => {
    const {
      form,
      selectedId,
      dataLabId,
      updateForms,
      history,
      updateDatalab
    } = this.props;

    form.validateFields((err, payload) => {
      const hasNoFields = _.get(payload, "fields", []).length === 0;
      if (hasNoFields) this.setState({ error: true });

      if (err || hasNoFields) return;

      this.setState({ loading: true });

      apiRequest(selectedId ? `/form/${selectedId}/` : "/form/", {
        method: selectedId ? "PATCH" : "POST",
        payload: { ...payload, datalab: dataLabId },
        onSuccess: updatedForm => {
          notification["success"]({
            message: `Form ${selectedId ? "updated" : "created"}`,
            description: `The form was successfully ${
              selectedId ? "updated" : "created"
            }.`
          });
          this.setState({ loading: false });

          if (selectedId) {
            updateDatalab(updatedForm.updated_datalab);
          } else {
            history.push({
              pathname: `/datalab/${dataLabId}/form/${updatedForm.id}`
            });
            updateForms({ updatedForm });
          }
        },
        onError: error => {
          this.setState({ loading: false });
        }
      });
    });
  };

  handleDelete = () => {
    const { selectedId, history, dataLabId, updateForms } = this.props;

    Modal.confirm({
      title: "Confirm form deletion",
      content: "All data collected through the form will also be deleted.",
      okText: "Continue with deletion",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        this.setState({
          deleting: true
        });

        apiRequest(`/form/${selectedId}/`, {
          method: "DELETE",
          onSuccess: () => {
            this.setState({ deleting: false });
            notification["success"]({
              message: "Form deleted",
              description: "The form was successfully deleted."
            });
            history.push(`/datalab/${dataLabId}/settings`);
            updateForms({ isDelete: true });
          },
          onError: error => {
            this.setState({ deleting: false });
            notification["error"]({
              message: "Form deletion failed",
              description: error
            });
          }
        });
      }
    });
  };

  preview = () => {
    const { form, data } = this.props;
    const { singleRecordIndex, grouping, searchField } = this.state;
    const { getFieldsValue } = form;
    const {
      primary,
      visibleFields,
      groupBy,
      searchBy,
      fields,
      layout
    } = getFieldsValue();

    const columns = [
      primary,
      ...visibleFields,
      ...(fields || []).map(field => field.name)
    ];

    const groups = groupBy ? new Set(data.map(item => item[groupBy])) : [];

    if (layout === "table") {
      const tableColumns = columns.map((column, columnIndex) => ({
        title: column,
        dataIndex: column,
        key: columnIndex,
        sorter: (a, b) => (a[column] || "").localeCompare(b[column] || ""),
        render: (text, record) => {
          const field = (fields || []).find(field => field.name === column);
          let value = column in record ? text : null;

          if (field && field.type === "checkbox-group")
            value = _.pick(record, field.columns);

          return <Field readOnly={!field} field={field} value={value} />;
        }
      }));

      return (
        <div>
          {groupBy && [
            <div style={{ marginBottom: 5 }} key="text">
              Group by:
            </div>,
            <Select
              style={{ width: "100%", maxWidth: 350 }}
              key="groups"
              allowClear
              showSearch
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

          <Table
            columns={tableColumns}
            dataSource={
              grouping !== undefined || grouping !== null
                ? data.filter(item => _.get(item, groupBy) === grouping)
                : data
            }
            scroll={{ x: (columns.length - 1) * 175 }}
            pagination={{
              showSizeChanger: true,
              pageSizeOptions: ["10", "25", "50", "100"]
            }}
            rowKey={(record, i) => i}
          />
        </div>
      );
    } else if (layout === "vertical") {
      const tableColumns = [
        {
          title: "Field",
          dataIndex: "column"
        },
        {
          title: "Value",
          dataIndex: "value",
          render: (value, record) => {
            const field = (fields || []).find(
              field => field.name === record.column
            );

            if (field && field.type === "checkbox-group")
              value = _.pick(record.item, field.columns);

            return (
              <Field
                primaryKey={_.get(record.item, primary)} // Force re-render of the field component after changing the selected record
                readOnly={!field}
                field={field}
                value={value}
              />
            );
          }
        }
      ];

      return (
        <div>
          {groupBy && [
            <div style={{ marginBottom: 5 }} key="text">
              Group by:
            </div>,
            <Select
              key="groups"
              style={{ width: "100%", maxWidth: 350, marginBottom: 10 }}
              allowClear
              showSearch
              onChange={grouping =>
                this.setState({
                  grouping,
                  singleRecordIndex: data.findIndex(
                    item => _.get(item, groupBy) === grouping
                  )
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

          <div style={{ marginBottom: 5 }}>Choose a record:</div>

          <div>
            {searchBy.length > 0 && (
              <Select
                style={{ marginRight: 10, minWidth: 150 }}
                onChange={searchField => this.setState({ searchField })}
                value={searchField}
              >
                {[
                  <Select.Option key={primary}>{primary}</Select.Option>,
                  ...searchBy.map((field, index) => (
                    <Select.Option key={field}>{field}</Select.Option>
                  ))
                ]}
              </Select>
            )}

            <Select
              style={{ width: "100%", maxWidth: 350 }}
              onChange={singleRecordIndex =>
                this.setState({ singleRecordIndex })
              }
              filterOption={(input, option) =>
                option.props.children
                  .toLowerCase()
                  .indexOf(input.toLowerCase()) >= 0
              }
              value={_.get(data, `${singleRecordIndex}.${searchField}`)}
            >
              {data.map((record, index) =>
                grouping === undefined ||
                grouping === null ||
                _.get(record, groupBy) === grouping ? (
                  <Select.Option key={index}>
                    {record[searchField]}
                  </Select.Option>
                ) : null
              )}
            </Select>
          </div>

          <Divider />

          <Table
            bordered
            columns={tableColumns}
            dataSource={columns.map((column, i) => ({
              column,
              value: _.get(data, `${singleRecordIndex}.${column}`),
              item: _.get(data, singleRecordIndex),
              key: i
            }))}
            pagination={false}
          />
        </div>
      );
    }
  };

  render() {
    const { formDetails, form, selectedId } = this.props;
    const {
      labels,
      fields,
      fieldKeys,
      error,
      loading,
      deleting,
      preview
    } = this.state;
    const { getFieldDecorator, getFieldValue, getFieldsValue } = form;

    const primary = getFieldValue("primary") || _.get(formDetails, "primary");

    return (
      <Form layout="horizontal" style={{ maxWidth: 700, overflow: "hidden" }}>
        <h2>Details</h2>

        <Form.Item
          {...formItemLayout}
          label={
            <span>
              Form name
              <Tooltip
                title="The name provided will be used as the page title 
                when a user accesses the form"
              >
                <Icon
                  style={{ marginLeft: 5, cursor: "help" }}
                  type="question-circle"
                />
              </Tooltip>
            </span>
          }
        >
          {getFieldDecorator("name", {
            initialValue: _.get(formDetails, "name"),
            rules: [{ required: true, message: "Name is required" }]
          })(<Input />)}
        </Form.Item>

        <Form.Item
          {...formItemLayout}
          label={
            <span>
              Description
              <Tooltip title="A description that users will see when accessing the form">
                <Icon
                  style={{ marginLeft: 5, cursor: "help" }}
                  type="question-circle"
                />
              </Tooltip>
            </span>
          }
        >
          {getFieldDecorator("description", {
            initialValue: _.get(formDetails, "description")
          })(<Input.TextArea />)}
        </Form.Item>

        <Form.Item
          {...formItemLayout}
          label={
            <span>
              Primary key
              <Tooltip
                title="The field from the DataLab that will be used 
                to identify the data collected through this form"
              >
                <Icon
                  style={{ marginLeft: 5, cursor: "help" }}
                  type="question-circle"
                />
              </Tooltip>
            </span>
          }
        >
          {getFieldDecorator(`primary`, {
            rules: [{ required: true, message: "Primary key is required" }],
            getValueFromEvent: this.onChangePrimary,
            initialValue: _.get(formDetails, "primary")
          })(
            <Select
              onChange={e => {
                if (
                  ![e, ...getFieldValue("visibleFields")].includes(
                    getFieldValue("groupBy")
                  )
                )
                  form.resetFields(["groupBy"]);
              }}
            >
              {labels.map(label => (
                <Select.Option value={label} key={label}>
                  {label}
                </Select.Option>
              ))}
            </Select>
          )}
        </Form.Item>

        <Form.Item
          {...formItemLayout}
          label={
            <span>
              Additional fields
              <Tooltip
                title="You may specify fields from other modules that 
                should be shown in the form (read only)"
              >
                <Icon
                  style={{ marginLeft: 5, cursor: "help" }}
                  type="question-circle"
                />
              </Tooltip>
            </span>
          }
        >
          {getFieldDecorator("visibleFields", {
            initialValue: _.get(formDetails, "visibleFields", [])
          })(
            <Select
              mode="multiple"
              maxTagCount={5}
              maxTagPlaceholder={`...${getFieldValue("visibleFields").length -
                5} more fields selected`}
              onChange={e => {
                if (
                  ![getFieldValue("primary"), ...e].includes(
                    getFieldValue("groupBy")
                  )
                )
                  form.resetFields(["groupBy"]);
              }}
            >
              {labels
                .filter(label => !fields.some(field => field.name === label))
                .map(label => (
                  <Select.Option
                    disabled={label === primary}
                    value={label}
                    key={label}
                  >
                    <Tooltip
                      title={
                        label === primary
                          ? "The primary key of the form is included by default"
                          : ""
                      }
                    >
                      {label}
                    </Tooltip>
                  </Select.Option>
                ))}
            </Select>
          )}
        </Form.Item>

        <Form.Item
          {...formItemLayout}
          label={
            <span>
              Group by
              <Tooltip title="Group form records by the chosen field">
                <Icon
                  style={{ marginLeft: 5, cursor: "help" }}
                  type="question-circle"
                />
              </Tooltip>
            </span>
          }
        >
          {getFieldDecorator("groupBy", {
            initialValue: _.get(formDetails, "groupBy")
          })(
            <Select allowClear>
              {[
                ...(getFieldValue("visibleFields")
                  ? getFieldValue("visibleFields")
                  : [])
              ].map(label => (
                <Select.Option value={label} key={label}>
                  {label}
                </Select.Option>
              ))}
            </Select>
          )}
        </Form.Item>

        <Form.Item
          {...formItemLayout}
          label={
            <span>
              Search by
              <Tooltip title="Allow records to be searched by the chosen field">
                <Icon
                  style={{ marginLeft: 5, cursor: "help" }}
                  type="question-circle"
                />
              </Tooltip>
            </span>
          }
        >
          {getFieldDecorator("searchBy", {
            initialValue: _.get(formDetails, "searchBy")
          })(
            <Select allowClear mode="multiple">
              {[
                ...(getFieldValue("primary") ? [getFieldValue("primary")] : []),
                ...(getFieldValue("visibleFields")
                  ? getFieldValue("visibleFields")
                  : [])
              ].map(label => (
                <Select.Option
                  disabled={label === primary}
                  value={label}
                  key={label}
                >
                  <Tooltip
                    title={
                      label === primary
                        ? "The primary key of the form is included by default"
                        : ""
                    }
                  >
                    {label}
                  </Tooltip>
                </Select.Option>
              ))}
            </Select>
          )}
        </Form.Item>

        <Divider />

        <h2>Design</h2>

        <div>
          <Button icon="plus" onClick={this.addField}>
            Add field
          </Button>

          <Tooltip
            title={
              !getFieldValue("primary")
                ? "The primary key must be specified before you can preview the form"
                : ""
            }
          >
            <Button
              disabled={!getFieldValue("primary")}
              style={{ marginLeft: 10 }}
              icon="experiment"
              onClick={() => this.setState({ preview: true })}
            >
              Preview
            </Button>
          </Tooltip>
          <Button
              style={{ marginLeft: 10 }}
              icon="export"
              onClick={() => this.exportField()}
          >
            Export
          </Button>
          <Upload
            accept='.json'
            showUploadList={false}
            // onChange={(file, fileList, event) => this.importField(file, fileList, event)}
            onChange={({ file }) => {
              if (file.status === 'done') {
                const reader = new FileReader();
                reader.onloadend = (e) => {
                  // TODO ERROR CHECK FILE CONTENTS
                  const importFields = JSON.parse(e.target.result);
                  const validateKeys = ["name", "type"];
                  const validateTypes = ["text", "list", "number", "date", "checkbox", "checkbox-group"];
                  const isValidImport = importFields instanceof Array && importFields.every(field => {
                    return validateKeys.every(key => field.hasOwnProperty(key)) && validateTypes.includes(field.type)
                  });
                  if (isValidImport) {
                    this.setState({
                      fields: importFields,
                      fieldKeys: importFields.map(() => _.uniqueId())
                    })
                    message.success(`${file.name} file uploaded successfully`);
                  }
                  else {
                    message.error(`${file.name} could not be imported. Please check its content structure`);
                  }
                };
                reader.readAsText(file.originFileObj);
              } else if (file.status === 'error') {
                message.error(`${file.name} file upload failed.`);
              }
            }}
            customRequest={({ file, onSuccess }) => {
              setTimeout(() => {
                onSuccess("ok");
              }, 0);
            }}
          >
            <Button
                style={{ marginLeft: 10 }}
                icon="upload"
            >
              Import
            </Button>
          </Upload>
        </div>

        <List
          size="large"
          bordered
          dataSource={fieldKeys}
          style={{ marginTop: 10, overflowY: "auto", maxHeight: 300 }}
          locale={{ emptyText: "No fields have been added yet." }}
          renderItem={(key, fieldIndex) => {
            return (
              <List.Item>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%"
                  }}
                >
                  <FieldDesign
                    key={key}
                    labels={[
                      ...labels,
                      ..._.get(getFieldsValue(), "fields", []).map(
                        (field, i) => i !== fieldIndex && field.name
                      )
                    ]}
                    field={fields[fieldIndex]}
                    fieldIndex={fieldIndex}
                    form={form}
                    deleteField={() => this.deleteField(fieldIndex)}
                    updateClonedField={field => {
                      const updatedFields = [...fields];
                      updatedFields[fieldIndex] = field;
                      this.setState({ fields: updatedFields });
                    }}
                  />
                </div>
              </List.Item>
            );
          }}
        />

        <Form.Item
          {...formItemLayout}
          style={{ marginTop: 10 }}
          label={
            <span>
              Layout
              <Tooltip
                title="Choose whether the form will be represented as a single-record 
                vertical form (mobile friendly) or a table (desktop friendly)"
              >
                <Icon
                  style={{ marginLeft: 5, cursor: "help" }}
                  type="question-circle"
                />
              </Tooltip>
            </span>
          }
        >
          {getFieldDecorator("layout", {
            initialValue: _.get(formDetails, "layout", "table")
          })(
            <Select>
              <Select.Option value="vertical">Single-record form</Select.Option>
              <Select.Option value="table">Data table</Select.Option>
            </Select>
          )}
        </Form.Item>

        <Divider />

        <h2>Access</h2>

        <Form.Item {...formItemLayout} label="Active from">
          {getFieldDecorator("activeFrom", {
            initialValue: _.get(formDetails, "activeFrom")
              ? moment(_.get(formDetails, "activeFrom"))
              : undefined
          })(
            <DatePicker
              style={{ width: "100%" }}
              showTime
              format="DD/MM/YYYY HH:mm"
            />
          )}
        </Form.Item>

        <Form.Item {...formItemLayout} label="Active to">
          {getFieldDecorator("activeTo", {
            initialValue: _.get(formDetails, "activeTo")
              ? moment(_.get(formDetails, "activeTo"))
              : undefined
          })(
            <DatePicker
              style={{ width: "100%" }}
              showTime
              format="DD/MM/YYYY HH:mm"
            />
          )}
        </Form.Item>

        <Form.Item {...formItemLayout} label="Allow access via user email">
          {getFieldDecorator("emailAccess", {
            initialValue: _.get(formDetails, "emailAccess") || false,
            valuePropName: "checked"
          })(<Checkbox />)}
        </Form.Item>

        <Form.Item {...formItemLayout} label="Allow access via LTI">
          {getFieldDecorator("ltiAccess", {
            initialValue: _.get(formDetails, "ltiAccess") || false,
            valuePropName: "checked"
          })(<Checkbox />)}
        </Form.Item>

        {(getFieldValue("ltiAccess") || getFieldValue("emailAccess")) && (
          <div>
            <Form.Item
              {...formItemLayout}
              label={
                <span>
                  Match permission with
                  <Tooltip
                    title="Grant access on a record-by-record basis by comparing the given 
                DataLab field value with the access method(s) specified above"
                  >
                    <Icon
                      style={{ marginLeft: 5, cursor: "help" }}
                      type="question-circle"
                    />
                  </Tooltip>
                </span>
              }
            >
              {getFieldDecorator("permission", {
                rules: [
                  {
                    required: true,
                    message:
                      "Permission matching field is required if access is allowed via LTI or user email"
                  }
                ],
                initialValue: _.get(formDetails, "permission")
              })(
                <Select>
                  {labels.map(label => (
                    <Select.Option value={label} key={label}>
                      {label}
                    </Select.Option>
                  ))}
                </Select>
              )}
            </Form.Item>

            <Form.Item {...formItemLayout} label="Restriction type">
              {getFieldDecorator("restriction", {
                rules: [
                  {
                    required: true,
                    message: "Restriction type is required"
                  }
                ],
                initialValue: _.get(formDetails, "restriction", "private")
              })(
                <Select>
                  <Select.Option value="private">
                    <Tooltip
                      title="Users can only see and edit the records for which they have
                  explicit access"
                    >
                      Limited read, limited write
                    </Tooltip>
                  </Select.Option>
                  <Select.Option value="limited">
                    <Tooltip
                      title="Users that have access to at least one record can see all 
                  records but can only edit those for which they have explicit access"
                    >
                      Open read, limited write
                    </Tooltip>
                  </Select.Option>
                  <Select.Option value="open">
                    <Tooltip
                      title="Users that have access to at least one record can see and 
                  edit all other records"
                    >
                      Open read, open write
                    </Tooltip>
                  </Select.Option>
                </Select>
              )}
            </Form.Item>
          </div>
        )}

        {error && (
          <Alert
            style={{ marginTop: 20 }}
            type="error"
            message="At least one field is required in the form"
          />
        )}

        <div style={{ marginTop: 20 }}>
          {selectedId && (
            <Button
              type="danger"
              style={{ marginRight: 10 }}
              loading={deleting}
              onClick={this.handleDelete}
            >
              Delete
            </Button>
          )}

          <Button type="primary" onClick={this.handleSubmit} loading={loading}>
            {selectedId ? "Save" : "Submit"}
          </Button>
        </div>

        {getFieldValue("primary") && (
          <Drawer
            className="form-drawer"
            title="Form Preview"
            placement="right"
            onClose={() => this.setState({ preview: false })}
            visible={preview}
          >
            {this.preview()}
            <Alert
              style={{ marginTop: 20, maxWidth: 500 }}
              type="info"
              showIcon
              message="Data entered in this form preview will not be saved"
            />
          </Drawer>
        )}
      </Form>
    );
  }
}

export default Form.create()(DataLabForm);
