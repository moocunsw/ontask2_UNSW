import React from "react";
import {
  Layout,
  Icon,
  Button,
  Spin,
  Modal,
  Select,
  Tooltip,
  List,
  Collapse,
  notification,
  Menu,
  Card
} from "antd";
import _ from "lodash";

import ContainerModal from "./ContainerModal";
import ContainerShare from "./ContainerShare";
import AccessListModal from "./AccessListModal";

import DatasourceTab from "./tabs/DatasourceTab";
import DataLabTab from "./tabs/DataLabTab";
import ActionTab from "./tabs/ActionTab";

import ContainerContext from "./ContainerContext";

import apiRequest from "../shared/apiRequest";

import "./Container.css";

const { Content } = Layout;
const { Option, OptGroup } = Select;
const Panel = Collapse.Panel;

class Dashboard extends React.Component {
  state = {
    dashboard: [],
    loadingDashboard: true,
    container: { visible: false, selected: null },
    sharing: { visible: false, selected: null },
    lti: { visible: false },
    deleting: {},
    formPermissions: {},
    terms: [],
    currentTerms: [],
    loadingTerms: true
  };

  fetchDashboard = () => {
    this.setState({ loadingDashboard: true });

    const payload = this.state.currentTerms;

    apiRequest(`/dashboard/`, {
      method: "POST",
      payload,
      onSuccess: dashboard => {
        let accordionKey = sessionStorage.getItem("accordionKey");
        let tabKey = sessionStorage.getItem("tabKey");

        if ((!accordionKey || !tabKey) && dashboard.length > 0)
          this.setDefaultKeys(dashboard[0].id);

        this.setState({
          dashboard,
          loadingDashboard: false,
          accordionKey,
          tabKey
        });
      },
      onError: () => {
        notification["error"]({
          message: "Failed to fetch dashboard"
        });
        this.setState({ loadingDashboard: false });
      }
    });
  };


  fetchTermsDashboard = () => {
    this.setState({ loadingTerms: true });

    apiRequest(`/terms/`, {
      method: "GET",
      onSuccess: terms => {
        const storageTerms = localStorage.getItem('currentTerms');
        if (storageTerms) terms.currentTerms = JSON.parse(storageTerms);
        // terms, currentTerms
        this.setState({
          loadingTerms: false,
          ...terms
        }, () => {this.fetchDashboard()});
      },
      onError: () => {
        notification["error"]({
          message: "Failed to fetch terms"
        });
        this.setState({ loadingTerms: false });
      }
    })
  };

  componentDidMount() {
    this.fetchTermsDashboard();
    // const currentTerms = localStorage.getItem('currentTerms');
    // if (currentTerms !== null) {
    //   this.setState(JSON.parse(termsInfo), () => { this.fetchDashboard() });
    // }
    // else {
    //   this.fetchTermsDashboard();
    // }
    // localStorage.setItem('currentTerms', JSON.stringify(newCurrentTerms));

    // this.fetchTerms();
    // this.fetchDashboard();
  }

  componentDidUpdate(prevProps) {
    const { ltiContainerId, ltiResourceId } = this.props;
    const { dashboard, didSetKeys } = this.state;

    if (ltiContainerId && dashboard.length > 0 && !didSetKeys) {
      const associatedContainer = dashboard.find(
        container => container.id === ltiContainerId
      );
      if (associatedContainer) this.setDefaultKeys(associatedContainer.id);
      this.setState({ didSetKeys: true });
    }

    if (ltiResourceId !== prevProps.ltiResourceId) {
      this.setState({ lti: { visible: true } });
    }
  }

  openModal = ({ type, selected, data }) => {
    // Opens a model of the specified type
    // E.g. create/edit container, modify sharing permissions of a container
    this.setState({
      [type]: {
        visible: true,
        selected,
        data
      }
    });
  };

