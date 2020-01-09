import React from "react";
import {
  Card,
  Icon,
  Select,
  Input,
  Tooltip,
  message,
  Form,
  Popover,
  notification
} from "antd";
import memoize from "memoize-one";
import _ from "lodash";

import ModelContext from "../ModelContext";

import DiscrepenciesModal from "./DiscrepenciesModal";

import apiRequest from "../../../shared/apiRequest";

const { Option, OptGroup } = Select;
const FormItem = Form.Item;

class DatasourceModule extends React.Component {
  static contextType = ModelContext;

  state = {
    editing: { isEditing: false },
    discrepencies: {
      visible: false,
      loading: false,
      matching: [],
      primary: []
    }
  };

  datasource = memoize(datasourceId => {
    const { datasources, dataLabs } = this.context;
    return (
      (datasources || []).find(datasource => datasource.id === datasourceId) ||
      (dataLabs || []).find(dataLab => dataLab.id === datasourceId)
    );
  });

  addAllFields = addedFields => {
    const { stepIndex } = this.props;
    const { form, labelsUsed } = this.context;
    const { getFieldValue, getFieldDecorator } = form;

    const datasourceId = getFieldValue(`steps[${stepIndex}].datasource.id`);
    const datasource = this.datasource(datasourceId);
    const primary = getFieldValue(`steps[${stepIndex}].datasource.primary`);

    const labels = labelsUsed();
    const fieldsToAdd = [];
    (
      datasource.fields || datasource.columns.map(field => field.details.label)
    ).forEach(field => {
      // Skip field if it's the primary key (after first module)
      if (stepIndex !== 0 && field === primary) return;

      // Field was already added to this datasource
      if (addedFields.includes(field)) return;

      // The field's label is already being used
      if (labels.includes(field)) {
        message.error(
          `'${field}' cannot be added automatically as this field 
          name is already being used in the DataLab.`
        );
        return;
      }

      // Register a form field for the field's label
      // Not a duplicate, therefore use the field name as-is
      getFieldDecorator(`steps[${stepIndex}].datasource.labels.${field}`, {
        initialValue: field
      });

      fieldsToAdd.push(field);
    });

    return [...addedFields, ...fieldsToAdd];
  };

  removeAllFields = () => {
    const { stepIndex } = this.props;
    const { form, hasDependency } = this.context;
    const { getFieldValue, setFieldsValue } = form;

    const fields = getFieldValue(`steps[${stepIndex}].datasource.fields`) || [];

    const fieldsToKeep = [];
    const labelsToRemove = {};
    fields.forEach(field => {
      const dependency = hasDependency(stepIndex, field);
      if (dependency) {
        fieldsToKeep.push(field);
        notification["error"]({
          message: `"${field}" cannot be removed`,
          description: dependency
        });
      } else {
        labelsToRemove[
          `steps[${stepIndex}].datasource.labels.${field}`
        ] = undefined;
      }
    });

    // Clear the labels of the fields that are being removed
    setFieldsValue(labelsToRemove);

    return fieldsToKeep;
  };

  onFieldsChange = e => {
    const { stepIndex } = this.props;
    const { form, labelsUsed, hasDependency } = this.context;
    const { editing } = this.state;
    const { setFieldsValue, getFieldValue, getFieldDecorator } = form;

    // Don't allow fields to be added whilst in editing mode
    if (editing.isEditing) return;

    const fields = getFieldValue(`steps[${stepIndex}].datasource.fields`) || [];

    // Add all fields utility was clicked
    if (e.slice(-1)[0] === "_all") return this.addAllFields(fields);

    // Remove all fields utility was clicked
    if (e.slice(-1)[0] === "_none") return this.removeAllFields();

    // A single field was added
    if (e.length > fields.length) {
      // Identify the field added
      const field = e.filter(field => !fields.includes(field))[0];

      // If this field name is a duplicate of an existing label in the build
      const labels = labelsUsed();
      if (labels.includes(field)) {
        // Generate a label for this field
        // Show the edit input field for the label
        this.onEdit({
          field,
          label: this.generateLabel(field),
          isRequired: true
        });
        // Return the original fields (i.e. prevent adding this field)
        return fields;
      } else {
        // Register a form field for the field's label
        // Not a duplicate, therefore use the field name as-is
        getFieldDecorator(`steps[${stepIndex}].datasource.labels.${field}`, {
          initialValue: field
        });

        // Add the field
        return e;
      }
      // A single field was removed
    } else if (e.length < fields.length) {
      // Identify the field removed
      const field = fields.filter(field => !e.includes(field))[0];

      const dependency = hasDependency(stepIndex, field);
      if (dependency) {
        notification["error"]({
          message: `"${field}" cannot be removed`,
          description: dependency
        });
        // Return the original fields (i.e. prevent removing this field)
        return fields;
      } else {
        // Remove the label for this field
        setFieldsValue({
          [`steps[${stepIndex}].datasource.labels.${field}`]: undefined
        });

        // Remove the field
        return e;
      }
    }
  };

