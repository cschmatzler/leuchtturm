import { Config } from "effect";

export const ApiConfig = Config.all({
	baseUrl: Config.string("BASE_URL"),
	port: Config.number("PORT"),
});
