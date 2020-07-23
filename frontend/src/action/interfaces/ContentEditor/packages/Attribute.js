import React from "react";

import { Select, Tooltip } from "antd";

function Attribute(options) {
  return {
    // Note: This function is called everytime a node changes (may consider optimising this)
    // Makes an attribute node "atomic"
    normalizeNode(node, editor, next) {
      if (node.type !== "attribute") return next()
      if (node.text === node.data.get("field")) return next()
      return () => editor.removeNodeByKey(node.key)
    },
    queries: {
      renderAttributeButton(editor, items, prefix, placeholder, tooltip, width) {
        return (
          <Tooltip title={tooltip}>
            <Select
              placeholder={placeholder}
              style={{ width: width }}
              size="small"
              value={undefined}
              onChange={field => {
                editor
                  .insertText(field)
                  .moveFocusBackward(field.length)
                  .wrapInline({
                    type: "attribute",
                    data: { field }
                  })
                  .moveToEndOfInline();
              }}
              className="attribute_select"
              dropdownMatchSelectWidth={false}
            >
              {items.map((item, i) => (
                <Select.Option value={`${prefix}:${item}`} key={i}>
                  {item}
                </Select.Option>
              ))}
            </Select>
          </Tooltip>
        );
      }
    },
    renderInline(props, editor, next) {
      const { attributes, children, node } = props;

      switch (node.type) {
        case "attribute":
          return (
            <span
              {...attributes}
              style={{
                display: "inline-block",
                padding: "0 5px",
                lineHeight: "1.25em",
                background: "#eee"
              }}
              contentEditable={false}
            >
              {children}
            </span>
          );
        default:
          return next();
      };
    }
  };
};

export default Attribute;