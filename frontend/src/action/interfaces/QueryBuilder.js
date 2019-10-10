import React from "react";
import {
  Form,
  Select,
  Icon,
  Input,
  InputNumber,
  Button,
  Tooltip,
  DatePicker,
  Modal,
  Alert
} from "antd";
import _ from "lodash";
import moment from "moment";
import { Parser } from "expr-eval";

import "./QueryBuilder.css";

const { OptGroup, Option } = Select;
const FormItem = Form.Item;

const modMap = {
  datasource: ["#2196F3", "database"],
  form: ["#5E35B1", "form"],
  computed: ["#43A047", "calculator"]
};

const labelMap = {
  ">=": "≥",
  "<=": "≤",
  "==": "="
};

const defaultState = {
  overlappingConditions: [],
  hasMissingValues: false,
  selectedClone: null,
  loading: false,
  deleting: false,
  error: null
};

const formItemLayout = {
  labelCol: { span: 6 },
  wrapperCol: { span: 18 },
  style: { marginBottom: 6 }
};

const OptionTitle = (type, label) => (
  <span style={{ color: modMap[type][0] }}>
    <Icon type={modMap[type][1]} style={{ marginRight: 5 }} />
    {type === "computed" ? "Computed fields" : label}
  </span>
);

class QueryBuilder extends React.Component {
  state = defaultState;

  componentDidMount() {
    const options = this.generateOptions();
    this.setState({ options });
  }

  componentDidUpdate(prevProps) {
    const { form, selected } = this.props;
    const { hasMissingValues } = this.state;

    const { setFieldsValue, getFieldValue, getFieldError } = form;

    const conditionKeys = getFieldValue("conditionKeys");

    // Ensure that there is at least one condition in the rule
    if (conditionKeys && conditionKeys.length < 1)
      setFieldsValue({
        conditionKeys: [_.uniqueId()]
      });

    // If the missing values error message is visible, then
    // check whether it is still needed after form values change
    if (hasMissingValues) {
      const conditionErrors = getFieldError("rule.conditions");
      let stillMissingValues = false;

      conditionErrors.forEach(condition => {
        condition.formulas.forEach(formula => {
          if (Object.values(formula).some(error => !!error))
            stillMissingValues = true;
        });
      });

      if (!stillMissingValues) this.setState({ hasMissingValues: false });
    }

    // If filter or rule is being edited, manually set these some values here so
    // that the DOM elements which depend on these form items are rendered (e.g.
    // conditions depend on conditionKeys, and eachparameter gives an additional
    // attribute to each condition).
    if (!prevProps.selected && selected) {
      setFieldsValue({
        "rule.parameters": selected.parameters,
        conditionKeys: selected.conditions.map(() => _.uniqueId())
      });
      // Create a clone of the selected object, which will be used to provide default
      // form values. When parameters are added/removed, the clone is likewise modified.
      // This progressively modified clone is used to provide default form values, so that
      // updating a query (i.e. a selected is provided) does not cause unexpected behaviour.
      //
      // Example of such behaviour: Parameter at index i is deleted, therefore the conditions
      // are updated (index i removed from list, DOM elements removed and therefore fields
      // removed from form). A parameter is added, DOM elements for new condition index added,
      // and the fields are added to the form with initialValue set by values from the
      // *selected*. The user would actually expect these values to be null.
      this.setState({ selectedClone: selected });
    }
  }

  generateOptions = () => {
    const { modules } = this.props;

    const options = [];
    modules.forEach((module, i) => {
      options.push(
        <OptGroup label={OptionTitle(module.type, module.name)} key={i}>
          {module.fields.map(field => (
            <Option key={field}>{field}</Option>
          ))}
        </OptGroup>
      );
    });

    return options;
  };

  Operations = type => {
    let operations = [];
    if (type === "number" || type === "date")
      operations = [">", ">=", "<", "<=", "==", "!=", "between"];
    else if (type === "text")
      operations = ["==", "!=", "IS_NULL", "IS_NOT_NULL"];
    else if (type === "list") operations = ["contains"];
    else if (type === "checkbox") operations = ["IS_TRUE", "IS_FALSE"];

    return operations.map((operation, i) => (
      <Option value={operation} key={i}>
        {operation in labelMap ? labelMap[operation] : operation}
      </Option>
    ));
  };