  closeModal = type => {
    // Close the model of the specified type, and clear the parameters
    this.setState({
      [type]: {
        visible: false,
        selected: null,
        data: {}
      }
    });
  };

  removeBinding = containerId => {
    Modal.confirm({
      title: "Confirm binding removal",
      content:
        "Are you sure you want to remove the resource binding for this container?",
      okText: "Continue with removal",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        this.setState({
          unbinding: true
        });

        apiRequest(`/container/${containerId}/`, {
          method: "PATCH",
          payload: { lti_resource: null },
          onSuccess: () => {
            notification["success"]({
              message: "Container binding successfully removed",
              description:
                "Users will no longer be directed towards this container when coming from LTI"
            });
            this.fetchDashboard();
          },
          onError: () =>
            notification["error"]({
              message: "Failed to remove binding from container"
            })
        });
      }
    });
  };

  deleteContainer = containerId => {
    const { deleting } = this.state;

    Modal.confirm({
      title: "Confirm container deletion",
      content:
        "All associated datasources, views and actions will be irrevocably deleted with the container.",
      okText: "Continue with deletion",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        this.setState({
          deleting: { ...deleting, [containerId]: true }
        });

        apiRequest(`/container/${containerId}/`, {
          method: "DELETE",
          onSuccess: () => {
            notification["success"]({
              message: "Container deleted",
              description:
                "The container and its associated datasources, DataLabs and actions have been successfully deleted."
            });
            this.fetchDashboard();
            this.setState({
              deleting: { ...deleting, [containerId]: false }
            });
          },
          onError: () => {
            notification["error"]({
              message: "Failed deletion",
              description: "The container was not deleted."
            });
            this.setState({
              deleting: { ...deleting, [containerId]: false }
            });
          }
        });
      }
    });
  };

  surrenderAccess = containerId => {
    const { deleting } = this.state;

    Modal.confirm({
      title: "Confirm sharing removal",
      content:
        "You will no longer be able to see or interact with this container.",
      okText: "Continue",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        this.setState({
          deleting: { ...deleting, [containerId]: true }
        });

        apiRequest(`/container/${containerId}/surrender_access/`, {
          method: "POST",
          onSuccess: () => {
            notification["success"]({
              message: "Sharing removed",
              description: "You no longer have access to the container"
            });
            this.setState({
              deleting: { ...deleting, [containerId]: false }
            });
            this.fetchDashboard();
          },
          onError: () => {
            notification["error"]({
              message: "Failed to remove sharing"
            });
            this.setState({
              deleting: { ...deleting, [containerId]: false }
            });
          }
        });
      }
    });
  };

  setDefaultKeys = containerId => {
    const { dashboard } = this.state;

    const container = dashboard.find(container => container.id === containerId);

    let tabKey;
    if (container) {
      tabKey = container.has_full_permission
        ? "datasources"
        : ["shared_datalabs", "information_submission"].find(
            type => container[type].length > 0
          );

      this.setState({ accordionKey: containerId, tabKey });
      sessionStorage.setItem("accordionKey", containerId);
      sessionStorage.setItem("tabKey", tabKey);
    } else {
      this.setState({ accordionKey: null, tabKey: null });
      sessionStorage.removeItem("accordionKey");
      sessionStorage.removeItem("tabKey");
    }
  };

  bindResource = () => {
    const { ltiResourceId } = this.props;
    const { lti } = this.state;

    if (!lti.container) {
      notification["error"]({
        message: "Container required",
        description: "You must choose a container to bind to this resource"
      });
      return;
    }

    this.setState({ lti: { ...lti, binding: true } });

    apiRequest(`/container/${lti.container}/`, {
      method: "PATCH",
      payload: { lti_resource: ltiResourceId },
      onSuccess: () => {
        notification["success"]({
          message: "Container successfully bound to resource",
          description:
            "When users come from LTI they will be directed towards the chosen container"
        });
        this.setState({ lti: { visible: false } });
        this.setDefaultKeys(lti.container);
        this.fetchDashboard();
      },
      onError: () =>
        notification["error"]({
          message: "Failed to bind container to resource"
        })
    });
  };

  Header = container => {
    const { deleting } = this.state;

    const currentUser = sessionStorage.getItem("email");
    const isOwner = currentUser === container.owner;

    return (
      <div>
        {container.code}

        {container.has_full_permission && (
          <div className="header_buttons">
            {!isOwner ? (
              <Tooltip title={`This container is owned by ${container.owner}`}>
                <span className="shared">SHARED</span>
              </Tooltip>
            ) : (
              <Tooltip title="Share container">
                <Button
                  icon="share-alt"
                  onClick={e => {
                    e.stopPropagation();
                    this.openModal({ type: "sharing", selected: container });
                  }}
                />
              </Tooltip>
            )}

            <Tooltip title="Edit container">
              <Button
                icon="edit"
                onClick={e => {
                  e.stopPropagation();
                  this.openModal({ type: "container", selected: container });
                }}
              />
            </Tooltip>

            {container.lti_resource && (
              <Tooltip title="Remove resource binding">
                <Button
                  type="danger"
                  icon="disconnect"
                  onClick={e => {
                    e.stopPropagation();
                    this.removeBinding(container.id);
                  }}
                >
                  Remove binding
                </Button>
              </Tooltip>
            )}

            <Tooltip title={isOwner ? "Delete container" : "Remove sharing"}>
              <Button
                type="danger"
                icon={isOwner ? "delete" : "close"}
                loading={container.id in deleting && deleting[container.id]}
                onClick={e => {
                  e.stopPropagation();
                  if (isOwner) {
                    this.deleteContainer(container.id);
                  } else {
                    this.surrenderAccess(container.id);
                  }
                }}
              />
            </Tooltip>
          </div>
        )}
      </div>
    );
  };

  ContainerList = () => {
    const { history } = this.props;
    const { accordionKey, tabKey, dashboard } = this.state;

    return (
      <div className="container_list">
        <Collapse
          accordion
          onChange={accordionKey => this.setDefaultKeys(accordionKey)}
          activeKey={accordionKey}
        >
          {dashboard.map((container, i) => (
            <Panel
              header={this.Header(container)}
              key={container.id}
              style={{ background: i.toString() === accordionKey && "#eee" }}
            >
              <div style={{ display: "flex" }}>
                <Menu
                  mode="inline"
                  selectedKeys={[tabKey]}
                  onSelect={e => {
                    const tabKey = e.key;
                    this.setState({ tabKey });
                    sessionStorage.setItem("tabKey", tabKey);
                  }}
                  style={{ maxWidth: 250 }}
                >
                  {container.has_full_permission && [
                    <Menu.Item key="datasources">
                      Datasources ({container.datasources.length})
                    </Menu.Item>,
                    <Menu.Item key="datalabs">
                      DataLabs ({container.datalabs.length})
                    </Menu.Item>,
                    <Menu.Item key="actions">
                      Actions ({container.actions.length})
                    </Menu.Item>
                  ]}

                  {container.has_full_permission &&
                    ["shared_datalabs", "information_submission"].some(
                      type => container[type].length > 0
                    ) && <Menu.Divider />}

                  {container.shared_datalabs.length > 0 && (
                    <Menu.Item key="shared_datalabs">
                      Shared DataLabs ({container.shared_datalabs.length})
                    </Menu.Item>
                  )}

                  {container.information_submission.length > 0 && (
                    <Menu.Item key="information_submission">
                      Information Submission (
                      {container.information_submission.length})
                    </Menu.Item>
                  )}
                </Menu>

                <div style={{ flex: 1, margin: "4px 0 0 20px" }}>
                  {container.has_full_permission &&
                    tabKey === "datasources" && (
                      <DatasourceTab
                        containerId={container.id}
                        datasources={container.datasources}
                      />
                    )}

                  {container.has_full_permission && tabKey === "datalabs" && (
                    <DataLabTab
                      containerId={container.id}
                      datasources={container.datasources}
                      dataLabs={container.datalabs}
                    />
                  )}

                  {container.has_full_permission && tabKey === "actions" && (
                    <ActionTab
                      containerId={container.id}
                      dataLabs={container.datalabs}
                      actions={container.actions}
                    />
                  )}

                  {tabKey === "information_submission" && (
                    <List
                      grid={{ gutter: 16 }}
                      dataSource={container.information_submission}
                      className="cards"
                      renderItem={form => (
                        <List.Item>
                          <Card title={form.name} style={{ maxWidth: 320 }}>
                            <div style={{ marginBottom: 10 }}>
                              {form.description}
                            </div>

                            <Button
                              icon="arrow-right"
                              type="primary"
                              onClick={() => history.push(`/form/${form.id}`)}
                            >
                              Open
                            </Button>

                            {_.get(form, "permitted_users", []).length > 0 && (
                              <Button
                                style={{ marginLeft: 10 }}
                                icon="lock"
                                onClick={() =>
                                  this.setState({
                                    accessList: {
                                      visible: true,
                                      users: form.permitted_users,
                                      name: form.name,
                                      permission: form.permission
                                    }
                                  })
                                }
                              >
                                Access list (
                                {_.get(form, "permitted_users", []).length})
                              </Button>
                            )}
                          </Card>
                        </List.Item>
                      )}
                    />
                  )}

                  {tabKey === "shared_datalabs" && (
                    <List
                      grid={{ gutter: 16 }}
                      dataSource={container.shared_datalabs}
                      className="cards"
                      renderItem={dataLab => (
                        <List.Item>
                          <Card title={dataLab.name} style={{ maxWidth: 320 }}>
                            <div style={{ marginBottom: 10 }}>
                              {dataLab.description}
                            </div>

                            <Button
                              icon="arrow-right"
                              type="primary"
                              onClick={() =>
                                history.push(`/datalab/${dataLab.id}`, {
                                  restrictedView: true
                                })
                              }
                            >
                              Open
                            </Button>

                            {_.get(dataLab, "permitted_users", []).length >
                              0 && (
                              <Button
                                style={{ marginLeft: 10 }}
                                icon="lock"
                                onClick={() =>
                                  this.setState({
                                    accessList: {
                                      visible: true,
                                      users: dataLab.permitted_users,
                                      name: dataLab.name,
                                      permission: dataLab.permission
                                    }
                                  })
                                }
                              >
                                Access list (
                                {_.get(dataLab, "permitted_users", []).length})
                              </Button>
                            )}
                          </Card>
                        </List.Item>
                      )}
                    />
                  )}
                </div>
              </div>
            </Panel>
          ))}
        </Collapse>
      </div>
    );
  };

  render() {
    const { history } = this.props;
    const {
      loadingDashboard,
      dashboard,
      container,
      sharing,
      lti,
      accessList,
      terms,
      currentTerms,
      loadingTerms
    } = this.state;

    const termIds = currentTerms.length === 0 ? [] : currentTerms.map(term => term.id);

    return (
      <ContainerContext.Provider
        value={{
          fetchDashboard: this.fetchDashboard,
          history
        }}
      >
        <div className="container">
          <Content className="wrapper">
            <Layout className="layout">
              <Content className="content">
                {loadingTerms ? (
                  <Spin size="large" />
                ) : (
                  <div>
                    <div style={{ marginBottom: 20 }}>
                      {["admin", "instructor"].includes(
                        sessionStorage.getItem("group")
                      ) && (
                        <Button
                          style={{ minWidth: '170px' }}
                          onClick={() => this.openModal({ type: "container" })}
                          type="primary"
                          icon="plus"
                          size="large"
                        >
                          New Container
                        </Button>
                      )}

                      {sessionStorage.getItem("group") === "admin" && (
                        <Button
                          onClick={() => history.push("/administration")}
                          type="primary"
                          icon="setting"
                          size="large"
                          style={{ minWidth: '170px', marginLeft: "10px" }}
                        >
                          Administration
                        </Button>
                      )}
                    </div>

                    <Select
                      mode="multiple"
                      style={{ width: '350px', marginBottom: '20px' }}
                      placeholder="Select filters"
                      value={termIds}
                      onChange={(value) => {
                        const { terms } = this.state;
                        let newCurrentTerms = null;
                        if (value.includes('_all')) newCurrentTerms = terms;
                        else if (value.includes('_none')) newCurrentTerms = [];
                        else newCurrentTerms = terms.filter(term => value.includes(term.id));
                        this.setState({ currentTerms: newCurrentTerms }, () => {
                          localStorage.setItem('currentTerms', JSON.stringify(newCurrentTerms));
                          this.fetchDashboard();
                        });
                      }}
                    >
                      <OptGroup label="Utilities">
                        <Option value="_all">Select all</Option>
                        <Option value="_none">Reset</Option>
                      </OptGroup>
                      <OptGroup label="Terms">
                        {
                          terms.map((term, i) => (
                            <Option value={term.id} key={i}>{term.name}</Option>
                          ))
                        }
                      </OptGroup>
                    </Select>
                  </div>
                )}

                {!loadingTerms && (loadingDashboard ? (
                  <Spin size="large" />
                ) : (
                  <div>
                    <ContainerModal
                      {...container}
                      fetchDashboard={this.fetchDashboard}
                      updateAccordionKey={accordionKey => {
                        this.setState({ accordionKey, tabKey: "datasources" });
                        sessionStorage.setItem("accordionKey", accordionKey);
                        sessionStorage.setItem("tabKey", "datasources");
                      }}
                      closeModal={() => this.closeModal("container")}
                      terms={terms}
                    />

                    <ContainerShare
                      {...sharing}
                      fetchDashboard={this.fetchDashboard}
                      closeModal={() => this.closeModal("sharing")}
                    />

                    <Modal
                      visible={lti.visible}
                      title="Bind LTI resource"
                      onCancel={() =>
                        Modal.confirm({
                          title: "Cancel resource binding",
                          content:
                            "Are you sure you do not want to bind this resource to a container?",
                          onOk: () => this.setState({ lti: { visible: false } })
                        })
                      }
                      onOk={this.bindResource}
                      confirmLoading={lti.binding}
                    >
                      <p>
                        The LTI resource you have come from has not yet been
                        bound to a container. Choose a container from the list
                        below:
                      </p>
                      <Select
                        style={{ width: "100%" }}
                        placeholder="Choose a container"
                        value={lti.container}
                        onChange={container =>
                          this.setState({ lti: { ...lti, container } })
                        }
                      >
                        {dashboard
                          .filter(container => !container.lti_resource)
                          .map(container => (
                            <Select.Option key={container.id}>
                              {container.code}
                            </Select.Option>
                          ))}
                      </Select>
                    </Modal>

                    <AccessListModal
                      {...accessList}
                      closeModal={() =>
                        this.setState({ accessList: { visible: false } })
                      }
                    />
                    {dashboard.length > 0 ? (
                      this.ContainerList()
                    ) : sessionStorage.getItem("group") === "user" ? (
                      <h2>
                        You have not received any correspondence via OnTask.
                      </h2>
                    ) : (
                      <h2>
                        <Icon type="info-circle-o" className="info_icon" />
                        Get started by creating your first container or selecting a filter.
                      </h2>
                    )}
                  </div>
                ))}
              </Content>
            </Layout>
          </Content>
        </div>
      </ContainerContext.Provider>
    );
  }
}

export default Dashboard;
