import { ZeroProvider as ZeroProviderPrimitive } from "@rocicorp/zero/react";
import { useRouter } from "@tanstack/react-router";
import type { Session, User } from "better-auth";
import { useRef, useState, type ReactNode } from "react";

import { Loading } from "@one/web/components/app/loading";
import { mutators } from "@one/zero/mutators";
import { queries } from "@one/zero/queries";
import { schema } from "@one/zero/schema";

export type SessionData = {
	session: Session;
	user: User;
};

export function ZeroProvider({ session, children }: { session: SessionData; children: ReactNode }) {
	const router = useRouter();
	const [ready, setReady] = useState(false);
	const hasInvalidatedRef = useRef(false);

	return (
		<ZeroProviderPrimitive
			schema={schema}
			cacheURL={`${import.meta.env.VITE_BASE_URL}/sync`}
			userID={session.user.id}
			context={{ userId: session.user.id }}
			mutators={mutators}
			storageKey={session.user.id}
			init={async (zero) => {
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
				setReady(true);
			}}
		>
			{ready ? children : <Loading />}
		</ZeroProviderPrimitive>
	);
}
