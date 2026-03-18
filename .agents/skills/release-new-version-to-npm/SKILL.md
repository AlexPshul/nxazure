---
name: release-new-version-to-npm
description: 'Release a new version of this package to NPM. Use when bumping the package version, preparing a publish, validating dist contents, creating a GitHub Release, or checking whether this repo should publish locally or through CI.'
argument-hint: 'Describe the intended release, for example: suggest the next patch version and prepare release notes for review'
user-invocable: true
---

# Release New Version To NPM

## What This Skill Does

This skill handles the release workflow for this repository's NPM package.

It is specific to this repo:

- The package version is changed in `packages/func/package.json`
- `npm install` is used to refresh `package-lock.json`
- Run `npm run build:all` to build the entire repo.
- Publishing is handled by the GitHub Actions release workflow in `.github/workflows/publish-func.yml`

Do not default to `npm publish` from the local machine unless the user explicitly asks for a manual local publish. The standard path is to create a GitHub Release, which triggers the publish workflow.

## When To Use

- Release a new package version to NPM
- Suggest the next package version and ask the user to confirm it
- Verify whether the repo is ready to publish
- Draft release notes from commits since the previous release
- Create the GitHub Release that triggers the publish workflow

## Decision Points

1. Decide the bump type.
   - Use `patch` for backward-compatible fixes
   - Use `minor` for backward-compatible features
   - Use `major` for breaking changes
   - Suggest the next version, but ask the user to confirm before changing files

2. Decide whether the current branch is releasable.
   - If the worktree is dirty, call that out before changing version files
   - If the release notes are unclear, gather commits since the previous release and present them for review
   - If the previous release tag cannot be found, stop and ask before guessing the commit range

3. Decide how to publish.
   - Preferred path: create a GitHub Release and let `.github/workflows/publish-func.yml` publish
   - Manual local publish is an exception path only when the user explicitly requests it

## Procedure

1. Inspect the current release state.
   - Read `packages/func/package.json` for the current version
   - Read `.github/workflows/publish-func.yml` to confirm the publish path
   - Check whether the worktree is clean before making release changes
   - If there are local commits or local changes, DO NOT ALLOW RELEASING A NEW VERSION! ABORT RIGHT AWAY!

2. Choose the new version.
   - Suggest the next version number based on the current version and the likely bump type
   - Ask the user to confirm the suggested version before editing any release files
   - If the user provides an exact version, use that confirmed version instead of inferring one

3. Update version files.
   - Update `packages/func/package.json` to the confirmed version
   - Run `npm install` so `package-lock.json` is refreshed and stays in sync with the new package version

4. Rebuild and validate the publishable package.
   - Run `npm run build:all` to build the entire repo, which produces `dist/`
   - No need to run the tests. The GitHub Action is taking care of this and will block the release if tests fail, so running them locally is not necessary for validation purposes
   - Confirm `dist/package.json` now carries the same version as the root package
   - Do not hand-edit `dist/package.json`; it is produced by the build step

5. Review the release diff.
   - Confirm the version bump is correct
   - Confirm the local build artifacts in `dist/` are up to date for validation purposes
   - Confirm no unrelated files were changed as part of the release

6. Commit the release preparation.
   - Create a commit with the exact message `Version Bump <version>`, where <version> is the new version number, for example `Version Bump 1.2.3`
   - Commit all the untracked files that were generated during the process, including `package-lock.json` if it was generated.

7. Draft release notes from commits since the previous release.
   - Find the previous release tag before creating the new one
   - Gather commits in the range from the previous release tag to `HEAD`
   - Convert those commits into a bullet-point list of user-facing changes for the user to review
   - Treat this list as draft GitHub release notes and ask the user to confirm or refine it before publishing

8. Publish through GitHub Release.
   - Create a Git tag and GitHub Release for the new version, typically `vX.Y.Z`
   - Prefer the GitHub CLI, for example `gh release create vX.Y.Z --title vX.Y.Z --notes-file <prepared-notes-file>`
   - The workflow in `.github/workflows/publish-func.yml` publishes `./dist/packages/func` on `release.created`
   - Monitor the workflow result before treating the release as complete

9. Verify success.
   - Confirm the GitHub Action succeeded
   - Confirm the new version is visible on NPM after the registry has had time to update

## Completion Checks

Treat the release as complete only when all of the following are true:

- `packages/func/package.json` and `dist/packages/func/package.json` reflect the intended version
- Build and test passed after the version bump
- The release commit exists with the expected `Version Bump <version>` message
- The user reviewed the draft release notes derived from commits since the previous release
- The release workflow completed successfully
- The package version is available from the NPM registry

## Repo-Specific Notes

- This repo currently publishes from `dist/packages/func`, not from the repository root
- `dist/` is gitignored and is not pushed to the remote branch
- The release workflow uses Node 22 and `npm ci`
- The workflow publishes only for GitHub Release creation events, not for every push to `main`
- Release notes should be derived from commits since the previous GitHub release and shown to the user before publishing

## If Something Looks Off

- If `dist/packages/func/package.json` does not match the root version after build, investigate the build pipeline instead of patching the file manually
- If the worktree contains unrelated user changes, stop and abort the release process instead of trying to work around it
- If the suggested version looks wrong, stop and ask the user to confirm the exact target version before making changes
- If there is no prior release tag, ask the user what commit range should be used for release notes
- If tests pass locally but publish fails in CI, inspect the workflow logs and the NPM auth configuration rather than retrying blindly