  generateLabel = field => {
    const { labelsUsed } = this.context;
    const labels = labelsUsed();

    let suffix = 1;
    while (labels.includes(`${field}_${suffix}`)) {
      suffix += 1;
    }
    return `${field}_${suffix}`;
  };

  onEdit = ({ e, field, label, isRequired }) => {
    const { stepIndex } = this.props;
    const { form, hasDependency } = this.context;
    const { getFieldValue, setFieldsValue } = form;

    if (e) e.stopPropagation();

    const fields = getFieldValue(`steps[${stepIndex}].datasource.fields`) || [];

    if (fields.includes(field)) {
      const dependency = hasDependency(stepIndex, field);
      if (dependency) {
        notification["error"]({
          message: `"${field}" cannot be renamed`,
          description: dependency
        });
        return;
      }
    }

    this.setState({
      editing: { isEditing: true, field, label, isRequired }
    });

    // Remove the field being edited from the list of fields added to the module
    const fieldIndex = fields.indexOf(field);
    if (fieldIndex >= 0) fields.splice(fieldIndex, 1);
    setFieldsValue({
      [`steps[${stepIndex}].datasource.fields`]: fields,
      [`steps[${stepIndex}].datasource.labels.${field}`]: undefined
    });

    // Add an event listener to detect when focus is lost
    // So that the isEditing can be set to false
    document.addEventListener("click", this.handleOutsideClick, false);
  };

  handleOutsideClick = e => {
    // If the click was not outside, then do nothing
    if (this.dropdown.contains(e.target)) return;

    document.removeEventListener("click", this.handleOutsideClick, false);
    this.setState({ editing: { isEditing: false } });
    this.select.focus();
    this.select.blur();
  };

  onFocusEdit = e => {
    // On focus, move the cursor to the end of the input
    const temp_value = e.target.value;
    e.target.value = "";
    e.target.value = temp_value;
  };

  cancelEdit = () => {
    document.removeEventListener("click", this.handleOutsideClick, false);

    // Set editing mode to false
    // After setState completes, perform a callback which focuses the select
    this.setState({ editing: { isEditing: false } }, () => {
      this.select.focus();
    });
  };

  confirmEdit = () => {
    const { stepIndex } = this.props;
    const { form, labelsUsed } = this.context;
    const { editing } = this.state;
    const { getFieldValue, setFieldsValue, getFieldDecorator } = form;

    if (!editing.label) {
      message.error("Label cannot be empty.");
      return;
    }

    const labels = labelsUsed();
    if (labels.includes(editing.label)) {
      message.error("This label is already being used.");
      return;
    }

    // Add the field and register a form field for its label
    const fields = getFieldValue(`steps[${stepIndex}].datasource.fields`) || [];
    const field = editing.field;
    getFieldDecorator(`steps[${stepIndex}].datasource.labels.${field}`, {
      initialValue: editing.label
    });
    setFieldsValue({
      [`steps[${stepIndex}].datasource.fields`]: [...fields, field]
    });

    // Turn off editing mode
    this.cancelEdit();
  };

