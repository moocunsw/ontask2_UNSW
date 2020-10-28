import React from "react";
import { Modal, Spin, Table, Tag, Icon } from "antd";

let number = 0;

class AdminStepModal extends React.Component {
  renderTable = () => {
    const { dataLab, dataLabs, datasources } = this.props;
    if (
      dataLab === undefined ||
      dataLabs === undefined ||
      datasources === undefined
    )
      return;
    const columns = [
      {
        title: "Name",
        dataIndex: "name",
        key: "name",
        // sorter: (a, b) => a.name.localeCompare(b.name),
        defaultSortOrder: "ascend",
        render: (text, record) => {
          if (record.type === "datasource") {
            const datasource = datasources.find(
              (datasource) => datasource.id === record.datasource.id
            );
            const dataLab = dataLabs.find(
              (dataLab) => dataLab.id === record.datasource.id
            );
            // if (dataLab != undefined) {
            return (
              <p>{datasource ? datasource.name : dataLab.name}</p>
            );
            // }
          } else if (record.type === "form") {
            return (
              <p>{record.form.name}</p>
            );
          } else if (record.type === "computed") {
            return "Computed Field"
          } return null;
        },
      },
      {
        title: "Type",
        dataIndex: "type",
        key: "type",
        render: (text, record) => {
          if (record.type === "datasource") {
            return (
              <Tag color="blue" style={{ margin: 3 }}>
                <Icon type="database" style={{ marginRight: 5 }} />
                Datasource
              </Tag>
            );
            // }
          } else if (record.type === "form") {
            return (
              <Tag color="purple" style={{ margin: 3 }}>
                <Icon type="edit" style={{ marginRight: 5 }} />
                Form
              </Tag>
            );
          } else if (record.type === "computed") {
            return (
              <Tag color="green" style={{ margin: 3 }}>
                <Icon type="calculator" style={{ marginRight: 5 }} />
                Computed
              </Tag>
            );
          }
          return null;
        },
      },
    ];

    return (
      <Table
        bordered
        dataSource={dataLab.steps}
        columns={columns}
        rowKey={(record) => {
          if (record.type === "datasource") return record.datasource.id;
          else if (record.type === "form") return record.form.name;
          else {
            number += 1;
            return number;
          }
        }}
        locale={{
          emptyText: "No DataLabs have been created yet",
        }}
        pagination={{
          size: "small",
          pageSize: 25,
          showSizeChanger: true,
          pageSizeOptions: ["10", "25", "50", "100"],
        }}
      />
    );
  };

  render() {
    const {
      loading,
      dataLab,
      visible,
      onCancel,
      dataLabs,
      datasources,
    } = this.props;

    return (
      <Modal visible={visible} onCancel={onCancel} width="80%">
        <div>
          <div>
            <h1>{dataLab.name}</h1>
          </div>
          {this.renderTable()}
        </div>
      </Modal>
    );
  }
}

export default AdminStepModal;
