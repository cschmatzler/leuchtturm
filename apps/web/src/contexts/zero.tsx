import { ZeroProvider as ZeroProviderPrimitive } from "@rocicorp/zero/react";
import { useRouter } from "@tanstack/react-router";
import type { Session, User } from "better-auth";
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { Loading } from "@leuchtturm/web/components/app/loading";
import { mutators } from "@leuchtturm/zero/mutators";
import { queries } from "@leuchtturm/zero/queries";
import { schema, type Zero } from "@leuchtturm/zero/schema";

export type SessionData = {
	session: Session;
	user: User;
};

export function ZeroProvider({
	session,
	slug,
	children,
}: {
	session: SessionData;
	slug: string;
	children: ReactNode;
}) {
	const router = useRouter();
	const [ready, setReady] = useState(false);
	const hasInvalidatedRef = useRef(false);

	const userId = session.user.id;
	const context = useMemo(() => ({ userId }), [userId]);

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
			await zero.preload(queries.organization({ slug })).complete;
			setReady(true);
		},
		[router, slug],
	);

	return (
		<ZeroProviderPrimitive
			schema={schema}
			cacheURL={import.meta.env.VITE_SYNC_URL}
			userID={userId}
			context={context}
			mutators={mutators}
			storageKey={slug}
			init={init}
		>
			{ready ? children : <Loading />}
		</ZeroProviderPrimitive>
	);
}
