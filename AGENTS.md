# AGENTS.md

This file is the primary repo guidance for coding agents working in this workspace.

## Repo focus

- This repository is an Nx monorepo focused on Azure-related Nx plugins, with current work centered on the `@nxazure/func` package.
- Treat this repo as an Nx plugin workspace, not a generic app repo.
- Follow the coding-style guidance in [.github/instructions/coding-style.instructions.md](.github/instructions/coding-style.instructions.md).

## Nx and plugin conventions

- Respect existing Nx plugin conventions and public package behavior.
- When changing generators or executors in `packages/func`, keep related artifacts aligned. Update implementation, schemas, exported types, tests, and documentation when behavior or options change.
- Preserve backward compatibility for public executor and generator options unless the task explicitly requires a breaking change.
- Prefer targeted changes over repo-wide refactors, especially in plugin code that affects generated project structure or CLI-facing behavior.

## Testing expectations

- Run targeted tests for the touched area by default when feasible.
- Prefer the smallest useful validation step first, such as the affected Jest suite or Nx target, before broader repo-wide runs.
- If behavior changes and there is an existing test pattern nearby, extend or update tests rather than relying only on manual reasoning.

## Repo-specific guidance

- Be careful with build and asset-path behavior in the Azure Functions plugin. Asset paths are resolved from the workspace root.
- Keep README examples and docs in sync when user-facing plugin behavior changes.
- Preserve existing generated project conventions for apps, libs, and package outputs unless a task explicitly calls for changing them.

## Change discipline

- Do not fix unrelated issues while working on a focused task.
- Surface tradeoffs briefly when there is more than one reasonable implementation path, but prefer the simplest change that fits the existing design.
- If a change may affect published package consumers, be conservative and keep migrations or compatibility in mind.

## Preference promotion

- When an agent notices a repeated or clearly repo-relevant user preference, ask whether it should be promoted into `AGENTS.md` or one of the referenced instruction files.
- Only suggest promoting preferences that are stable, broadly useful for future work in this repo, and specific enough to belong in shared guidance rather than temporary conversation memory.
