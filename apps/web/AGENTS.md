# @chevrotain/web - React Frontend

## Overview

React 19 SPA with TanStack Router, @rocicorp/zero for local-first data, i18next for i18n.

## Structure

```
src/
├── pages/           # File-based routes ($slug._app.*.tsx pattern)
├── components/
│   ├── ui/          # shadcn-style primitives (Base UI + CVA)
│   ├── app/         # App-specific components (Loading, NotFound)
│   ├── data-table-filter/  # Complex filtering system
│   └── billing/     # Billing/subscription UI
├── hooks/           # Custom React hooks
├── contexts/        # React contexts (Zero, Organization, CommandBar)
├── clients/         # API/auth/i18n clients
├── lib/             # Utilities (cn, query helpers, search params)
├── queries/         # React Query query definitions
└── public/locales/  # i18next translation files
```

## Where to Look

| Task                 | Location                                 |
| -------------------- | ---------------------------------------- |
| Add page             | `pages/$slug._app.{name}.tsx`            |
| Add UI primitive     | `components/ui/` (follow shadcn pattern) |
| Add hook             | `hooks/use-{name}.ts` + test file        |
| Add Zero query usage | Use `useZeroQuery(queries.xxx())`        |
| Add React Query      | `queries/` + use `useReactQuery()`       |
| Add translation      | `public/locales/{lang}/translation.json` |

## Conventions

### Route Context

Every route inside `$slug._app` has access to:

```typescript
const { zero, session, queryClient } = Route.useRouteContext();
```

### Zero vs React Query

- **Zero**: Real-time synced data (grinders, methods, beans, brews, etc.)
- **React Query**: Server-only data (device sessions, billing)

```typescript
// Zero (local-first, reactive)
const [beans] = useZeroQuery(queries.beans());

// React Query (server fetch)
const { data } = useReactQuery(deviceSessionsQuery());
```

### Zero Data Flow & Types

**Query Placement**:

- Call `useZeroQuery(queries.*)` in the component that renders the data
- Pass only identifiers (`slug`, `id`) through props — never Row objects or arrays

**Type Usage**:

- Base `*Row` types from `@chevrotain/zero/schema` are **ALLOWED** for internal typing (e.g., `BrewRow`, `BeanRow`)
- Compound type aliases combining Row types with relations are **NOT ALLOWED** (e.g., `BeanWithBrewsRow`, `BrewWithDetailsRow`)
- Inline types where needed (e.g., `createFilterBuilder<(typeof rows)[number]>()`)

**Anti-Patterns**:

```tsx
// BAD: Wrapper/inner pattern with key prop
function BeanForm({ beanId }) {
	const [bean] = useZeroQuery(queries.bean({ id: beanId }));
	return <BeanFormInner key={bean?.id ?? "new"} bean={bean} />;
}
function BeanFormInner({ bean }: { bean: BeanRow }) {
	/* ... */
}

// BAD: Passing Row arrays through props
function BrewForm({
	beans,
	methods,
}: {
	beans: readonly BeanRow[];
	methods: readonly MethodRow[];
}) {
	/* ... */
}

// BAD: Compound type aliases
type BeanWithBrews = BeanRow & { brews: BrewRow[] };
```

**Correct Pattern** (single component, queries inside):

```tsx
// GOOD: Single component with identifier props
function BeanForm({ beanId, onSubmit }: { beanId?: string; onSubmit?: () => void }) {
	const [bean] = useZeroQuery(queries.bean({ id: beanId ?? "" }));

	// Early return for loading (no spinners)
	if (beanId && !bean) return null;

	const form = useForm({
		defaultValues: { name: bean?.name ?? "" },
		// ...
	});

	return <form>...</form>;
}
```

### Hook Ordering

Hooks in components must follow this order:

