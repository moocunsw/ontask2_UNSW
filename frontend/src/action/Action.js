import React from "react";
import { bindActionCreators } from "redux";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { Switch, Route, Redirect } from "react-router-dom";
import { Layout, Breadcrumb, Icon, Spin, Menu } from "antd";

import * as ActionActionCreators from "./ActionActions";

import Compose from "./interfaces/Compose";
import Email from "./interfaces/Email";
import Feedback from "./interfaces/Feedback";
// import StaticPage from "./interfaces/StaticPage";

import queryString from "query-string";

import "./Action.css";

const { Content, Sider } = Layout;

class Action extends React.Component {
  constructor(props) {
    super(props);
    const { dispatch } = props;

    this.boundActionCreators = bindActionCreators(
      ActionActionCreators,
      dispatch
    );

    this.state = {
      isFetching: true
    };
  }

  componentWillMount() {
    const { location, match } = this.props;

    const isFeedbackForm = location.pathname.split("/")[3] === "feedback";
    const actionId = match.params.id;
    const jobId = queryString.parse(window.location.search).job;

    if (isFeedbackForm) {
      this.setState({ isFeedbackForm });

      this.boundActionCreators.fetchFeedback({
        actionId,
        jobId,
        onError: () => this.setState({ isFetching: false }),
        onSuccess: feedback =>
          this.setState({
            isFetching: false,
            feedback: { ...feedback, actionId, jobId }
          })
      });
    } else {
      this.boundActionCreators.fetchAction({
        actionId,
        onError: () => this.setState({ isFetching: false }),
        onSuccess: action => this.setState({ isFetching: false, action })
      });
    }
  }

  updateAction = action => {
    this.setState({ action });
  };

  render() {
    const { match, location } = this.props;
    const { isFetching, action, isFeedbackForm, feedback } = this.state;

    return (
      <div className={`action ${isFeedbackForm && "is_feedback_form"}`}>
        <Content className="wrapper">
          {!isFeedbackForm && (
            <Breadcrumb className="breadcrumbs">
              <Breadcrumb.Item>
                <Link to="/">Dashboard</Link>
              </Breadcrumb.Item>
              <Breadcrumb.Item>
                <Link to="/containers">Containers</Link>
              </Breadcrumb.Item>
              <Breadcrumb.Item>Action</Breadcrumb.Item>
            </Breadcrumb>
          )}

          <Layout className="layout">
            <Content className="content">
              <Layout className="content_body">
                {!isFeedbackForm && (
                  <Sider width={200}>
                    <Menu
                      mode="inline"
                      selectedKeys={[location.pathname.split("/")[3]]}
                      style={{ height: "100%" }}
                    >
                      <Menu.Item key="back">
                        <Link to="/containers">
                          <Icon type="arrow-left" />
                          <span>Back to containers</span>
                        </Link>
                      </Menu.Item>

                      <Menu.Divider />

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

                      <Menu.Item key="static" disabled>
                        <Link to={`${match.url}/static`}>
                          <Icon type="link" />
                          <span>Static page</span>
                          {/* <Tag style={{ marginLeft: 5 }} color="red" size="small">OFF</Tag> */}
                        </Link>
                      </Menu.Item>
                    </Menu>
                  </Sider>
                )}

                <Content className="content">
                  <h1>{action && action.name}</h1>

                  {isFetching ? (
                    <Spin size="large" />
                  ) : (
                    <Switch>
                      <Redirect
                        exact
                        from={match.url}
                        to={`${match.url}/compose`}
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
                        path={`${match.url}/feedback`}
                        render={props => (
                          <Feedback {...props} feedback={feedback} />
                        )}
                      />

                      {/* <Route
                        path={`${match.url}/static`}
                        component={StaticPage}
                      /> */}
                    </Switch>
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

export default connect()(Action);
