import { Autumn } from "autumn-js";

const autumn = new Autumn({
	secretKey: process.env.AUTUMN_SECRET_KEY,
});

export { autumn };
