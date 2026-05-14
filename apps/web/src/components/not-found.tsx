import { MagnifyingGlassMinusIcon } from "@phosphor-icons/react/MagnifyingGlassMinus";
import { Link, type LinkOptions } from "@tanstack/react-router";
import { T } from "gt-react";

import { Button } from "@leuchtturm/web/components/ui/button";

export function NotFound({ backTo, backLabel }: { backTo: LinkOptions; backLabel: string }) {
	return (
		<div className="flex size-full flex-col items-center justify-center gap-4 px-6">
			<div className="flex size-14 items-center justify-center rounded-full bg-muted">
				<MagnifyingGlassMinusIcon className="size-6 text-muted-foreground" />
			</div>
			<h1 className="text-xl font-semibold">
				<T>Not found</T>
			</h1>
			<p className="text-sm text-muted-foreground">
				<T>The page you&apos;re looking for doesn&apos;t exist.</T>
			</p>
			<Button variant="outline" nativeButton={false} render={<Link {...backTo} role={undefined} />}>
				{backLabel}
			</Button>
		</div>
	);
}