  Element = (type, field) => {
    const { form } = this.props;
    const { getFieldValue } = form;

    const value = getFieldValue(field) || "";

    // Create a temporary DOM element to calculate the width of the input value
    const widthCalc = document.createElement("span");
    widthCalc.innerHTML = value;
    document.body.appendChild(widthCalc);
    const width = widthCalc.getBoundingClientRect().width + 24; // Includes padding
    widthCalc.remove();

    if (type === "number")
      return (
        <InputNumber
          key={field}
          className="field-input"
          style={{ width: width + 18 }} // Include extra space for the up/down arrows
        />
      );
    else if (type === "text" || type === "list")
      return <Input key={field} className="field-input" style={{ width }} />;
    else if (type === "date")
      return (
        <DatePicker
          key={field}
          className="field-input"
          placeholder=""
          // Make the time negligible, as we only care about the date
          // This is important when converting to unix epoch for testing date field overlaps
          showTime={{ defaultValue: moment("00:00:00", "HH:mm:ss") }}
        />
      );
  };

  Comparator = (type, conditionIndex, parameterIndex) => {
    const { form } = this.props;
    const { selectedClone } = this.state;

    const { getFieldValue, getFieldDecorator } = form;

    const fieldBase = `conditions[${conditionIndex}].formulas[${parameterIndex}].`;

    const operation = getFieldValue(`rule.${fieldBase}operator`);

    const initialValue = field => {
      let value = _.get(selectedClone, field);
      if (type === "date" && value) value = moment(value);
      return value;
    };

    if (operation === "between")
      return [
        <FormItem key={`rule.${fieldBase}rangeFrom`}>
          {getFieldDecorator(`rule.${fieldBase}rangeFrom`, {
            rules: [
              {
                required: true
              }
            ],
            initialValue: initialValue(`${fieldBase}rangeFrom`)
          })(this.Element(type, `rule.${fieldBase}rangeFrom`))}
        </FormItem>,
        <span className="and" key={`${fieldBase}and`}>
          and
        </span>,
        <FormItem key={`rule.${fieldBase}rangeTo`}>
          {getFieldDecorator(`rule.${fieldBase}rangeTo`, {
            rules: [
              {
                required: true
              }
            ],
            initialValue: initialValue(`${fieldBase}rangeTo`)
          })(this.Element(type, `rule.${fieldBase}rangeTo`))}
        </FormItem>
      ];

    return (
      <FormItem>
        {!["IS_NULL", "IS_NOT_NULL"].includes(operation) &&
          type !== "checkbox" &&
          getFieldDecorator(`rule.${fieldBase}comparator`, {
            rules: [
              {
                required: true
              }
            ],
            initialValue: initialValue(`${fieldBase}comparator`)
          })(this.Element(type, `rule.${fieldBase}comparator`))}
      </FormItem>
    );
  };

  addCondition = () => {
    const { form } = this.props;
    const { getFieldValue, setFieldsValue } = form;

    const conditionKeys = getFieldValue("conditionKeys");

    setFieldsValue({
      conditionKeys: [...conditionKeys, _.uniqueId()]
    });
  };

  deleteCondition = conditionIndex => {
    const { form } = this.props;
    const { selectedClone } = this.state;

    const { getFieldValue } = form;

    const conditionKeys = getFieldValue("conditionKeys");
    const conditions = getFieldValue("rule.conditions");

    conditionKeys.splice(conditionIndex, 1);
    if (conditions) conditions.splice(conditionIndex, 1);

    form.setFieldsValue({
      conditionKeys,
      "rule.conditions": conditions
    });
    this.setState({ selectedClone: { ...selectedClone, conditions } });
  };

  modifyParameters = parameters => {
    const { form } = this.props;
    const { selectedClone } = this.state;

    const { getFieldValue } = form;

    const oldParameters = getFieldValue("rule.parameters");

    // Detect whether any parameters have been *removed*
    const deletedParameters = oldParameters
      ? oldParameters.filter(oldParameter => !parameters.includes(oldParameter))
      : [];

    // If a parameter was removed, then update each of the conditions
    // to remove that parameter from the condition formula
    if (deletedParameters.length > 0) {
      const conditions = getFieldValue("rule.conditions");

      deletedParameters.forEach(deletedParameter => {
        const deletedParameterIndex = oldParameters.indexOf(deletedParameter);
        conditions.forEach(condition => {
          condition.formulas.splice(deletedParameterIndex, 1);
        });
      });

      // Update the conditions in the form
      this.setState({ selectedClone: { ...selectedClone, conditions } }, () =>
        // Update the form values as a second stage, so that the DOM is first
        // re-rendered due to the selectedClone changes
        form.setFieldsValue({ "rule.conditions": conditions })
      );
    }
  };

