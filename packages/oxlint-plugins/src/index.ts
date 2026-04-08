import noDirectFetch from "@leuchtturm/oxlint-plugins/no-direct-fetch";
import noLiveSuffix from "@leuchtturm/oxlint-plugins/no-live-suffix";
import noProcessEnv from "@leuchtturm/oxlint-plugins/no-process-env";
import noRelativeImports from "@leuchtturm/oxlint-plugins/no-relative-imports";
import noRowSuffix from "@leuchtturm/oxlint-plugins/no-row-suffix";
import noViMock from "@leuchtturm/oxlint-plugins/no-vi-mock";

const plugin = {
	meta: {
		name: "@leuchtturm/oxlint-plugins",
	},
	rules: {
		...noDirectFetch.rules,
		...noLiveSuffix.rules,
		...noProcessEnv.rules,
		...noRelativeImports.rules,
		...noRowSuffix.rules,
		...noViMock.rules,
	},
};

export { plugin };

export default plugin;
