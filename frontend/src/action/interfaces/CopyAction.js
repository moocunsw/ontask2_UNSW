import React from "react";
import {
  Form,
  Button,
  Alert,
  Spin,
  Input,
  Icon,
  // Tooltip,
  Divider,
  Table,
  Modal,
  Popover,
  notification,
  Select,
  Row,
  Col,
} from "antd";
import moment from "moment";

import apiRequest from "../../shared/apiRequest";

class CopyAction extends React.Component {
  state = {
    loadingDashboard: true,
    loadingTerms: true,
    loadingDatalab: true,
    containers: [],
    terms: [],
    currentTerms: [],
    currentContainer: [],
    originalActionFields: [],
  };

  fetchContainers = () => {
    this.setState({ loadingContainer: true });

    apiRequest(`/dashboard/`, {
      method: "POST",
      payload: { terms: this.state.currentTerms },
      onSuccess: (containers) => {
        this.setState({
          containers,
          loadingContainer: false,
        });
      },
      onError: () => {
        notification["error"]({
          message: "Failed to fetch dashboard",
        });
        this.setState({ loadingContainer: false });
      },
    });
  };

  fetchTermsDashboard = () => {
    this.setState({ loadingTerms: true });
    apiRequest(`/terms/`, {
      method: "GET",
      onSuccess: (terms) => {
        // const storageTerms = localStorage.getItem('currentTerms');
        // terms.currentTerms = storageTerms
        //   ? JSON.parse(storageTerms)
        //   : terms.currentTerms.map(term => term.id);

        // terms, currentTerms
        this.setState({
          loadingTerms: false,
          terms: terms.terms,
        });
      },
      onError: () => {
        notification["error"]({
          message: "Failed to fetch terms",
        });
        this.setState({ loadingTerms: false });
      },
    });
  };

  copyAction = () => {
    const { action } = this.props
    apiRequest(`/workflow/${action.id}/copy_action/`, {
      method: "POST",
      payload: { 
        containerId: this.state.currentContainer[0],
        datalabId: this.state.selected.id,
        name: this.state.newActionName,
      },
      onSuccess: (newAction) => {
        console.log(newAction)
      },
      onError: () => {
        notification["error"]({
          message: "Could not copy action"
        })
      }
    })
  }

  fetchDatalab = (datalabId) => {
    this.setState({ loadingDatalab: true });
    apiRequest(`/datalab/${datalabId}/access/`, {
      method: "GET",
      onSuccess: (selected) => {
        const { datasources, dataLabs, filter_details, actions } = selected;
        delete selected.datasources;
        delete selected.dataLabs;
        this.setState({
          loadingDatalab: false,
          selected,
          // datasources,
          // dataLabs,
          // filter_details,
          // actions,
        });
      },
      onError: (error, status) => {
        // if (status === 403) {
        //   history.replace("/forbidden");
        // } else {
        //   history.replace("/error");
        // }
        console.log("error");
      },
    });
  };

  componentDidMount = () => {
    // get all related containers.
    this.fetchTermsDashboard();
    this.getFields();
  };

  termSelect = () => {
    const { terms, currentTerms } = this.state;
    if (this.state.loadingTerms) {
      return <Spin />;
    } else {
      return (
        <Select
          style={{ flex: 1 }}
          onChange={(value) => {
            const { terms } = this.state;
            let newCurrentTerms = null;
            if (value.includes("_all"))
              newCurrentTerms = terms.map((term) => term.id);
            else if (value.includes("_none")) newCurrentTerms = [];
            else
              newCurrentTerms = terms
                .filter((term) => value.includes(term.id))
                .map((term) => term.id);
            this.setState({ currentTerms: newCurrentTerms }, () => {
              this.fetchContainers();
            });
          }}
        >
          {terms.map((term, i) => {
            return (
              <Select.Option value={term.id} key={term.id}>
                {term.name}
              </Select.Option>
            );
          })}
        </Select>
      );
    }
  };

  containerSelect = () => {
    const { containers } = this.state;
    return (
      <Select
        style={{ flex: 1 }}
        onChange={(value) => {
          this.setState({
            currentContainer: [value],
          });
        }}
      >
        {containers.map((container, i) => {
          return (
            <Select.Option value={container.id} key={container.id}>
              {container.code}
            </Select.Option>
          );
        })}
      </Select>
    );
  };

  datalabSelect = () => {
    const { currentContainer, containers } = this.state;

    const selectedContainer = containers.find(
      (container) => container.id == currentContainer[0]
    );

    if (selectedContainer.datalabs) {
      return (
        <Select
          style={{ flex: 1 }}
          onChange={(value) => this.fetchDatalab(value)}
        >
          {selectedContainer.datalabs.map((datalab, i) => {
            return (
              <Select.Option value={datalab.id} key={datalab.id}>
                {datalab.name}
              </Select.Option>
            );
          })}
        </Select>
      );
    }
  };

  getFields = () => {
    const { action } = this.props;
    if (action.content) {
      // filter this
      const regex = /field:[a-zA-Z_]*/g;
      let matches,
        fields = [];
      while ((matches = regex.exec(action.content))) {
        console.log(matches);
        let splitField = matches[0].split(":");
        fields.push(splitField[1]);
      }
      this.setState({ originalActionFields: fields });
    }
  };

  render() {
    const { action } = this.props;
    const { currentTerms, loadingContainer, currentContainer, selected } = this.state;
    console.log(this.state);
    console.log(this.props);

    return (
      <div style={{ display: "flex", flex: 1, flexDirection: "column" }}>
        <Row style={{ padding: 20 }}>
          <Col span={6}>New Action Name:</Col>
          <Col span={18} style={{ display: "flex", flex: 1 }}>
            <Input value={this.state.newActionName} onChange={(e) => this.setState({newActionName: e.target.value})} />
          </Col>
        </Row>

        <Row style={{ padding: 20 }}>
          <Col span={6}>Term:</Col>
          <Col span={18} style={{ display: "flex", flex: 1 }}>
            {this.termSelect()}
          </Col>
        </Row>

        {currentTerms.length > 0 && !loadingContainer ? (
          <Row style={{ padding: 20 }}>
            <Col span={6}>Container:</Col>
            <Col span={18} style={{ display: "flex", flex: 1 }}>
              {this.containerSelect()}
            </Col>
          </Row>
        ) : null}

        {currentContainer.length > 0 ? (
          <Row style={{ padding: 20 }}>
            <Col span={6}>Datalab:</Col>
            <Col span={18} style={{ display: "flex", flex: 1 }}>
              {this.datalabSelect()}
            </Col>
          </Row>
        ) : null}

        

        {selected ? (
          <div>
            <Button
              onClick={() => {
                this.copyAction();
              }}
            >
              Copy Action
            </Button>
          </div>
        ) : null}

        <div></div>
      </div>
    );
  }
}

export default CopyAction;
