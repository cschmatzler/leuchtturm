import noRelativeImports from "@chevrotain/oxlint-plugins/no-relative-imports";
import noViMock from "@chevrotain/oxlint-plugins/no-vi-mock";

const plugin = {
	meta: {
		name: "@chevrotain/oxlint-plugins",
	},
	rules: {
		...noRelativeImports.rules,
		...noViMock.rules,
	},
};

export { plugin };

export default plugin;
