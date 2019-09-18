import React from "react";

import { Select, Tooltip } from "antd";

import FontList from './FontList';

const { Option } = Select;

/**
 * TODO: FontSize
 * Keep Text Highlighting after clicking on Font Select
 */

const defaultFont = "Arial";

function Font(options) {
  return {
    queries: {
      renderFontFamilySelect(editor) {
        const mark = editor.value.activeMarks.find(mark => mark.type === "font-family" && mark.data.get("font"));
        const currMark = (typeof mark !== 'undefined') ? mark.data.get("font") : defaultFont;

        const options = Object.keys(FontList).map((key, index) =>
          <Option value={key} key={index}>{key}</Option>
        );

        return (
          <Tooltip title="Font">
            <Select
              showSearch
              autoFocus
              size="small"
              value={currMark}
              placeholder="Select a font"
              className="attribute_select"
              optionFilterProp="children"
              onChange={(font) => editor.onChangeFontFamily(font)}
              filterOption={(input, option) =>
                option.props.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
              }
            >
              {options}
            </Select>
          </Tooltip>
        );
      },
      onChangeFontFamily(editor, font) {
        // Remove Current fontfamily
        editor.value.marks
          .filter(mark => mark.type === "font-family")
          .forEach(mark => editor.removeMark(mark));

        // Add new fontfamily
        editor
          .addMark({ type: "font-family", data: { font: font } })
          .focus();
      }
    },
    renderMark(props, editor, next) {
      const { children, mark, attributes } = props;
      switch (mark.type) {
        case "font-family":
          const font = FontList[mark.data.get("font")];
          const fontStackString = font && font["stack"].join(", ");
          return <span style={{fontFamily: fontStackString}} {...attributes}>{children}</span>;
        default:
          return next();
      };
    }
  };
};

export default Font;