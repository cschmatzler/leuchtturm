import noDirectFetch from "@chevrotain/oxlint-plugins/no-direct-fetch";
import noRelativeImports from "@chevrotain/oxlint-plugins/no-relative-imports";
import noViMock from "@chevrotain/oxlint-plugins/no-vi-mock";

const plugin = {
	meta: {
		name: "@chevrotain/oxlint-plugins",
	},
	rules: {
		...noDirectFetch.rules,
		...noRelativeImports.rules,
		...noViMock.rules,
	},
};

export { plugin };

export default plugin;
