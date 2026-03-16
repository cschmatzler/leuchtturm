import type { FC, ReactNode } from "react";
import { createContext, useRef, useState } from "react";
import { groupByProp } from "remeda";

export interface Action {
	title: string;
	value?: string;
	category?: string;
	global?: boolean;
	disabled?: boolean;
	icon: FC<{ className?: string }>;
	shortcut?: FC;
	run: () => void | Promise<void>;
}

type ActionProvider = (input: string) => Promise<Action[]>;

export const Context = createContext<{
	visible: boolean;
	input: string;
	categories: Record<string, Action[]>;
	register: (name: string, provider: ActionProvider) => () => void;
	show: (...providers: string[]) => Promise<void>;
	hide: () => void;
	toggle: (open: boolean) => void;
	setInput: (input: string) => void;
} | null>(null);

export function CommandBarProvider({ children }: { children: ReactNode }) {
	const providersRef = useRef(new Map<string, ActionProvider[]>());
	const activeProvidersRef = useRef<string[]>([]);

	const [visible, setVisible] = useState<boolean>(false);
	const [input, setInput] = useState<string>("");
	const [categories, setCategories] = useState<Record<string, Action[]>>({});

	const resolveActions = async (providerNames: string[], inputValue: string) => {
		const requestedProviders = [...providerNames];
		if (providerNames.length === 0) {
			providerNames = Array.from(providersRef.current.keys());
		} else {
			providerNames = Array.from(new Set(providerNames));
		}

		const activeProviders = providerNames.flatMap((name) => {
			const providers = providersRef.current.get(name);
			if (!providers) {
				console.warn(`Command bar provider "${name}" not found`);
				return [];
			}
			return providers;
		});

		const results = await Promise.all(activeProviders.map((provider) => provider(inputValue)));
		const actions = results.flat().filter((action) => {
			if (requestedProviders.length === 0 && !action.global) return false;
			return !action.disabled;
		});

		return groupByProp(actions, "category");
	};

	const value = {
		visible,
		input,
		categories,
		register: (name: string, provider: ActionProvider) => {
			const currentProviders = providersRef.current.get(name) || [];
			if (!currentProviders.includes(provider)) {
				providersRef.current.set(name, [...currentProviders, provider]);
			}

			return () => {
				const current = providersRef.current.get(name);
				if (current) {
					providersRef.current.set(
						name,
						current.filter((p) => p !== provider),
					);
				}
			};
		},
		show: async (...providerNames: string[]) => {
			activeProvidersRef.current = providerNames;
			const groupedActions = await resolveActions(providerNames, input);
			setCategories(groupedActions);
			setVisible(true);
		},
		hide: () => setVisible(false),
		toggle: (open: boolean) => setVisible(open),
		setInput: async (newInput: string) => {
			setInput(newInput);
			if (visible) {
				const groupedActions = await resolveActions(activeProvidersRef.current, newInput);
				setCategories(groupedActions);
			}
		},
	};

	return <Context value={value}>{children}</Context>;
}
