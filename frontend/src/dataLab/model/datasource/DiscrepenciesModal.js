import React from "react";
import { Modal, Icon, Table, Radio, Button } from "antd";
import _ from "lodash";

import ModelContext from "../ModelContext";

const RadioGroup = Radio.Group;

class DiscrepenciesModal extends React.Component {
  static contextType = ModelContext;

  render() {
    const {
      visible,
      matching,
      primary,
      stepIndex,
      step,
      datasource,
      closeModal,
      exportToCSV,
      exporting
    } = this.props;
    const { form } = this.context;
    const { getFieldDecorator, setFieldsValue, getFieldValue } = form;

    getFieldDecorator(`steps[${stepIndex}].datasource.discrepencies.primary`, {
      rules: [{ required: true }],
      initialValue: !!_.get(step, "datasource.discrepencies.primary", false)
    });

    getFieldDecorator(`steps[${stepIndex}].datasource.discrepencies.matching`, {
      rules: [{ required: true }],
      initialValue: !!_.get(step, "datasource.discrepencies.matching", false)
    });

    return (
      <Modal
        className="discrepencies"
        visible={visible}
        title={
          <div className="title">
            <Icon type="exclamation-circle" />
            Resolve Match Conflict
          </div>
        }
        footer={[
          <Button
            key="export"
            type="primary"
            onClick={exportToCSV}
            loading={exporting}
          >
            Export to csv
          </Button>,
          <Button key="ok" type="primary" onClick={closeModal}>
            OK
          </Button>
        ]}
        onCancel={closeModal}
      >
        <p>
          Record mismatches have been detected between this datasource (
          {datasource}) and the DataLab. How should these discrepencies be
          handled?
        </p>

        {(primary || []).length > 0 && (
          <div className="conflict">
            <p>
              The following <strong>{primary.length}</strong> records occur in
              this datasource but not in the DataLab:
            </p>

            <Table
              size="small"
              pagination={{ size: "small", pageSize: 5 }}
              dataSource={primary.map((record, index) => ({
                key: index,
                record: record
              }))}
              columns={[
                {
                  title: "Record",
                  dataIndex: "record",
                  key: "record",
                  render: value =>
                    value ? (
                      value
                    ) : (
                      <span style={{ fontStyle: "italic" }}>NULL</span>
                    )
                }
              ]}
            />

            <RadioGroup
              className="options"
              onChange={e =>
                setFieldsValue({
                  [`steps[${stepIndex}].datasource.discrepencies.primary`]: e
                    .target.value
                })
              }
              value={getFieldValue(
                `steps[${stepIndex}].datasource.discrepencies.primary`
              )}
            >
              <Radio value={false}>Ignore</Radio>
              <Radio value={true}>Add</Radio>
            </RadioGroup>
          </div>
        )}

        {(matching || []).length > 0 && (
          <div className="conflict">
            <p>
              The following <strong>{matching.length}</strong> records occur in
              the DataLab but not in this datasource:
            </p>

            <Table
              size="small"
              pagination={{ size: "small", pageSize: 5 }}
              dataSource={matching.map((record, index) => ({
                key: index,
                record: record
              }))}
              columns={[
                {
                  title: "Record",
                  dataIndex: "record",
                  key: "record",
                  render: value =>
                    value ? (
                      value
                    ) : (
                      <span style={{ fontStyle: "italic" }}>NULL</span>
                    )
                }
              ]}
            />

            <RadioGroup
              className="options"
              onChange={e =>
                setFieldsValue({
                  [`steps[${stepIndex}].datasource.discrepencies.matching`]: e
                    .target.value
                })
              }
              value={getFieldValue(
                `steps[${stepIndex}].datasource.discrepencies.matching`
              )}
            >
              <Radio value={false}>Drop</Radio>
              <Radio value={true}>Keep</Radio>
            </RadioGroup>
          </div>
        )}
      </Modal>
    );
  }
}

export default DiscrepenciesModal;
