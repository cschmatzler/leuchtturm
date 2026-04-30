import { CaretDownIcon, SparkleIcon } from "@phosphor-icons/react";
import { Link, useNavigate, useRouteContext } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@leuchtturm/web/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@leuchtturm/web/components/ui/dropdown-menu";
import { useAuth } from "@leuchtturm/web/hooks/use-auth";

export function CreateOrganizationHeader() {
	const { session } = useRouteContext({ from: "/create-organization" });
	const navigate = useNavigate();
	const { t } = useTranslation();
	const { deviceSessions, setActiveSession, signOutCurrent } = useAuth();
	const [accountMenuOpen, setAccountMenuOpen] = useState(false);

	return (
		<div className="flex items-center justify-between gap-3">
			<Link
				to="/"
				className="flex items-center gap-2.5 font-medium transition-colors hover:text-primary"
			>
				<div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
					<SparkleIcon className="size-4" />
				</div>
				<span className="text-base font-semibold">Leuchtturm</span>
			</Link>
			<DropdownMenu open={accountMenuOpen} onOpenChange={setAccountMenuOpen}>
				<DropdownMenuTrigger render={<Button size="sm" variant="ghost" />}>
					<CaretDownIcon className="mr-2 size-3" />
					{session.user.email}
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					{deviceSessions?.map((deviceSession) => (
						<DropdownMenuCheckboxItem
							key={deviceSession.session.id}
							checked={deviceSession.session.token === session.session.token}
							onClick={async () => {
								await setActiveSession(deviceSession.session.token);
								setAccountMenuOpen(false);
							}}
						>
							{deviceSession.user.email}
						</DropdownMenuCheckboxItem>
					))}
					<DropdownMenuSeparator />
					<DropdownMenuItem
						onClick={() => {
							void navigate({ to: "/login" });
						}}
					>
						{t("Add account")}
					</DropdownMenuItem>
					<DropdownMenuItem
						onClick={() => {
							void signOutCurrent();
						}}
					>
						{t("Log out")}
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}
