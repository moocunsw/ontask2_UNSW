import React from "react";
import {
  Modal,
  Button,
  Dropdown,
  Menu,
  Icon,
  TreeSelect,
  Tooltip,
  Alert,
  Form,
  Input,
  Popover,
  Select
} from "antd";
import { Editor } from "slate-react";
import { Value } from "slate";

import ModelContext from "../ModelContext";

import FormItemLayout from "../../../shared/FormItemLayout";

const FormItem = Form.Item;
const confirm = Modal.confirm;
const Option = Select.Option;

const initialValue = Value.fromJSON({
  document: {
    nodes: [
      {
        object: "block",
        type: "paragraph",
        nodes: [
          {
            object: "text"
          }
        ]
      }
    ]
  }
});

class ComputedFieldModal extends React.Component {
  static contextType = ModelContext;

  state = {
    value: initialValue,
    error: null,
    treeData: null
  };

  generateTreeData = () => {
    const { stepIndex } = this.props;
    const { datasources, form, actions, forms, dataLabs } = this.context;
    const { getFieldValue } = form;

    const treeData = [];

    getFieldValue("steps")
      .slice(0, stepIndex)
      .forEach((step, i) => {
        if (step.type === "datasource") {
          step = step.datasource;

          const datasource =
            datasources.find(datasource => datasource.id === step.id) ||
            dataLabs.find(dataLab => dataLab.id === step.id);
          if (!datasource) return;

          treeData.push({
            title: (
              <span style={{ color: "#2196F3" }}>
                <Icon type="database" style={{ marginRight: 5 }} />
                {datasource.name}
              </span>
            ),
            value: `${i}`,
            children: (step.fields || []).map((field, j) => ({
              title: step.labels[field],
              value: `${i}_${j}`
            }))
          });
        }

        if (step.type === "form") {
          step = (forms || []).find(form => form.id === step.form);

          treeData.push({
            title: (
              <span style={{ color: "#5E35B1" }}>
                <Icon type="form" style={{ marginRight: 5 }} />
                {step.name}
              </span>
            ),
            value: `${i}`,
            children: (step.fields || []).map((field, j) => ({
              title: field.name,
              value: `${i}_${j}`
            }))
          });
        }
      });

    let tracking = [];
    if (actions && actions.length > 0)
      actions.forEach(action => {
        if (action.emailJobs.length > 0) {
          tracking.push({
            title: (
              <span>
                <Icon type="thunderbolt" style={{ marginRight: 5 }} />
                {action.name}
              </span>
            ),
            value: `tracking_${action.id}`,
            children: action.emailJobs.map(emailJob => {
              const initiatedAt = new Date(emailJob.initiated_at)
                .toISOString()
                .substring(0, 10);

              return {
                title: this.TruncatedLabel(
                  `${initiatedAt} - ${emailJob.subject}`
                ),
                value: `tracking_${action.id}_${emailJob.job_id}`
              };
            })
          });
        }
      });

    if (tracking.length > 0)
      treeData.push({
        title: (
          <span style={{ color: "#FF7043" }}>
            <Icon type="eye" style={{ marginRight: 5 }} />
            Tracking
          </span>
        ),
        value: "tracking",
        children: tracking
      });

    return treeData;
  };

  TruncatedLabel = label => {
    return label.length > 25 ? (
      <Popover
        mouseLeaveDelay={0}
        overlayStyle={{ maxWidth: 250 }}
        content={label}
      >{`${label.slice(0, 25)}...`}</Popover>
    ) : (
      label
    );
  };

  componentDidUpdate(prevProps) {
    const { visible, field } = this.props;

    const newState = {};

    if (!prevProps.visible && visible)
      newState.treeData = this.generateTreeData();

    if (Object.keys(newState).length > 0) {
      this.setState(newState, () => {
        // At this point, this.editor ref is defined
        if (!prevProps.field && field) {
          // Manually reconstruct the block map
          // Using Value.fromJSON(formula.field) does not work, as functions
          // such as value.endBlock fail to reflect the imported block map
          field.formula.document.nodes.forEach(node => {
            if (node.type !== "paragraph") this.editor.insertBlock(node);
          });
          newState.value = this.editor.value;
          if (Object.keys(newState).length > 0) this.setState(newState);
        }
      });
    }
  }

