import React from "react";

import { Button, Divider, Table, Tooltip, notification } from "antd";

import _ from "lodash";
import Draggable from "react-draggable";

import PreviewModal from "../modals/PreviewModal";

import ContentEditor from "./ContentEditor/ContentEditor";
import QueryBuilder from "./QueryBuilder";

import "material-design-icons/iconfont/material-icons.css";

import apiRequest from "../../shared/apiRequest";

const generateColours = size => {
  let colours = new Array(size);

  const sin_to_hex = (i, phase) => {
    const sin = Math.sin((Math.PI / size) * 2 * i + phase);
    const int = Math.floor(sin * 127) + 128;
    const hex = int.toString(16);

    return hex.length === 1 ? "0" + hex : hex;
  };

  for (var i = 0; i < size; i++) {
    var red = sin_to_hex(i, (0 * Math.PI * 2) / 3); // 0   deg
    var blue = sin_to_hex(i, (1 * Math.PI * 2) / 3); // 120 deg
    var green = sin_to_hex(i, (2 * Math.PI * 2) / 3); // 240 deg

    colours[i] = "#" + red + green + blue;
  }

  return colours;
};

const methodMap = {
  POST: "created",
  PUT: "updated",
  DELETE: "deleted"
};

class Compose extends React.Component {
  constructor(props) {
    super(props);
    const { action } = this.props;

    this.state = {
      querybuilder: { visible: false },
      preview: { visible: false },
      colours: generateColours(action.rules.length),
      contentEditorKey: _.uniqueId()
    };
  }

  componentDidUpdate(prevProps) {
    const { action } = this.props;

    if (prevProps.action.rules.length < action.rules.length)
      this.setState({
        colours: generateColours(action.rules.length)
      });
  }

  updateFilter = ({ filter, method, onSuccess, onError }) => {
    const { action, updateAction } = this.props;

    apiRequest(`/workflow/${action.id}/filter/`, {
      method,
      payload: { filter },
      onSuccess: action => {
        notification["success"]({
          message: `Filter successfully ${methodMap[method]}.`
        });
        onSuccess();
        updateAction(action);
      },
      onError: error => onError(error)
    });
  };

  updateRule = ({ rule, ruleIndex, method, onSuccess, onError }) => {
    const { action, updateAction } = this.props;

    apiRequest(`/workflow/${action.id}/rules/`, {
      method,
      payload: { rule, ruleIndex },
      onSuccess: action => {
        notification["success"]({
          message: `Rule successfully ${methodMap[method]}.`
        });
        onSuccess();
        updateAction(action);
        // Recreate the content editor component by changing its key
        this.setState({ contentEditorKey: _.uniqueId() });
      },
      onError: error => onError(error)
    });
  };

  previewContent = ({ content, onSuccess, onError }) => {
    const { action } = this.props;

    apiRequest(`/workflow/${action.id}/content/`, {
      method: "POST",
      payload: { content },
      onSuccess: populatedContent => {
        onSuccess();
        this.setState({ preview: { visible: true, populatedContent } });
      },
      onError: error => onError(error)
    });
  };

  updateContent = ({ content, onSuccess, onError }) => {
    const { action, updateAction } = this.props;

    apiRequest(`/workflow/${action.id}/content/`, {
      method: "PUT",
      payload: { content },
      onSuccess: action => {
        notification["success"]({
          message: "Content successfully updated."
        });
        onSuccess();
        updateAction(action);
      },
      onError: error => onError(error)
    });
  };

