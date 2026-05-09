function getIdentifierName(node: any) {
	return node?.type === "Identifier" ? node.name : undefined;
}

function patternHasName(node: any, name: string): boolean {
	if (node?.type === "Identifier") {
		return node.name === name;
	}

	if (node?.type === "AssignmentPattern" || node?.type === "RestElement") {
		return patternHasName(node.left ?? node.argument, name);
	}

	if (node?.type === "ArrayPattern") {
		return node.elements.some((element: any) => patternHasName(element, name));
	}

	if (node?.type === "ObjectPattern") {
		return node.properties.some((property: any) => {
			if (property?.type === "Property") {
				return patternHasName(property.value, name);
			}

			return property?.type === "RestElement" && patternHasName(property.argument, name);
		});
	}

	if (node?.type === "TSParameterProperty") {
		return patternHasName(node.parameter, name);
	}

	return false;
}

function importHasName(statement: any, name: string) {
	return (
		statement.importKind !== "type" &&
		statement.specifiers?.some(
			(specifier: any) =>
				specifier.importKind !== "type" && getIdentifierName(specifier.local) === name,
		)
	);
}

function statementHasName(statement: any, name: string, includeImports: boolean): boolean {
	if (!statement) {
		return false;
	}

	if (statement.type === "ImportDeclaration") {
		return includeImports && importHasName(statement, name);
	}

	if (statement.type === "VariableDeclaration") {
		return statement.declarations.some((declaration: any) => patternHasName(declaration.id, name));
	}

	if (statement.type === "FunctionDeclaration" || statement.type === "ClassDeclaration") {
		return getIdentifierName(statement.id) === name;
	}

	if (
		statement.type === "ExportNamedDeclaration" ||
		statement.type === "ExportDefaultDeclaration"
	) {
		return statementHasName(statement.declaration, name, includeImports);
	}

	return false;
}

function scopeHasName(scope: any, name: string, includeImports: boolean) {
	if (
		scope.type === "FunctionDeclaration" ||
		scope.type === "FunctionExpression" ||
		scope.type === "ArrowFunctionExpression"
	) {
		return (
			getIdentifierName(scope.id) === name ||
			scope.params.some((parameter: any) => patternHasName(parameter, name))
		);
	}

	if (scope.type === "CatchClause") {
		return patternHasName(scope.param, name);
	}

	if (scope.type === "ForStatement") {
		return statementHasName(scope.init, name, includeImports);
	}

	if (scope.type === "ForInStatement" || scope.type === "ForOfStatement") {
		return statementHasName(scope.left, name, includeImports);
	}

	if (scope.type === "Program" || scope.type === "BlockStatement") {
		return scope.body.some((statement: any) => statementHasName(statement, name, includeImports));
	}

	return false;
}

function isNameDeclared(node: any, name: string, includeImports: boolean) {
	let current = node?.parent;

	while (current) {
		if (scopeHasName(current, name, includeImports)) {
			return true;
		}

		current = current.parent;
	}

	return false;
}

export function isRuntimeNameDeclared(node: any, name: string) {
	return isNameDeclared(node, name, true);
}

export function isLocalNameDeclared(node: any, name: string) {
	return isNameDeclared(node, name, false);
}
