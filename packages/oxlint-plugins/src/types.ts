export interface OxlintRuleReportDescriptor {
	readonly node: unknown;
	readonly message?: string;
	readonly messageId?: string;
	readonly data?: Record<string, string>;
}

export interface OxlintRuleContext {
	report(descriptor: OxlintRuleReportDescriptor): void;
}

export type OxlintRuleVisitor = Record<string, (node: any) => void>;

export interface OxlintRuleMeta {
	readonly type: string;
	readonly docs: {
		readonly description: string;
	};
	readonly messages?: Record<string, string>;
}

export interface OxlintRule {
	readonly meta: OxlintRuleMeta;
	create(context: OxlintRuleContext): OxlintRuleVisitor;
}

export interface OxlintPlugin {
	readonly meta: {
		readonly name: string;
	};
	readonly rules: Record<string, OxlintRule>;
}
