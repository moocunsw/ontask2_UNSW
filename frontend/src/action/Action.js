import React from "react";
import { Link } from "react-router-dom";
import { Switch, Route, Redirect } from "react-router-dom";
import { Layout, Icon, Spin, Menu } from "antd";
import queryString from "query-string";
import _ from "lodash";

import Compose from "./interfaces/Compose";
import Email from "./interfaces/Email";
import Feedback from "./interfaces/Feedback";
import Settings from "./interfaces/ActionSettings";
import EmailHistory from './interfaces/EmailHistory'
// import StaticPage from "./interfaces/StaticPage";

import apiRequest from "../shared/apiRequest";

import "./Action.css";

const { Content, Sider } = Layout;

class Action extends React.Component {
  state = { fetching: true };

  componentWillMount() {
    const { match, isFeedbackForm, location, history } = this.props;

    const actionId = match.params.id;
    const jobId = queryString.parse(window.location.search).job;
    const emailId = queryString.parse(window.location.search).email;

    const containerId = _.get(location, "state.containerId");

    if (isFeedbackForm) {
      apiRequest(`/feedback/${actionId}/?job=${jobId}&email=${emailId}`, {
        method: "GET",
        isAuthenticated: false,
        onSuccess: feedback =>
          this.setState({
            fetching: false,
            feedback: { ...feedback, actionId, jobId, emailId }
          }),
        onError: () => this.setState({ fetching: false })
      });
    } else if (containerId) {
      // User pressed "Create Action", as the containerId is only set in the
      // location state when the navigation occurs
      this.setState({ fetching: false });
    } else if (match.params.id) {
      apiRequest(`/workflow/${actionId}/`, {
        method: "GET",
        onSuccess: action => this.setState({ fetching: false, action }),
        onError: () => this.setState({ fetching: false })
      });
    } else {
      // The user must have cold-loaded the URL, so we have no container to reference
      // Therefore redirect the user back to the container list
      history.replace("/dashboard");
    }
  }

  updateAction = action => {
    this.setState({ action });
  };

  render() {
    const { history, match, location, isFeedbackForm } = this.props;
    const { fetching, action, feedback } = this.state;

    const selectedId = match.params.id;

    return (
      <div className={`action ${isFeedbackForm && "is_feedback_form"}`}>
        <Content className="wrapper">
          <Layout className="layout">
            <Content className="content">
              <Layout className="content_body">
                {!isFeedbackForm && selectedId && (
                  <Sider width={200}>
                    <Menu
                      mode="inline"
                      selectedKeys={[location.pathname.split("/")[3]]}
                      style={{ height: "100%" }}
                    >
                      <Menu.Item key="back">
                        <Link to="/dashboard">
                          <Icon type="arrow-left" />
                          <span>Back to dashboard</span>
                        </Link>
                      </Menu.Item>

                      <Menu.Divider />

                      <Menu.Item key="settings">
                        <Link to={`${match.url}/settings`}>
                          <Icon type="setting" />
                          <span>Settings</span>
                        </Link>
                      </Menu.Item>

                      <Menu.Item key="compose">
                        <Link to={`${match.url}/compose`}>
                          <Icon type="form" />
                          <span>Compose</span>
                        </Link>
                      </Menu.Item>

                      <Menu.Item key="email">
                        <Link to={`${match.url}/email`}>
                          <Icon type="mail" />
                          <span>Email</span>
                        </Link>
                      </Menu.Item>

                      <Menu.Item key="email_history">
                        <Link to={`${match.url}/email_history`}>
                          <Icon type="history"/>
                          <span>Email History</span>
                        </Link>
                      </Menu.Item>

                      <Menu.Item key="static" disabled>
                        <Link to={`${match.url}/static`}>
                          <Icon type="link" />
                          <span>Static Page</span>
                          {/* <Tag style={{ marginLeft: 5 }} color="red" size="small">OFF</Tag> */}
                        </Link>
                      </Menu.Item>
                    </Menu>
                  </Sider>
                )}

                <Content className="content">
                  {fetching ? (
                    <Spin size="large" />
                  ) : (
                    <div>
                      {isFeedbackForm ? (
                        <Feedback feedback={feedback} />
                      ) : action ? (
                        <div>
                          <h1>{action.name}</h1>

                          <Switch>
                            <Redirect
                              exact
                              from={match.url}
                              to={`${match.url}/settings`}
                            />

                            <Route
                              path={`${match.url}/settings`}
                              render={props => (
                                <Settings
                                  {...props}
                                  action={action}
                                  updateAction={this.updateAction}
                                />
                              )}
                            />

                            <Route
                              path={`${match.url}/compose`}
                              render={props => (
                                <Compose
                                  {...props}
                                  action={action}
                                  updateAction={this.updateAction}
                                />
                              )}
                            />

                            <Route
                              path={`${match.url}/email`}
                              render={props => (
                                <Email
                                  {...props}
                                  action={action}
                                  updateAction={this.updateAction}
                                />
                              )}
                            />
                            <Route
                              path={`${match.url}/email_history`}
                              render={props => (
                                <EmailHistory
                                  {...props}
                                  action={action}
                                  updateAction={this.updateAction}
                                />
                              )}
                            />
                          </Switch>
                        </div>
                      ) : (
                        <div>
                          <Link
                            to="/dashboard"
                            style={{
                              display: "inline-block",
                              marginBottom: 20
                            }}
                          >
                            <Icon
                              type="arrow-left"
                              style={{ marginRight: 5 }}
                            />
                            <span>Back to dashboard</span>
                          </Link>

                          <h1>Create Action</h1>

                          <Settings
                            match={match}
                            history={history}
                            location={location}
                            updateAction={this.updateAction}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </Content>
              </Layout>
            </Content>
          </Layout>
        </Content>
      </div>
    );
  }
}

export default Action;