```tsx
function MyComponent() {
	// 1. Router hooks
	const { slug } = Route.useParams();
	const search = Route.useSearch();
	const navigate = useNavigate();

	// 2. Translation
	const { t } = useTranslation();

	// 3. Library instances
	const { zero } = useZero();
	const queryClient = useQueryClient();

	// 4. Data fetching
	const [data] = useZeroQuery(queries.myData({ slug }));

	// 5. Local state
	const [isOpen, setIsOpen] = useState(false);

	// 6. Derived values
	const sortedItems = useMemo(() => /* ... */, [items]);

	// 7. Callbacks
	const handleSubmit = useCallback(() => /* ... */, []);

	// 8. Custom behavior hooks (shortcuts, commands, etc.)
	useShortcuts({ "g b": () => navigate({ to: "/beans" }) });
	useCommandProvider("myProvider", async () => [...], [deps]);

	// 9. Effects
	useEffect(() => /* ... */, []);

	// 10. Form hooks (last, as they depend on above)
	const form = useForm({ /* ... */ });
}
```

### Handler Naming

- **Props**: Use `onX` pattern (`onSubmit`, `onClick`, `onOpenChange`)
- **Internal handlers**: Use `handleX` pattern (`handleSubmit`, `handleClick`)

```tsx
// Props use onX
type DialogProps = {
	onOpenChange: (open: boolean) => void;
	onSubmit: () => void;
};

// Internal handlers use handleX
function MyDialog({ onOpenChange, onSubmit }: DialogProps) {
	const handleClose = () => {
		cleanup();
		onOpenChange(false);
	};

	const handleFormSubmit = () => {
		validate();
		onSubmit();
	};
}
```

### Boolean Naming

Use semantic prefixes for boolean variables:

| Prefix   | Usage             | Examples                         |
| -------- | ----------------- | -------------------------------- |
| `is`     | State/condition   | `isLoading`, `isOpen`, `isValid` |
| `has`    | Possession        | `hasError`, `hasChildren`        |
| `should` | Behavior/decision | `shouldValidate`, `shouldFetch`  |
| `can`    | Capability        | `canEdit`, `canDelete`           |

### Type Naming

- Props types: `XProps` (`DialogProps`, `ButtonProps`)
- State types: `XState` (`FormState`, `FilterState`)
- Config/options: `XConfig` or `XOptions`
- No `I` prefix for interfaces
- Prefer `type` over `interface`

### Forms (TanStack Form + Effect Schema)

Extract validation schemas and submit handlers inside the component:

```typescript
import { Schema } from "effect";

function Page() {
	const shape = Schema.Struct({
		name: Schema.NonEmptyString,
		email: Schema.String.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
		password: Schema.String.check(Schema.isMinLength(13)),
	});

	const onSubmit = async (value: typeof shape.Type) => {
		// submission logic
	};

	const form = useForm({
		defaultValues: { name: "", email: "", password: "" },
		validators: {
			onSubmit: Schema.toStandardSchemaV1(shape),
		},
		onSubmit: ({ value }) => onSubmit(value),
	});
}
```

- Convert Effect Schemas to StandardSchemaV1 with `Schema.toStandardSchemaV1()` for form validators
- Reference field schemas from `@chevrotain/core` where available (e.g., `User.fields.email`)
- Extract async submit logic into named functions
- Use camelCase for event properties (e.g., `isNewUser`, `errorType`)

### Shortcuts

Keyboard shortcuts in `use-shortcuts.ts`. Pattern: `"g b"` (go beans), `"alt+n b"` (newbean).

```typescript
useShortcuts({
	"g b": () => navigate({ to: "/beans" }),
	"g m": () => navigate({ to: "/methods" }),
	"alt+n b": () => openNewBeanDialog(),
});
```

### Translations

All user-facing strings via `useTranslation()`. Keys in `public/locales/{lang}/translation.json`.

```tsx
const { t } = useTranslation();

<h1>{t("beans.title")}</h1>
<p>{t("beans.description", { count: 5 })}</p>
```

