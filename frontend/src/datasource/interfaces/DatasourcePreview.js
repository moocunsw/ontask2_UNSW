import React from "react";
import { Table, Button } from "antd";

import apiRequest from "../../shared/apiRequest";

class DatasourcePreview extends React.Component {
  state = { exporting: false };

  exportToCSV = () => {
    const { datasource } = this.props;
    const { id } = datasource;

    this.setState({ exporting: true });

    apiRequest(`/datasource/${id}/csv/`, {
      method: "POST",
      onSuccess: () => {
        this.setState({ exporting: false });
      },
      onError: () => this.setState({ exporting: false })
    });
  };

  render() {
    const { datasource } = this.props;
    const { exporting } = this.state;
    const { data } = datasource;

    const columns = Object.keys(data[0]).map(k => {
      return { title: k, dataIndex: k };
    });

    return (
      <div>
        <div
          style={{ display: "flex", alignItems: "center", marginBottom: 15 }}
        >
          <Button
            size="large"
            onClick={this.exportToCSV}
            type="primary"
            icon="export"
            loading={exporting}
          >
            Export to CSV
          </Button>

          <div style={{ marginLeft: 10 }}>
            Number of records: <strong>{data.length}</strong>
          </div>
        </div>

        <Table
          rowKey={(record, index) => index}
          columns={columns}
          dataSource={data}
          pagination={{ position: 'both', defaultPageSize: 10, showSizeChanger: true, pageSizeOptions: ['10', '25', '50']}}
        />
      </div>
    );
  }
}

export default DatasourcePreview;
