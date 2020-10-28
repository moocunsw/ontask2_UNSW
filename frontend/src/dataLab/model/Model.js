import React from "react";
import {
  Button,
  Form,
  Input,
  message,
  Alert,
  Tooltip,
  notification,
  Affix,
  Icon,
  Select,
  Checkbox
} from "antd";
import _ from "lodash";
import memoize from "memoize-one";

import DatasourceModule from "./datasource/Datasource";
import FormModule from "./form/Form";
import ComputedModule from "./computed/Computed";

import ModelContext from "./ModelContext";

import apiRequest from "../../shared/apiRequest";
import formItemLayout from "../../shared/FormItemLayout";

class Model extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      loading: false,
      error: null,
      stepKeys: (props.steps || []).map(() => _.uniqueId()),
      // Make a clone of the build steps. If the user deletes a module,
      // or a module's values must be reset (e.g. change the chosen datasource
      // in a datasource module) then the step/module in the build must also be
      // cleared, as it is used for populating the initial values of the fields.
      steps: props.steps,
    };
  }

  setChanged = () => {
    this.props.onSettingsChange()
  }

  labelsUsed = memoize(stepIndex => {
    const { form, forms } = this.props;
    const { getFieldValue } = form;
    let steps = getFieldValue("steps") || [];

    if (stepIndex) steps = steps.filter((step, i) => i < stepIndex);

    return steps.reduce((labels, step, stepIndex) => {
      let stepLabels = [];

      if (step.type === "datasource" && "datasource" in step)
        stepLabels = Object.values(step.datasource.labels || {}).filter(
          label => !!label
        );
      else if (step.type === "form") {
        const relatedForm = forms.find(form => form.id === step.form);
        stepLabels = relatedForm
          ? relatedForm.fields.map(field => field.name)
          : [];
      } else if (step.type === "computed") {
        stepLabels = _.get(step, `${step.type}.fields`, [])
          .filter(field => !!field.name)
          .map(field => field.name);
      }

      return [...labels, ...stepLabels];
    }, []);
  });

  hasDependency = (stepIndex, field) => {
    const { form, datasources, forms } = this.props;
    const { getFieldValue } = form;

    // If a datasource field is being checked, then use the field's label
    let steps = getFieldValue("steps");
    if (steps[stepIndex].type === "datasource")
      field = (steps[stepIndex].datasource.labels || {})[field];

    // Check whether this field is used anywhere else
    for (let step of steps.slice(stepIndex + 1)) {
      if (step.type === "datasource") {
        if (_.get(step, "datasource.matching") === field) {
          const relatedDatasource = datasources.find(
            datasource => datasource.id === step.datasource.id
          );
          if (!relatedDatasource) break;

          return `The datasource component "${
            relatedDatasource.name
          }" is using it as a matching field.`;
        }
      }

      if (step.type === "form") {
        const relatedForm = forms.find(form => form.id === step.form);
        if (!relatedForm) break;

        if (relatedForm.primary === field)
          return `The form "${relatedForm.name}" is using it as a primary key.`;
        else if (relatedForm.permission === field)
          return `The form "${
            relatedForm.name
          }" is using it as a permission field.`;
        else if ((relatedForm.visibleFields || []).includes(field))
          return `The form "${
            relatedForm.name
          }" is using it as an additional field.`;
      }
    }

    return false;
  };

  handleSave = () => {
    const { location, history, form, selectedId, updateDatalab } = this.props;

    form.validateFields((err, build) => {
      if ((build.steps || []).length === 0) {
        this.setState({ error: "At least one component is required." });
        return;
      }

      if (err) return;

      this.setState({ loading: true });

      const containerId = _.get(location, "state.containerId");
      if (containerId) build.container = containerId;

      apiRequest(selectedId ? `/datalab/${selectedId}/` : "/datalab/", {
        method: selectedId ? "PATCH" : "POST",
        payload: build,
        onSuccess: dataLab => {
          notification["success"]({
            message: `DataLab ${selectedId ? "updated" : "created"}`,
            description: `The DataLab was successfully ${
              selectedId ? "updated" : "created"
            }.`
          });
          this.setState({ loading: false });
          updateDatalab(dataLab);
          if (!selectedId)
            history.push({ pathname: `/datalab/${dataLab.id}/data` });
        },
        onError: error => {
          notification["error"]({ message: error })
          this.setState({ loading: false });
        }
      });
    });
  };

  addModule = type => {
    const { form } = this.props;
    const { stepKeys } = this.state;
    const { getFieldDecorator } = form;

    // Force the first module to be a datasource
    if (stepKeys.length === 0 && type !== "datasource") {
      message.error("The first module of a DataLab must be a datasource.");
      return;
    }

    getFieldDecorator(`steps[${stepKeys.length}].type`, {
      initialValue: type
    });
    this.setState({ stepKeys: [...stepKeys, _.uniqueId()], error: null, changed: true });
    this.setChanged()
  };

  deleteModule = () => {
    const { form } = this.props;
    const { stepKeys, steps } = this.state;
    const { getFieldValue, setFieldsValue } = form;

    // Delete the last module in the build
    this.setState({
      stepKeys: stepKeys.slice(0, -1),
      // Update the steps in the state.
      // This ensures that if a module is added, then the values will not
      // be mistakenly pre-populated (given that the form fields set
      // initialValue against the "step" provided in the props of the module)
      steps: steps && steps.slice(0, -1),
    });
    this.setChanged()

    setFieldsValue({ steps: getFieldValue("steps").slice(0, -1) });
  };

  updateStep = (stepIndex, updatedStep) => {
    const { steps } = this.state;

    // If steps are undefined, then the user must be creating a DataLab
    // rather than updating one
    if (!steps) return;

    // Allow modules to update
    steps[stepIndex] = updatedStep;
    this.setState({ steps });
    this.setChanged()
  };

  render() {
    const {
      form,
      datasources,
      dataLabs,
      forms,
      actions,
      name,
      description,
      groupBy,
      selectedId,
      emailAccess,
      ltiAccess,
      permission,
      restriction
    } = this.props;
    const { loading, error, stepKeys, steps } = this.state;
    const { getFieldDecorator, getFieldValue } = form;

    return (
      <ModelContext.Provider
        value={{
          selectedId,
          form,
          stepKeys,
          labelsUsed: this.labelsUsed,
          datasources,
          dataLabs,
          forms,
          actions,
          deleteModule: this.deleteModule,
          hasDependency: this.hasDependency,
          updateStep: this.updateStep
        }}
      >
        <div className="model" style={{ maxWidth: 2000 }}>
          <h2>Data Model</h2>

          <Affix offsetTop={25}>
            <div className="components">
              <div>Components</div>
              <div>
                <Tooltip title="Add a datasource module">
                  <Button
                    icon="database"
                    size="large"
                    className="datasource"
                    onClick={() => this.addModule("datasource")}
                  />
                </Tooltip>

                <Tooltip
                  title={
                    selectedId
                      ? "Add a form module"
                      : "The DataLab must be created before you can add a form module"
                  }
                >
                  <Button
                    disabled={!selectedId}
                    icon="form"
                    size="large"
                    className="form"
                    onClick={() => this.addModule("form")}
                    style={{ margin: "0 10px" }}
                  />
                </Tooltip>

                <Tooltip title="Add a computed fields module">
                  <Button
                    icon="calculator"
                    size="large"
                    className="computed"
                    onClick={() => this.addModule("computed")}
                  />
                </Tooltip>

                {/* <Tooltip title="Add an action">
                  <Button
                    icon="form"
                    size="large"
                    className="action"
                    onClick={() => console.log("action pls")}
                    style={{marginLeft: "10px"}}
                  />
                </Tooltip> */}
              </div>
            </div>
          </Affix>

          <div className="build">
            {stepKeys.length > 0 ? (
              stepKeys.map((key, index) => {
                // If the module was added during this session,
                // then a type would have been bound via the addModule
                // function's getFieldDecorator
                let type = getFieldValue(`steps[${index}].type`);
                // Otherwise, we must be editing an existing DataLab
                // so use the API call data to infer the module type
                if (!type) {
                  type = steps[index].type;
                }

                return (
                  <div className="module" key={key}>
                    {type === "datasource" && (
                      <DatasourceModule
                        stepIndex={index}
                        step={steps && steps[index]}
                      />
                    )}

                    {type === "form" && (
                      <FormModule
                        stepIndex={index}
                        step={steps && steps[index]}
                      />
                    )}

                    {type === "computed" && (
                      <ComputedModule
                        setChanged={() => this.setChanged()}
                        stepIndex={index}
                        step={steps && steps[index]}
                      />
                    )}
                  </div>
                );
              })
            ) : (
              <div>
                <Icon
                  type="info-circle"
                  theme="twoTone"
                  style={{ marginRight: 5 }}
                />
                Add your first component by clicking the Datasource module in
                the Components toolbox above.
              </div>
            )}
          </div>

          <div style={{ maxWidth: 700, marginBottom: 20 }}>
            <h2>Details/Access</h2>

            <Form.Item
              {...formItemLayout}
              label={
                <span>
                  DataLab name
                  <Tooltip
                    title="The name provided will be used as the page title 
                when a user accesses the DataLab"
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
                initialValue: name,
                rules: [{ required: true, message: "Name is required" }]
              })(<Input onChange={() => this.setChanged()}/>)}
            </Form.Item>

            <Form.Item
              {...formItemLayout}
              label={
                <span>
                  Description
                  <Tooltip title="A description that users will see when accessing the DataLab">
                    <Icon
                      style={{ marginLeft: 5, cursor: "help" }}
                      type="question-circle"
                    />
                  </Tooltip>
                </span>
              }
            >
              {getFieldDecorator("description", {
                initialValue: description
              })(<Input.TextArea onChange={() => this.setChanged()}/>)}
            </Form.Item>

            <Form.Item
              {...formItemLayout}
              label={
                <span>
                  Group by
                  <Tooltip title="Group records by the chosen field when users access the DataLab">
                    <Icon
                      style={{ marginLeft: 5, cursor: "help" }}
                      type="question-circle"
                    />
                  </Tooltip>
                </span>
              }
            >
              {getFieldDecorator("groupBy", {
                initialValue: groupBy
              })(
                <Select allowClear onChange={() => this.setChanged()}>
                  {this.labelsUsed().map(label => (
                    <Select.Option value={label} key={label}>
                      {label}
                    </Select.Option>
                  ))}
                </Select>
              )}
            </Form.Item>

            <Form.Item {...formItemLayout} label="Allow access via user email">
              {getFieldDecorator("emailAccess", {
                initialValue: emailAccess || false,
                valuePropName: "checked"
              })(<Checkbox onChange={() => this.setChanged()}/>)}
            </Form.Item>

            <Form.Item {...formItemLayout} label="Allow access via LTI">
              {getFieldDecorator("ltiAccess", {
                initialValue: ltiAccess || false,
                valuePropName: "checked"
              })(<Checkbox onChange={() => this.setChanged()}/>)}
            </Form.Item>

            {(getFieldValue("emailAccess") || getFieldValue("ltiAccess")) && (
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
                    initialValue: permission
                  })(
                    <Select>
                      {this.labelsUsed().map(label => (
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
                    initialValue: restriction || "private"
                  })(
                    <Select>
                      <Select.Option value="private">
                        <Tooltip title="Users can only see the records for which they have explicit access">
                          Limited read
                        </Tooltip>
                      </Select.Option>
                      <Select.Option value="open">
                        <Tooltip title="Users that have access to at least one record can see all other records">
                          Open read
                        </Tooltip>
                      </Select.Option>
                    </Select>
                  )}
                </Form.Item>
              </div>
            )}
          </div>

          {error && (
            <Alert message={error} type="error" style={{ marginBottom: 10 }} />
          )}

          <Button type="primary" onClick={this.handleSave} loading={loading}>
            {selectedId ? "Save" : "Submit"}
          </Button>
        </div>
      </ModelContext.Provider>
    );
  }
}

export default Form.create()(Model);