### Error Handling

Use `reportUiError` for async errors:

```typescript
import { reportUiError } from "@chevrotain/web/lib/report-ui-error";

try {
	await zero.mutate.bean.create(beanData);
} catch (error) {
	reportUiError({ error, message: t("error.creatingBean") });
}
```

### Zero Context

The `ZeroProvider` in `contexts/zero.tsx` handles:

- Zero client initialization
- Preloading `queries.currentUser()`
- Router context injection
- Loading state while Zero initializes

### Command Bar Context

The `CommandBarProvider` in `contexts/command-bar.tsx` provides:

- Command registration
- Keyboard shortcut management
- Global search/command palette

## UI Components

Located in `components/ui/`. Follow shadcn/ui patterns:

- Use Base UI primitives
- Use CVA for variants
- Export with useRender (no explicit forwardRef needed)
- Support all standard HTML attributes
- Use `cn()` for class merging

### Component Pattern

```typescript
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@chevrotain/web/lib/cn";

const buttonVariants = cva("inline-flex items-center justify-center gap-2 ...", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground",
			destructive: "bg-destructive text-white",
		},
		size: {
			default: "h-11 px-6 py-2",
			sm: "h-9 px-4",
		},
	},
	defaultVariants: {
		variant: "default",
		size: "default",
	},
});

function Button({
	variant,
	size,
	className,
	...props
}: useRender.ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
	return useRender({
		defaultTagName: "button",
		props: {
			"data-slot": "button",
			className: cn(buttonVariants({ variant, size, className })),
			...props,
		},
	});
}
```

### Design Tokens

Colors defined in `index.css`:

| Token         | Usage             |
| ------------- | ----------------- |
| `background`  | Page background   |
| `foreground`  | Body text         |
| `primary`     | Main actions      |
| `secondary`   | Alternate actions |
| `accent`      | Highlights        |
| `destructive` | Errors, deletion  |
| `muted`       | Disabled state    |
| `border`      | Borders           |
| `ring`        | Focus rings       |

### Data Table Filter

Complex filtering system in `components/data-table-filter/`:

- Uses search params for filter state
- Supports multiple filter types (text, number, date, option)
- Operators: equals, contains, greaterThan, lessThan, etc.
- FilterBuilder pattern for type-safe filters

```typescript
const builder = createFilterBuilder<BeanRow>();
const filterDefinitions = [
	builder
		.text()
		.id("name")
		.accessor((d) => d.name)
		.build(),
	builder
		.option()
		.id("roaster")
		.accessor((d) => d.roaster)
		.options(roasters)
		.build(),
];
```

## Testing

Test files alongside source files with `.test.ts` suffix:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";

describe("useLocalStorage", () => {
	it("should persist value", () => {
		const [value, setValue] = useLocalStorage("key", "default");
		// ...
	});
});
```

Testing conventions:

- Tests colocated with source: `file.ts` → `file.test.ts`
- Use `describe` for grouping (max 3 levels deep)
- Use `it` for individual tests
- Readable test names: `it("returns true when condition")`
- Mock with `vi.fn()`, `vi.mock()`, `vi.spyOn()`
- Use `vi.hoisted()` for module-level mocks
- Factory functions for test data
- Explicit assertions (no snapshots)

### Test File Pattern

```typescript
import { describe, it, expect, vi, beforeEach } from "vite-plus/test";
import { renderHook, act } from "@testing-library/react";
import { useLocalStorage } from "./use-local-storage";