  hasOverlap = (formulas, type) => {
    // If either formula has any incomplete details, then cancel the overlap check
    let isIncomplete = false;
    formulas.forEach(formula => {
      if (
        Object.values(formula).some(
          value => value === undefined || value === null
        )
      ) {
        isIncomplete = true;
      }
    });
    if (isIncomplete) return false;

    if (type === "text") {
      // Define the logical tests which would indicate an overlap
      const tests = [
        (formula1, formula2) =>
          formula1.operator === "==" &&
          formula2.operator === "==" &&
          formula1.comparator === formula2.comparator,
        (formula1, formula2) =>
          formula1.operator === "!=" && formula2.operator === "!=",
        (formula1, formula2) =>
          // If one of the formula's operator is ==
          [formula1.operator, formula2.operator].some(
            operator => operator === "=="
          ) &&
          // And the other formula's operator is !=
          [formula1.operator, formula2.operator].some(
            operator => operator === "!="
          ) &&
          // And the two formulas have a different comparator
          formula1.comparator !== formula2.comparator,
        (formula1, formula2) =>
          [formula1.operator, formula2.operator].some(
            operator => operator === "IS_NOT_NULL"
          ) &&
          [formula1.operator, formula2.operator].some(operator =>
            ["!=", "=="].includes(operator)
          ),
        (formula1, formula2) =>
          [formula1.operator, formula2.operator].every(
            operator => operator === "IS_NOT_NULL"
          ) ||
          [formula1.operator, formula2.operator].every(
            operator => operator === "IS_NULL"
          )
      ];

      // If *any* of the logical tests above returns true, then there is an overlap
      if (tests.some(test => test(formulas[0], formulas[1]))) return true;
    }

    if (type === "list") {
      // The only operator for lists is "contains", so the below test is sufficient
      if (formulas[0].comparator === formulas[1].comparator) return true;
    }

    if (type === "checkbox") {
      if (formulas[0].operator === formulas[1].operator) return true;
    }

    if (type === "number" || type === "date") {
      const expressionGroups = []; // Two expression "groups", one for each condition
      const values = new Set(); // Values to logically test the expressions

      formulas.forEach(formula => {
        if (formula.operator === "between") {
          if (type === "date") {
            // Convert moment datetimes to unix epoch
            formula.rangeFrom = formula.rangeFrom.unix();
            formula.rangeTo = formula.rangeTo.unix();
          }
          // Push an array of two expressions, one for each of "from" and "to"
          expressionGroups.push([
            `x >= ${formula.rangeFrom}`,
            `x <= ${formula.rangeTo}`
          ]);
          [-1, 0, 1].forEach(i => {
            values.add(formula.rangeFrom + i);
            values.add(formula.rangeTo + i);
          });
        } else {
          if (type === "date") {
            formula.comparator = formula.comparator.unix();
          }
          // Push an array of one expression
          expressionGroups.push([
            `x ${formula.operator} ${formula.comparator}`
          ]);
          [-1, 0, 1].forEach(i => values.add(formula.comparator + i));
        }
      });

      // If for *any* of the values...
      return [...values].some(value => {
        // the logical tests of the expressions for *both* conditions returns true, given that...
        return expressionGroups.every(expressions =>
          // the logical tests of every expression for that condition returns true...
          expressions.every(expression => {
            const parser = Parser.parse(expression);
            return parser.evaluate({ x: value });
          })
        );
      });
      // then an overlap must exist between the two conditions being compared, for the
      // parameter being tested.
    }

    // If none of the above tests returned true, then there must not be an overlap
    return false;
  };

