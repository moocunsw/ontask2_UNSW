import React from 'react';

import { getEventTransfer } from "slate-react";
import Html from "slate-html-serializer";

import sanitizeHtml from "sanitize-html";

import { Button } from 'antd';

import FontList from './FontList';

// Note: blockquote; heading 3,4,5,6 unsupported, so render paragraph
const BLOCK_TAGS = {
  p: 'paragraph',
  li: 'list-item',
  ul: 'bulleted-list',
  ol: 'numbered-list',
  h1: 'heading-one',
  h2: 'heading-two',
  h3: 'paragraph',
  h4: 'paragraph',
  h5: 'paragraph',
  h6: 'paragraph',
  blockquote: 'paragraph',
};

const MARK_TAGS = {
  strong: "bold",
  em: "italic",
  u: "underlined",
  s: "strikethrough",
  code: "code",
  span: "span"
};

const rules = [
  {
    serialize(obj, children) {
      if (["block", "inline"].includes(obj.object)) {
        switch (obj.type) {
          case "heading-one":
            return <h1>{children}</h1>;
          case "heading-two":
            return <h2>{children}</h2>;
          case "paragraph":
            return <p>{children}</p>;
          case "numbered-list":
            return <ol>{children}</ol>;
          case "bulleted-list":
            return <ul>{children}</ul>;
          case "list-item":
            return <li>{children}</li>;
          case "link":
            return (
              <a
                href={obj.data.get("href")}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            );
          case "image":
            return (
              <img
                src={obj.data.get("src")}
                alt={obj.data.get("alt")}
                style={{ maxWidth: "100%" }}
              />
            );
          case "attribute":
            return <attribute>{children}</attribute>;
          case "condition-wrapper":
            return <cwrapper index={obj.data.get("ruleIndex")}>{children}</cwrapper>
          case "condition":
            return <condition conditionid={obj.data.get("conditionId")} index={obj.data.get("ruleIndex")} label={obj.data.get("label")}>{children}</condition>;
          default:
            return;
        }
      }
    }
  },
  {
    serialize(obj, children) {
      if (obj.object === "mark") {
        switch (obj.type) {
          case "span":
            return (
              <span style={parseStyles(obj.data.get("style"))}>{children}</span>
            );
          case "bold":
            return <strong>{children}</strong>;
          case "italic":
            return <em>{children}</em>;
          case "underlined":
            return <u>{children}</u>;
          case "code":
            return <code>{children}</code>;
          case "color":
            return <span style={{color: obj.data.get("hex")}}>{children}</span>;
          case "font-family":
            const font = FontList[obj.data.get("font")];
            const fontStackString = font && font["stack"].join(", ");
            return <span style={{fontFamily: fontStackString}}>{children}</span>;
          default:
            return;
        }
      }
    }
  },
  {
    deserialize(el, next) {
      const tag = el.tagName.toLowerCase();
      const block = BLOCK_TAGS[tag];
      const mark = MARK_TAGS[tag];
      if (block) {
        return {
          object: "block",
          type: block,
          nodes: next(el.childNodes)
        };
      }
      if (mark) {
        // TODO: Add both colour & fontfamily when pasting from word doc (two styles in one span tag)
        const style = el.getAttribute("style");
        const styleClean = style && (style.indexOf(';') === -1 ? style : style.slice(0, style.indexOf(';')));
        const property = styleClean && styleClean.slice(0, styleClean.indexOf(':'));
        const value = styleClean && styleClean.slice(styleClean.indexOf(':') + 1);

        switch (property) {
          case 'color':
            return {
              object: "mark",
              type: "color",
              nodes: next(el.childNodes),
              data: { hex: value }
            }
          case 'font-family':
            return {
              object: "mark",
              type: "font-family",
              nodes: next(el.childNodes),
              data: { font: value.split(",")[0].replace(/['"]+/g, '') }
            }
          default:
            return {
              object: "mark",
              type: mark,
              nodes: next(el.childNodes),
              data:
                mark === "span"
                  ? {
                      style: el.getAttribute("style")
                    }
                  : undefined
            };
        }
      }
      if (el.tagName.toLowerCase() === "img") {
        return {
          object: "inline",
          type: "image",
          isVoid: true,
          nodes: next(el.childNodes),
          data: {
            src: el.getAttribute("src"),
            alt: el.getAttribute("alt")
          }
        };
      }
      if (el.tagName.toLowerCase() === "a") {
        return {
          object: "inline",
          type: "link",
          nodes: next(el.childNodes),
          data: {
            href: el.getAttribute("href")
          }
        };
      }
      if (el.tagName.toLowerCase() === "attribute") {
        return {
          object: "inline",
          type: "attribute",
          nodes: next(el.childNodes),
          data: {
            field: el.textContent
          }
        }
      }
      if (el.tagName.toLowerCase() === "cwrapper") {
        return {
          object: "block",
          type: "condition-wrapper",
          nodes: next(el.childNodes),
          data: {
            ruleIndex: el.getAttribute("index")
          }
        }
      }
      if (el.tagName.toLowerCase() === "condition") {
        return {
          object: "block",
          type: "condition",
          nodes: next(el.childNodes),
          data: {
            label: el.getAttribute("label"),
            conditionId: el.getAttribute("conditionid"),
            ruleIndex: el.getAttribute("index"),
          }
        }
      }
      if (!el.nodeValue || el.nodeValue.trim() === "") return null;
    }
  },
];

function Serialize(options) {
  const serializer = new Html({ rules });
  return {
    queries: {
      generateHtml(editor) {
        const { value } = editor;

        const output = value.document.nodes.map(node => {
          const pseudoValue = { document: { nodes: [node] } };
          return serializer.serialize(pseudoValue);
        });
        return [...output].join('');
      },
      generateDocument(editor, html) {
        return serializer.deserialize(html);
      }
    },
    onPaste(event, editor, next) {
      /**
       * To handle pasting from apps such as Word Document.
       * TODO:
       * Bullet Points - Convert dotted symbol text to a <ul> tag
       */
      const transfer = getEventTransfer(event);
      if (transfer.type !== "html") return next();

      const sanitizedHtml = sanitizeHtml(transfer.html, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat([
          "h1",
          "h2",
          "span",
          "img",
          "u"
        ]),
        allowedAttributes: {
          "*": ["style"],
          a: ["href", "name", "target"],
          img: ["src"]
        },
        allowedStyles: {
          "*": {
            "color": [/^.*$/],
            // "font-size": [/^.*$/],
            "font-family": [/^.*$/]
          }
        },
        transformTags: {
          b: sanitizeHtml.simpleTransform("strong"),
          i: sanitizeHtml.simpleTransform("em")
        }
      });

      const { document } = serializer.deserialize(sanitizedHtml);
      editor.insertFragment(document);

      return true;
    }
  };
};

export function parseStyles(styles) {
  return styles
    ? styles
        .split(";")
        .filter(style => style.split(":")[0] && style.split(":")[1])
        .map(style => [
          style
            .split(":")[0]
            .trim()
            .replace(/-./g, c => c.substr(1).toUpperCase()),
          style.split(":")[1].trim()
        ])
        .reduce(
          (styleObj, style) => ({
            ...styleObj,
            [style[0]]: style[1]
          }),
          {}
        )
    : styles;
};

export const PreviewButton = (props) => {
  return (
    <Button
      loading={props.previewing}
      style={{ marginRight: "10px" }}
      size="large"
      onClick={props.onClick}
    >
      Preview
    </Button>
  );
};

export const SaveButton = (props) => {
  return (
    <Button
      loading={props.saving}
      type="primary"
      size="large"
      onClick={props.onClick}
    >
      Save
    </Button>
  )
}

export default Serialize;