  checkForDiscrepencies = ({ matchingField, isExport }) => {
    const { stepIndex } = this.props;
    const { form, selectedId } = this.context;
    const { discrepencies } = this.state;
    const { getFieldValue } = form;

    const partial = getFieldValue("steps").slice(0, stepIndex + 1);

    if (matchingField)
      partial[partial.length - 1].datasource.matching = matchingField;

    const key = isExport ? "exporting" : "loading";
    this.setState({ discrepencies: { ...discrepencies, [key]: true } });

    apiRequest(`/datalab/check_discrepencies/`, {
      method: "POST",
      payload: { partial, dataLabId: selectedId, isExport },
      onSuccess: result => {
        if (isExport) {
          this.setState({
            discrepencies: { ...discrepencies, [key]: false }
          });
          return;
        }

        if (
          (result.matching || []).length > 0 ||
          (result.primary || []).length > 0
        ) {
          this.setState({
            discrepencies: {
              visible: true,
              [key]: false,
              ...result
            }
          });
        } else {
          this.setState({
            discrepencies: { [key]: false }
          });
          notification["success"]({
            message: "No discrepencies found",
            description:
              "No discrepencies were detected between this component and the DataLab"
          });
        }
      },
      onError: error => {
        this.setState({
          discrepencies: { [key]: false }
        });
        notification["error"]({
          message: "Failed to check discrepencies",
          description: error
        });
      }
    });
  };

  onChangeDatasource = e => {
    const { stepIndex } = this.props;
    const { form, hasDependency, updateStep } = this.context;
    const { getFieldValue, resetFields } = form;

    const datasource = getFieldValue(`steps[${stepIndex}].datasource`);
    const fields = [
      ...(datasource.primary ? [datasource.primary] : []),
      ...(datasource.fields || [])
    ];

    for (let field of fields) {
      const dependency = hasDependency(stepIndex, field);
      if (dependency) {
        notification["error"]({
          message: `Datasource cannot be changed because of its field "${field}"`,
          description: `${dependency}`
        });

        const currentDatasource = getFieldValue(
          `steps[${stepIndex}].datasource.id`
        );
        return currentDatasource;
      }
    }

    updateStep(stepIndex, { type: "datasource", datasource: {} });
    resetFields(`steps[${stepIndex}].datasource`);
    return e;
  };