  testOverlaps = () => {
    const { form, types } = this.props;

    const { rule } = form.getFieldsValue();
    const { parameters, conditions } = rule;

    // Instantiate a single bucket containing all the conditions
    let buckets = [conditions]; // i.e. [[cond1, cond2, cond3]]

    // Iterate over the parameters
    //
    // On the first passthrough (i.e. the first parameter), assign each
    // condition to a given bucket if there is an overlap in the formula
    // for that particular parameter. E.g. first parameter is "grade",
    // one condition has grade >= 50 and the other condition has grade <= 60.
    // These conditions would overlap if 50 <= grade <= 60.
    //
    // For each next parameter, perform comparisons between the conditions as
    // above, but only with those conditions in the same bucket, and assign
    // them to the same bucket if there is an overlap. Otherwise, a new bucket
    // is created.
    //
    // The buckets should thin out with each passthrough. If there are no overlaps
    // between the conditions after iterating through all parameters, then all buckets
    // should have a length of 1.
    //
    // The final result is a list of buckets where the first condition (index 0)
    // definitely overlaps (taking all parameters into consideration) with every
    // other condition in that bucket
    parameters.forEach((parameter, parameterIndex) => {
      const newBuckets = [];

      buckets.forEach(bucket => {
        const conditionsChecked = [];

        bucket.forEach((condition, conditionIndex) => {
          // If this condition has already been assigned to a bucket due to
          // overlapping, then do not create a new bucket
          if (conditionsChecked.includes(condition)) return;

          // Instantiate a new bucket containing just this condition
          const newBucket = [condition];

          // Compare this condition to each following condition *in the same bucket*
          bucket.slice(conditionIndex + 1).forEach(comparison => {
            // Check whether the condition overlaps
            const hasOverlap = this.hasOverlap(
              [
                condition.formulas[parameterIndex],
                comparison.formulas[parameterIndex]
              ],
              types[parameter]
            );

            // If the condition being compared does overlap, add it to the new bucket.
            // Otherwise, the condition will be assigned to its own bucket, and the process
            // will repeat until all conditions are exhausted for this passthrough
            if (hasOverlap) {
              newBucket.push(comparison);
              conditionsChecked.push(comparison);
            }
          });

          newBuckets.push(newBucket);
        });
      });

      // Overwrite with the new buckets so that the next iteration only compares
      // conditions that overlap as of the n-th parameter passthrough
      buckets = newBuckets;
    });

    // Find the first instance of a bucket with conditions that overlap (if any)
    const overlappingConditions = buckets.find(bucket => bucket.length > 1);

    if (overlappingConditions) {
      return overlappingConditions.map(condition =>
        conditions.indexOf(condition)
      );
    }
  };

  handleOk = () => {
    const { selected, type, form, onSubmit } = this.props;

    this.setState({ error: null });

    form.validateFields((err, values) => {
      if (err) {
        if ("conditions" in err.rule) this.setState({ hasMissingValues: true });
        return;
      }

      const overlappingConditions = this.testOverlaps();
      this.setState({ overlappingConditions, hasMissingValues: false });

      if (overlappingConditions) return;

      this.setState({ loading: true });

      onSubmit({
        [type]: values.rule,
        method: selected ? "PUT" : "POST",
        onSuccess: this.handleClose,
        onError: error => this.setState({ error })
      });
    });
  };

  handleDelete = () => {
    const { selected: rule, onSubmit } = this.props;

    this.setState({ error: null, deleting: true });

    onSubmit({
      rule,
      method: "DELETE",
      onSuccess: this.handleClose,
      onError: error => this.setState({ error })
    });
  };

  handleClose = () => {
    const { form, onClose } = this.props;

    form.resetFields();
    this.setState(defaultState);
    onClose();
  };

