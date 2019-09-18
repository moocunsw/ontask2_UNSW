import React from "react";
import {
  Input,
  InputNumber,
  DatePicker,
  Checkbox,
  Select,
  Radio,
  Icon
} from "antd";
import moment from "moment";
import { range } from "lodash";

import "./Field.css";

const Option = Select.Option;
const RadioGroup = Radio.Group;
const CheckboxGroup = Checkbox.Group;

class Field extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      value: props.value
    };
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.value !== this.props.value ||
      prevProps.primaryKey !== this.props.primaryKey
    )
      this.setState({ value: this.props.value });
  }

  handleChange = (value, shouldSave) => {
    this.setState({ value }, () => {
      if (shouldSave) this.handleSave(value);
    });
  };

  handleSave = () => {
    const { onSave } = this.props;
    const { value } = this.state;

    if (!onSave) return;

    // Compare contents of the values rather than the referential equality
    // For example, comparing arrays such as [1, 2, 3] === [1, 2, 3] could
    // produce False if the array has different pointers
    if (JSON.stringify(this.props.value) !== JSON.stringify(value)) {
      onSave(value);
    }
  };

  TextField = () => {
    const { field } = this.props;
    const { value } = this.state;

    if (field.textArea) {
      return (
        <Input.TextArea
          value={value}
          maxLength={field.maxLength}
          rows="5"
          onChange={e => this.handleChange(e.target.value)}
          onBlur={this.handleSave}
        />
      );
    } else {
      return (
        <Input
          value={value}
          maxLength={field.maxLength}
          onChange={e => this.handleChange(e.target.value)}
          onBlur={this.handleSave}
        />
      );
    }
  };

  ListField = () => {
    const { field } = this.props;
    let { value } = this.state;

    if (!value) value = [];

    if (field.listStyle === "dropdown") {
      return (
        <Select
          value={value}
          mode={field.multiSelect ? "multiple" : "default"}
          allowClear={true}
          style={{ width: "100%" }}
          onChange={value => this.handleChange(value, true)}
          onBlur={this.handleSave}
        >
          {(field.options || []).map(option => (
            <Option key={option.value ? option.value : option.label}>
              {field.useIcon ? <Icon type={option.label} /> : option.label}
            </Option>
          ))}
        </Select>
      );
    }

    if (field.listStyle === "radio") {
      if (field.multiSelect) {
        return (
          <CheckboxGroup
            value={value}
            options={(field.options || []).map(option => ({
              label: field.useIcon ? (
                <Icon type={option.label} />
              ) : (
                option.label || null
              ),
              value: option.value || null
            }))}
            style={{
              display: "flex",
              flexDirection: field.alignment === "vertical" ? "column" : "row"
            }}
            onChange={value => this.handleChange(value, true)}
          />
        );
      } else {
        return (
          <RadioGroup
            value={value}
            style={{
              display: "flex",
              flexDirection: field.alignment === "vertical" ? "column" : "row"
            }}
            onChange={e => this.handleChange(e.target.value, true)}
          >
            {(field.options || []).map((option, i) => (
              <Radio key={i} value={option.value}>
                {field.useIcon ? <Icon type={option.label} /> : option.label}
              </Radio>
            ))}
          </RadioGroup>
        );
      }
    }
  };

  NumberField = () => {
    const { field } = this.props;
    const { value } = this.state;

    if (field.numberDisplay === "list") {
      const steps = range(
        field.minimum,
        field.maximum + field.interval,
        field.interval
      );

      return (
        <Select
          value={value}
          style={{ width: "100%" }}
          onChange={value => this.handleChange(value, true)}
          onBlur={this.handleSave}
        >
          {steps.map(step => (
            <Option key={step} value={step}>{step}</Option>
          ))}
        </Select>
      );
    } else {
      return (
        <InputNumber
          value={value}
          style={{ width: "100%" }}
          min={
            field.minimum !== undefined && field.minimum !== null
              ? field.minimum
              : -Infinity
          }
          max={
            field.maximum !== undefined && field.maximum !== null
              ? field.maximum
              : Infinity
          }
          step={field.interval || undefined}
          precision={field.precision || null}
          onChange={value => this.handleChange(value)}
          onBlur={this.handleSave}
        />
      );
    }
  };

  DateField = () => {
    const { value } = this.state;

    return (
      <DatePicker
        value={value && moment(value)}
        style={{ width: "100%" }}
        onChange={value =>
          this.handleChange(value ? moment.utc(value).format() : null, true)
        }
      />
    );
  };

  BooleanField = () => {
    const { value } = this.state;

    return (
      <Checkbox
        checked={value}
        onChange={e => {
          this.handleChange(e.target.checked, true);
        }}
      />
    );
  };

  CheckboxGroup = () => {
    const { field, onSave } = this.props;
    const { value } = this.state;

    const fieldColumns = field.columns &&
      field.columns.map(column => (
        <div
          className={value && value[column] ? "active" : "inactive"}
          key={column}
          onClick={() => {
            const newValue = !value[column];

            this.setState({
              value: { ...value, [column]: newValue }
            });

            if (!onSave) return;

            if (this.props.value[column] !== newValue) {
              onSave(newValue, column);
            }
          }}
        >
          {column}
        </div>
      ));

    return (
      <div className="checkbox-group">
        {fieldColumns}
      </div>
    );
  };

  render() {
    let { field, readOnly, value, showName } = this.props;

    return (
      <div>
        {showName && <h4>{(field && field.name) || <i>Unnamed Field</i>}:</h4>}

        {readOnly &&
          (() => {
            if (!field) return value;

            switch (field.type) {
              case "number":
                return value !== undefined && value !== null
                  ? value.toString()
                  : null;

              case "date":
                return value ? moment(value).format("YYYY-MM-DD") : null;

              case "checkbox":
                return value ? "True" : "False";

              case "list":
                if (!value) return null;

                const label = value => {
                  const option = field.options.find(
                    option => option.value === value
                  );
                  return option ? option.label : "";
                };

                if (value instanceof Array)
                  return value.map(x => label(x)).join(", ");

                return label(value);

              case "checkbox-group":
                return (
                  <div className="checkbox-group disabled">
                    {field.columns.map(column => (
                      <div
                        className={
                          value && value[column] ? "active" : "inactive"
                        }
                        key={column}
                      >
                        {column}
                      </div>
                    ))}
                  </div>
                );

              default:
                return value;
            }
          })()}

        {!readOnly &&
          (!field ? (
            <Input />
          ) : (
            (() => {
              if (!field) return this.TextField();

              switch (field.type) {
                case "list":
                  return this.ListField();

                case "number":
                  return this.NumberField();

                case "date":
                  return this.DateField();

                case "checkbox":
                  return this.BooleanField();

                case "checkbox-group":
                  return this.CheckboxGroup();

                default:
                  return this.TextField();
              }
            })()
          ))}
      </div>
    );
  }
}

export default Field;
