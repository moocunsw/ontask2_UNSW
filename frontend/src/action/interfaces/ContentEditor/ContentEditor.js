import React from "react";

import { Editor } from 'slate-react';
import { Value } from 'slate';
import SoftBreak from "slate-soft-break";

import Mark from './packages/Mark';
import Blocks from './packages/Blocks';
import Link, { LinkButton } from './packages/Link';
import Image, { ImageButton } from './packages/Image';
import Attribute from './packages/Attribute';
import Color from './packages/Color';
import Font from './packages/Font';
import Rules from './packages/Rules';
import History from './packages/History';
import Serialize, { PreviewButton, SaveButton } from './packages/Serialize';

const initialValue = Value.fromJSON({
  document: {
    nodes: [
      {
        object: 'block',
        type: 'paragraph',
      },
    ],
  },
});

class ContentEditor extends React.Component {
  schema = {
    document: {
      nodes: [
        { match: [
          { type: 'paragraph' },
          { type: 'list-item' },
          { type: 'bulleted-list' },
          { type: 'numbered-list' },
          { type: 'code' },
          { type: 'heading-one' },
          { type: 'heading-two' },
          { type: 'link' },
          { type: 'image' },
          { type: 'attribute' },
          { type: 'condition-wrapper' },
          { type: 'condition' }
        ]}
      ]
    }
  };

  plugins = [
    Blocks(),
    Link(),
    Image(),
    Attribute(),
    Mark({ type: "bold", hotkey: "mod+b" }),
    Mark({ type: "italic", hotkey: "mod+i" }),
    Mark({ type: "underlined", hotkey: "mod+u" }),
    Mark({ type: "code", hotkey: "mod+`" }),
    Color(),
    Font(),
    Rules({ rules: this.props.rules, types: this.props.types, colours: this.props.colours }),
    History(),
    Serialize(),
    SoftBreak({ shift: true })
  ];

  constructor(props) {
    super(props);

    this.state = {
      value: initialValue,
      isInside: false,
      previewing: false,
      saving: false,
      showDeleteCondition: false,
      error: null
    };
  };

  componentDidMount = () => {
    const html = this.editor.generateDocument(this.props.html);
    this.setState({ value: html });
  };

  componentDidUpdate = () => {
    this.handleRuleDrag();
  };

  handleRuleDrag = () => {
    const { mouseEvent, ruleIndex, rules } = this.props;
    const { isInside } = this.state;

    if (mouseEvent) {
      const contentEditor = this.editorDiv.getBoundingClientRect();

      const isInsideX =
        mouseEvent.clientX >= contentEditor.x &&
        mouseEvent.clientX <= contentEditor.x + contentEditor.width;
      const isInsideY =
        mouseEvent.clientY >= contentEditor.y &&
        mouseEvent.clientY <= contentEditor.y + contentEditor.height;

      if (!isInside && isInsideX && isInsideY)
        this.setState({ isInside: true });

      if (isInside && !(isInsideX && isInsideY))
        this.setState({ isInside: false });
    }

    if (ruleIndex !== null && isInside) {
      this.setState({ isInside: false }, () => {
        this.editor.insertRule(ruleIndex, rules[ruleIndex]);
      });
    }
  };

  handleRuleClick(ruleIndex, rules) {
    this.editor.insertRule(ruleIndex, rules[ruleIndex]);
  };

  previewContent = () => {
    const { onPreview } = this.props;

    const content = {
      html: this.editor.generateHtml()
    };

    this.setState({ error: null, previewing: true });

    onPreview({
      content,
      onSuccess: () => this.setState({ previewing: false }),
      onError: error => this.setState({ error })
    });
  };

  updateContent = () => {
    const { onUpdate } = this.props;

    const content = {
      html: this.editor.generateHtml()
    };

    this.setState({ error: null, saving: true });

    onUpdate({
      content,
      onSuccess: () => this.setState({ saving: false }),
      onError: error => this.setState({ error })
    });
  };

  onChange = ({ value }) => {
    this.setState({ value });
  };

  render() {
    const { order } = this.props;
    const { value, isInside, previewing, saving } = this.state;

    return (
      <div>
        <div className="toolbar">
          {this.editor && this.editor.renderUndoButton()}
          {this.editor && this.editor.renderRedoButton()}
          {this.editor && this.editor.renderMarkButton("bold", "Bold", "format_bold")}
          {this.editor && this.editor.renderMarkButton("italic", "Italic", "format_italic")}
          {this.editor && this.editor.renderMarkButton("underlined", "Underline", "format_underlined")}
          {this.editor && this.editor.renderMarkButton("code", "Code", "code")}
          {this.editor && this.editor.renderFontFamilySelect()}
          {this.editor && this.editor.renderColorButton()}
          {<LinkButton editor={this.editor} />}
          <ImageButton editor={this.editor} />
          {this.editor && this.editor.renderBlockButton("heading-one", "Header One", "looks_one")}
          {this.editor && this.editor.renderBlockButton("heading-two", "Header Two", "looks_two")}
          {this.editor && this.editor.renderBlockButton("paragraph", "Paragraph", "short_text")}
          {this.editor && this.editor.renderBlockButton("numbered-list", "Ordered List", "format_list_numbered")}
          {this.editor && this.editor.renderBlockButton("bulleted-list", "Unordered List", "format_list_bulleted")}
          {this.editor && this.editor.renderAttributeButton(order)}
        </div>
        <Editor
          className={`content_editor ${isInside ? "isInside" : ""}`}
          ref={editor => this.editor = editor}
          schema={this.schema}
          plugins={this.plugins}
          value={value}
          onChange={this.onChange}
          renderEditor={(props) =>
            <div ref={editorDiv => (this.editorDiv = editorDiv)}>{props.children}</div> // editorDiv to use this.editorDiv.getBoundgetBoundingClientRect
          }
        />
        <div style={{ marginTop: "10px" }}>
          <PreviewButton loading={previewing} onClick={this.previewContent} />
          <SaveButton saving={saving} onClick={this.updateContent} />
        </div>
      </div>
    )
  };
};

export default ContentEditor;