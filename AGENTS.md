<!-- intent-skills:start -->

## Skill Loading

Before substantial work:

- Skill check: run `npx @tanstack/intent@latest list`, or use skills already listed in context.
- Skill guidance: if one local skill clearly matches the task, run `npx @tanstack/intent@latest load <package>#<skill>` and follow the returned `SKILL.md`.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

# Workflow

- IF YOU ARE ASKED A QUESTION, STOP EDITING FILES AND ANSWER IT.
- Talk to the user. Do not go ahead on your own. Make sure the requirements are abundantly clear before editing files. Use the questions tool a lot.
- Collaborate with the user. You are _not_ alone. If there's any ambiguity, stop editing files and use the questions tool. Do not _just_ go ahead.
- Never try to generate migrations yourself. Tell the user to.
- Do not stop at "yeah, you're right" or similar acknowledgement when the user is clearly pointing out a mistake that should be corrected. Fix it in the same turn.

# Vite+ Toolchain

```bash
vp lint         # Lint code
vp test         # Run tests
vp fmt          # Format code
vp check        # Lint + type check
```

`vp lint` and `vp check` include type checking. Never run `tsc` directly.

All testing and build utilities import from `vite-plus`:

```typescript
import { describe, it, expect, vi } from "vite-plus/test";
import { defineConfig } from "vite-plus";
```

Always run `vp check` and `vp test` after making changes.

---

- IF YOU ARE ASKED A QUESTION, STOP EDITING FILES AND ANSWER IT.
