import React from "react";
import {
  Form,
  Button,
  Alert,
  Spin,
  Icon,
  // Tooltip,
  Divider,
  Table,
  Modal,
  Popover,
  notification
} from "antd";
import moment from "moment";
// import _ from "lodash";

// import { narrowFormItemLayout } from "../../shared/FormItemLayout";

// import SchedulerModal from "../../scheduler/SchedulerModal";
import EmailSettings from "./EmailSettings";

import apiRequest from "../../shared/apiRequest";

// const FormItem = Form.Item;

class EmailHistory extends React.Component {
  constructor(props) {
    super(props);
    const { action } = props;

    const options = [];
    action.options.modules.forEach(step => {
      if (step.type === "datasource") {
        step.fields.forEach(field => {
          options.push(field);
        });
      }
    });

    this.state = {
      index: 0,
      scheduler: { visible: false, selected: null, data: {} },
      previewing: true,
      sending: false,
      options,
      emailView: { visible: false },
      emailLocked: true,
      intervalId: null
    };

    this.dayMap = {
      mon: { order: 0, label: "Monday" },
      tue: { order: 1, label: "Tuesday" },
      wed: { order: 2, label: "Wednesday" },
      thu: { order: 3, label: "Thursday" },
      fri: { order: 4, label: "Friday" },
      sat: { order: 5, label: "Saturday" },
      sun: { order: 6, label: "Sunday" }
    };
  }

  FeedbackDetails = record => (
    <div>
      <b>Feedback provided on:</b>
      <div>{moment(record.feedback_datetime).format("DD/MM/YYYY, HH:mm")}</div>

      <Divider style={{ margin: "6px 0" }} />

      {record.list_feedback && (
        <div>
          <b>Dropdown feedback:</b>
          <div>{record.list_feedback}</div>
        </div>
      )}

      {record.list_feedback && record.textbox_feedback && (
        <Divider style={{ margin: "6px 0" }} />
      )}

      {record.textbox_feedback && (
        <div style={{ maxWidth: 400, wordBreak: "break-word" }}>
          <b>Textbox feedback:</b>
          <div>{record.textbox_feedback}</div>
        </div>
      )}
    </div>
  );

  TrackingDetails = record => (
    <div>
      <b>First tracked:</b>
      <div>{moment(record.first_tracked).format("DD/MM/YYYY, HH:mm")}</div>
      <Divider style={{ margin: "6px 0" }} />
      <b>Last tracked:</b>
      <div>
        {record.last_tracked
          ? moment(record.last_tracked).format("DD/MM/YYYY, HH:mm")
          : "N/A"}
      </div>
    </div>
  );

  EmailJobDetails = job => (
    <Table
      size="small"
      columns={[
        { title: "Recipient", dataIndex: "recipient", key: "recipient" },
        {
          title: "Feedback",
          sorter: (a, b) =>
            (a.feedback_datetime || "").localeCompare(
              b.feedback_datetime || ""
            ),
          render: (text, record) => {
            if (!job.included_feedback) return <Icon type="minus" />;

            var feedback =
              record.list_feedback && record.textbox_feedback
                ? `["${record.list_feedback}", "${record.textbox_feedback}"]`
                : record.list_feedback || record.textbox_feedback || "";

            return (
              <Popover content={this.FeedbackDetails(record)} trigger="hover">
                {feedback.length > 25
                  ? `${feedback.slice(0, 25)} ...`
                  : feedback}
              </Popover>
            );
          }
        },
        {
          title: "Tracking",
          dataIndex: "track_count",
          key: "track_count",
          sorter: (a, b) => (a.track_count > b.track_count ? 1 : -1),
          render: (count, record) =>
            count > 0 ? (
              <Popover content={this.TrackingDetails(record)} trigger="hover">
                {count}
              </Popover>
            ) : (
              <Icon type="close" />
            )
        },
        {
          title: "Content",
          dataIndex: "content",
          key: "content",
          render: (text, record) => (
            <span
              style={{ cursor: "pointer", color: "#2196F3" }}
              onClick={() =>
                this.setState({
                  emailView: {
                    visible: true,
                    recipient: record.recipient,
                    subject: job.subject,
                    text
                  }
                })
              }
            >
              View
            </span>
          )
        }
      ]}
      dataSource={job.emails}
      rowKey="email_id"
      pagination={{ size: "small", pageSize: 5 }}
    />
  );

  EmailHistory = () => {
    const { action } = this.props;
    const { emailView } = this.state;

    const onCancel = () => this.setState({ emailView: { visible: false } });

    return (
      <div>
        <Table
          size="small"
          className="email_history"
          locale={{ emptyText: "No emails have been sent for this action" }}
          columns={[
            {
              title: "Date/Time",
              dataIndex: "initiated_at",
              key: "initiated_at",
              render: text => moment(text).format("DD/MM/YYYY, HH:mm")
            },
            { title: "Type", dataIndex: "type", key: "type" },
            { title: "Subject", dataIndex: "subject", key: "subject" },
            {
              title: "Feedback",
              dataIndex: "included_feedback",
              key: "included_feedback",
              render: text =>
                text ? <Icon type="check" /> : <Icon type="close" />
            },
            {
              title: "Tracking",
              render: (text, record) => {
                const trackedCount = record.emails.filter(
                  email => !!email.first_tracked
                ).length;
                const trackedPct = Math.round(
                  (trackedCount / record.emails.length) * 100
                );
                return (
                  <span>{`${trackedCount} of ${
                    record.emails.length
                  } (${trackedPct}%)`}</span>
                );
              }
            }
          ]}
          dataSource={action.emailJobs}
          expandedRowRender={this.EmailJobDetails}
          rowKey="job_id"
          pagination={{ size: "small", pageSize: 5 }}
        />

        <Modal
          visible={emailView.visible}
          onCancel={onCancel}
          footer={
            <Button type="primary" onClick={onCancel}>
              OK
            </Button>
          }
        >
          <div className="view_email">
            <div className="field">Recipient:</div>
            <div className="value">{emailView.recipient}</div>
            <div className="field">Subject:</div>
            <div className="value">{emailView.subject}</div>
            <div className="field">Date/Time:</div>
            <div className="value">
              {moment(emailView.initiated_at).format("DD/MM/YYYY, HH:mm")}
            </div>
            <Divider />
            <div
              className="email_content"
              dangerouslySetInnerHTML={{
                __html: emailView.text
              }}
            />
          </div>
        </Modal>
      </div>
    );
  };

  render() {
    const { action, form } = this.props;
    const {
      sending,
      previewing,
      error,
      // scheduler,
      options,
      index,
      populatedContent,
      emailLocked
    } = this.state;

    return (
      <div className="email">
        <div>
          <h3>Email history</h3>
          {this.EmailHistory()}
        </div>
      </div>
    );
  }
}

export default EmailHistory;
