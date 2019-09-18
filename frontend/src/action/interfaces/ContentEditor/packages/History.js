import React from "react";

import { Tooltip } from 'antd';

function History(options) {
  return {
    queries: {
      renderUndoButton(editor) {
        return (
          <Tooltip title="Undo">
            <i
              className={"material-icons"}
              onMouseDown={(event) => {
                event.preventDefault();
                // Prevents bug where press undo, then press redo without typing in the editor
                // results in error
                // There should be a better solution to this:
                // (editor.value.data.get('undos').size = 1 on render)
                if (editor.value.data.get('undos').size > 1) { editor.undo(); }
              }}
            >
              undo
            </i>
          </Tooltip>
        );
      },
      renderRedoButton(editor) {
        return (
          <Tooltip title="Redo">
            <i
              className={"material-icons"}
              onMouseDown={(event) => {
                event.preventDefault();
                if (editor.value.data.get('redos').size > 0) { editor.redo(); }
              }}
            >
              redo
            </i>
          </Tooltip>
        );
      }
    }
  };
};

export default History;