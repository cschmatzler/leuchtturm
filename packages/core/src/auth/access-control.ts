import { createAccessControl } from "better-auth/plugins";

export namespace AuthAccessControl {
	export const accessControl = createAccessControl({
		organization: ["update", "delete"],
		member: ["create", "update", "delete"],
		invitation: ["create", "cancel"],
		team: ["create", "update", "delete"],
		document: [
			"create",
			"read_metadata",
			"read_content",
			"update_metadata",
			"update_content",
			"delete",
			"restore",
			"manage_versions",
			"check_out",
			"share",
			"view_audit",
		],
		document_acl: ["manage"],
		workflow: ["transition", "manage_tasks"],
		ac: ["create", "read", "update", "delete"],
	} as const);

	export const owner = accessControl.newRole({
		organization: ["update", "delete"],
		member: ["create", "update", "delete"],
		invitation: ["create", "cancel"],
		team: ["create", "update", "delete"],
		document: [
			"create",
			"read_metadata",
			"read_content",
			"update_metadata",
			"update_content",
			"delete",
			"restore",
			"manage_versions",
			"check_out",
			"share",
			"view_audit",
		],
		document_acl: ["manage"],
		workflow: ["transition", "manage_tasks"],
		ac: ["create", "read", "update", "delete"],
	});

	export const admin = accessControl.newRole({
		organization: ["update"],
		member: ["create", "update", "delete"],
		invitation: ["create", "cancel"],
		team: ["create", "update", "delete"],
		document: [
			"create",
			"read_metadata",
			"read_content",
			"update_metadata",
			"update_content",
			"delete",
			"restore",
			"manage_versions",
			"check_out",
			"share",
			"view_audit",
		],
		document_acl: ["manage"],
		workflow: ["transition", "manage_tasks"],
		ac: ["create", "read", "update", "delete"],
	});

	export const editor = accessControl.newRole({
		organization: [],
		member: [],
		invitation: [],
		team: [],
		document: [
			"create",
			"read_metadata",
			"read_content",
			"update_metadata",
			"update_content",
			"manage_versions",
			"check_out",
			"view_audit",
		],
		document_acl: [],
		workflow: ["transition"],
		ac: ["read"],
	});

	export const contributor = accessControl.newRole({
		organization: [],
		member: [],
		invitation: [],
		team: [],
		document: ["create", "read_metadata", "read_content", "update_metadata", "update_content"],
		document_acl: [],
		workflow: ["transition"],
		ac: ["read"],
	});

	export const viewer = accessControl.newRole({
		organization: [],
		member: [],
		invitation: [],
		team: [],
		document: ["read_metadata", "read_content"],
		document_acl: [],
		workflow: [],
		ac: ["read"],
	});

	export const roles = {
		owner,
		admin,
		editor,
		contributor,
		member: contributor,
		viewer,
	} as const;

	export const roleKeys = ["owner", "admin", "editor", "contributor", "member", "viewer"] as const;

	export type Resource = keyof typeof accessControl.statements;
	export type Action<ResourceKey extends Resource> =
		(typeof accessControl.statements)[ResourceKey][number];
	export type Permissions = {
		readonly [ResourceKey in Resource]?: Array<Action<ResourceKey>>;
	};
}
