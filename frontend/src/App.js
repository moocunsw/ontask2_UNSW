import React from "react";
import { Switch, Route, Redirect } from "react-router-dom";
import { withRouter } from "react-router";
import { Layout, Tooltip, Button } from "antd";
import queryString from "query-string";
import _ from "lodash";
import preval from "preval.macro";

import logo from "./img/logo.png";

import { requestToken } from "./auth/AuthActions";

import Login from "./auth/Login";
import Dashboard from "./container/Dashboard";
import Datasource from "./datasource/Datasource";
import DataLab from "./dataLab/DataLab";
import Action from "./action/Action";
import Administration from "./administration/Administration";
import Form from "./form/Form";
import Forbidden from "./error/Forbidden";
import ServerError from "./error/ServerError";

import "./App.css";

const { Header, Footer } = Layout;

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = { hasToken: false };
  }

  logout = isImpersonating => {
    const { history } = this.props;

    if (isImpersonating) {
      sessionStorage.setItem("token", sessionStorage.getItem("token_copy"));
      sessionStorage.setItem("email", sessionStorage.getItem("email_copy"));
      sessionStorage.setItem("name", sessionStorage.getItem("name_copy"));
      sessionStorage.setItem("group", sessionStorage.getItem("group_copy"));

      sessionStorage.removeItem("token_copy");
      sessionStorage.removeItem("email_copy");
      sessionStorage.removeItem("name_copy");
      sessionStorage.removeItem("group_copy");
      history.push("/administration/users");
    } else {
      sessionStorage.removeItem("token");
      sessionStorage.removeItem("email");
      sessionStorage.removeItem("name");
      sessionStorage.removeItem("group");
      this.setState({ hasToken: false });
      history.push("/");
    }
  };

  componentWillMount() {
    this.setState({
      hasToken: sessionStorage.getItem("token") ? true : false
    });

    const queryStrings = queryString.parse(window.location.search);
    const { tkn, lti, container } = queryStrings;

    // Form Token
    const form_tkn = queryStrings.token;

    if (tkn)
      requestToken(tkn, response => {
        sessionStorage.setItem("token", response.token);
        sessionStorage.setItem("email", response.email);
        sessionStorage.setItem("name", response.name);
        sessionStorage.setItem("group", response.group);
        this.setState({
          hasToken: true,
          ltiResourceId: lti,
          ltiContainerId: container
        });
      });
    else if (form_tkn) {
      // sessionStorage.setItem("token", form_tkn);
      // sessionStorage.setItem("email", 'fake_email');
      // sessionStorage.setItem("name", 'fake_name');
      // sessionStorage.setItem("group", 'fake_group');
      this.setState({
        hasToken: true,
        ltiResourceId: lti,
        ltiContainerId: container
      });
    }
    else {
      this.setState({ ltiResourceId: lti, ltiContainerId: container });
    }
  }

  AuthenticatedRoute = ({
    component: Component,
    componentProps,
    feedbackForm,
    ...routeProps
  }) => {
    const { location } = this.props;
    const { hasToken } = this.state;

    const shouldRedirectToAAF =
      feedbackForm && process.env.NODE_ENV !== "development";

    return (
      <Route
        {...routeProps}
        render={props =>
          hasToken ? (
            <Component {...props} {...componentProps} />
          ) : (
            <Redirect
              to={{
                pathname: "/",
                state: {
                  redirectTo: location.pathname + location.search,
                  shouldRedirectToAAF
                }
              }}
            />
          )
        }
      />
    );
  };

  render() {
    const { location } = this.props;
    const { hasToken, ltiResourceId, ltiContainerId } = this.state;

    // const pathName = location.pathname.slice(1).split("/");
    // let menuKey;
    // if (["about", "help", "contact"].includes(pathName[0])) {
    //   menuKey = pathName;
    // } else {
    //   menuKey = "dashboard";
    // }

    const redirectTo = _.get(location, "state.redirectTo");
    const shouldRedirectToAAF = _.get(location, "state.shouldRedirectToAAF");

    if (!hasToken && shouldRedirectToAAF && process.env.REACT_APP_AAF_URL)
      window.location = process.env.REACT_APP_AAF_URL;

    const isImpersonating = !!sessionStorage.getItem("token_copy");

    return (
      <Layout className="app">
        <Header className="header">
          <img src={logo} alt="OnTask" className="logo" />

          {hasToken && (
            <div className="logout">
              <span style={{ marginRight: 10 }}>
                Logged in as: <strong>{sessionStorage.getItem("name")}</strong>
              </span>

              <Tooltip title={isImpersonating ? "Switch User" : "Logout"}>
                <Button
                  icon="logout"
                  onClick={() => this.logout(isImpersonating)}
                />
              </Tooltip>
            </div>
          )}

          {/* {!feedbackForm && (
            <Menu
              mode="horizontal"
              defaultSelectedKeys={[menuKey]}
              className="navigation"
              onSelect={({ key }) =>
                history.push(
                  key === "dashboard" ? (webForm ? webForm : "/") : `/${key}`
                )
              }
            >
              <Menu.Item key="dashboard">
                {webForm ? "Form" : "Dashboard"}
              </Menu.Item>
              <Menu.Item key="about">About</Menu.Item>
              <Menu.Item key="help">Help</Menu.Item>
              <Menu.Item key="contact">Contact</Menu.Item>
            </Menu>
          )} */}
        </Header>

        <Switch>
          <Route
            exact
            path="/"
            render={() =>
              !hasToken ? (
                <Login onLogin={() => this.setState({ hasToken: true })} />
              ) : (
                <Redirect to={redirectTo ? redirectTo : "/dashboard"} />
              )
            }
          />

          {this.AuthenticatedRoute({
            path: "/dashboard",
            component: Dashboard,
            componentProps: { ltiResourceId, ltiContainerId }
          })}

          {this.AuthenticatedRoute({
            path: "/datasource/:id?",
            component: Datasource
          })}

          {this.AuthenticatedRoute({
            path: "/datalab/:id?",
            component: DataLab
          })}

          {this.AuthenticatedRoute({
            path: "/action/:id?",
            component: Action
          })}

          {this.AuthenticatedRoute({
            path: "/form/:id",
            component: Form
          })}

          {this.AuthenticatedRoute({
            path: "/administration",
            component: Administration
          })}

          <Route exact path="/forbidden" component={Forbidden} />
          <Route exact path="/error" component={ServerError} />

          <Route
            path="/feedback/:id"
            render={props => <Action {...props} isFeedbackForm />}
          />
        </Switch>

        <Footer className="footer">
          © OnTask Project 2018
          <span style={{ marginLeft: 15, color: "rgba(117, 117, 117, 0.5)" }}>
            Build date{" "}
            {preval`module.exports = new Date().toLocaleString("en-AU", {year: "numeric", month: "2-digit", day: "2-digit"});`}
          </span>
        </Footer>
      </Layout>
    );
  }
}

export default withRouter(App);