  handleOk = () => {
    const { onOk, form } = this.props;
    const { value, error } = this.state;

    const blockMap = value.toJSON();
    const nodes = blockMap.document.nodes;

    if (nodes.length < 2) {
      this.setState({
        error: "Formula cannot be empty"
      });
      return;
    }

    const lastBlock = value.endBlock.type;
    const hasUnclosedParenthesis = this.hasUnclosedParenthesis(value);
    const hasEmptyAggregation = nodes.find(
      node =>
        node.type === "aggregation" &&
        (!("columns" in node.data) || node.data.columns.length < 1)
    );

    if (
      !["aggregation", "field", "close-bracket"].includes(lastBlock) ||
      hasUnclosedParenthesis ||
      hasEmptyAggregation
    ) {
      this.setState({
        error: "Formula is invalid"
      });
      return;
    }

    // Reset the error if one has been set
    if (error) this.setState({ error: null });

    form.validateFields((err, values) => {
      if (err) return;

      values.formula = blockMap;
      onOk(values);
      this.handleClose();
    });
  };

  handleClose = () => {
    const { closeModal, form } = this.props;

    this.setState({
      value: initialValue,
      error: null,
      treeData: null
    });
    form.resetFields();
    closeModal();
  };

  handleDelete = () => {
    const { fieldIndex, onDelete } = this.props;

    confirm({
      title: "Confirm field deletion",
      content: "Are you sure you want to delete this computed field?",
      onOk: () => {
        onDelete(fieldIndex);
        this.handleClose();
      }
    });
  };

  renderBlock = props => {
    const { attributes, node } = props;
    const { treeData } = this.state;

    switch (node.type) {
      case "paragraph":
        return (
          <p
            {...attributes}
            style={{
              display: "inline-flex",
              margin: 0,
              height: 0,
              alignItems: "center"
            }}
          >
          </p>
        );
      case "aggregation": {
        const type = node.data.get("type");
        const columns = node.data.get("columns");
        const delimiter = node.data.get("delimiter");

        return (
          <div>
            <div
              {...attributes}
              style={{
                border: "1px solid #757575",
                borderRadius: 3,
                display: "inline-flex",
                alignItems: "center",
                background: "#FAFAFA",
                margin: "2px 5px 2px 0"
              }}
            >
              <div
                style={{
                  padding: "0 5px",
                  cursor: "default"
                }}
              >
                {type}:
              </div>
              <div>
                <TreeSelect
                  treeData={treeData}
                  treeCheckable={true}
                  showCheckedStrategy={TreeSelect.SHOW_PARENT}
                  searchPlaceholder={"Click to add columns"}
                  style={{ minWidth: 175 }}
                  dropdownStyle={{ maxHeight: 250, zIndex: 1030 }}
                  dropdownMatchSelectWidth={false}
                  className="tree-select"
                  value={columns}
                  onChange={columns => {
                    this.editor.setNodeByKey(node.key, {
                      data: { type, columns, delimiter }
                    });
                  }}
                />
              </div>
            </div>
            {type === "concat" && (
              <div style={{ display: "inline" }}>
                <span style={{ marginRight: 5 }}>using</span>
                <Select
                  placeholder="Delimiter"
                  className="delimiter"
                  style={{
                    width: 100,
                    marginRight: 5,
                    border: "1px solid #757575",
                    borderRadius: 3
                  }}
                  value={delimiter === undefined ? "," : delimiter}
                  onChange={delimiter => {
                    this.editor.setNodeByKey(node.key, {
                      data: { type, columns, delimiter }
                    });
                  }}
                >
                  <Option value="">None</Option>
                  <Option value=" ">Space</Option>
                  <Option value=",">Comma</Option>
                  <Option value="|">Bar</Option>
                </Select>
                as a delimiter
              </div>
            )}
          </div>
        );
      }
      case "field": {
        const name = node.data.get("name");
        return (
          <div
            style={{
              display: "inline-block",
              padding: "0 5px",
              border: "1px solid #757575",
              borderRadius: 3,
              margin: "2px 5px 2px 0",
              lineHeight: "2.3em",
              background: "#FAFAFA",
              cursor: "default"
            }}
          >
            {name}
          </div>
        );
      }
      case "operator": {
        const type = node.data.get("type");
        const typeMap = {
          "+": "+",
          "-": "−",
          "*": "×",
          "/": "÷"
        };
        return (
          <div
            style={{
              display: "inline-block",
              padding: "0 5px",
              border: "1px solid #757575",
              borderRadius: 3,
              margin: "2px 5px 2px 0",
              lineHeight: "2.3em",
              background: "#FAFAFA",
              cursor: "default"
            }}
          >
            {typeMap[type]}
          </div>
        );
      }
      case "open-bracket": {
        return (
          <div
            style={{
              display: "inline-block",
              fontSize: "200%",
              marginRight: 5,
              marginTop: -5
            }}
          >
            (
          </div>
        );
      }
      case "close-bracket": {
        return (
          <div
            style={{
              display: "inline-block",
              fontSize: "200%",
              marginRight: 5,
              marginTop: -5
            }}
          >
            )
          </div>
        );
      }
      default:
        return;
    }
  };

