import { describe, expect, it } from "vitest";

import { AuthAccessControl } from "@leuchtturm/core/auth/access-control";

describe("AuthAccessControl", () => {
	it("defines document and ACL resources for Better Auth", () => {
		expect(AuthAccessControl.accessControl.statements.document).toContain("read_metadata");
		expect(AuthAccessControl.accessControl.statements.document).toContain("read_content");
		expect(AuthAccessControl.accessControl.statements.document_acl).toEqual(["manage"]);
		expect(AuthAccessControl.accessControl.statements.workflow).toContain("transition");
	});

	it("keeps viewer limited to document reads", () => {
		expect(
			AuthAccessControl.viewer.authorize({
				document: ["read_metadata", "read_content"],
			}).success,
		).toBe(true);
		expect(
			AuthAccessControl.viewer.authorize({
				document: ["update_metadata"],
			}).success,
		).toBe(false);
	});

	it("keeps the existing member role as the default contributor role", () => {
		expect(AuthAccessControl.roles.member).toBe(AuthAccessControl.contributor);
		expect(
			AuthAccessControl.roles.member.authorize({
				document: ["create", "update_content"],
			}).success,
		).toBe(true);
		expect(
			AuthAccessControl.roles.member.authorize({
				document: ["delete"],
			}).success,
		).toBe(false);
	});
});
