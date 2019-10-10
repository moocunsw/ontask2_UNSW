import React, { useState } from "react";

import { Popover, Tooltip, Popconfirm, Input } from "antd";

function Link(options) {
  return {
    renderInline(props, editor, next) {
      const { attributes, children, node } = props;

      switch (node.type) {
        case "link":
          let href = node.data.get("href");
          if (href && !(href.startsWith("http://") || href.startsWith("https://")))
            href = `//${href}`;
          return (
            <Popover
              content={
                <div>
                  {/* <Tooltip title="Edit link">
                    <i
                      style={{ cursor: "pointer", marginRight: 5 }}
                      className="material-icons"
                    >
                      create
                    </i>
                  </Tooltip> */}
                  <Tooltip title="Go to link">
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "rgba(0, 0, 0, 0.65)" }}
                    >
                      <i className="material-icons">public</i>
                    </a>
                  </Tooltip>
                </div>
              }
            >
              <a {...attributes}>{children}</a>
            </Popover>
          );
        default:
          return next();
      };
    }
  };
};

export const LinkButton = (props) => {
  const [ hyperlink, setHyperlink ] = useState({ label: null, url: null });

  return (
    <Popconfirm
      icon={null}
      title={
        <div className="action_toolbar_popup">
          <Input
            placeholder="Label"
            size="small"
            onChange={e => setHyperlink({ ...hyperlink, label: e.target.value })}
            value={hyperlink.label}
          />
          <Input
            placeholder="URL"
            size="small"
            onChange={e => setHyperlink({ ...hyperlink, url: e.target.value })}
            value={hyperlink.url}
          />
        </div>
      }
      onVisibleChange={visible => {
        if (!visible)
          setHyperlink({ label: null, url: null });
      }}
      onConfirm={() => {
        if (!(hyperlink.label && hyperlink.url)) return;
        props.editor
          .insertText(hyperlink.label)
          .moveFocusBackward(hyperlink.label.length)
          .wrapInline({
            type: "link",
            data: { href: hyperlink.url }
          })
          .moveToEnd();
      }}
    >
      <Tooltip title="Insert Link">
        <i className="material-icons">insert_link</i>
      </Tooltip>
    </Popconfirm>
  );
};

export default Link;