import React from "react";

import { Block } from 'slate';

import { Button, Tooltip } from 'antd';

const nonConditionNodes = [
  { type: 'paragraph' },
  { type: 'list-item' },
  { type: 'bulleted-list' },
  { type: 'numbered-list' },
  { type: 'code' },
  { type: 'heading-one' },
  { type: 'heading-two' },
  { type: 'link' },
  { type: 'image' },
  { type: 'attribute' }
];

function Rules(options) {
  const { rules, types, colours } = options;

  return {
    schema: {
      blocks: {
        "rule": {
          nodes: [
            {
              match: [{type: 'condition'}],
            }
          ],
        },
        "condition": {
          // No Text
          nodes: [
            { match: [
              ...nonConditionNodes,
              { type: 'rule' },
              { type: 'condition' }
            ]},
          ],
          first: nonConditionNodes,
          last: nonConditionNodes,
          normalize: (editor, { code, node, child, index }) => {
            switch (code) {
              case 'child_type_invalid':
                // Prevent Deletion of Block
                return editor.insertNodeByKey(node.key, index, Block.create({ object: 'block', type: 'paragraph' }));
              case 'first_child_type_invalid':
                return editor.insertNodeByKey(node.key, 0, Block.create({ object: 'block', type: 'paragraph' }));
              case 'last_child_type_invalid':
                // return editor.setBlocks('paragraph');
                return editor.insertNodeByKey(node.key, node.nodes.size, Block.create({ object: 'block', type: 'paragraph' }));
              default:
                return;
            }
          }
        },
      }
    },
    commands: {
      insertRule(editor, rule) {
        let ruleBlocks = rule.conditions.map(condition => ({
            type: "condition",
            nodes: [
              {
                object: 'block',
                type: 'paragraph',
              },
            ],
            data: {
              conditionId: condition.conditionId,
              ruleId: rule.ruleId
            }
          }));

        ruleBlocks.push(
          {
            type: "condition",
            nodes: [
              {
                object: 'block',
                type: 'paragraph',
              },
            ],
            data: {
              label: "else",
              conditionId: rule.catchAll,
              ruleId: rule.ruleId
            }
          }
        );

        editor.insertBlock({
          type: "rule",
          data: { ruleId: rule.ruleId },
          nodes: Block.createList(ruleBlocks)
        });
      },
    },
    renderBlock(props, editor, next) {
      const { children, node } = props;
      switch (node.type) {
        case "rule":
          return <div>{children}</div>
        case "condition":
          const ruleId = node.data.get("ruleId");
          const conditionId = node.data.get("conditionId");
          // The "else" blocks have a label of "else",
          // otherwise generate a name for the condition based on
          // the condition parameters
          let label = node.data.get("label");
          if (!label) label = generateLabel(ruleId, conditionId, rules, types);

          const colour =
            !["MISSING_CONDITION", "MISSING_RULE"].includes(label) &&
            colours[rules.findIndex(obj => obj.ruleId === ruleId)];

          return (
            <div
              className="condition_block"
              style={{ borderColor: colour }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between"
              }}>
                <div
                  className="condition_name"
                  style={{ color: colour }}
                >
                  If <strong>{label}</strong>:
                </div>
                <Tooltip title="Delete condition block">
                  <Button
                    icon="close-circle"
                    size="small"
                    style={{ border: "none" }}
                    onClick={(e) => {editor.removeNodeByKey(node.key).focus()}}
                  />
                </Tooltip>
              </div>
                {children}
              </div>
          );
        default:
          return next();
      };
    }
  };
};

function generateLabel(ruleId, conditionId, rules, types) {
  const rule = rules.find(obj => obj.ruleId === ruleId);

  if (!rule) return "MISSING_RULE";

  const condition = rule.conditions.find(
    condition => condition.conditionId === conditionId
  );

  if (!condition) return "MISSING_CONDITION";

  const operatorMap = {
    "==": "="
  };

  const transformValues = (type, configuration) => {
    const valueKeys = ["rangeFrom", "rangeTo", "comparator"];
    valueKeys.forEach(key => {
      if (!configuration[key]) return;

      if (type === "date")
        configuration[key] = configuration[key].slice(0, 10);
    });

    return configuration;
  };

  let label = [];
  rule.parameters.forEach((parameter, parameterIndex) => {
    let configuration = transformValues(
      types[parameter],
      condition.formulas[parameterIndex]
    );

    let operator = configuration.operator;
    if (operator === "between") {
      label.push(`${parameter} >= ${configuration.rangeFrom}`);
      label.push(`${parameter} <= ${configuration.rangeTo}`);
    } else if (configuration.comparator) {
      operator = operator in operatorMap ? operatorMap[operator] : operator;
      label.push(`${parameter} ${operator} ${configuration.comparator}`);
    } else {
      label.push(`${parameter} ${operator}`);
    }
  });

  label = label.join(", ");

  return label;
};

export default Rules;