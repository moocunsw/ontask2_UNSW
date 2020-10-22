import React from "react";
import { Card, Icon, Select, Input, Tooltip, Form } from "antd";
import _ from "lodash";
import memoize from "memoize-one";

import ModelContext from "../ModelContext";

const FormItem = Form.Item;
const { Option } = Select;

class FormModule extends React.Component {
  static contextType = ModelContext;

  form = memoize(formId => {
    const { forms } = this.context;
    return (forms || []).find(form => form.id === formId);
  });

  render() {
    const { stepIndex, step } = this.props;
    const { forms, form, stepKeys, deleteModule } = this.context;
    const { getFieldDecorator, getFieldValue } = form;

    getFieldDecorator(`steps[${stepIndex}].type`, {
      initialValue: "form"
    });

    // Initialize the array that will hold the datasource's actions
    let actions = [
      // <Tooltip title="Export/import fields">
      //   <Icon
      //     type="select"
      //     onClick={() =>
      //       this.setState({ importExport: { visible: true, type: "export" } })
      //     }
      //   />
      // </Tooltip>
    ];

    // if (getFieldValue(`steps[${stepIndex}].form.webForm.active`))
    //   actions.push(
    //     <Tooltip title="Access URL">
    //       <a
    //         href={`/datalab/${selectedId}/form/${stepIndex}`}
    //         target="_blank"
    //         rel="noopener noreferrer"
    //       >
    //         <Icon type="global" />
    //       </a>
    //     </Tooltip>
    //   );

    // If this is the last step, show the delete button
    if ((stepKeys || []).length === stepIndex + 1)
      actions.push(
        <Tooltip title="Remove form">
          <Icon type="delete" onClick={() => deleteModule()} />
        </Tooltip>
      );

    const formId =
      getFieldValue(`steps[${stepIndex}].form`) || _.get(step, "form");
    const chosenForm = this.form(formId);
    const formFields = chosenForm
      ? chosenForm.fields.map(field => field.name)
      : [];

    const usedForms = getFieldValue("steps").map(step => step.form);

    return (
      <Card
        className="form"
        actions={actions}
        title={
          <div className="title">
            <div className="step_number">{stepIndex + 1}</div>

            <Icon type="form" className="title_icon" />

            <FormItem className="no-explain">
              {getFieldDecorator(`steps[${stepIndex}].form`, {
                rules: [{ required: true }],
                initialValue: _.get(step, "form")
              })(
                <Select placeholder="Choose form">
                  {(forms || []).map(form => (
                    <Option
                      value={form.id}
                      key={form.id}
                      disabled={usedForms.includes(form.id)}
                    >
                      {form.name}
                    </Option>
                  ))}
                </Select>
              )}
            </FormItem>
          </div>
        }
      >
        <FormItem>
          <Tooltip
            title={
              !getFieldValue(`steps[${stepIndex}].form`)
                ? "A form must be chosen first"
                : "The field from this DataLab which uniquely identifies each of the records in the form"
            }
            placement="right"
          >
            <Input
              style={{ background: "none" }}
              placeholder="Primary key"
              value={chosenForm && chosenForm.primary}
              disabled
            />
          </Tooltip>
        </FormItem>

        <FormItem>
          <Tooltip
            title={
              !getFieldValue(`steps[${stepIndex}].form`)
                ? "A form must be chosen first"
                : "The fields that are included in this form and will be added to the DataLab"
            }
            placement="right"
          >
            <Select
              style={{ background: "none" }}
              placeholder="Fields"
              mode="multiple"
              value={formFields}
              disabled
            >
              {formFields.map(field => (
                <Option value={field} key={field}>
                  {field}
                </Option>
              ))}
            </Select>
          </Tooltip>
        </FormItem>
      </Card>
    );
  }
}

export default FormModule;