  render() {
    const { form, type, visible, types } = this.props;
    const {
      options,
      overlappingConditions,
      hasMissingValues,
      loading,
      error,
      selectedClone
    } = this.state;
    const { getFieldDecorator, getFieldValue } = form;

    getFieldDecorator("conditionKeys", { initialValue: [] });
    const conditionKeys = getFieldValue("conditionKeys");
    const parameters = getFieldValue("rule.parameters");

    if (selectedClone) {
      getFieldDecorator("rule.ruleId", {
        initialValue: _.get(selectedClone, "ruleId")
      });

      getFieldDecorator("rule.catchAll", {
        initialValue: _.get(selectedClone, "catchAll")
      });
    }

    return (
      <Modal
        title={`${selectedClone ? "Update" : "Create"} ${type}`}
        visible={visible}
        width={650}
        onCancel={this.handleClose}
        footer={[
          <Button key="back" onClick={this.handleClose}>
            Cancel
          </Button>,
          selectedClone && (
            <Button key="delete" onClick={this.handleDelete} type="danger">
              Delete
            </Button>
          ),
          <Button
            key="submit"
            type="primary"
            loading={loading}
            onClick={this.handleOk}
          >
            {selectedClone ? "Update" : "Create"}
          </Button>
        ]}
      >
        <Form layout="horizontal" className="querybuilder">
          {type === "rule" && (
            <FormItem label="Rule name" {...formItemLayout}>
              {getFieldDecorator("rule.name", {
                rules: [
                  {
                    required: true,
                    message: "Rule name is required"
                  }
                ],
                initialValue: selectedClone && selectedClone.name
              })(<Input />)}
            </FormItem>
          )}

          <FormItem label="Parameters" {...formItemLayout}>
            {getFieldDecorator("rule.parameters", {
              // initialValue for parameters is set via componentDidUpdate
              rules: [
                {
                  required: true,
                  message: "At least one parameter is required"
                }
              ]
            })(
              <Select
                showSearch
                mode="multiple"
                onChange={this.modifyParameters}
              >
                {options}
              </Select>
            )}
          </FormItem>

          {parameters && parameters.length > 0 && (
            <div>
              {type === "rule" && (
                <FormItem label="Conditions" {...formItemLayout}>
                  <Tooltip title="Add condition">
                    <Button
                      icon="plus"
                      size="small"
                      type="primary"
                      onClick={this.addCondition}
                    />
                  </Tooltip>
                </FormItem>
              )}

              <ul className="conditions">
                {conditionKeys.map((key, conditionIndex) => (
                  <li
                    key={key}
                    className={
                      overlappingConditions &&
                      overlappingConditions.includes(conditionIndex)
                        ? "overlap"
                        : ""
                    }
                  >
                    {conditionKeys.length > 1 && (
                      <div className="delete">
                        <Tooltip title="Delete condition">
                          <Button
                            icon="close"
                            shape="circle"
                            size="small"
                            disabled={conditionKeys.length <= 1}
                            onClick={() => this.deleteCondition(conditionIndex)}
                          />
                        </Tooltip>
                      </div>
                    )}

                    <div className="parameters">
                      {parameters.map((parameter, parameterIndex) => {
                        if (selectedClone)
                          getFieldDecorator(
                            `rule.conditions[${conditionIndex}].conditionId`,
                            {
                              initialValue: _.get(
                                selectedClone,
                                `conditions[${conditionIndex}].conditionId`
                              )
                            }
                          );

                        return (
                          <div className="field" key={`${key}_${parameter}`}>
                            <div className="name">{parameter}</div>

                            <div className="operation">
                              <FormItem>
                                {getFieldDecorator(
                                  `rule.conditions[${conditionIndex}].formulas[${parameterIndex}].operator`,
                                  {
                                    rules: [
                                      {
                                        required: true
                                      }
                                    ],
                                    initialValue: _.get(
                                      selectedClone,
                                      `conditions[${conditionIndex}].formulas[${parameterIndex}].operator`
                                    )
                                  }
                                )(
                                  <Select
                                    showArrow={false}
                                    dropdownMatchSelectWidth={false}
                                  >
                                    {this.Operations(types[parameter])}
                                  </Select>
                                )}
                              </FormItem>
                            </div>

                            <div className="comparator">
                              {this.Comparator(
                                types[parameter],
                                conditionIndex,
                                parameterIndex
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {overlappingConditions && overlappingConditions.length > 0 && (
            <Alert
              message="Condition overlap detected"
              description="For the conditions marked in red, a record could
              match multiple conditions at the same time. Adjust the settings to ensure
              mutual exclusivity before continuing."
              type="error"
              showIcon
            />
          )}

          {hasMissingValues && (
            <Alert
              message="Missing condition values"
              description="The values marked in red must be filled in order for the condition to be valid."
              type="error"
              showIcon
            />
          )}

          {error && <Alert message={error} type="error" showIcon />}
        </Form>
      </Modal>
    );
  }
}

export default Form.create()(QueryBuilder);
