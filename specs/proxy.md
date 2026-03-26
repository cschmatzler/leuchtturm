# Remote Mail Asset Proxy

## Context

Rendering sanitized HTML email directly in the browser still allows browser-initiated fetches for remote assets such as:

- `<img src="https://...">`
- inline CSS declarations containing `url(...)`
- inline CSS declarations containing `image-set(...)` or similar URL-bearing functions

That leaks recipient network information to sender-controlled infrastructure and enables tracking pixels.

## Goal

Preserve most HTML email styling while preventing direct browser requests to sender-controlled remote assets.

## Non-Goal

Do **not** remove the `style` attribute entirely. That would break too much email formatting.

## Policy

### 1. Proxy remote image sources

Remote image sources should be rewritten to an application-controlled proxy endpoint instead of being loaded directly by the browser.

Desired shape:

- stored or rendered HTML uses app-owned URLs
- proxy URLs are signed so the endpoint cannot be abused as a public fetch proxy
- proxy only permits `http` and `https`
- proxy only serves image content
- proxy enforces request timeout and response size limits
- proxy blocks SSRF targets, including private, loopback, link-local, and otherwise local network addresses
- proxy should cache upstream responses

Examples of viable open-source building blocks:

- `imgproxy`
- `camo`
- `imagor`

We do not need a full Gmail-style renderer. We only need a safe image proxy plus HTML/CSS rewriting.

### 2. Keep inline `style`, but strip URL-bearing declarations

We should preserve `style` for normal email formatting, but remove declarations that can trigger remote fetches.

At minimum, remove declarations whose values contain:

- `url(...)`
- `image-set(...)`
- `-webkit-image-set(...)`

Examples:

- remove `background-image: url(...)`
- remove `background: url(...) no-repeat center / cover`
- keep `font-size`, `margin`, `padding`, `color`, `text-align`, etc.

## Implementation Notes

### CSS handling

Do **not** use regex or raw string replacement on the whole style attribute.

Instead:

1. parse the inline style declaration list
2. inspect each declaration value
3. drop declarations containing URL-bearing functions
4. serialize the remaining declarations back into `style`

This keeps the majority of email formatting intact while removing remote-fetch behavior.

### HTML handling

When sanitizing or rendering HTML mail:

1. sanitize the HTML structure
2. rewrite remote `<img src>` values to signed proxy URLs
3. filter inline `style` declarations to remove URL-bearing declarations
4. render the transformed HTML

## Practical Recommendation

Preferred implementation order:

1. add signed remote image proxy
2. rewrite `<img src>` through the proxy
3. filter `url(...)`-bearing inline CSS declarations instead of stripping `style`

This addresses the privacy issue without destroying common email layout and typography.
