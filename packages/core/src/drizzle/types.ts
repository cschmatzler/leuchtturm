import { char } from "drizzle-orm/pg-core";

export const id = { id: char("id", { length: 26 + 4 }).primaryKey() };
