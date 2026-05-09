import * as Effect from "effect/Effect";
import { describe, expect, it, vi } from "vite-plus/test";

import { RequestRuntime } from "@leuchtturm/api/request-runtime";

describe("RequestRuntime", () => {
	it("registers promises with waitUntil", async () => {
		const waitUntilPromises: Array<Promise<unknown>> = [];
		const waitUntil = vi.fn((promise: Promise<unknown>) => {
			waitUntilPromises.push(promise);
		});

		await Effect.runPromise(
			RequestRuntime.registerPromise(Promise.resolve("done")).pipe(
				Effect.provideContext(RequestRuntime.makeContext({ waitUntil })),
			),
		);

		expect(waitUntil).toHaveBeenCalledTimes(1);
		await expect(waitUntilPromises[0]).resolves.toBeUndefined();
	});

	it("runs finalizers after registered waitUntil promises settle", async () => {
		const events: Array<string> = [];
		const waitUntilPromises: Array<Promise<unknown>> = [];
		let finishRegistered!: () => void;
		const registered = new Promise<void>((resolve) => {
			finishRegistered = resolve;
		}).then(() => {
			events.push("registered");
		});

		await Effect.runPromise(
			Effect.gen(function* () {
				yield* RequestRuntime.registerPromise(registered);
				yield* RequestRuntime.runAfterWaitUntil(
					Effect.sync(() => {
						events.push("finalizer");
					}),
				);
			}).pipe(
				Effect.provideContext(
					RequestRuntime.makeContext({
						waitUntil: (promise) => {
							waitUntilPromises.push(promise);
						},
					}),
				),
			),
		);

		expect(waitUntilPromises).toHaveLength(2);
		await Promise.resolve();
		expect(events).toEqual([]);

		finishRegistered();
		await Promise.all(waitUntilPromises);

		expect(events).toEqual(["registered", "finalizer"]);
	});

	it("forks Effect work into waitUntil", async () => {
		const events: Array<string> = [];
		const waitUntilPromises: Array<Promise<unknown>> = [];

		await Effect.runPromise(
			RequestRuntime.fork(
				Effect.sync(() => {
					events.push("forked");
				}),
			).pipe(
				Effect.provideContext(
					RequestRuntime.makeContext({
						waitUntil: (promise) => {
							waitUntilPromises.push(promise);
						},
					}),
				),
			),
		);

		expect(waitUntilPromises).toHaveLength(1);
		await Promise.all(waitUntilPromises);
		expect(events).toEqual(["forked"]);
	});
});
