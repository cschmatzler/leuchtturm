import { useHotkey } from "@tanstack/react-hotkeys";

export function useShellShortcuts({
	onOpenCommandBar,
	onSignOut,
}: {
	onOpenCommandBar: () => void;
	onSignOut: () => void | Promise<void>;
}) {
	useHotkey("Mod+K", () => onOpenCommandBar(), { ignoreInputs: false });
	useHotkey("Alt+Shift+Q", () => onSignOut());
}
