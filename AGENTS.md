# Workflow

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
