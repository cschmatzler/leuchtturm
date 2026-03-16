import { pixelBasedPreset, type TailwindConfig } from "@react-email/tailwind";

export const tailwindConfig: TailwindConfig = {
	presets: [pixelBasedPreset],
	theme: {
		extend: {
			colors: {
				background: "oklch(0.9551 0 0)",
				foreground: "oklch(0.3211 0 0)",
				card: "oklch(0.9702 0 0)",
				"card-foreground": "oklch(0.3211 0 0)",
				primary: "oklch(0.8649 0.1073 71.4313)",
				"primary-foreground": "oklch(0.1229 0.0504 29.2339)",
				muted: "oklch(0.8853 0 0)",
				"muted-foreground": "oklch(0.5103 0 0)",
				accent: "oklch(0.5702 0.154 33.0482)",
				"accent-foreground": "oklch(0.9801 0.0097 17.3214)",
				border: "oklch(0.8576 0 0)",
			},
			fontFamily: {
				sans: ["Manrope", "ui-sans-serif", "sans-serif", "system-ui"],
				mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
				serif: ["Georgia", "serif"],
			},
			boxShadow: {
				sm: "0px 2px 0px 0px hsl(0 0% 20% / 0.15), 0px 1px 2px -1px hsl(0 0% 20% / 0.15)",
			},
		},
	},
};
