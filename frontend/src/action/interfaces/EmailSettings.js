import React from "react";
import {
  Form,
  Select,
  Input,
  Button,
  Checkbox,
  Icon,
  Tooltip,
  Alert,
  Spin
} from "antd";
import _ from "lodash";

import { narrowFormItemLayout } from "../../shared/FormItemLayout";

const FormItem = Form.Item;
const Option = Select.Option;

class EmailSettings extends React.Component {
  state = { loading: false };

  handleUpdate = () => {
    const { form, updateEmailSettings } = this.props;

    form.validateFields((err, payload) => {
      if (err) return;

      const { emailSettings } = payload;

      if (
        emailSettings.include_feedback &&
        !emailSettings.feedback_list &&
        !emailSettings.feedback_textbox
      ) {
        this.setState({
          error:
            "You must have at least a dropdown or a textbox in order to collect feedback",
        });
        return;
      }

      this.setState({ loading: true, error: null });

      updateEmailSettings({
        emailSettings,
        onSuccess: () => this.setState({ loading: false }),
        onError: (error) => this.setState({ loading: false, error }),
      });
    });
  };

  render() {
    const { form, emailSettings, options, locked } = this.props;
    const { loading, error } = this.state;
    const { getFieldDecorator, getFieldValue, setFieldsValue } = form;

    getFieldDecorator("feedbackOptionKeys", {
      initialValue: emailSettings
        ? emailSettings.list_options.map(() => _.uniqueId())
        : [],
    });
    const feedbackOptionKeys = getFieldValue("feedbackOptionKeys");

    return (
      <Form layout="horizontal" className="panel">
        <FormItem {...narrowFormItemLayout} label="Email field">
          {getFieldDecorator("emailSettings.field", {
            rules: [{ required: true, message: "Email field is required" }],
            initialValue: _.get(emailSettings, "field"),
          })(
            <Select>
              {options.map((option, i) => {
                return (
                  <Option value={option} key={i}>
                    {option}
                  </Option>
                );
              })}
            </Select>
          )}
        </FormItem>

        <FormItem {...narrowFormItemLayout} label="Subject">
          {getFieldDecorator("emailSettings.subject", {
            rules: [{ required: true, message: "Subject is required" }],
            initialValue: _.get(emailSettings, "subject"),
          })(<Input />)}
        </FormItem>

        <FormItem {...narrowFormItemLayout} label="From (name)">
          {getFieldDecorator("emailSettings.fromName", {
            initialValue:
              _.get(emailSettings, "fromName") ||
              sessionStorage.getItem("name"),
          })(<Input />)}
        </FormItem>

        <FormItem {...narrowFormItemLayout} label="Reply-to">
          {getFieldDecorator("emailSettings.replyTo", {
            rules: [{ required: true, message: "Reply-to is required" }],
            initialValue:
              _.get(emailSettings, "replyTo") ||
              sessionStorage.getItem("email"),
          })(<Input />)}
        </FormItem>

        <FormItem
          {...narrowFormItemLayout}
          className="checkbox"
          label={
            <div className="field_label">
              Feedback form
              <Tooltip
                title={`Includes a hyperlink to a form that allows recipients to 
            provide feedback for this email`}
              >
                <Icon type="question-circle-o" />
              </Tooltip>
            </div>
          }
        >
          {getFieldDecorator("emailSettings.include_feedback", {
            initialValue: _.get(emailSettings, "include_feedback") || false,
            valuePropName: "checked",
          })(<Checkbox />)}
        </FormItem>

        {getFieldValue("emailSettings.include_feedback") && (
          <div
            style={{
              border: "1px dashed #e9e9e9",
              background: "#F5F5F5",
              borderRadius: 5,
              margin: "20px -1px",
              padding: "10px 20px 10px 0",
            }}
          >
            <FormItem
              {...narrowFormItemLayout}
              className="checkbox"
              label="Include list"
            >
              {getFieldDecorator("emailSettings.feedback_list", {
                initialValue: _.get(emailSettings, "feedback_list") || false,
                valuePropName: "checked",
              })(
                <Checkbox
                  onChange={(e) => {
                    if (e.target.checked)
                      setFieldsValue({ feedbackOptionKeys: [_.uniqueId()] });
                    if (error && e.target.checked)
                      this.setState({ error: null });
                  }}
                />
              )}
            </FormItem>

            {form.getFieldValue("emailSettings.feedback_list") && (
              <div>
                <FormItem
                  {...narrowFormItemLayout}
                  label="List question"
                  style={{ margin: 0 }}
                  help={null}
                >
                  {getFieldDecorator("emailSettings.list_question", {
                    rules: [
                      {
                        required: true,
                      },
                    ],
                    initialValue: _.get(emailSettings, "list_question"),
                  })(
                    <Input placeholder="E.g. How would you rate this feedback?" />
                  )}
                </FormItem>

                <FormItem
                  {...narrowFormItemLayout}
                  label="List type"
                  style={{ margin: 0 }}
                  help={null}
                >
                  {getFieldDecorator("emailSettings.list_type", {
                    rules: [
                      {
                        required: true,
                      },
                    ],
                    initialValue: _.get(emailSettings, "list_type") || "radio",
                  })(
                    <Select>
                      <Option value="dropdown">Dropdown</Option>
                      <Option value="radio">Radio boxes</Option>
                    </Select>
                  )}
                </FormItem>

                <FormItem
                  {...narrowFormItemLayout}
                  label="List options"
                  style={{ margin: 0 }}
                  help={null}
                >
                  <Button
                    type="primary"
                    size="small"
                    onClick={() => {
                      setFieldsValue({
                        feedbackOptionKeys: [
                          ...feedbackOptionKeys,
                          _.uniqueId(),
                        ],
                      });
                    }}
                  >
                    Add option
                  </Button>
                </FormItem>

                <ul style={{ listStyle: "none" }}>
                  {feedbackOptionKeys.map((key, i) => (
                    <li
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "right",
                        alignItems: "center",
                      }}
                      className="formlist_item"
                    >
                      <FormItem style={{ marginRight: 10, width: "38%" }}>
                        {getFieldDecorator(
                          `emailSettings.list_options[${i}].label`,
                          {
                            rules: [
                              {
                                required: true,
                              },
                            ],
                            initialValue: _.get(
                              emailSettings,
                              `list_options[${i}].label`
                            ),
                          }
                        )(<Input placeholder="Label" />)}
                      </FormItem>

                      <FormItem style={{ marginRight: 10, width: "38%" }}>
                        {getFieldDecorator(
                          `emailSettings.list_options[${i}].value`,
                          {
                            rules: [{ required: true }],
                            initialValue: _.get(
                              emailSettings,
                              `list_options[${i}].value`
                            ),
                          }
                        )(<Input placeholder="Value" />)}
                      </FormItem>

                      <Button
                        type="danger"
                        icon="delete"
                        disabled={feedbackOptionKeys.length <= 1}
                        onClick={() => {
                          const feedbackOptions = getFieldValue(
                            "emailSettings.list_options"
                          );
                          feedbackOptionKeys.splice(i, 1);
                          feedbackOptions.splice(i, 1);

                          form.setFieldsValue({
                            feedbackOptionKeys,
                            "emailSettings.list_options": feedbackOptions,
                          });
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <FormItem
              {...narrowFormItemLayout}
              className="checkbox"
              label="Include textbox"
            >
              {form.getFieldDecorator("emailSettings.feedback_textbox", {
                initialValue: _.get(emailSettings, "feedback_textbox") || false,
                valuePropName: "checked",
              })(
                <Checkbox
                  onChange={(e) => {
                    if (error && e.target.checked)
                      this.setState({ error: null });
                  }}
                />
              )}
            </FormItem>

            {form.getFieldValue("emailSettings.feedback_textbox") && (
              <FormItem
                {...narrowFormItemLayout}
                label="Textbox question"
                style={{ margin: 0 }}
                help={null}
              >
                {form.getFieldDecorator("emailSettings.textbox_question", {
                  rules: [
                    {
                      required: true,
                    },
                  ],
                  initialValue: _.get(emailSettings, "textbox_question"),
                })(
                  <Input placeholder="E.g. How useful was this correspondence?" />
                )}
              </FormItem>
            )}
          </div>
        )}

        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ marginBottom: 20 }}
          />
        )}

        <div className="button">
            <Button disabled={locked} loading={loading} onClick={this.handleUpdate}>
              {locked ? (
                <span>
                  Emailing in progress, please wait
                </span>
              ) : (
                <span>
                  Update
                </span>
              )}
            </Button>
          
        </div>
      </Form>
    );
  }
}

export default EmailSettings;
