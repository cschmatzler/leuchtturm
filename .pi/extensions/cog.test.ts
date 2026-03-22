import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

import { areSearchTargetsIndexed, getSearchTargetsForTokens } from "./cog.ts";

function createWorkspaceFixture() {
	const parent = mkdtempSync(join(tmpdir(), "cog-extension-"));
	const root = join(parent, "root");
	const src = join(root, "src");
	const sibling = join(parent, "sibling");
	const otherRepo = join(parent, "other-repo");

	mkdirSync(src, { recursive: true });
	mkdirSync(sibling, { recursive: true });
	mkdirSync(otherRepo, { recursive: true });

	return {
		root,
		sibling,
		otherRepo,
		cleanup() {
			rmSync(parent, { force: true, recursive: true });
		},
	};
}

describe("Cog shell search target detection", () => {
	it("parses env-wrapped rg commands with external targets", () => {
		const fixture = createWorkspaceFixture();

		try {
			expect(
				getSearchTargetsForTokens(["env", "LC_ALL=C", "rg", "needle", "../sibling"], fixture.root),
			).toEqual([fixture.sibling]);
			expect(areSearchTargetsIndexed("env LC_ALL=C rg needle ../sibling", fixture.root)).toBe(
				false,
			);
		} finally {
			fixture.cleanup();
		}
	});

	it("parses assignment-prefixed rg commands", () => {
		const fixture = createWorkspaceFixture();

		try {
			expect(
				getSearchTargetsForTokens(["LC_ALL=C", "rg", "needle", "./src"], fixture.root),
			).toEqual([join(fixture.root, "src")]);
			expect(areSearchTargetsIndexed("LC_ALL=C rg needle ./src", fixture.root)).toBe(true);
		} finally {
			fixture.cleanup();
		}
	});

	it("parses git grep commands with git -C prefixes", () => {
		const fixture = createWorkspaceFixture();

		try {
			expect(
				getSearchTargetsForTokens(["git", "-C", "../other-repo", "grep", "needle"], fixture.root),
			).toEqual([fixture.otherRepo]);
			expect(areSearchTargetsIndexed("git -C ../other-repo grep needle", fixture.root)).toBe(false);
		} finally {
			fixture.cleanup();
		}
	});
});