  onChange = ({ value }) => {
    this.setState({ value });
  };

  hasUnclosedParenthesis = formula => {
    let hasUnclosedParenthesis = false;

    formula.toJSON().document.nodes.forEach(block => {
      if (block.type === "open-bracket") hasUnclosedParenthesis = true;
      if (block.type === "close-bracket" && hasUnclosedParenthesis)
        hasUnclosedParenthesis = false;
    });

    return hasUnclosedParenthesis;
  };

  Parentheses = () => {
    const { value } = this.state;

    const lastBlock = value.endBlock.type;
    const hasUnclosedParenthesis = this.hasUnclosedParenthesis(value);

    return (
      <div style={{ display: "inline" }}>
        <Tooltip title="Open parenthesis">
          <Button
            style={{ padding: "0 10px", borderRadius: "4px 0 0 4px" }}
            onClick={() => {
              this.editor.insertBlock({
                type: "open-bracket"
              });
            }}
            disabled={
              !["paragraph", "operator"].includes(lastBlock) ||
              hasUnclosedParenthesis
            }
          >
            (
          </Button>
        </Tooltip>

        <Tooltip title="Close parenthesis">
          <Button
            style={{
              padding: "0 10px",
              borderRadius: "0 4px 4px 0",
              marginRight: 5
            }}
            onClick={() => {
              this.editor.insertBlock({
                type: "close-bracket"
              });
            }}
            disabled={
              !["aggregation", "field"].includes(lastBlock) ||
              !hasUnclosedParenthesis
            }
          >
            )
          </Button>
        </Tooltip>
      </div>
    );
  };

  AggregationFunctions = () => {
    const { value } = this.state;

    const handleMenuClick = e => {
      this.editor.insertBlock({
        type: "aggregation",
        data: { type: e.key, delimiter: e.key === "concat" && "," }
      });
    };

    const numberOfBlocks = value.toJSON().document.nodes.length;

    const menu = (
      <Menu onClick={handleMenuClick}>
        <Menu.Item key="sum">Sum</Menu.Item>
        <Menu.Item key="average">Average</Menu.Item>
        <Menu.Item key="list" disabled={numberOfBlocks > 1}>
          List
        </Menu.Item>
        <Menu.Item key="concat" disabled={numberOfBlocks > 1}>
          Concat
        </Menu.Item>
        <Menu.Item key="last">Last</Menu.Item>
      </Menu>
    );

    const lastBlock = value.endBlock.type;

    return (
      <Dropdown
        overlay={menu}
        trigger={["click"]}
        disabled={
          !["paragraph", "open-bracket", "operator"].includes(lastBlock)
        }
      >
        <Button style={{ marginRight: 5 }}>
          Aggregations <Icon type="down" />
        </Button>
      </Dropdown>
    );
  };

