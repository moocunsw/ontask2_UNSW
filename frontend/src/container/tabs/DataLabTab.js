import React from "react";
import {
  Icon,
  Tooltip,
  Button,
  Modal,
  notification,
  Table,
  Tag,
  Drawer,
} from "antd";

import apiRequest from "../../shared/apiRequest";
import ContainerContext from "../ContainerContext";
import AdminStepModal from "./modals/AdminStepModal";

const confirm = Modal.confirm;

class DataLabTab extends React.Component {
  static contextType = ContainerContext;

  state = { filter: null, deleting: {}, cloning: {}, drawer: {}, visibleAdminStepModal: false, stepDataLab: {}, stepLoading: false };

  deleteDataLab = (dataLabId) => {
    const { fetchDashboard } = this.context;

    confirm({
      title: "Confirm DataLab deletion",
      content:
        "All associated actions will be irrevocably deleted with the DataLab.",
      okText: "Continue with deletion",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        this.setState({
          deleting: { [dataLabId]: true },
        });

        apiRequest(`/datalab/${dataLabId}/`, {
          method: "DELETE",
          onSuccess: () => {
            this.setState({ deleting: { [dataLabId]: false } });
            fetchDashboard();
            notification["success"]({
              message: "DataLab deleted",
              description: "The DataLab was successfully deleted.",
            });
          },
          onError: (error) => {
            this.setState({ deleting: { [dataLabId]: false } });
            notification["error"]({
              message: "DataLab deletion failed",
              description: error,
            });
          },
        });
      },
    });
  };

  cloneDataLab = (datalabId) => {
    const { fetchDashboard } = this.context;

    confirm({
      title: "Confirm DataLab clone",
      content: "Are you sure you want to clone this DataLab?",
      onOk: () => {
        this.setState({
          cloning: { [datalabId]: true },
        });

        apiRequest(`/datalab/${datalabId}/clone_datalab/`, {
          method: "POST",
          onSuccess: () => {
            this.setState({ cloning: { [datalabId]: false } });
            fetchDashboard();
            notification["success"]({
              message: "DataLab cloned",
              description: "The DataLab was successfully cloned.",
            });
          },
          onError: (error) => {
            this.setState({ cloning: { [datalabId]: false } });
            notification["error"]({
              message: "DataLab cloning failed",
              description: error,
            });
          },
        });
      },
    });
  };

  previewDatasource = (objectId, isDatasource) => {
    apiRequest(`/${isDatasource ? "datasource" : "datalab"}/${objectId}/`, {
      method: "GET",
      onSuccess: (datasource) =>
        this.setState({
          drawer: {
            title: datasource.name,
            visible: true,
            content: (
              <div>
                <div style={{ marginBottom: 20 }}>
                  Number of records: <strong>{datasource.data.length}</strong>
                </div>

                <Table
                  style={{ maxHeight: "80vh" }}
                  rowKey={(record, index) => index}
                  columns={Object.keys(datasource.data[0]).map((k) => {
                    return { title: k, dataIndex: k };
                  })}
                  dataSource={datasource.data}
                />
              </div>
            ),
          },
        }),
    });
  };

  previewForm = (form) => {
    this.setState({
      drawer: {
        title: form.name,
        visible: true,
        content: (
          <Table
            rowKey={(record, index) => index}
            columns={
              form.data.length > 0
                ? Object.keys(form.data[0]).map((k) => {
                    return { title: k, dataIndex: k };
                  })
                : []
            }
            dataSource={form.data}
          />
        ),
      },
    });
  };

  openAdminStepsModal = async (datalab) => {
    this.setState({ visibleAdminStepModal: true, stepDataLab: datalab })
    console.log(datalab)
    // make api call here
    // this.setState({ stepDataLab: {}, loading: false })
  }

  /* 
    To check if another datalab is dependent on this one before deleting.
  */
  checkDependencies = (dataLabId) => {
    const { dataLabs } = this.props;
    for (let dataLab of dataLabs) {
      for (let step of dataLab.steps) {
        if (step.datasource) {
          if (step.datasource.id == dataLabId) return true;
        }
      }
    }
    return false;
  };

  render() {
    const { containerId, dataLabs, datasources } = this.props;
    const { deleting, cloning, drawer } = this.state;
    const { history } = this.context;
    const isAdmin = sessionStorage.getItem("group") === "admin";
    const columns = [
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        sorter: (a, b) => a.name.localeCompare(b.name),
        defaultSortOrder: "ascend",
      },
      {
        title: "Modules",
        dataIndex: "steps",
        key: "modules",
        render: (steps) => {
          return steps.map((step, stepIndex) => {
            if (step.type === "datasource") {
              const datasource = datasources.find(
                (datasource) => datasource.id === step.datasource.id
              );
              const dataLab = dataLabs.find(
                (dataLab) => dataLab.id === step.datasource.id
              );
              // if (dataLab != undefined) {
              return (
                <Tag
                  color="blue"
                  key={stepIndex}
                  style={{ margin: 3 }}
                  onClick={() =>
                    this.previewDatasource(step.datasource.id, !!datasource)
                  }
                >
                  <Icon type="database" style={{ marginRight: 5 }} />
                  {datasource ? datasource.name : dataLab.name}
                </Tag>
              );
              // }
            } else if (step.type === "form") {
              return (
                <Tag
                  color="purple"
                  key={stepIndex}
                  style={{ margin: 3 }}
                  onClick={() => this.previewForm(step.form)}
                >
                  <Icon type="edit" style={{ marginRight: 5 }} />
                  {step.form.name}
                </Tag>
              );
            } else if (step.type === "computed") {
              return (
                <Tag color="green" key={stepIndex} style={{ margin: 3 }}>
                  <Icon type="calculator" style={{ marginRight: 5 }} />
                  Computed
                </Tag>
              );
            }
            return null;
          });
        },
      },
      {
        title: "Actions",
        key: "actions",
        render: (text, dataLab, steps) => (
          <div>
            <Tooltip title="Edit DataLab settings">
              <Button
                style={{ margin: 3 }}
                icon="setting"
                onClick={() => {
                  history.push(`/datalab/${dataLab.id}/settings`);
                }}
              />
            </Tooltip>

            <Tooltip title="View DataLab data">
              <Button
                style={{ margin: 3 }}
                icon="table"
                onClick={() => {
                  history.push(`/datalab/${dataLab.id}/data`);
                }}
              />
            </Tooltip>

            <Tooltip title="Clone DataLab">
              <Button
                style={{ margin: 3 }}
                icon="copy"
                loading={dataLab.id in cloning && cloning[dataLab.id]}
                onClick={() => this.cloneDataLab(dataLab.id)}
              />
            </Tooltip>

            {isAdmin ? (
              <Tooltip title="View Steps Only">
                <Button
                  onClick={() => {
                    // make request to server
                    this.openAdminStepsModal(dataLab)
                  }}
                >
                  <Icon style={{color: 'orange'}} type="exclamation-circle"/>
                </Button>
              </Tooltip>
            ) : null}
            
            <Tooltip title="Delete DataLab">
              <Button
                style={{ margin: 3 }}
                type="danger"
                icon="delete"
                loading={dataLab.id in deleting && deleting[dataLab.id]}
                onClick={() => {
                  // check if this datalab.id is a part of any of the other sources
                  if (!this.checkDependencies(dataLab.id))
                    this.deleteDataLab(dataLab.id);
                  else {
                    notification["error"]({
                      message: "DataLab deletion failed",
                      description: `Other datalabs are dependent on "${dataLab.name}". Delete the others first.`,
                    });
                  }
                  // this.deleteDataLab(dataLab.id)
                }}
              />
            </Tooltip>
          </div>
        ),
      },
    ];

    return (
      <div>
        <Button
          style={{ marginBottom: 15 }}
          type="primary"
          icon="plus"
          onClick={() =>
            history.push({
              pathname: "/datalab",
              state: { containerId },
            })
          }
        >
          Create DataLab
        </Button>

        <Drawer
          className="datalab-drawer"
          title={drawer.title}
          placement="right"
          onClose={() => this.setState({ drawer: { visible: false } })}
          visible={drawer.visible}
        >
          {drawer.content}
        </Drawer>

        <Table
          bordered
          dataSource={dataLabs}
          columns={columns}
          rowKey="id"
          locale={{
            emptyText: "No DataLabs have been created yet",
          }}
        />
        
        <AdminStepModal 
          loading={this.state.stepLoading}
          dataLab={this.state.stepDataLab}
          dataLabs={this.props.dataLabs}
          datasources={this.props.datasources}
          visible={this.state.visibleAdminStepModal}
          onCancel={() => this.setState({ stepLoading: false, stepDataLab: {}, visibleAdminStepModal: false })}
        />
      </div>
    );
  }
}

export default DataLabTab;
