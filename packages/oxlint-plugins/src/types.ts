export interface SourceLocation {
	start: { line: number; column: number };
	end: { line: number; column: number };
}

export interface BaseNode {
	type: string;
	loc?: SourceLocation;
	range?: [number, number];
}

export interface Literal extends BaseNode {
	type: "Literal";
	value: string | number | boolean | null | RegExp | bigint;
	raw?: string;
}

export interface ImportDeclaration extends BaseNode {
	type: "ImportDeclaration";
	source: Literal;
	specifiers: unknown[];
	importKind?: "value" | "type";
}

export interface RuleReportDescriptor {
	node: BaseNode;
	message: string;
	data?: Record<string, unknown>;
	fix?: unknown;
	suggest?: unknown;
}

export interface RuleContext {
	report(descriptor: RuleReportDescriptor): void;
	sourceCode: {
		text: string;
		ast: unknown;
	};
	options: unknown[];
	settings: Record<string, unknown>;
	filename: string;
	physicalFilename: string;
	id: string;
}

export interface RuleListener {
	[key: string]: (node: BaseNode) => void;
}

export interface RuleModule {
	create(context: RuleContext): RuleListener;
	meta?: {
		docs?: {
			description?: string;
			category?: string;
			recommended?: boolean;
			url?: string;
		};
		messages?: Record<string, string>;
		schema?: unknown[];
		deprecated?: boolean;
		replacedBy?: string[];
		type?: "problem" | "suggestion" | "layout";
	};
}

export interface Plugin {
	meta: {
		name: string;
		version?: string;
	};
	rules: Record<string, RuleModule>;
}
