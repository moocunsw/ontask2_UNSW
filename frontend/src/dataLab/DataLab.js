import React from "react";
import { Switch, Route, Link, Redirect } from "react-router-dom";
import { Spin, Layout, Icon, Menu } from "antd";
import { DragDropContext } from "react-dnd";
import HTML5Backend from "react-dnd-html5-backend";
import _ from "lodash";

import "./DataLab.css";

import Model from "./model/Model";
import Data from "./data/Data";
import DataLabForm from "./form/Form";

import apiRequest from "../shared/apiRequest";

const { Content, Sider } = Layout;
const SubMenu = Menu.SubMenu;

class DataLab extends React.Component {
  state = {
    fetching: true,
    forms: [],
  };

  componentDidMount() {
    const { match, location, history } = this.props;

    const containerId = _.get(location, "state.containerId");

    // User pressed "Create DataLab", as the containerId is only set in the
    // location state when the navigation occurs
    if (containerId) {
      apiRequest(`/datalab/create/?container=${containerId}`, {
        method: "GET",
        onSuccess: ({ datasources, dataLabs }) => {
          this.setState({
            fetching: false,
            datasources,
            dataLabs
          });
        },
        onError: (error, status) => {
          if (status === 403) {
            history.replace("/forbidden");
          } else {
            history.replace("/error");
          }
        }
      });
    } else if (match.params.id) {
      // this.fetchData();
      apiRequest(`/datalab/${match.params.id}/access/`, {
        // TODO: FIX
        method: "POST",
        payload: null,
        onSuccess: selected => {
          const { datasources, dataLabs, filters } = selected;
          delete selected.datasources;
          delete selected.dataLabs;
          this.setState({
            fetching: false,
            selected,
            datasources,
            dataLabs,
            filters
          });
        },
        onError: (error, status) => {
          if (status === 403) {
            history.replace("/forbidden");
          } else {
            history.replace("/error");
          }
        }
      });
    } else {
      // The user must have cold-loaded the URL, so we have no container to reference
      // Therefore redirect the user back to the container list
      history.replace("/dashboard");
    }
  }

  updateDatalab = dataLab => {
    const { selected } = this.state;
    console.log(selected);
    this.setState({
      selected: { ...selected, ...dataLab }
    });
  };

  updateData = (index, field, value) => {
    const { data } = this.state;
    data[index][field] = value;
    this.setState({ data });
  };

  updateForms = ({ formIndex, updatedForm, isDelete }) => {
    const { selected } = this.state;
    const { forms } = selected;

    if (isDelete) {
      forms.splice(formIndex, 1);
    } else {
      if (formIndex >= 0) {
        forms[formIndex] = updatedForm;
      } else {
        forms.push(updatedForm);
      }
    }

    this.setState({ selected: { ...selected, forms } });
  };

  fetchData = (payload, setTableState) => {
    setTableState({filterOptions: payload, loading: true})
    const { match, history } = this.props;
    apiRequest(`/datalab/${match.params.id}/access/`, {
      method: "POST",
      payload: payload,
      onSuccess: selected => {
        const { datasources, dataLabs, filter_details } = selected;
        delete selected.datasources;
        delete selected.dataLabs;
        this.setState({
          fetching: false,
          selected,
          datasources,
          dataLabs,
        });
        //
        payload.pagination.total = filter_details.paginationTotal;
        setTableState({filterOptions: payload, loading: false})
      },
      onError: (error, status) => {
        setTableState({filterOptions: payload, loading: false})
        if (status === 403) {
          history.replace("/forbidden");
        } else {
          history.replace("/error");
        }
      }
    });
  }