  render() {
    const { action } = this.props;
    const {
      preview,
      colours,
      querybuilder,
      contentEditor,
      contentEditorKey
    } = this.state;

    return (
      <div>
        <QueryBuilder
          actionId={action.id}
          modules={action.options.modules}
          types={action.options.types}
          {...querybuilder}
          onClose={() => this.setState({ querybuilder: { visible: false } })}
        />

        <h3>
          Filter
          <Button
            style={{ marginLeft: "10px" }}
            shape="circle"
            icon="edit"
            onClick={() =>
              this.setState({
                querybuilder: {
                  visible: true,
                  type: "filter",
                  selected: action.filter,
                  onSubmit: this.updateFilter
                }
              })
            }
          />
        </h3>

        {action.filter
          ? `${action.data.filteredLength} records selected out of ${
              action.data.unfilteredLength
            } (${action.data.unfilteredLength -
              action.data.filteredLength} filtered out)`
          : "No filter is currently being applied"}

        <div className="filter_results">
          <Table
            size="small"
            scroll={{ x: (action.data.order.length - 1) * 175 }}
            pagination={{
              pageSize: 5
            }}
            dataSource={action.data.records}
            columns={action.data.order.map(item => ({
              title: item,
              dataIndex: item
            }))}
            rowKey={(record, i) => i}
          />
        </div>

        <Divider dashed />

        <h3>
          Rules
          <Button
            style={{ marginLeft: "10px" }}
            shape="circle"
            icon="plus"
            onClick={() =>
              this.setState({
                querybuilder: {
                  visible: true,
                  type: "rule",
                  onSubmit: this.updateRule
                }
              })
            }
          />
        </h3>

        {action.rules.length > 0
          ? action.rules.map((rule, ruleIndex) => (
              <Draggable
                key={ruleIndex}
                cancel="Button"
                position={{ x: 0, y: 0 }}
                onDrag={mouseEvent => {
                  this.setState({
                    contentEditor: { mouseEvent, ruleIndex: null, isRuleClick: false }
                  });
                }}
                onStop={e => {
                  // Rule was dragged
                  if (contentEditor && contentEditor.mouseEvent) {
                    this.setState({
                      contentEditor: { mouseEvent: null, ruleIndex, isRuleClick: false }
                    });
                    // Rule was clicked
                  }
                  // else {
                  //   this.setState({
                  //     querybuilder: {
                  //       visible: true,
                  //       type: "rule",
                  //       selected: rule,
                  //       onSubmit: ({ rule, method, onSuccess, onError }) =>
                  //         this.updateRule({
                  //           rule,
                  //           ruleIndex,
                  //           method,
                  //           onSuccess,
                  //           onError
                  //         })
                  //     }
                  //   });
                  // }
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    marginRight: 5,
                    textAlign: "center",
                    border: "1px solid #d9d9d9",
                    borderRadius: "4px",
                    padding: "1px 7px 2px",
                    cursor: "move"
                  }}
                >
                  <div>
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        background: colours[ruleIndex],
                        marginRight: 5,
                        display: "inline-block"
                      }}
                    />
                    {rule.name}
                  </div>
                  <div>
                    <Tooltip title="Edit rule">
                      <Button
                        icon="edit"
                        size="small"
                        onClick={(e) => {
                          this.setState({
                            querybuilder: {
                              visible: true,
                              type: "rule",
                              selected: rule,
                              onSubmit: ({ rule, method, onSuccess, onError }) =>
                                this.updateRule({rule, ruleIndex, method, onSuccess, onError})
                            }
                          });
                        }}
                      />
                    </Tooltip>
                    <Tooltip title="Add rule to content editor">
                      <Button
                        size="small"
                        icon="plus"
                        onClick={(e) => {this.newContentEditor.handleRuleClick(ruleIndex, action.rules)}}
                      />
                    </Tooltip>
                  </div>
                </div>
              </Draggable>
            ))
          : "No rules have been added yet."}

        <Divider dashed />

        <h3>Content</h3>

        <ContentEditor
          ref={newContentEditor => this.newContentEditor = newContentEditor}
          key={contentEditorKey} // Used to force a re-render after updating rules
          {...contentEditor}
          html={_.get(action, "content")}
          rules={action.rules}
          types={action.options.types}
          order={action.data.order}
          colours={colours}
          onUpdate={this.updateContent}
          onPreview={this.previewContent}
        />

        <PreviewModal
          {...action.data}
          {...preview}
          onClose={() => this.setState({ preview: { visible: false } })}
        />
      </div>
    );
  }
}

export default Compose;
