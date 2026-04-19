import {
	createBuilder,
	createSchema,
	number,
	string,
	table,
	type Row,
	type Zero,
} from "@rocicorp/zero";

import { type SupportedLanguage } from "@leuchtturm/core/i18n";

const user = table("user")
	.columns({
		id: string(),
		name: string(),
		email: string(),
		language: string<SupportedLanguage>().optional(),
		createdAt: number().from("created_at"),
		updatedAt: number().from("updated_at"),
	})
	.primaryKey("id");

export const schema = createSchema({
	tables: [user],
	relationships: [],
});

export const zql = createBuilder(schema);

export type Schema = typeof schema;

export type Context = { userId: string };

declare module "@rocicorp/zero" {
	interface DefaultTypes {
		schema: Schema;
		context: Context;
	}
}

export type User = Row<typeof schema.tables.user>;

export type { Zero };