  render() {
    const { match, history, location } = this.props;
    const { fetching, datasources, dataLabs, selected } = this.state;
    let menuKey = [location.pathname.split("/")[3]];
    if (menuKey[0] === "form") menuKey.push(location.pathname.split("/")[4]);

    // If the user does not have full permission to the datalab,
    // then steps will not be included in the response body.
    // So use steps as an indicator of has_full_permission
    const restrictedView =
      (selected && !selected.steps) ||
      _.get(location, "state.restrictedView", false);

    return (
      <div className="dataLab">
        <Content className="wrapper">
          <Layout className="layout">
            <Content className="content">
              {fetching ? (
                <Spin size="large" />
              ) : (
                <Layout className="content_body">
                  {selected && !restrictedView && (
                    <Sider width={200}>
                      <Menu
                        mode="inline"
                        selectedKeys={menuKey}
                        style={{ height: "100%" }}
                        defaultOpenKeys={["form"]}
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

                        <Menu.Item key="data">
                          <Link to={`${match.url}/data`}>
                            <Icon type="table" />
                            <span>Data</span>
                          </Link>
                        </Menu.Item>

                        <Menu.ItemGroup title="Extensions">
                          <SubMenu
                            key="form"
                            title={
                              <span>
                                <Icon type="form" />
                                <span>Forms ({selected.forms.length})</span>
                              </span>
                            }
                          >
                            <Menu.Item key="create">
                              <Link to={`${match.url}/form/create`}>
                                <span>Create new form</span>
                              </Link>
                            </Menu.Item>

                            {selected.forms.length > 0 && <Menu.Divider />}

                            {selected.forms.map(form => (
                              <Menu.Item key={form.id}>
                                <Link to={`${match.url}/form/${form.id}`}>
                                  <span>{form.name}</span>
                                </Link>
                              </Menu.Item>
                            ))}
                          </SubMenu>
                        </Menu.ItemGroup>
                      </Menu>
                    </Sider>
                  )}

                  <Content className="content" style={{ overflowY: "hidden" }}>
                    <div>
                      {(!selected || restrictedView) && (
                        <Link
                          to="/dashboard"
                          style={{
                            display: "inline-block",
                            marginBottom: 20
                          }}
                        >
                          <Icon type="arrow-left" style={{ marginRight: 5 }} />
                          <span>Back to dashboard</span>
                        </Link>
                      )}

                      <h1>{selected ? selected.name : "Create DataLab"}</h1>

                      {selected && !restrictedView && (
                        <Switch>
                          <Redirect
                            exact
                            from={match.url}
                            to={`${match.url}/settings`}
                          />

                          <Route
                            path={`${match.url}/settings`}
                            render={props => (
                              <Model
                                {...props}
                                {...selected}
                                datasources={datasources}
                                dataLabs={dataLabs}
                                selectedId={selected.id}
                                updateDatalab={this.updateDatalab}
                              />
                            )}
                          />

                          <Route
                            path={`${match.url}/data`}
                            render={props => (
                              <Data
                                {...props}
                                steps={selected.steps}
                                data={selected.data}
                                filter_details={selected.filter_details}
                                datasources={datasources}
                                dataLabs={dataLabs}
                                selectedId={selected.id}
                                updateDatalab={this.updateDatalab}
                                updateData={this.updateData}
                                fetchData={this.fetchData}
                                forms={selected.forms}
                                columns={selected.columns}
                                groupBy={selected.groupBy}
                              />
                            )}
                          />

                          <Route
                            path={`${match.url}/form/:formId`}
                            render={props => {
                              const formId = props.match.params.formId;
                              const formIndex = selected.forms.findIndex(
                                form => form.id === formId
                              );
                              return (
                                <DataLabForm
                                  {...props}
                                  columns={selected.columns}
                                  selectedId={formId !== "create" && formId}
                                  dataLabId={selected.id}
                                  containerId={selected.container}
                                  formDetails={
                                    formIndex >= 0 && selected.forms[formIndex]
                                  }
                                  updateForms={({ updatedForm, isDelete }) =>
                                    this.updateForms({
                                      formIndex,
                                      updatedForm,
                                      isDelete
                                    })
                                  }
                                  updateDatalab={this.updateDatalab}
                                  data={selected.data}
                                />
                              );
                            }}
                          />
                        </Switch>
                      )}

                      {selected && restrictedView && (
                        <Data
                          restrictedView
                          selectedId={match.params.id}
                          data={selected.data}
                          filter_details={selected.filter_details}
                          columns={selected.columns}
                          groupBy={selected.groupBy}
                          defaultGroup={selected.default_group}
                          updateDatalab={this.updateDatalab}
                          fetchData={this.fetchData}
                        />
                      )}

                      {!selected && (
                        <Model
                          history={history}
                          location={location}
                          datasources={datasources}
                          dataLabs={dataLabs}
                          updateDatalab={this.updateDatalab}
                        />
                      )}
                    </div>
                  </Content>
                </Layout>
              )}
            </Content>
          </Layout>
        </Content>
      </div>
    );
  }
}

export default DragDropContext(HTML5Backend)(DataLab);
