import React from "react";
import { Tooltip, Button, Modal, notification, Table, Tag, Drawer } from "antd";

import apiRequest from "../../shared/apiRequest";
import ContainerContext from "../ContainerContext";

import moment from "moment";

const confirm = Modal.confirm;

const TYPEMAP = {
  mysql: "MySQL",
  postgresql: "PostgreSQL",
  xlsXlsxFile: "Excel file",
  csvTextFile: "CSV/text file",
  s3BucketFile: "S3 bucket file",
  sqlite: "SQLite",
  mssql: "MSSQL"
};

class DatasourceTab extends React.Component {
  static contextType = ContainerContext;

  state = { deleting: {}, refreshing: {}, previewing: {}, drawer: {} };

  deleteDatasource = datasourceId => {
    const { fetchDashboard } = this.context;

    confirm({
      title: "Confirm datasource deletion",
      content: "Are you sure you want to delete this datasource?",
      okText: "Continue with deletion",
      okType: "danger",
      cancelText: "Cancel",
      onOk: () => {
        this.setState({
          deleting: { [datasourceId]: true }
        });

        apiRequest(`/datasource/${datasourceId}/`, {
          method: "DELETE",
          onError: error => {
            this.setState({ deleting: { [datasourceId]: false } });
            notification["error"]({
              message: "Datasource deletion failed",
              description: error
            });
          },
          onSuccess: () => {
            this.setState({ deleting: { [datasourceId]: false } });
            fetchDashboard();
            notification["success"]({
              message: "Datasource deleted",
              description: "The datasource was successfully deleted."
            });
          }
        });
      }
    });
  };

  forceRefresh = datasourceId => {
    const { fetchDashboard } = this.context;

    this.setState({
      refreshing: { [datasourceId]: true }
    });

    apiRequest(`/datasource/${datasourceId}/force_refresh/`, {
      method: "POST",
      onError: error => {
        this.setState({ refreshing: { [datasourceId]: false } });
        notification["error"]({
          message: "Data refresh failed",
          description: error
        });
      },
      onSuccess: () => {
        this.setState({ refreshing: { [datasourceId]: false } });
        fetchDashboard();
        notification["success"]({
          message: "Datasource data refreshed",
          description: "The datasource data was successfully refreshed."
        });
      }
    });
  };

  previewDatasource = datasourceId => {
    const { previewing } = this.state;

    this.setState({ previewing: { ...previewing, [datasourceId]: true } });

    apiRequest(`/datasource/${datasourceId}/`, {
      method: "GET",
      onSuccess: datasource =>
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
                  columns={Object.keys(datasource.data[0]).map(k => {
                    return { title: k, dataIndex: k };
                  })}
                  dataSource={datasource.data}
                  pagination={{ position: 'both', defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50']}}
                />
              </div>
            )
          },
          previewing: { ...previewing, [datasourceId]: false }
        })
    });
  };

  render() {
    const { containerId, datasources } = this.props;
    const { deleting, refreshing, previewing, drawer } = this.state;
    const { history } = this.context;

    const canScheduleUpdates = dbType =>
      ["mysql", "postgresql", "sqlite", "mssql", "s3BucketFile"].includes(
        dbType
      );

    const columns = [
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        sorter: (a, b) => a.name.localeCompare(b.name),
        defaultSortOrder: "ascend"
      },
      {
        title: "Type",
        dataIndex: "connection.dbType",
        key: "type",
        render: dbType => TYPEMAP[dbType],
        filters: Object.entries(TYPEMAP)
          .map(entry => ({
            text: entry[1],
            value: entry[0]
          }))
          .filter(filter =>
            datasources.some(
              datasource => datasource.connection.dbType === filter.value
            )
          ),
        onFilter: (value, record) => record.connection.dbType === value,
        sorter: (a, b) => a.connection.dbType.localeCompare(b.connection.dbType)
      },
      {
        title: "Data last updated",
        dataIndex: "lastUpdated",
        key: "lastUpdated",
        render: lastUpdated => moment(lastUpdated).format("DD/MM/YYYY, HH:mm"),
        sorter: (a, b) =>
          moment(a.lastUpdated) > moment(b.lastUpdated) ? 1 : -1
      },
      {
        title: "Scheduled data updates",
        dataIndex: "schedule",
        key: "schedule",
        render: (schedule, datasource) => {
          return canScheduleUpdates(datasource.connection.dbType) ? (
            <div>
              {schedule ? (
                <Tag color="green" style={{ margin: 3 }}>
                  On
                </Tag>
              ) : (
                <Tag color="red" style={{ margin: 3 }}>
                  Off
                </Tag>
              )}
              <Button
                style={{ margin: 3 }}
                size="small"
                icon="thunderbolt"
                loading={refreshing[datasource.id] || false}
                onClick={() => this.forceRefresh(datasource.id)}
              >
                Refresh now
              </Button>
            </div>
          ) : (
            <Tag>Not applicable</Tag>
          );
        },
        filters: [
          {
            text: "On",
            value: true
          },
          {
            text: "Off",
            value: false
          }
        ],
        onFilter: (value, datasource) =>
          canScheduleUpdates(datasource.connection.dbType) &&
          (!!datasource.schedule === (value === "true") ||
            !datasource.schedule === (value === "false"))
      },
      {
        title: "Actions",
        key: "actions",
        render: (text, datasource) => {
          return (
            <div>
              <Tooltip title="Edit datasource settings">
                <Button
                  style={{ margin: 3 }}
                  icon="setting"
                  onClick={() => {
                    history.push(`/datasource/${datasource.id}/settings`);
                  }}
                />
              </Tooltip>

              <Tooltip
                title={
                  canScheduleUpdates(datasource.connection.dbType)
                    ? "Configure scheduled data updates"
                    : "This datasource type does not support scheduled data updates"
                }
              >
                <Button
                  style={{ margin: 3 }}
                  disabled={!canScheduleUpdates(datasource.connection.dbType)}
                  icon="calendar"
                  onClick={() => {
                    history.push(`/datasource/${datasource.id}/schedule`);
                  }}
                />
              </Tooltip>

              <Tooltip title="Preview datasource data">
                <Button
                  style={{ margin: 3 }}
                  icon="database"
                  loading={previewing[datasource.id] || false}
                  onClick={() => this.previewDatasource(datasource.id)}
                />
              </Tooltip>

              <Tooltip title="Delete datasource">
                <Button
                  style={{ margin: 3 }}
                  type="danger"
                  icon="delete"
                  loading={deleting[datasource.id] || false}
                  onClick={() => this.deleteDatasource(datasource.id)}
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
          onClick={() =>
            history.push({
              pathname: "/datasource",
              state: { containerId }
            })
          }
        >
          Add Datasource
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
          dataSource={datasources}
          columns={columns}
          rowKey="id"
          locale={{
            emptyText: "No datasources have been added yet"
          }}
        />
      </div>
    );
  }
}

export default DatasourceTab;
