import React from "react";
import {
  Icon,
  // Tooltip,
  Table,
  Input,
  Popover,
  Divider,
  Modal,
  Button,
} from "antd";
import moment from "moment";
import Highlighter from "react-highlight-words";

class EmailJobDetails extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchText: "",
      emailView: { visible: false },
    };
  }

  searchEntry = (dataSource, searchText) => {
    let searchFiltered = dataSource.filter(
      (it) =>
        !it.recipient ||
        (it.recipient && it.recipient.toLowerCase().includes(searchText))
    );
    return searchFiltered;
  };

  FeedbackDetails = (record) => (
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

  LinkDetails = (record) => {
    const rows = Object.keys(record).map(key => 
      <b key={key}>{key} - {record[key]}</b>
    )
    return (
      <div>
        {rows}
      </div>
    )
  }

  onCancel = () => this.setState({ emailView: { visible: false } });

  TrackingDetails = (record) => (
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

  render = () => {
    const { job } = this.props;
    const { searchText, emailView } = this.state;

    return (
      <div>
        <Input
          placeholder="Search by Recipient"
          prefix={<Icon type="search" style={{ color: "rgba(0,0,0,.25)" }} />}
          onChange={(e) => {
            this.setState({ searchText: e.target.value.toLowerCase() });
          }}
        />
        <Table
          size="small"
          columns={[
            { title: "Recipient", dataIndex: "recipient", key: "recipient",
              render: (text) => (
                <Highlighter
                  highlightStyle={{ backgroundColor: "#ffc069", padding: 0 }}
                  searchWords={[searchText]}
                  autoEscape
                  textToHighlight={text.toString()}
                />
              )
            },
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
                  <Popover
                    content={this.FeedbackDetails(record)}
                    trigger="hover"
                  >
                    {feedback.length > 25
                      ? `${feedback.slice(0, 25)} ...`
                      : feedback}
                  </Popover>
                );
              },
            },
            {
              title: "Tracking",
              dataIndex: "track_count",
              key: "track_count",
              sorter: (a, b) => (a.track_count > b.track_count ? 1 : -1),
              render: (count, record) =>
                count > 0 ? (
                  <Popover
                    content={this.TrackingDetails(record)}
                    trigger="hover"
                  >
                    {count}
                  </Popover>
                ) : (
                  <Icon type="close" />
                ),
            },
            {
              title: "Link Clicks",
              render: (text, record) => {
                let clicks = 0;
                if (record.link_clicks) {
                  Object.keys(record.link_clicks).forEach((key => {
                    clicks += record.link_clicks[key];
                  }))
                }
                return (
                  clicks > 0 ? (
                    <Popover
                      content={this.LinkDetails(record.link_clicks)}
                      trigger={"hover"}
                    >
                      {clicks}
                    </Popover>
                  ) : (<span>0</span>)
                )
              }
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
                        text,
                      },
                    })
                  }
                >
                  View
                </span>
              ),
            },
          ]}
          dataSource={this.searchEntry(job.emails, searchText)}
          rowKey="email_id"
          pagination={{
            size: "small",
            defaultPageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: ["10", "25", "50"],
          }}
        />
         <Modal
          visible={emailView.visible}
          onCancel={this.onCancel}
          footer={
            <Button type="primary" onClick={this.onCancel}>
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
                __html: emailView.text,
              }}
            />
          </div>
        </Modal>
      </div>
    );
  };
}

export default EmailJobDetails;
