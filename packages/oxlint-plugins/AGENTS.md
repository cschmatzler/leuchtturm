# @one/oxlint-plugins - Custom Oxlint Plugins

## Overview

Custom oxlint ESLint-compatible plugins for the monorepo.

## Structure

```
src/
├── index.ts              # Plugin aggregator + exports
├── types.ts              # Rule types (RuleModule, RuleContext, etc.)
└── no-relative-imports.ts # Disallow relative imports across packages
```

## Available Plugins

| Plugin                | Rule                  | Description                                                         |
| --------------------- | --------------------- | ------------------------------------------------------------------- |
| `no-relative-imports` | `no-relative-imports` | Disallows `./` and `../` imports, requires `@one/*` package imports |

## Usage

### In vite.config.ts

```typescript
import { defineConfig } from "vite-plus";

export default defineConfig({
	lint: {
		plugins: ["eslint", "typescript", "unicorn", "react", "oxc", "import"],
		jsPlugins: ["./packages/oxlint-plugins/dist/no-relative-imports.mjs"],
		rules: {
			"no-relative-imports/no-relative-imports": "error",
		},
	},
});
```

### Building

```bash
pnpm --filter @one/oxlint-plugins build
```

## Conventions

### Rule Structure

```typescript
import type { Plugin, RuleModule } from "./types";

const rule: RuleModule = {
	meta: {
		docs: {
			description: "Rule description",
		},
		type: "problem",
	},
	create(context) {
		return {
			NodeType(node) {
				// Check AST nodes
				if (violation) {
					context.report({ node, message: "Error message" });
				}
			},
		};
	},
};

const plugin: Plugin = {
	meta: { name: "plugin-name" },
	rules: {
		"rule-name": rule,
	},
};

export default plugin;
```

### AST Node Types

Common node types for import rules:

- `ImportDeclaration` - ES import statement
- `ExportNamedDeclaration` - Named export
- `ExportAllDeclaration` - Export all

### Context Methods

```typescript
context.report({
	node: BaseNode;
	message: string;
	data?: Record<string, unknown>; // For message interpolation
	fix?: unknown; // Auto-fix function
});
```

## Anti-Patterns

| Never           | Instead                         |
| --------------- | ------------------------------- |
| Use `any` type  | Define proper types in types.ts |
| Skip meta/docs  | Always include description      |
| Hardcoded paths | Use context.filename            |
| Fire-and-forget | Always return from create()     |

## Testing

Run lint to verify plugins work:

```bash
vp lint --type-aware --type-check
```

## Adding New Plugins

1. Create `src/new-plugin.ts`
2. Add to `src/index.ts` exports
3. Add to `tsdown.config.ts` entry array
4. Update `vite.config.ts` jsPlugins
5. Document in this AGENTS.md
