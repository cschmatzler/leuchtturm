import { useRouter } from "@tanstack/react-router";
import type { Session, User as BetterAuthUser } from "better-auth";
import * as Schema from "effect/Schema";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { UserSelect } from "@leuchtturm/core/auth/schema";
import { Loading } from "@leuchtturm/web/components/app/loading";
import { mutators } from "@leuchtturm/zero/mutators";
import { queries } from "@leuchtturm/zero/queries";
import { ZeroProvider as ZeroProviderPrimitive } from "@leuchtturm/zero/react";
import { schema, type Context, type Zero } from "@leuchtturm/zero/schema";

export type SessionData = {
	session: Session;
	user: BetterAuthUser;
};

export function ZeroProvider({
	session,
	organization,
	storageKey = organization,
	children,
}: {
	session: SessionData;
	organization?: string;
	storageKey?: string;
	children: ReactNode;
}) {
	const router = useRouter();

	const [ready, setReady] = useState(false);
	const hasInvalidatedRef = useRef(false);

	const userId = useMemo(
		() => Schema.decodeUnknownSync(UserSelect.fields.id)(session.user.id),
		[session.user.id],
	);
	const context = useMemo<Context>(() => ({ userId }), [userId]);

	const init = useCallback(
		async (zero: Zero) => {
			setReady(false);
			router.update({
				context: {
					...router.options.context,
					zero,
				},
			});

			if (!hasInvalidatedRef.current) {
				hasInvalidatedRef.current = true;
				router.invalidate();
			}

			await zero.preload(queries.currentUser()).complete;
			if (organization) {
				await zero.preload(queries.organization({ organization })).complete;
			}
			setReady(true);
		},
		[router, organization],
	);

	return (
		<ZeroProviderPrimitive
			schema={schema}
			cacheURL={import.meta.env.VITE_SYNC_URL}
			userID={userId}
			context={context}
			mutators={mutators}
			storageKey={storageKey}
			init={init}
		>
			{ready ? children : <Loading />}
		</ZeroProviderPrimitive>
	);
}
