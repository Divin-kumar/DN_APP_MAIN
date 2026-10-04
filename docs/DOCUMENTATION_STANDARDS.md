# Documentation standards

These standards apply to comments and explanatory documentation across the repository.

## Purpose of comments

Comments should answer the questions:

- Why does this exist?
- What user problem does it solve?
- What business behavior is important here?
- What outcome is expected when this logic runs?

Comments should not simply describe syntax.

## Good comment style

- explain business intent
- describe user value
- clarify why logic exists
- document special handling or edge cases

Examples:

```js
// Keep recurring events aligned with the next planned occurrence so the dashboard
// shows the next meaningful date rather than the original creation date.
```

```js
// This merge keeps guest data from being lost when a user signs in later.
// Without this step, temporary records would disappear after account creation.
```

## Comment style to avoid

Avoid comments such as:

```js
// Loop through array
// Set state
// Return value
```

These do not explain the business purpose or the practical effect.

## When comments are useful

Use comments in these situations:

- route protection and access rules
- custom list handling and default migration logic
- data merge between guest and authenticated modes
- dashboard visibility rules
- greeting-card generation logic
- financial summaries and balance calculations
- storage and backup flows

## When comments are not useful

Do not add comments for obvious code that is already self-explanatory.

## Review rule

If a comment cannot be explained in plain business language without code knowledge, it should be rewritten or removed.
