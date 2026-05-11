import { pixelBasedPreset, type TailwindConfig } from "@react-email/tailwind";

export const tailwindConfig: TailwindConfig = {
	presets: [pixelBasedPreset],
	theme: {
		extend: {
			colors: {
				background: "oklch(1 0 0)",
				foreground: "oklch(0.148 0.004 228.8)",
				card: "oklch(1 0 0)",
				"card-foreground": "oklch(0.148 0.004 228.8)",
				primary: "oklch(0.218 0.008 223.9)",
				"primary-foreground": "oklch(0.987 0.002 197.1)",
				secondary: "oklch(0.963 0.002 197.1)",
				"secondary-foreground": "oklch(0.218 0.008 223.9)",
				muted: "oklch(0.963 0.002 197.1)",
				"muted-foreground": "oklch(0.56 0.021 213.5)",
				accent: "oklch(0.963 0.002 197.1)",
				"accent-foreground": "oklch(0.218 0.008 223.9)",
				destructive: "oklch(0.577 0.245 27.325)",
				"destructive-foreground": "oklch(1 0 0)",
				border: "oklch(0.925 0.005 214.3)",
				input: "oklch(0.925 0.005 214.3)",
				ring: "oklch(0.723 0.014 214.4)",
				sidebar: "oklch(0.987 0.002 197.1)",
				"sidebar-foreground": "oklch(0.148 0.004 228.8)",
			},
			fontFamily: {
				sans: ["Geist Variable", "ui-sans-serif", "system-ui", "sans-serif"],
				mono: [
					"ui-monospace",
					"SFMono-Regular",
					"Menlo",
					"Monaco",
					"Consolas",
					"Liberation Mono",
					"Courier New",
					"monospace",
				],
				serif: ["ui-serif", "Georgia", "Cambria", "Times New Roman", "Times", "serif"],
			},
			borderRadius: {
				sm: "0.375rem",
				md: "0.5rem",
				lg: "0.625rem",
				xl: "0.875rem",
			},
			boxShadow: {
				sm: "0 1px 3px 0px hsl(0 0% 0% / 0.1), 0 1px 2px -1px hsl(0 0% 0% / 0.1)",
			},
		},
	},
};
