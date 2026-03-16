import { Collapsible as BaseCollapsible } from "@base-ui/react/collapsible";

function Collapsible({ ...props }: BaseCollapsible.Root.Props) {
	return <BaseCollapsible.Root data-slot="collapsible" {...props} />;
}

function CollapsibleTrigger({ ...props }: BaseCollapsible.Trigger.Props) {
	return <BaseCollapsible.Trigger data-slot="collapsible-trigger" {...props} />;
}

function CollapsibleContent({ ...props }: BaseCollapsible.Panel.Props) {
	return <BaseCollapsible.Panel data-slot="collapsible-content" {...props} />;
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
