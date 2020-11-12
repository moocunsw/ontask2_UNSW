import React from "react";
import {
  Button,
  Icon,
  // Tooltip,
  Divider,
  Table,
  Modal,
} from "antd";
import moment from "moment";
// import _ from "lodash";

// import { narrowFormItemLayout } from "../../shared/FormItemLayout";

// import SchedulerModal from "../../scheduler/SchedulerModal";
import EmailSettings from "./EmailSettings";
import EmailJobDetails from "./EmailJobDetails";
import apiRequest from "../../shared/apiRequest";
const { Parser } = require('json2csv');
// const FormItem = Form.Item;

class EmailHistory extends React.Component {
  constructor(props) {
    super(props);
    const { action } = props;

    const options = [];
    action.options.modules.forEach((step) => {
      if (step.type === "datasource") {
        step.fields.forEach((field) => {
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
      emailLocked: true,
      intervalId: null,
    };

    this.dayMap = {
      mon: { order: 0, label: "Monday" },
      tue: { order: 1, label: "Tuesday" },
      wed: { order: 2, label: "Wednesday" },
      thu: { order: 3, label: "Thursday" },
      fri: { order: 4, label: "Friday" },
      sat: { order: 5, label: "Saturday" },
      sun: { order: 6, label: "Sunday" },
    };
  }

  EmailJobDetails = (job) => {
    return (
      <EmailJobDetails job={job} />
    );
  };

  export = () => {
    const rows = [];
    const { action } = this.props
    for (let job of action.emailJobs) {
      for (let email of job.emails) {
        let object = {
          recipient: email.recipient,
          track_count: email.track_count,
          first_tracked: email.first_tracked,
          last_tracked: email.last_tracked,
          content: email.content,
          subject: job.subject,
          included_feedback: job.included_feedback,
          action_name: action.name,
          action_id: action.id,
          reply_to_email: action.emailSettings.replyTo,
          reply_to_name: action.emailSettings.fromName,
        }
        rows.push(object)
      }
    }
    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(rows);
    var pom = document.createElement('a');
    var blob = new Blob([csv],{type: 'text/csv;charset=utf-8;'});
    var url = URL.createObjectURL(blob);
    pom.href = url;
    let filename = action.name.replace(" ", "_") + action.id + ".csv"
    pom.setAttribute('download', filename);
    pom.click();
  }

  EmailHistory = () => {
    const { action } = this.props;

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
              render: (text) => moment(text).format("DD/MM/YYYY, HH:mm"),
            },
            { title: "Type", dataIndex: "type", key: "type" },
            { title: "Subject", dataIndex: "subject", key: "subject" },
            {
              title: "Action",
              dataIndex: "action",
              key: "action",
              render: () => {
                return <span>{action.name}</span>;
              },
            },
            {
              title: "Reply To",
              dataIndex: "replyTo",
              key: "replyTo",
              render: () => {
                return <span>{action.emailSettings.replyTo}</span>;
              },
            },
            {
              title: "Feedback",
              dataIndex: "included_feedback",
              key: "included_feedback",
              render: (text) =>
                text ? <Icon type="check" /> : <Icon type="close" />,
            },
            {
              title: "Tracking",
              render: (text, record) => {
                const trackedCount = record.emails.filter(
                  (email) => !!email.first_tracked
                ).length;
                const trackedPct = Math.round(
                  (trackedCount / record.emails.length) * 100
                );
                return (
                  <span>{`${trackedCount} of ${record.emails.length} (${trackedPct}%)`}</span>
                );
              },
            },
          ]}
          dataSource={action.emailJobs}
          expandedRowRender={this.EmailJobDetails}
          rowKey="job_id"
          pagination={{ size: "small", pageSize: 20 }}
        />
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
      emailLocked,
    } = this.state;

    console.log(action);

    return (
      <div className="email">
        <div>
          <h3>Email history</h3>
          <Button type="primary" style={{ marginBottom: 5 }} onClick={() => this.export()}>
            Export to CSV
          </Button>
          {this.EmailHistory()}
        </div>
      </div>
    );
  }
}

export default EmailHistory;
