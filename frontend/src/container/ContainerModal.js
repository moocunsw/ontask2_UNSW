import React from "react";
import { Modal, Form, Input, Select, Alert, notification } from "antd";

import apiRequest from "../shared/apiRequest";
import formItemLayout from "../shared/FormItemLayout";

const FormItem = Form.Item;
const Option = Select.Option;
const { TextArea } = Input;

// TODO: Generalise
const sampleTerms = [
  {
    "code": 5196,
    "name": "2019 Term 2"
  },
  {
    "code": 5197,
    "name": "2019 Semester 2 Canberra"
  },
  {
    "code": 5199,
    "name": "2019 Term 3"
  }
]

class ContainerModal extends React.Component {
  state = { loading: null, error: null };

  handleOk = () => {
    const {
      form,
      selected,
      closeModal,
      fetchDashboard,
      updateAccordionKey
    } = this.props;

    form.validateFields((err, payload) => {
      if (err) return;

      this.setState({ loading: true });

      apiRequest(selected ? `/container/${selected.id}/` : "/container/", {
        method: selected ? "PATCH" : "POST",
        payload,
        onSuccess: container => {
          this.setState({ loading: false, error: null });
          if (!selected) updateAccordionKey(container.id);
          form.resetFields();
          closeModal();
          fetchDashboard();
          notification["success"]({
            message: `Container ${selected ? "updated" : "added"}`,
            description: `The container was successfully ${
              selected ? "updated" : "created"
            }.`
          });
        },
        onError: error => this.setState({ loading: false, error })
      });
    });
  };

  handleCancel = () => {
    const { form, closeModal } = this.props;

    this.setState({ loading: null, error: null });
    form.resetFields();
    closeModal();
  };

  render() {
    const { visible, selected, form } = this.props;
    const { loading, error } = this.state;

    const { getFieldDecorator } = form;

    return (
      <Modal
        visible={visible}
        title={selected ? "Update Container" : "Create Container"}
        okText={selected ? "Update" : "Create"}
        onCancel={this.handleCancel}
        onOk={this.handleOk}
        confirmLoading={loading}
      >
        <Form layout="horizontal">
          <FormItem {...formItemLayout} label="Code">
            {getFieldDecorator("code", {
              initialValue: selected ? selected.code : null,
              rules: [{ required: true, message: "Code is required" }]
            })(<Input />)}
          </FormItem>

          <FormItem {...formItemLayout} label="Term">
            {getFieldDecorator("term", {
              initialValue: selected ? selected.term : null,
            })(
              <Select>
                {
                  sampleTerms.map((term, i) => (
                    <Option value={term.code} key={i}>{term.name}</Option>
                  ))
                }
              </Select>
            )}
          </FormItem>

          <FormItem {...formItemLayout} label="School">
            {getFieldDecorator("school", {
              initialValue: selected ? selected.school : null
            })(<Input />)}
          </FormItem>

          <FormItem {...formItemLayout} label="Faculty">
            {getFieldDecorator("faculty", {
              initialValue: selected ? selected.faculty : null
            })(<Input />)}
          </FormItem>

          <FormItem {...formItemLayout} label="Description">
            {getFieldDecorator("description", {
              initialValue: selected ? selected.description : null
            })(<TextArea rows={4} />)}
          </FormItem>

          {error && <Alert message={error} type="error" />}
        </Form>
      </Modal>
    );
  }
}

export default Form.create()(ContainerModal);
