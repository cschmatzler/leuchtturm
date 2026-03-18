# @chevrotain/email - React Email Templates

## Overview

React Email templates with Resend for transactional emails.

## Structure

```
src/
├── index.ts           # Resend client export
├── tailwind.ts        # Tailwind config for emails
└── password-reset.tsx # Password reset email template
```

## Where to Look

| Task                  | Location            |
| --------------------- | ------------------- |
| Add email template    | Create `{name}.tsx` |
| Modify Tailwind theme | `tailwind.ts`       |
| Send email            | Use `resend` client |

## Conventions

### Email Template Pattern

Create a component and render function:

```typescript
import {
	Body,
	Button,
	Container,
	Heading,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import { Tailwind } from "@react-email/tailwind";
import { tailwindConfig } from "@chevrotain/email/tailwind";

const WelcomeEmail = ({ userName }: { userName: string }) => {
	return (
		<Html lang="en">
			<Tailwind config={tailwindConfig}>
				<Preview>Welcome to Chevrotain</Preview>
				<Body className="bg-background font-sans text-foreground">
					<Container className="mx-auto w-full max-w-[560px] px-4 py-10">
						<Heading>Welcome {userName}</Heading>
						<Text>Thank you for joining Chevrotain.</Text>
						<Button href="https://chevrotain.schmatzler.com">Get Started</Button>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

export async function renderWelcomeEmail({ userName }: { userName: string }) {
	const html = await render(<WelcomeEmail userName={userName} />, {
		pretty: false,
	});

	const text = `Welcome ${userName}!\n\nThank you for joining Chevrotain.`;

	return { html, text };
}
```

### Email Template Boilerplate

```typescript
// 1. Imports
import {
	Body,
	Button,
	Container,
	Heading,
	Html,
	Preview,
	Section,
	Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import { Tailwind } from "@react-email/tailwind";
import { tailwindConfig } from "@chevrotain/email/tailwind";

// 2. Props interface
interface TemplateNameProps {
	// Required props first, then optional
	userName: string;
	actionUrl: string;
	title?: string;
}

// 3. Component
const TemplateName = ({ userName, actionUrl, title = "Default" }: TemplateNameProps) => {
	return (
		<Html lang="en">
			<Tailwind config={tailwindConfig}>
				<Preview>{title}</Preview>
				<Body className="bg-background font-sans text-foreground">
					<Container className="mx-auto w-full max-w-[560px] px-4 py-10">
						<Section>
							<Heading as="h1">{title}</Heading>
							<Text>Hello {userName},</Text>
						</Section>
						<Section>
							<Button href={actionUrl}>Take Action</Button>
						</Section>
					</Container>
				</Body>
			</Tailwind>
		</Html>
	);
};

// 4. Render function
export async function renderTemplateName(props: TemplateNameProps) {
	const html = await render(<TemplateName {...props} />, { pretty: false });

	const text = [
		props.title ?? "Default Title",
		"",
		`Hello ${props.userName},`,
		"",
		`Take action: ${props.actionUrl}`,
	].join("\n");

	return { html, text };
}
```

### Tailwind Configuration

The `tailwind.ts` exports a config using React Email's pixelBasedPreset:

```typescript
import { pixelBasedPreset, type TailwindConfig } from "@react-email/tailwind";

export const tailwindConfig: TailwindConfig = {
	presets: [pixelBasedPreset],
	theme: {
		extend: {
			colors: {
				background: "oklch(0.9551 0 0)",
				foreground: "oklch(0.3211 0 0)",
				primary: "oklch(0.8649 0.1073 71.4313)",
				// ... match app theme
			},
			fontFamily: {
				sans: ["Manrope", "ui-sans-serif", "sans-serif"],
			},
		},
	},
};
```

### Color Palette

| Token        | Value                          | Usage               |
| ------------ | ------------------------------ | ------------------- |
| `background` | `oklch(0.9551 0 0)`            | Email background    |
| `foreground` | `oklch(0.3211 0 0)`            | Body text           |
| `primary`    | `oklch(0.8649 0.1073 71.4313)` | Buttons, highlights |
| `secondary`  | `oklch(0.75 0.18 45)`          | Secondary actions   |
| `muted`      | `oklch(0.94 0.03 95)`          | Muted text          |
| `border`     | `oklch(0.45 0.2 270)`          | Borders             |

