import React from "react";
import { Card, Icon, Tooltip, Select, Popover } from "antd";
import _ from "lodash";

import ModelContext from "../ModelContext";
import ComputedFieldModal from "./ComputedFieldModal";

class ComputedModule extends React.Component {
  static contextType = ModelContext;

  constructor(props) {
    super(props);
    const { step } = props;

    this.state = {
      fieldModal: false,
      fieldKeys: _.get(step, "computed.fields", []).map(() => _.uniqueId()),
      fields: _.get(step, "computed.fields", [])
    };
  }

  addField = field => {
    const { stepIndex } = this.props;
    const { fieldKeys } = this.state;
    const { form } = this.context;
    const { getFieldDecorator } = form;

    this.setState({
      fieldKeys: [...fieldKeys, _.uniqueId()]
    });
    getFieldDecorator(
      `steps[${stepIndex}].computed.fields[${fieldKeys.length}]`,
      {
        initialValue: field
      }
    );
  };

  updateField = (field, fieldIndex) => {
    const { stepIndex } = this.props;
    const { form } = this.context;
    const { setFieldsValue } = form;
    setFieldsValue({
      [`steps[${stepIndex}].computed.fields[${fieldIndex}]`]: field
    });
    this.props.setChanged(true)
  };

  deleteField = fieldIndex => {
    const { stepIndex } = this.props;
    const { form } = this.context;
    const { fieldKeys, fields } = this.state;
    const { getFieldValue, setFieldsValue } = form;

    const formFields = getFieldValue(`steps[${stepIndex}].computed.fields`);

    fieldKeys.splice(fieldIndex, 1);
    formFields.splice(fieldIndex, 1);
    fields.splice(fieldIndex, 1);

    this.setState({ fieldKeys, fields });
    setFieldsValue({ [`steps[${stepIndex}].computed.fields`]: formFields });
    this.props.setChanged(true)
  };

  render() {
    const { stepIndex } = this.props;
    const { fieldKeys, fieldModal, fields } = this.state;
    const { form, stepKeys, deleteModule } = this.context;
    const { getFieldValue, getFieldDecorator } = form;

    getFieldDecorator(`steps[${stepIndex}].type`, {
      initialValue: "computed"
    });

    // Initialize the array that will hold the modules' actions
    let actions = [
      <Tooltip title="Add computed field">
        <Icon
          type="plus"
          onClick={() =>
            this.setState({
              fieldModal: { visible: true, onOk: this.addField }
            })
          }
        />
      </Tooltip>
    ];

    // If this is the last step, show the delete button
    if ((stepKeys || []).length === stepIndex + 1)
      actions.push(
        <Tooltip title="Remove computed fields">
          <Icon type="delete" onClick={deleteModule} />
        </Tooltip>
      );

    return (
      <Card
        className="computed"
        actions={actions}
        title={
          <div className="title">
            <div className="step_number">{stepIndex + 1}</div>
            <Icon type="calculator" className="title_icon" />
            Computed Fields
          </div>
        }
      >
        {fieldKeys.length === 0 ? (
          <p>Add a computed field by clicking the button below.</p>
        ) : (
          <Tooltip
            title="Edit a given field by clicking on its name"
            placement="right"
          >
            <Select
              disabled
              mode="tags"
              dropdownStyle={{ display: "none" }}
              labelInValue={true}
              className="fields"
              value={fieldKeys.map((key, fieldIndex) => {
                getFieldDecorator(
                  `steps[${stepIndex}].computed.fields[${fieldIndex}]`,
                  {
                    initialValue:
                      getFieldValue(
                        `steps[${stepIndex}].computed.fields[${fieldIndex}]`
                      ) || _.get(fields, fieldIndex)
                  }
                );

                const field = getFieldValue(
                  `steps[${stepIndex}].computed.fields[${fieldIndex}]`
                );
                const label = field.name;

                const truncatedLabel =
                  label.length > 20 ? `${label.slice(0, 20)}...` : label;

                return {
                  key: label,
                  label: (
                    <span
                      onClick={() =>
                        this.setState({
                          fieldModal: {
                            visible: true,
                            field,
                            onOk: field => this.updateField(field, fieldIndex),
                            onDelete: () => this.deleteField(fieldIndex)
                          }
                        })
                      }
                    >
                      {truncatedLabel !== label ? (
                        <Popover
                          content={label}
                          overlayStyle={{ zIndex: 2000 }}
                          mouseLeaveDelay={0}
                        >
                          {truncatedLabel}
                        </Popover>
                      ) : (
                        label
                      )}
                    </span>
                  )
                };
              })}
            />
          </Tooltip>
        )}

        <ComputedFieldModal
          {...fieldModal}
          stepIndex={stepIndex}
          closeModal={() => this.setState({ fieldModal: { visible: false } })}
        />
      </Card>
    );
  }
}

export default ComputedModule;
