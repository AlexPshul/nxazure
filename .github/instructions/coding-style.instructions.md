---
applyTo: '**/*.{ts,tsx,js,jsx}'
description: 'Use when editing TypeScript or JavaScript in this repo. Captures preferred coding style such as guard clauses, concise one-line statements, descriptive naming, sparse comments, fail-fast errors, and AAA tests.'
---

# Coding Style

## Core approach

- Prefer minimal diffs. Preserve existing structure, naming, and file layout unless the task requires a deeper change.
- Match the existing TypeScript, Nx, Jest, and JSON styles already used in the touched area.
- Let the repo's linter and formatter handle line length, wrapping, and trailing-comma details rather than restating formatting rules here.

## Types and structure

- Keep code strongly typed. Avoid `any`, avoid type assertions when a better type model is practical, and favor explicit interfaces or type aliases when they improve clarity.
- Prefer small, focused helpers and reasonably pure functions over large multi-purpose blocks of logic.
- Prefer `const` arrow functions for local helpers and exports, but keep the existing file style when changing it would add churn without benefit.
- Prefer concise expression bodies when readability is not reduced.

## Function flow

- Prefer guard clauses and sanity checks at the top of functions so the main path stays flat and easy to read.
- Prefer early returns or early throws over nested conditionals when they simplify control flow.
- Prefer one-line statements when they remain clear. Omit braces for single-line control statements when the existing style and linter allow it.
- Prefer positive conditions when practical instead of layering negation into the main path.

## Naming and comments

- Prefer descriptive names over short names. Avoid abbreviations unless they are standard in the Nx, TypeScript, or Azure domain.
- Name booleans like predicates so their intent is obvious at call sites.
- Keep comments sparse and focused on non-obvious intent or tradeoffs.

## Errors and dependencies

- Fail fast on invalid inputs or impossible states, and surface actionable error messages with enough context to debug executor and generator failures.
- Avoid introducing new dependencies unless there is a clear payoff that outweighs added maintenance and package surface area.

## Tests

- Prefer arrange-act-assert structure in tests when adding or rewriting coverage.
