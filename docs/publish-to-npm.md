# Publishing to npm

This project uses [Changesets](https://github.com/changesets/changesets) for version management and publishing.

## Prerequisites

1. Login to npm:
   ```bash
   npm login
   ```

2. Ensure you have access to the `@ai26` npm organization, or create it at https://www.npmjs.com/org/create

## Workflow

### 1. Create a changeset

When you make changes that should be released, create a changeset:

```bash
bunx changeset
```

This will prompt you to:
- Select which packages are affected
- Choose the semver bump type (patch/minor/major) for each
- Write a summary of the changes

A markdown file will be created in `.changeset/` describing the change.

### 2. Commit the changeset

Commit the generated changeset file along with your code changes:

```bash
git add .changeset/*.md
git commit -m "Add changeset for feature X"
```

### 3. Version packages

When ready to release, consume all changesets and bump versions:

```bash
bunx changeset version
```

This will:
- Update `version` in affected package.json files
- Update CHANGELOG.md for each package
- Delete the consumed changeset files

Review and commit the version bumps:

```bash
git add .
git commit -m "Version packages"
```

### 4. Publish to npm

```bash
bun run publish:npm
```

This builds all packages and publishes them to npm with public access.

### 5. Push and tag

```bash
git push
git push --tags
```

## Quick Reference

| Command | Description |
|---------|-------------|
| `bunx changeset` | Create a new changeset |
| `bunx changeset status` | See pending changesets |
| `bunx changeset version` | Apply changesets and bump versions |
| `bun run publish:npm` | Build and publish all packages |

## Package Structure

| Package | npm Name | Description |
|---------|----------|-------------|
| packages/auth | `@ai26/zag-auth` | Authentication verification library |
| packages/cli | `@ai26/zag` | CLI tool |
| packages/example | (private) | Example - not published |

## Tips

- Create changesets as you work, not just before release
- Use `patch` for bug fixes, `minor` for new features, `major` for breaking changes
- The CLI package depends on the auth package for dev/testing, so coordinate releases if needed
