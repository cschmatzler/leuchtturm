import { Link as TanStackLink, type LinkComponentProps } from "@tanstack/react-router";

export function Link(props: LinkComponentProps) {
	return <TanStackLink {...props} activeProps={{ "data-active": true }} />;
}
