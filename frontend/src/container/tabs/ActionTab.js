import React from "react";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import { Input, Icon, Tooltip, Button, Card, Modal } from "antd";
import { Link } from "react-router-dom";

import { deleteAction } from "../../workflow/WorkflowActions";

const { Meta } = Card;
const confirm = Modal.confirm;

class ActionTab extends React.Component {
  constructor(props) {
    super(props);
    const { dispatch } = props;

    this.boundActionCreators = bindActionCreators(
      { deleteAction },
      dispatch
    );

    this.state = { filter: null, loading: {} };
  }

  deleteAction = actionId => {
    confirm({
      title: "Confirm action deletion",
      content: "Are you sure you want to delete this action?",
      okText: "Continue with deletion",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        this.setState({
          loading: { [actionId]: true }
        });

        this.boundActionCreators.deleteAction({
          actionId,
          onFinish: () => {
            this.setState({ loading: { [actionId]: false } });
          }
        });
      }
    });
  };

  render() {
    const { containerId, actions, dataLabs, openModal } = this.props;
    const { filter, loading } = this.state;

    return (
      <div className="tab">
        {actions &&
          actions.length > 0 && (
            <div className="filter_wrapper">
              <div className="filter">
                <Input
                  placeholder="Filter actions by name"
                  value={filter}
                  addonAfter={
                    <Tooltip title="Clear filter">
                      <Icon
                        type="close"
                        onClick={() => this.setState({ filter: null })}
                      />
                    </Tooltip>
                  }
                  onChange={e => this.setState({ filter: e.target.value })}
                />
              </div>
            </div>
          )}
        {actions &&
          actions.map((action, i) => {
            if (filter && !action.name.includes(filter)) return null;

            return (
              <Card
                className="item"
                bodyStyle={{ flex: 1 }}
                title={action.name}
                actions={[
                  <Tooltip title="Edit action">
                    <Link to={`/workflow/${action.id}`}>
                      <Button icon="arrow-right" />
                    </Link>
                  </Tooltip>,
                  <Tooltip title="Delete action">
                    <Button
                      type="danger"
                      icon="delete"
                      loading={action.id in loading && loading[action.id]}
                      onClick={() => this.deleteAction(action.id)}
                    />
                  </Tooltip>
                ]}
                key={i}
              >
                <Meta
                  description={
                    <div>
                      {action.description
                        ? action.description
                        : "No description provided"}
                    </div>
                  }
                />
              </Card>
            );
          })}
        <div
          className="add item"
          onClick={() => {
            openModal({ type: "action", data: { containerId, dataLabs } });
          }}
        >
          <Icon type="plus" />
          <span>Create action</span>
        </div>
      </div>
    );
  }
}

export default connect()(ActionTab);
