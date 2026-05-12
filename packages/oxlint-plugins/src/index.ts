import consistentComponentHookGroups from "@leuchtturm/oxlint-plugins/consistent-component-hook-groups";
import namespaceFilenameMatch from "@leuchtturm/oxlint-plugins/namespace-filename-match";
import noApiResponseSchemaInCore from "@leuchtturm/oxlint-plugins/no-api-response-schema-in-core";
import noDirectFetch from "@leuchtturm/oxlint-plugins/no-direct-fetch";
import noEffectTryHelper from "@leuchtturm/oxlint-plugins/no-effect-try-helper";
import noGenericDomainErrorClass from "@leuchtturm/oxlint-plugins/no-generic-domain-error-class";
import noLiveSuffix from "@leuchtturm/oxlint-plugins/no-live-suffix";
import noLocalEffectCallbackWrapper from "@leuchtturm/oxlint-plugins/no-local-effect-callback-wrapper";
import noLocalWebSchema from "@leuchtturm/oxlint-plugins/no-local-web-schema";
import noNamespaceImports from "@leuchtturm/oxlint-plugins/no-namespace-imports";
import noNonExactPackageJsonVersions from "@leuchtturm/oxlint-plugins/no-non-exact-package-json-versions";
import noPhosphorTopLevelImport from "@leuchtturm/oxlint-plugins/no-phosphor-top-level-import";
import noRelativeImports from "@leuchtturm/oxlint-plugins/no-relative-imports";
import noRowSuffix from "@leuchtturm/oxlint-plugins/no-row-suffix";
import noSchemaTypeAlias from "@leuchtturm/oxlint-plugins/no-schema-type-alias";
import noUseParamsStrictFalse from "@leuchtturm/oxlint-plugins/no-use-params-strict-false";
import noVariableAlias from "@leuchtturm/oxlint-plugins/no-variable-alias";
import noViMock from "@leuchtturm/oxlint-plugins/no-vi-mock";

const plugin = {
	meta: {
		name: "@leuchtturm/oxlint-plugins",
	},
	rules: {
		...consistentComponentHookGroups.rules,
		...noApiResponseSchemaInCore.rules,
		...noDirectFetch.rules,
		...noEffectTryHelper.rules,
		...noGenericDomainErrorClass.rules,
		...noVariableAlias.rules,
		...noLiveSuffix.rules,
		...noLocalEffectCallbackWrapper.rules,
		...noLocalWebSchema.rules,
		...namespaceFilenameMatch.rules,
		...noNamespaceImports.rules,
		...noNonExactPackageJsonVersions.rules,
		...noPhosphorTopLevelImport.rules,
		...noRelativeImports.rules,
		...noRowSuffix.rules,
		...noSchemaTypeAlias.rules,
		...noUseParamsStrictFalse.rules,
		...noViMock.rules,
	},
};

export { plugin };

export default plugin;
