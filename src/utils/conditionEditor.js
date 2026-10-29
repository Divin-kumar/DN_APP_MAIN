import { operatorsForField } from './conditionEngine.js';

const comparisons = Object.freeze({
  text: [['contains', 'Contains'], ['eq', 'Is'], ['ne', 'Is not']],
  dropdown: [['eq', 'Is'], ['ne', 'Is not']],
  boolean: [['eq', 'Is'], ['ne', 'Is not']],
  number: [['eq', 'Equals'], ['gt', 'More than'], ['lt', 'Less than'], ['between', 'Between']],
  date: [['eq', 'On'], ['lt', 'Before'], ['gt', 'After'], ['between', 'Custom range'],
    ['today', 'Today'], ['this_week', 'This week'], ['this_month', 'This month']],
});

// Offer everyday comparisons without changing the engine's legacy semantics.
export const filterEditorOperators = (field, currentOperator) => {
  const base = comparisons[field?.type] || comparisons.text;
  const choices = field?.allowEmpty ? [...base, ['empty', 'Not specified'], ['not_empty', 'Specified']] : base;
  const previous = operatorsForField(field, currentOperator).find(([operator]) => operator === currentOperator);
  return previous && !choices.some(([operator]) => operator === currentOperator)
    ? [...choices, [previous[0], `${previous[1]} (previous filter)`]] : choices;
};

// Adding another filter always narrows results. Retain any older OR expression
// as a visible group rather than silently flattening its meaning.
export const appendFilterRule = (group, rule) => ({ ...group, join: 'AND', children:
  group.join === 'OR' && group.children.length
    ? [{ ...group, id: `${rule.id}-previous` }, rule]
    : [...group.children, rule],
});
