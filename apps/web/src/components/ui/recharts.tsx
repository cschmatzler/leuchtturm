import { Suspense, use, type ReactNode } from "react";

const rechartsModulePromise = import("recharts");

type RechartsModule = typeof import("recharts");

function RechartsBoundary({
	children,
	fallback = null,
}: {
	children: ReactNode;
	fallback?: ReactNode;
}) {
	return <Suspense fallback={fallback}>{children}</Suspense>;
}

function useRechartsModule() {
	return use(rechartsModulePromise);
}

export { RechartsBoundary, useRechartsModule };
export type { RechartsModule };
