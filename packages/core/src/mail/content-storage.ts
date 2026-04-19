import { Effect, Layer, Schema, Context } from "effect";

export interface MailContentBucketObject {
	readonly text: () => Promise<string>;
}

export interface MailContentBucket {
	readonly put: (
		key: string,
		value: string,
		options?: {
			readonly httpMetadata?: {
				readonly contentType?: string;
			};
		},
	) => Promise<unknown>;
	readonly get: (key: string) => Promise<MailContentBucketObject | null>;
	readonly delete: (keys: string | readonly string[]) => Promise<void>;
}

export class MailContentStorageError extends Schema.TaggedErrorClass<MailContentStorageError>()(
	"MailContentStorageError",
	{ message: Schema.String },
	{ httpApiStatus: 500 },
) {}

export namespace MailContentStorage {
	export interface Interface {
		readonly putText: (key: string, value: string) => Effect.Effect<void, MailContentStorageError>;
		readonly getText: (key: string) => Effect.Effect<string | undefined, MailContentStorageError>;
		readonly deleteKeys: (keys: readonly string[]) => Effect.Effect<void, MailContentStorageError>;
	}

	export class Service extends Context.Service<Service, Interface>()(
		"@leuchtturm/MailContentStorage",
	) {}

	export const layer = (bucket: MailContentBucket) =>
		Layer.succeed(
			Service,
			Service.of({
				putText: (key, value) =>
					Effect.tryPromise({
						try: () =>
							bucket.put(key, value, {
								httpMetadata: {
									contentType: "application/json; charset=utf-8",
								},
							}),
						catch: (error) =>
							new MailContentStorageError({
								message: `Failed to write mail content object ${key}: ${String(error)}`,
							}),
					}).pipe(Effect.asVoid),
				getText: (key) =>
					Effect.tryPromise({
						try: async () => {
							const object = await bucket.get(key);
							if (!object) {
								return undefined;
							}
							return await object.text();
						},
						catch: (error) =>
							new MailContentStorageError({
								message: `Failed to read mail content object ${key}: ${String(error)}`,
							}),
					}),
				deleteKeys: (keys) =>
					Effect.tryPromise({
						try: async () => {
							if (keys.length === 0) {
								return;
							}
							await bucket.delete(keys);
						},
						catch: (error) =>
							new MailContentStorageError({
								message: `Failed to delete mail content objects: ${String(error)}`,
							}),
					}),
			}),
		);
}
