import { ArrowBigUpIcon, OptionIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Kbd, KbdGroup } from "@roasted/web/components/ui/kbd";

function getPlatformOptionKey(): ReactNode {
	return /Mac|iPod|iPhone|iPad/.test(navigator.userAgent) ? (
		<OptionIcon className="size-3" />
	) : (
		"Alt"
	);
}

function renderShortcut(keys: ReactNode[]) {
	return (
		<KbdGroup>
			{keys.map((key, index) => (
				<Kbd key={index}>{key}</Kbd>
			))}
		</KbdGroup>
	);
}

export function renderSequenceShortcut(keys: string[]) {
	return renderShortcut(keys);
}

export function renderOptionShortcut(keys: string[]) {
	return renderShortcut([getPlatformOptionKey(), ...keys]);
}

export function renderOptionShiftShortcut(key: string) {
	return renderShortcut([
		getPlatformOptionKey(),
		<ArrowBigUpIcon key="shift" className="size-3" />,
		key,
	]);
}