  Columns = () => {
    const { value, treeData } = this.state;

    const handleMenuClick = e => {
      this.editor.insertBlock({
        type: "field",
        data: { name: e.key }
      });
    };

    const menu = (
      <Menu onClick={handleMenuClick}>
        {treeData &&
          treeData.map((step, i) => {
            if (step.value === "tracking") return null;

            return (
              <Menu.SubMenu
                key={i}
                title={step.title}
                children={step.children.map((field, j) => (
                  <Menu.Item key={field.title}>{field.title}</Menu.Item>
                ))}
              />
            );
          })}
      </Menu>
    );

    const lastBlock = value.endBlock.type;

    return (
      <Dropdown
        overlay={menu}
        trigger={["click"]}
        disabled={
          !["paragraph", "open-bracket", "operator"].includes(lastBlock)
        }
      >
        <Button style={{ marginRight: 5 }}>
          Fields <Icon type="down" />
        </Button>
      </Dropdown>
    );
  };

  Operators = () => {
    const { value } = this.state;

    const handleMenuClick = e => {
      this.editor.insertBlock({
        type: "operator",
        data: { type: e.key }
      });
    };

    const menu = (
      <Menu onClick={handleMenuClick}>
        <Menu.Item key="+">Add</Menu.Item>
        <Menu.Item key="-">Subtract</Menu.Item>
        <Menu.Item key="*">Multiply</Menu.Item>
        <Menu.Item key="/">Divide</Menu.Item>
      </Menu>
    );

    const lastBlock = value.endBlock;

    return (
      <Dropdown
        overlay={menu}
        trigger={["click"]}
        disabled={
          !["aggregation", "field", "close-bracket"].includes(lastBlock.type) ||
          (lastBlock.type === "aggregation" &&
            ["concat", "list"].includes(lastBlock.data.get("type")))
        }
      >
        <Button>
          Operation <Icon type="down" />
        </Button>
      </Dropdown>
    );
  };

  DeleteBlock = () => {
    return (
      <Tooltip title="Delete last block from formula">
        <Button
          icon="delete"
          type="danger"
          style={{ float: "right" }}
          onClick={() => {
            this.editor.moveToEnd().deleteBackward(1);
          }}
        />
      </Tooltip>
    );
  };

  render() {
    const { visible, field, form } = this.props;
    const { labelsUsed } = this.context;
    const { value, error } = this.state;

    const { getFieldDecorator } = form;

    // Retrieve the labels before the field name validator consumes it
    // So that the results are cached, and the field does not get
    // mistakenly marked as duplicate (due to comparing against itself)
    const labels = labelsUsed();

    return (
      <Modal
        className="computed-field-modal"
        visible={visible}
        title={`${field ? "Edit" : "Add"} computed field`}
        onCancel={this.handleClose}
        footer={
          <div>
            <Button onClick={this.handleClose}>Cancel</Button>
            {field && (
              <Button type="danger" onClick={this.handleDelete}>
                Delete
              </Button>
            )}
            <Button type="primary" onClick={this.handleOk}>
              {field ? "Update" : "Add"}
            </Button>
          </div>
        }
      >
        <FormItem
          {...FormItemLayout}
          label={
            <div className="field_label">
              Field name
              <Tooltip title="The name for this field in the DataLab">
                <Icon type="question-circle-o" />
              </Tooltip>
            </div>
          }
        >
          {getFieldDecorator("name", {
            rules: [
              { required: true, message: "Field name is required" },
              {
                message: "Field name is already being used in the DataLab",
                validator: (rule, value, cb) => {
                  if (field && field.name === value) cb();
                  labels.some(label => label === value) ? cb(true) : cb();
                }
              }
            ],
            initialValue: field && field.name
          })(<Input />)}
        </FormItem>

        <div className="toolbar">
          {this.Parentheses()}
          {this.AggregationFunctions()}
          {this.Columns()}
          {this.Operators()}
          {this.DeleteBlock()}
        </div>

        <Editor
          readOnly
          ref={editor => this.editor = editor}
          value={value}
          onChange={this.onChange}
          renderBlock={this.renderBlock}
          placeholder="Create a formula using the buttons above"
          style={{
            border: "2px solid #ddd",
            borderRadius: 5,
            padding: 5,
            minHeight: 60,
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            whiteSpace: "normal"
          }}
        />

        {error && (
          <Alert message={error} type="error" style={{ marginTop: "10px" }} />
        )}
      </Modal>
    );
  }
}

export default Form.create()(ComputedFieldModal);
