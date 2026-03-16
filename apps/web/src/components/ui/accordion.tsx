import { Accordion as BaseAccordion } from "@base-ui/react/accordion";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { cn } from "@roasted/web/lib/cn";

function Accordion({ className, ...props }: BaseAccordion.Root.Props) {
	return (
		<BaseAccordion.Root
			data-slot="accordion"
			className={cn("flex w-full flex-col", className)}
			{...props}
		/>
	);
}

function AccordionItem({ className, ...props }: BaseAccordion.Item.Props) {
	return (
		<BaseAccordion.Item
			data-slot="accordion-item"
			className={cn("border-b last:border-b-0", className)}
			{...props}
		/>
	);
}

function AccordionTrigger({ className, children, ...props }: BaseAccordion.Trigger.Props) {
	return (
		<BaseAccordion.Header className="flex">
			<BaseAccordion.Trigger
				data-slot="accordion-trigger"
				className={cn(
					"focus-visible:border-ring focus-visible:ring-ring/50 group/accordion-trigger relative flex flex-1 items-start justify-between gap-4 rounded-md border border-transparent py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50",
					className,
				)}
				{...props}
			>
				{children}
				<ChevronDownIcon
					data-slot="accordion-trigger-icon"
					className="text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200 group-aria-expanded/accordion-trigger:hidden"
				/>
				<ChevronUpIcon
					data-slot="accordion-trigger-icon"
					className="text-muted-foreground pointer-events-none hidden size-4 shrink-0 translate-y-0.5 transition-transform duration-200 group-aria-expanded/accordion-trigger:inline"
				/>
			</BaseAccordion.Trigger>
		</BaseAccordion.Header>
	);
}

function AccordionContent({ className, children, ...props }: BaseAccordion.Panel.Props) {
	return (
		<BaseAccordion.Panel data-slot="accordion-content" className="overflow-hidden" {...props}>
			<div
				className={cn(
					"h-(--accordion-panel-height) pt-0 pb-4 text-sm data-[ending-style]:h-0 data-[starting-style]:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-4",
					className,
				)}
			>
				{children}
			</div>
		</BaseAccordion.Panel>
	);
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
