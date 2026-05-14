import { CheckIcon } from "@phosphor-icons/react/Check";
import { CopyIcon } from "@phosphor-icons/react/Copy";
import { type ComponentProps, type ReactNode, type RefObject, useState } from "react";

import { Button } from "@leuchtturm/web/components/ui/button";
import { cn } from "@leuchtturm/web/lib/utils";

interface CopyButtonProps extends ComponentProps<typeof Button> {
	readonly text?: string;
	readonly html?: string;
	readonly htmlRef?: RefObject<HTMLElement | null>;
	readonly copiedLabel?: ReactNode;
	readonly onCopied?: () => void;
	readonly onCopyError?: (error: unknown) => void;
}

function CopyButton({
	text,
	html,
	htmlRef,
	copiedLabel = "Copied",
	children = "Copy",
	className,
	onClick,
	onCopied,
	onCopyError,
	...props
}: CopyButtonProps) {
	const [copied, setCopied] = useState(false);

	const copyToClipboard = async (event: Parameters<NonNullable<CopyButtonProps["onClick"]>>[0]) => {
		onClick?.(event);
		if (event.defaultPrevented) return;

		try {
			const htmlContent = html ?? htmlRef?.current?.innerHTML;
			let textContent = text;

			if (!textContent && htmlContent) {
				const element = document.createElement("div");
				element.innerHTML = htmlContent;
				textContent = element.textContent ?? "";
			}

			if (!textContent) return;

			if (htmlContent) {
				await navigator.clipboard.write([
					new ClipboardItem({
						"text/html": new Blob([htmlContent], { type: "text/html" }),
						"text/plain": new Blob([textContent], { type: "text/plain" }),
					}),
				]);
			} else {
				await navigator.clipboard.writeText(textContent);
			}

			setCopied(true);
			onCopied?.();
			setTimeout(() => setCopied(false), 2000);
		} catch (error) {
			onCopyError?.(error);
		}
	};

	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			className={cn("gap-1.5", className)}
			onClick={copyToClipboard}
			{...props}
		>
			{copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
			{copied ? copiedLabel : children}
		</Button>
	);
}

export { CopyButton };