describe("useLocalStorage", () => {
	let localStorageMock: Storage;

	beforeEach(() => {
		localStorageMock = {
			getItem: vi.fn(),
			setItem: vi.fn(),
			removeItem: vi.fn(),
			clear: vi.fn(),
			key: vi.fn(),
			length: 0,
		};
		Object.defineProperty(window, "localStorage", {
			value: localStorageMock,
			writable: true,
		});
	});

	it("returns default value", () => {
		const { result } = renderHook(() => useLocalStorage("key", "default"));
		expect(result.current[0]).toBe("default");
	});
});
```

## Build Configuration

Vite config in `vite.config.ts`:

- TanStack Router plugin for file-based routing
- React plugin with React Compiler
- Tailwind CSS via Vite plugin
- Path aliases via `@chevrotain/*` and `~/`

### Key Build Settings

```typescript
export default defineConfig({
	plugins: [
		TanStackRouterVite({
			routesDirectory: "src/pages",
			generatedRouteTree: "src/routeTree.gen.ts",
		}),
		React Compiler,
		tailwindcss(),
	],
	resolve: {
		alias: {
			"~/": path.resolve(__dirname, "src/"),
		},
	},
});
```

## Anti-Patterns

| Never                                | Instead                                        |
| ------------------------------------ | ---------------------------------------------- |
| Direct fetch in components           | Use Zero mutations or React Query              |
| Inline styles                        | Use Tailwind + CVA                             |
| `any` types                          | Define proper types                            |
| Missing exhaustive-deps              | Fix hook dependencies (error, not warning)     |
| Manually add/remove translation keys | Translation files are managed externally       |
| `console.log` in production code     | Use `reportUiError` or remove                  |
| Passing Zero rows through props      | Pass IDs only, query in child components       |
| Wrapper components with `key` prop   | Single component with conditional early return |

## Client Initialization

### API Client

```typescript
// clients/api.ts
const baseUrl = import.meta.env.VITE_BASE_URL;

async function postJson(path: string, body: unknown): Promise<unknown> {
	const response = await fetch(`${baseUrl}/api${path}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		credentials: "include",
		body: JSON.stringify(body),
	});
	return response.json();
}

export const api = {
	analytics: {
		$post: (opts: { json: { events: unknown[] } }) => postJson("/analytics", opts.json),
	},
	errors: {
		$post: (opts: { json: { errors: unknown[] } }) => postJson("/errors", opts.json),
	},
};
```

### Auth Client

```typescript
// clients/auth.ts
import { createAuthClient } from "better-auth/react";

export const auth = createAuthClient({
	baseURL: import.meta.env.VITE_BASE_URL,
});
```

### i18n Client

```typescript
// clients/i18n.ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
	lng: "en",
	fallbackLng: "en",
	resources: {
		/* ... */
	},
});
```

## File-Based Routing

Route files use TanStack Router conventions:

| File                             | Path               | Description       |
| -------------------------------- | ------------------ | ----------------- |
| `pages/_app.tsx`                 | `/`                | App layout        |
| `pages/$slug._app.tsx`           | `/:slug`           | Org-scoped layout |
| `pages/$slug._app.beans.tsx`     | `/:slug/beans`     | Beans list        |
| `pages/$slug._app.beans.$id.tsx` | `/:slug/beans/:id` | Bean detail       |
| `pages/$slug._app.brews.new.tsx` | `/:slug/brews/new` | New brew form     |

### Route Context Pattern

```typescript
// $slug._app.tsx - parent route
export const Route = createFileRoute("/$slug/_app")({
	beforeLoad: async ({ context, params }) => {
		// Set up context for child routes
		return {
			zero: context.zero,
			session: context.session,
			queryClient: context.queryClient,
		};
	},
	component: AppLayout,
});

// $slug._app.beans.tsx - child route
function BeansPage() {
	const { slug } = Route.useParams();
	const [beans] = useZeroQuery(queries.beans({ slug }));
	// ...
}
```

## Search Params

Use TanStack Router's search params for filter state:

```typescript
// Define search schema
const SearchSchema = z.object({
	page: z.number().optional(),
	sort: z.string().optional(),
	filter: z.string().optional(),
});

// In component
const search = Route.useSearch();
const navigate = Route.useNavigate();

// Update search params
navigate({ search: { page: 2 } });
```
