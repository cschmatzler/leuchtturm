import { useTranslation } from "react-i18next";

import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "@leuchtturm/web/components/ui/command";
import { useCommandBar } from "@leuchtturm/web/hooks/use-command-bar";

function CommandBar() {
	const { t } = useTranslation();
	const commandBar = useCommandBar();

	return (
		<CommandDialog open={commandBar.visible} onOpenChange={commandBar.toggle}>
			<CommandInput
				value={commandBar.input}
				onValueChange={commandBar.setInput}
				placeholder={t("Type a command...")}
			/>
			<CommandList>
				<CommandEmpty>{t("No results found.")}</CommandEmpty>
				{Object.entries(commandBar.categories).map(([category, actions]) => (
					<CommandGroup heading={category} key={category}>
						{actions.map((action) => (
							<CommandItem
								key={action.value ?? action.title}
								value={action.value ?? action.title}
								onSelect={async () => {
									commandBar.setInput("");
									commandBar.hide();
									await action.run();
								}}
							>
								<action.icon className="mr-2 size-5" />
								{action.title}
								{action.shortcut && (
									<CommandShortcut className="ml-auto">
										<action.shortcut />
									</CommandShortcut>
								)}
							</CommandItem>
						))}
					</CommandGroup>
				))}
			</CommandList>
		</CommandDialog>
	);
}

export { CommandBar };
