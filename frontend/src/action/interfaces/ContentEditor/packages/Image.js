import React, { useState } from "react";

import { Popconfirm, Input, Tooltip } from "antd";

function Image(options) {
  return {
    schema: {
      inlines: {
        "image": {
          isVoid: true
        }
      }
    },
    renderInline(props, editor, next) {
      const { attributes, node } = props;

      switch (node.type) {
        case "image":
            const src = node.data.get("src");
            const alt = node.data.get("alt");
            return (
              <img
                {...attributes}
                src={src}
                alt={alt}
                style={{ maxWidth: "100%" }}
              />
            );
        default:
          return next();
      };
    }
  };
};

export const ImageButton = (props) => {
  const [ image, setImage ] = useState({ src: null, alt: null });

  return (
    <Popconfirm
      icon={null}
      title={
        <div className="action_toolbar_popup">
          <Input
            placeholder="Image URL"
            size="small"
            onChange={e => setImage({...image, src: e.target.value })}
            value={image.src}
          />
          <Input
            placeholder="Description/Alt tag"
            size="small"
            onChange={e => setImage({...image, alt: e.target.value })}
            value={image.alt}
          />
        </div>
      }
      onVisibleChange={visible => {
        if (!visible) setImage({ src: null, alt: null });
      }}
      onConfirm={() => {
        props.editor.insertInline({
          type: "image",
          data: { src: image.src, alt: image.alt },
          isVoid: true
        });
      }}
    >
      <Tooltip title="Insert Image">
        <i className="material-icons">insert_photo</i>
      </Tooltip>
    </Popconfirm>
  );
};

export default Image;