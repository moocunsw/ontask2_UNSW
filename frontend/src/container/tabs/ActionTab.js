import React from "react";
import { Tooltip, Button, Modal, notification, Table } from "antd";

import apiRequest from "../../shared/apiRequest";
import ContainerContext from "../ContainerContext";

const confirm = Modal.confirm;

class ActionTab extends React.Component {
  static contextType = ContainerContext;

  state = { filter: null, filterCategory: "name", deleting: {}, cloning: {} };

  deleteAction = actionId => {
    const { fetchDashboard } = this.context;

    confirm({
      title: "Confirm action deletion",
      content: "Are you sure you want to delete this action?",
      okText: "Continue with deletion",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        this.setState({
          deleting: { [actionId]: true }
        });

        apiRequest(`/workflow/${actionId}/`, {
          method: "DELETE",
          onSuccess: () => {
            this.setState({ deleting: { [actionId]: false } });
            fetchDashboard();
            notification["success"]({
              message: "Action deleted",
              description: "The action was successfully deleted."
            });
          },
          onError: error => {
            this.setState({ deleting: { [actionId]: false } });
            notification["error"]({
              message: "Action deletion failed",
              description: error
            });
          }
        });
      }
    });
  };

  cloneAction = actionId => {
    const { fetchDashboard } = this.context;

    confirm({
      title: "Confirm action clone",
      content: "Are you sure you want to clone this action?",
      onOk: () => {
        this.setState({
          cloning: { [actionId]: true }
        });

        apiRequest(`/workflow/${actionId}/clone_action/`, {
          method: "POST",
          onSuccess: () => {
            this.setState({ cloning: { [actionId]: false } });
            fetchDashboard();
            notification["success"]({
              message: "Action cloned",
              description: "The action was successfully cloned."
            });
          },
          onError: error => {
            this.setState({ cloning: { [actionId]: false } });
            notification["error"]({
              message: "Action cloning failed",
              description: error
            });
          }
        });
      }
    });
  };

  render() {
    const { containerId, actions, dataLabs } = this.props;
    const { deleting, cloning } = this.state;
    const { history } = this.context;

    const columns = [
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        sorter: (a, b) => a.name.localeCompare(b.name),
        defaultSortOrder: "ascend"
      },
      {
        title: "Description",
        dataIndex: "description",
        key: "description",
        sorter: (a, b) => a.description.localeCompare(b.description)
      },
      {
        title: "Associated DataLab",
        dataIndex: "datalab",
        key: "datalab",
        sorter: (a, b) => a.datalab.localeCompare(b.datalab),
        filters: [...new Set(actions.map(action => action.datalab))].map(
          datalab => ({
            text: datalab,
            value: datalab
          })
        ),
        onFilter: (value, record) => record.datalab === value
      },
      {
        title: "Actions",
        key: "actions",
        render: (text, action) => {
          return (
            <div>
              <Tooltip title="Edit action settings">
                <Button
                  style={{ margin: 3 }}
                  icon="setting"
                  onClick={() => {
                    history.push(`/action/${action.id}/settings`);
                  }}
                />
              </Tooltip>

              <Tooltip title="View Action Tracking/Feedback">
                <Button
                  style={{ margin: 3 }}
                  icon="table"
                  onClick={() => {
                    history.push(`/action/${action.id}/email_history`)
                  }}
                />
              </Tooltip>

              <Tooltip title="Clone action">
                <Button
                  style={{ margin: 3 }}
                  icon="copy"
                  loading={action.id in cloning && cloning[action.id]}
                  onClick={() => this.cloneAction(action.id)}
                />
              </Tooltip>

              <Tooltip title="Clone action to another container">
                <Button
                  style={{ margin: 3 }}
                  icon="export"
                  onClick={() => {
                    history.push(`/action/${action.id}/clone_action`)
                  }}
                />
              </Tooltip>

              <Tooltip title="Delete action">
                <Button
                  style={{ margin: 3 }}
                  type="danger"
                  icon="delete"
                  loading={action.id in deleting && deleting[action.id]}
                  onClick={() => this.deleteAction(action.id)}
                />
              </Tooltip>
            </div>
          );
        }
      }
    ];

    return (
      <div>
        <Button
          style={{ marginBottom: 15 }}
          type="primary"
          icon="plus"
          onClick={() => {
            history.push({
              pathname: "/action",
              state: {
                containerId,
                dataLabs: dataLabs.map(dataLab => ({
                  id: dataLab.id,
                  name: dataLab.name
                }))
              }
            });
          }}
        >
          Create Action
        </Button>

        <Table
          bordered
          dataSource={actions}
          columns={columns}
          rowKey="id"
          locale={{
            emptyText: "No actions have been created yet"
          }}
        />
      </div>
    );
  }
}

export default ActionTab;
