const serverOnly = () => {
	throw new Error("@leuchtturm/core/drizzle is server-only");
};

export const Database = {
	Service: Symbol.for("@leuchtturm/core/drizzle/Database.Service"),
	layer: serverOnly,
};