### Sending Emails

Use the Resend client from `@chevrotain/email/index`:

```typescript
import { resend } from "@chevrotain/email/index";
import { renderPasswordResetEmail } from "@chevrotain/email/password-reset";

const { html, text } = await renderPasswordResetEmail({
	resetUrl: "https://...",
	userName: "John",
});

await resend.emails.send({
	from: "Chevrotain <noreply@chevrotain.schmatzler.com>",
	to: user.email,
	subject: "Reset your password",
	html,
	text,
});
```

### Email Components

Available from `@react-email/components`:

| Component         | Purpose                          |
| ----------------- | -------------------------------- |
| `Html`            | Root element with lang attribute |
| `Head`, `Preview` | Preheader text                   |
| `Body`            | Email body with Tailwind classes |
| `Container`       | Max-width wrapper                |
| `Section`         | Block-level sections             |
| `Heading`         | Typography (h1-h6)               |
| `Text`            | Paragraphs                       |
| `Button`          | CTA buttons                      |
| `Hr`              | Dividers                         |
| `Link`            | Anchor tags                      |
| `Img`             | Images                           |
| `Row`, `Column`   | Layout tables                    |

### Responsive Design

- Use Tailwind classes for styling
- Container has `max-w-[560px]` for email client compatibility
- Use inline styles for critical properties
- Test in multiple email clients
- Pixel-based sizing (no rem/em)

### Text Version

Always provide a text version for accessibility:

```typescript
const text = ["Subject line", "", "Plain text content", "", "Action: https://link"].join("\n");
```

## Anti-Patterns

| Never             | Instead                       |
| ----------------- | ----------------------------- |
| Skip text version | Always provide both HTML/text |
| Use CSS Grid/Flex | Use tables for layout         |
| External CSS/JS   | Inline Tailwind classes only  |
| Large images      | Keep under 200KB total        |
| Custom fonts      | Use system fonts              |
| Background images | Use solid background colors   |
| Dynamic content   | Static templates only         |
| Markdown          | Use HTML + Tailwind           |

## Testing

Preview emails using React Email dev server:

```bash
# From email package
pnpm email dev
```

Or send test emails via Resend:

```typescript
await resend.emails.send({
	from: "test@chevrotain.schmatzler.com",
	to: "your@email.com",
	subject: "Test",
	html: "<p>Test</p>",
});
```

## Integration with Auth

Better-auth sends emails via hooks in `@chevrotain/core/auth/index.ts`:

```typescript
emailAndPassword: {
	sendResetPassword: async ({ user, url }) => {
		const { html, text } = await renderPasswordResetEmail({
			resetUrl: url,
			userName: user.name,
		});
		await resend.emails.send({
			from: "Chevrotain <noreply@chevrotain.schmatzler.com>",
			to: user.email,
			subject: "Reset your password",
			html,
			text,
		});
	},
}
```

## Environment Variables

Required in production:

- `RESEND_API_KEY` - Resend API key

## Size Constraints

- Max email size: 200KB total
- Max width: 560px container
- Image format: PNG/JPG preferred
- Font fallbacks: Always include system fonts

## Email Client Compatibility

| Client     | Support                      |
| ---------- | ---------------------------- |
| Gmail      | Full support                 |
| Outlook    | Partial (fallbacks required) |
| Apple Mail | Full support                 |
| Yahoo      | Full support                 |
| Mobile     | Responsive tables            |

## Development Workflow

1. **Create template**: New file `src/{name}.tsx`
2. **Add render function**: `export async function render{Name}Email()`
3. **Export from index**: Add to `src/index.ts` if needed
4. **Preview**: Run `pnpm email dev`
5. **Test**: Send via Resend to test addresses
6. **Integrate**: Use in auth hooks or API endpoints

## Testing Mock Pattern

In tests, mock the email module:

```typescript
import { vi } from "vite-plus/test";

vi.mock("@chevrotain/email", () => ({
	resend: {
		emails: {
			send: vi.fn(),
		},
	},
}));

// Verify send was called
expect(resend.emails.send).toHaveBeenCalledWith({
	from: expect.stringContaining("chevrotain.schmatzler.com"),
	to: "user@example.com",
	subject: expect.any(String),
	html: expect.any(String),
	text: expect.any(String),
});
```
