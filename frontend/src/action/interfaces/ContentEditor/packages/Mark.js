import React from "react";

import { Tooltip } from 'antd';

import { isKeyHotkey } from "is-hotkey";

// TODO: Changing style of an empty block unaffected when previous block has a style

function Mark(options) {
  const { type, hotkey } = options;

  const isHotkey = isKeyHotkey(hotkey);

  return {
    queries: {
      hasMark(editor, type) {
        return editor.value.activeMarks.some(mark => mark.type === type);
      },
      renderMarkButton(editor, type, title, icon) {
        const isActive = editor.hasMark(type);
        return (
          <Tooltip title={title}>
            <i
              className={`material-icons ${isActive ? "active" : ""}`}
              onMouseDown={(event) => {
                event.preventDefault();
                editor.toggleMark(type);
              }}
            >
              {icon}
            </i>
          </Tooltip>
        );
      }
    },
    onKeyDown(event, editor, next) {
      if (isHotkey(event)) {
        editor.toggleMark(type);
      }
      return next();
    },
    renderMark(props, editor, next) {
      const { children, mark, attributes } = props;
      switch (mark.type) {
        case "bold":
          return <strong {...attributes}>{children}</strong>;
        case "code":
          return <code {...attributes}>{children}</code>;
        case "italic":
          return <em {...attributes}>{children}</em>;
        case "underlined":
          return <u {...attributes}>{children}</u>;
        default:
          return next();
      };
    }
  };
};

export default Mark;