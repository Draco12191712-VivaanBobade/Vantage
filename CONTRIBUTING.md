# Contributing to the Project

## Before You Start

Before contributing:

1. Check existing issues and PRs.
2. Make sure your change is not already being worked on.
3. For large changes, open an issue first to discuss the proposed implementation.
4. Test your changes in Minecraft Bedrock before submitting them.
5. Keep changes focused and avoid unrelated modifications.

## Development Environment

Recommended tools:

- Minecraft Bedrock Edition
- Visual Studio Code
- Git
- A Bedrock development tool such as Bridge v2/Nova Resolve or Blockbench when appropriate
- JSON and JavaScript language support

The project should be developed against the Minecraft Bedrock version 1.26.0+.

When testing changes, use a clean test world whenever possible.


## Getting Started

Clone the repository and create a development branch:

```bash
git clone https://github.com/Draco12191712-VivaanBobade/Vantage.git
cd Vantage
git checkout -b feature/your-feature
```

Make your changes and test them in Minecraft Bedrock.

Before committing, inspect the changed files and make sure no temporary files, generated files, credentials, or unrelated changes are included.

## Coding Standards

### JavaScript

Use modern JavaScript supported by the Minecraft Bedrock Script API version targeted by the project.

Prefer:

- `const` when a binding does not change
- `let` when a binding must change
- ES module imports and exports
- Small, focused functions
- Explicit validation at API boundaries
- Defensive handling of unavailable Minecraft APIs
- Immutable constants where appropriate
- Early returns for invalid input

Avoid:

- Global mutable state
- Unnecessary allocations inside high-frequency tick loops
- Duplicated utility functions
- Unhandled exceptions
- Unnecessary API calls
- Unrelated refactoring in feature branches

### Naming

Use descriptive names.

Examples:

```text
getPlayerState
updateCamera
interpolateVector3
isFirstPerson
resetPlayer
```

Use `camelCase` for functions and variables.

Use `PascalCase` for classes.

Use uppercase constants for true global constants where appropriate.

### Imports

Keep imports explicit and only import functionality that the module actually uses.

Example:

```js
import {
    clamp01,
    lerp
} from "../utilities/math.js";
```

Do not import an entire module solely to access one unrelated feature.

### Comments

Comments should explain intent or non-obvious implementation details.

Do not add comments that merely restate what the code already clearly expresses.

## Minecraft Bedrock Development

All Minecraft API usage must be compatible with the project's supported Bedrock version.

Do not assume that an API exists simply because it exists in another Minecraft version or in Java Edition.

When using a Minecraft API:

1. Verify that the API is available in the target Bedrock version.
2. Handle unavailable components or properties safely where compatibility requires it.
3. Avoid relying on undocumented behavior.
4. Test the behavior in an actual Bedrock environment.

Do not mix Java Edition APIs with Bedrock Script API code.

## Testing

Every functional change should be tested before submitting a pull request.

At minimum, test:

- World loading
- Player joining
- Player leaving
- Respawning
- First-person camera
- Third-person camera
- Camera transitions
- Player movement
- Sprinting
- Sneaking
- Swimming
- Jumping
- Falling
- Flying or gliding where applicable
- Riding where applicable
- Multiplayer where applicable
- Resource-pack compatibility where applicable

For performance-related changes, test both:

- A normal world
- A relatively demanding world with many entities or effects

Also test repeated world loading and player reconnecting to catch state-management and cleanup bugs.

## Bug Reports

When reporting a bug, provide as much relevant information as possible.

Include:

- Minecraft Bedrock version
- Addon version
- Device/platform
- Single-player or multiplayer
- Steps to reproduce
- Expected behavior
- Actual behavior
- Relevant error messages
- Relevant logs when available
- Minimal reproduction information when possible

A useful bug report should allow another developer to reproduce the problem.

## Feature Requests

Feature requests are welcome.

A feature request should explain:

- What the feature does
- Why it would be useful
- How it should behave
- Whether it affects existing functionality
- Whether it introduces compatibility concerns
- Any relevant technical considerations

For large features, discuss the architecture before implementing the feature.

## Pull Requests

Before opening a pull request:

1. Make sure the project loads successfully.
2. Test the changed functionality in Minecraft Bedrock.
3. Check for Script API errors.
4. Check for malformed JSON.
5. Remove debugging code.
6. Remove unused imports.
7. Review the complete diff.
8. Ensure the pull request contains only relevant changes.

Pull requests should have:

- A clear title
- A concise description
- Testing information
- Any compatibility considerations
- Screenshots or recordings when visual behavior changes

Keep pull requests focused.

A pull request that changes camera behavior should not also contain unrelated formatting changes across the entire repository.

## Commit Messages

Use concise, descriptive commit messages.

Recommended format:

```text
type: description
```

Examples:

```text
feat: add camera transition smoothing
fix: prevent invalid player state access
perf: reduce per-tick camera allocations
refactor: simplify visibility state handling
docs: update contribution guidelines
```

Common types include:

- `feat` — New functionality
- `fix` — Bug fix
- `perf` — Performance improvement
- `refactor` — Code restructuring without intended behavior changes
- `docs` — Documentation changes
- `test` — Testing changes
- `chore` — Maintenance

Use imperative wording where practical.

## Compatibility

Compatibility is a core consideration for this project.

Changes should avoid unnecessarily breaking:

- Existing resource packs
- Existing behavior packs
- Existing animations
- Multiplayer functionality
- Existing configuration
- Existing addon integrations

If a change intentionally breaks compatibility, clearly document it in the pull request.

Compatibility modules should contain compatibility-specific behavior rather than spreading version checks throughout unrelated modules.

## Performance

Minecraft scripts can execute frequently, so performance matters.

Avoid:

- Expensive operations every tick when they are not necessary
- Repeated object creation in hot paths
- Unnecessary entity searches
- Repeated component lookups when caching is safe
- Repeated configuration parsing
- Excessive event subscriptions
- Unbounded queues or collections

Prefer:

- Tick-based caches
- Change detection
- Throttling
- Interpolation and smoothing where appropriate
- Reusing calculated values
- Early exits
- Batching work when practical

Performance optimizations must not compromise correctness without a clear reason.

## Documentation

Documentation should be updated when a change affects:

- Public APIs
- Configuration
- Installation
- Supported Minecraft versions
- User-facing behavior
- Development workflows

Keep documentation accurate to the current implementation.

Do not document functionality that does not actually exist.

## Security

Do not commit:

- Passwords
- API keys
- Access tokens
- Private credentials
- Personal authentication information
- Secrets used by development tools

If you discover a security issue, do not publicly post sensitive details in an issue. Follow the project's security-reporting process if one is provided.