  render() {
    const { stepIndex, step } = this.props;
    const {
      datasources,
      dataLabs,
      form,
      labelsUsed,
      stepKeys,
      deleteModule
    } = this.context;
    const { getFieldDecorator, getFieldValue, setFieldsValue } = form;
    const { editing, discrepencies } = this.state;

    getFieldDecorator(`steps[${stepIndex}].type`, {
      initialValue: "datasource"
    });

    const datasourceId =
      getFieldValue(`steps[${stepIndex}].datasource.id`) ||
      _.get(step, "datasource.id");
    const datasource = this.datasource(datasourceId);

    const matchingFields = labelsUsed(stepIndex);

    const fieldsAdded =
      getFieldValue(`steps[${stepIndex}].datasource.fields`) ||
      _.get(step, "datasource.fields") ||
      [];
    // Instantiate a form item for each field label
    // If the field is removed, then the label form field would not be
    // generated in the DOM, and so the label would also be removed from
    // the form (which is what we want)
    fieldsAdded.forEach(field => {
      getFieldDecorator(`steps[${stepIndex}].datasource.labels.${field}`, {
        initialValue:
          getFieldValue(`steps[${stepIndex}].datasource.labels.${field}`) ||
          _.get(step, `datasource.labels[${field}]`)
      });
    });

    // Initialize the array that will hold the datasource's actions
    let actions = [];
    if (
      (stepIndex > 0 &&
        getFieldValue(`steps[${stepIndex}].datasource.matching`)) ||
      _.get(step, "datasource.matching", false)
    )
      actions.push(
        <Tooltip title="Check discrepencies">
          <Icon
            type={discrepencies.loading ? "loading" : "disconnect"}
            onClick={this.checkForDiscrepencies}
          />
        </Tooltip>
      );

    // If this is the last step, show the delete button
    if ((stepKeys || []).length === stepIndex + 1)
      actions.push(
        <Tooltip title="Remove datasource">
          <Icon type="delete" onClick={deleteModule} />
        </Tooltip>
      );

    return (
      <Card
        className="datasource"
        actions={actions}
        title={
          <div className="title">
            <div className="step_number">{stepIndex + 1}</div>

            <Icon type="database" className="title_icon" />

            <FormItem className="no-explain">
              {getFieldDecorator(`steps[${stepIndex}].datasource.id`, {
                rules: [{ required: true }],
                getValueFromEvent: this.onChangeDatasource,
                initialValue: _.get(step, "datasource.id")
              })(
                <Select placeholder="Choose datasource">
                  {dataLabs && dataLabs.length > 0
                    ? [
                        <Select.OptGroup label="Datasources" key="datasources">
                          {(datasources || []).map(datasource => (
                            <Option value={datasource.id} key={datasource.id}>
                              {datasource.name}
                            </Option>
                          ))}
                        </Select.OptGroup>,
                        <Select.OptGroup label="DataLabs" key="datalabs">
                          {(dataLabs || []).map(dataLab => (
                            <Option value={dataLab.id} key={dataLab.id}>
                              {dataLab.name}
                            </Option>
                          ))}
                        </Select.OptGroup>
                      ]
                    : (datasources || []).map(datasource => (
                        <Option value={datasource.id} key={datasource.id}>
                          {datasource.name}
                        </Option>
                      ))}
                </Select>
              )}
            </FormItem>
          </div>
        }
      >
        <FormItem className="no-explain">
          <Tooltip
            title={
              !datasource
                ? "A datasource must be chosen first"
                : "The field from this datasource which uniquely identifies each of the records"
            }
            placement="right"
          >
            {getFieldDecorator(`steps[${stepIndex}].datasource.primary`, {
              rules: [{ required: true }],
              initialValue: _.get(step, "datasource.primary")
            })(
              <Select
                placeholder="Primary key"
                disabled={!datasource}
                onChange={e => {
                  if (stepIndex) return; 

                  const fieldsChosen = getFieldValue(
                    `steps[${stepIndex}].datasource.fields`
                  ) || [];

                  if (!fieldsChosen.includes(e))
                    setFieldsValue({
                      [`steps[${stepIndex}].datasource.fields`]: [
                        ...fieldsChosen,
                        e
                      ]
                    });
                }}
              >
                {datasource &&
                  (
                    datasource.fields ||
                    datasource.columns.map(field => field.details.label)
                  ).map(field => (
                    <Option
                      value={field}
                      key={`${datasource.id}_${field}_primary`}
                    >
                      {field}
                    </Option>
                  ))}
              </Select>
            )}
          </Tooltip>
        </FormItem>

        {stepIndex > 0 && (
          <FormItem className="no-explain">
            <Tooltip
              title={
                !datasource
                  ? "A datasource must be chosen first"
                  : !getFieldValue(`steps[${stepIndex}].datasource.primary`)
                  ? "A primary key must be chosen first"
                  : `In order to join the data from this datasource with the DataLab, 
                      you must specify which field from the DataLab will be matched against 
                      the primary key (specified above)`
              }
              placement="right"
            >
              {getFieldDecorator(`steps[${stepIndex}].datasource.matching`, {
                rules: [{ required: true }],
                initialValue: _.get(step, "datasource.matching")
              })(
                <Select
                  placeholder="Matching field"
                  onChange={matchingField =>
                    this.checkForDiscrepencies({ matchingField })
                  }
                  disabled={
                    !datasource ||
                    !getFieldValue(`steps[${stepIndex}].datasource.primary`)
                  }
                >
                  {matchingFields &&
                    matchingFields.map(label => (
                      <Option value={label} key={label}>
                        {label}
                      </Option>
                    ))}
                </Select>
              )}
            </Tooltip>
          </FormItem>
        )}

        <div
          id={`dropdown_${stepIndex}`}
          ref={dropdown => (this.dropdown = dropdown)}
        />

        <FormItem className="no-explain">
          <Tooltip
            title={
              !datasource
                ? "A datasource must be chosen first"
                : "The fields from this datasource that should be added to the DataLab"
            }
            placement="right"
          >
            {getFieldDecorator(`steps[${stepIndex}].datasource.fields`, {
              rules: [{ required: true }],
              getValueFromEvent: this.onFieldsChange,
              initialValue: _.get(step, "datasource.fields")
            })(
              <Select
                mode="multiple"
                className="select"
                dropdownClassName="select_dropdown"
                placeholder="Fields"
                disabled={editing.isEditing || !datasource}
                maxTagCount={10}
                maxTagPlaceholder={`...${fieldsAdded.length -
                  10} more fields selected`}
                getPopupContainer={() =>
                  document.getElementById(`dropdown_${stepIndex}`)
                }
                ref={select => {
                  this.select = select;
                }}
              >
                <OptGroup label="Utilities">
                  <Option key="_all">Select all</Option>
                  <Option key="_none">Reset</Option>
                </OptGroup>

                <OptGroup label="Datasource fields">
                  {datasource &&
                    (
                      datasource.fields ||
                      datasource.columns.map(field => field.details.label)
                    ).map(field => {
                      const isEditing = editing.field === field;
                      const label =
                        getFieldValue(
                          `steps[${stepIndex}].datasource.labels.${field}`
                        ) || field;

                      const truncatedLabel =
                        label.length > 20 ? `${label.slice(0, 20)}...` : label;

                      return (
                        <Option
                          disabled={
                            editing.isEditing ||
                            !stepIndex && field ===
                              getFieldValue(
                                `steps[${stepIndex}].datasource.primary`
                              )
                          }
                          value={field}
                          key={`${datasource.id}_${field}_field`}
                          className={isEditing ? "editing_field" : ""}
                        >
                          {isEditing ? (
                            <div className="editing_input">
                              <Tooltip
                                title={
                                  editing.isRequired &&
                                  `A label is required, as a field with name '${field}' 
                                already exists in the DataLab`
                                }
                                placement="bottom"
                              >
                                <Input
                                  ref={input => input && input.focus()}
                                  size="small"
                                  value={editing.label}
                                  onFocus={this.onFocusEdit}
                                  onChange={e => {
                                    this.setState({
                                      editing: {
                                        ...editing,
                                        label: e.target.value
                                      }
                                    });
                                  }}
                                  onKeyDown={e => {
                                    e.stopPropagation();
                                    if (e.key === "Escape") this.cancelEdit();
                                    if (e.key === "Enter") this.confirmEdit();
                                  }}
                                />
                              </Tooltip>
                              <div>
                                <Icon type="close" onClick={this.cancelEdit} />
                                <Icon type="save" onClick={this.confirmEdit} />
                              </div>
                            </div>
                          ) : (
                            <div className="normal_field">
                              {truncatedLabel !== label ? (
                                <Popover
                                  content={label}
                                  overlayStyle={{ zIndex: 2000 }}
                                >
                                  {truncatedLabel}
                                </Popover>
                              ) : (
                                label
                              )}
                              {!editing.isEditing && (
                                <Icon
                                  type="edit"
                                  onClick={e =>
                                    this.onEdit({ e, field, label })
                                  }
                                />
                              )}
                            </div>
                          )}
                        </Option>
                      );
                    })}
                </OptGroup>
              </Select>
            )}
          </Tooltip>
        </FormItem>

        {datasource && (
          <DiscrepenciesModal
            {...discrepencies}
            stepIndex={stepIndex}
            step={step}
            datasource={datasource.name}
            closeModal={() =>
              this.setState({
                discrepencies: {
                  visible: false,
                  loading: false,
                  primary: [],
                  matching: []
                }
              })
            }
            exportToCSV={() => this.checkForDiscrepencies({ isExport: true })}
          />
        )}
      </Card>
    );
  }
}

export default DatasourceModule;
