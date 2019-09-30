import React from "react";

import { Tooltip } from 'antd';

const DEFAULT_NODE = "paragraph";

function Blocks(options) {
  return {
    schema: {
      blocks: {
        "list-item": {
          parent: [{ type: 'bulleted-list' }, { type: 'numbered-list' }],
          normalize: (editor, { code, node, child, index }) => {
            if (code === "parent_type_invalid") editor.setNodeByKey(node.key, { type: 'paragraph' });
          }
        },
      }
    },
    queries: {
      hasBlock(editor, type) {
        return editor.value.blocks.some(node => node.type === type);
      },
      getParentType(editor) {
        const { value } = editor;
        return value.document.getParent(value.anchorBlock.key).type;
      },
      getCurrentParent(editor) {
        const { value } = editor;
        return value.document.getParent(value.anchorBlock.key)
      },
      renderBlockButton(editor, type, title, icon) {
        let isActive = editor.hasBlock(type);

        if (["numbered-list", "bulleted-list"].includes(type)) {
          const { document, blocks } = editor.value;

          if (blocks.size > 0) {
            const parent = document.getParent(blocks.first().key);
            isActive = editor.hasBlock("list-item") && parent && parent.type === type;
          }
        }

        return (
          <Tooltip title={title}>
            <i
              className={`material-icons ${isActive ? "active" : ""}`}
              onMouseDown={event => {editor.onClickBlock(event, type)}}
            >
              {icon}
            </i>
          </Tooltip>
        );
      }
    },
    commands: {
      onClickBlock(editor, event, type) {
        event.preventDefault();
        const parentType = editor.getParentType();

        // Handle everything but list buttons.
        if (type !== "bulleted-list" && type !== "numbered-list") {
          const isActive = editor.hasBlock(type);
          const isList = editor.hasBlock("list-item");

          if (isList) {
            // Set from List to Paragraph/Heading
            editor
              .setBlocks(isActive ? DEFAULT_NODE : type)
              .unwrapBlock(parentType);
          } else {
            // Swap Paragraph/List
            editor.setBlocks(isActive ? DEFAULT_NODE : type);
          }
        } else {
          // Handle the extra wrapping required for list buttons.
          const isList = editor.hasBlock("list-item");
          const parentType = editor.getParentType();

          if (isList && (parentType === type)) {
            // Is a list and of the same type
            editor
              .setBlocks(DEFAULT_NODE)
              .unwrapBlock(parentType);
          } else if (isList) {
            editor.setNodeByKey(editor.getCurrentParent().key, type)
          } else {
            // Not a list
            editor
              .wrapBlock(type)
              .setBlocks("list-item");
          }
        }
      },
    },
    onKeyDown(event, editor, next) {
      const { value } = editor;
      const { selection, anchorText, anchorBlock, document } = value;
      const { start } = selection;
      const offset = start.offset;
      const nodeType = anchorBlock.type;
      const parent = editor.getCurrentParent();
      const parentType = editor.getParentType();

      const hasParentList = ["bulleted-list", "numbered-list"].includes(parentType);

      const prevNode = document.getPreviousNode(anchorBlock.key);
      const nextNode = document.getNextNode(anchorBlock.key);

      const prevNodeType = prevNode && prevNode.type;
      const prevNodeParent = prevNode && document.getParent(prevNode.key);
      const prevNodeParentKey = prevNodeParent && prevNodeParent.key;
      const isPrevNodeCondition = ["condition-wrapper", "condition"].includes(prevNodeType);

      const prevNodeBlocks = prevNode && prevNode.getBlocks();
      const lastPrevNodeBlock = prevNodeBlocks && prevNodeBlocks.get(prevNodeBlocks.size - 1);

      const nextNodeBlocks = nextNode && nextNode.getBlocks();
      const firstNextNodeBlock = nextNodeBlocks && nextNodeBlocks.get(0);

      // List depth
      if (event.key === 'Tab') {
        event.preventDefault();
        if (editor.hasBlock("list-item")) {
          if (event.shiftKey) {
            editor.unwrapBlock(parentType);
          }
          else {
            editor
              .setBlocks('list-item')
              .wrapBlock(parentType);
          }
        }
        else {
          editor.insertText("\t");
        }
      }

      // Removes leftover bulleted-list & numbered-list blocks
      if (event.key === 'Backspace') {
        event.preventDefault();

        if (hasParentList && offset === 0 && (nodeType !== "list-item" || parent.nodes.size === 1)) {
          // console.log("A")
          editor.unwrapBlock(parentType);
          return false;
        }

        // Backspace into a condition block, or out of a condition block
        if ((anchorText.text === '' || offset === 0) && (isPrevNodeCondition || (prevNodeParentKey !== parent.key))) {
          editor.moveBackward();
          return false; // Prevents moving backwards twice
        }
      }

      if (event.key === "ArrowUp") {
        // If condition for case when cursor is at start of document
        if (!!lastPrevNodeBlock || !!prevNode) {
          event.preventDefault();
          if (!!lastPrevNodeBlock)
            editor
              .moveToEndOfNode(lastPrevNodeBlock)
              .moveTo(offset);
          else
            editor
              .moveToEndOfNode(prevNode)
              .moveTo(offset);
          // Offset
          return false;
        }
      }

      if (event.key === "ArrowDown") {
        // If condition for case when cursor is at end of document
        if (!!firstNextNodeBlock || !!nextNode) {
          event.preventDefault();
          if (!!firstNextNodeBlock)
            editor
              .moveToEndOfNode(firstNextNodeBlock)
              .moveTo(offset);
          else
            editor
              .moveToEndOfNode(nextNode)
              .moveTo(offset);
          return false;
        }
      }

      if (event.key === "Enter" && !event.shiftKey) {
        // Enter on Heading Block to remove heading style
        if (["heading-one", "heading-two"].includes(anchorBlock.type)) {
          editor
            .splitBlock()
            .setBlocks('paragraph');
          return false; // Prevent 'Enter' from creating a new block by default
        }
        // Enter on empty list item block to unwrap list
        if (nodeType === "list-item" && hasParentList && anchorText.text === '') {
          editor.unwrapBlock(parentType);
          return false;
        }
        // Enter in a condition block
        if (nodeType === "paragraph" && parentType === "condition" && anchorText.text === '') {
          editor.moveForward();
          return false;
        }
      }
      return next();
    },
    onKeyUp(event, editor, next) {
      const { value } = editor;
      const { anchorText } = value;
      const { text } = anchorText

      // Reference: canner-slate-editor
      if (event.key === " ") {
        // * item
        // + item
        // - item
        if (text.match(/((?:^\s*)(?:[*+-]\s))/m)) {
          editor
            .deleteBackward(2)
            .wrapBlock('bulleted-list')
            .setBlocks("list-item");
        }
        // 1. item
        if (text.match(/((?:^\s*)(?:\d+\.\s))/m)) {
          editor
            .deleteBackward(3)
            .wrapBlock('numbered-list')
            .setBlocks("list-item");
        }
      }
      return next();
    },
    renderBlock(props, editor, next) {
        const { attributes, children, node } = props;
        switch (node.type) {
          case "paragraph":
            return <p {...attributes}>{children}</p>;
          case "bulleted-list":
            return <ul {...attributes}>{children}</ul>;
          case "heading-one":
            return <h1 {...attributes}>{children}</h1>;
          case "heading-two":
            return <h2 {...attributes}>{children}</h2>;
          case "list-item":
            return <li {...attributes}>{children}</li>;
          case "numbered-list":
            return <ol {...attributes}>{children}</ol>;
          default:
            return next();
        };
    }
  };
};

export default Blocks;