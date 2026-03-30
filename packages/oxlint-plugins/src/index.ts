import noDirectFetch from "@chevrotain/oxlint-plugins/no-direct-fetch";
import noProcessEnv from "@chevrotain/oxlint-plugins/no-process-env";
import noRelativeImports from "@chevrotain/oxlint-plugins/no-relative-imports";
import noRowSuffix from "@chevrotain/oxlint-plugins/no-row-suffix";
import noViMock from "@chevrotain/oxlint-plugins/no-vi-mock";

const plugin = {
	meta: {
		name: "@chevrotain/oxlint-plugins",
	},
	rules: {
		...noDirectFetch.rules,
		...noProcessEnv.rules,
		...noRelativeImports.rules,
		...noRowSuffix.rules,
		...noViMock.rules,
	},
};

export { plugin };

export default plugin;
