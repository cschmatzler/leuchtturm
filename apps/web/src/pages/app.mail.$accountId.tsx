import { createFileRoute, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import {
	ArchiveIcon,
	FileTextIcon,
	FolderIcon,
	InboxIcon,
	SendIcon,
	Trash2Icon,
	AlertTriangleIcon,
} from "lucide-react";
import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import {
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@chevrotain/web/components/ui/sidebar";
import { useZeroQuery } from "@chevrotain/web/lib/query";
import { queries } from "@chevrotain/zero/queries";

export const Route = createFileRoute("/app/mail/$accountId")({
	loader: async ({ context: { zero }, params: { accountId } }) => {
		zero.preload(queries.mailFolders({ accountId }));
		zero.preload(queries.mailLabels({ accountId }));
	},
	component: AccountLayout,
});

const FOLDER_ICONS: Record<string, ComponentType<{ className?: string }>> = {
	inbox: InboxIcon,
	sent: SendIcon,
	drafts: FileTextIcon,
	trash: Trash2Icon,
	spam: AlertTriangleIcon,
	archive: ArchiveIcon,
	all_mail: FolderIcon,
	custom: FolderIcon,
};

function AccountLayout() {
	const { t } = useTranslation();
	const { accountId } = useParams({ from: "/app/mail/$accountId" });
	const navigate = useNavigate();

	const [folders] = useZeroQuery(queries.mailFolders({ accountId }));
	const [labels] = useZeroQuery(queries.mailLabels({ accountId }));

	const systemFolders = (folders ?? []).filter((f) => f.kind !== "custom");
	const customFolders = (folders ?? []).filter((f) => f.kind === "custom");
	const userLabels = (labels ?? []).filter((l) => l.kind === "user");

	const navigateToFolder = (folderId: string) => {
		navigate({
			to: "/app/mail/$accountId/folder/$folderId",
			params: { accountId, folderId },
		});
	};

	return (
		<div className="flex h-full">
			<div className="w-56 shrink-0 border-r border-border">
				<SidebarContent className="gap-0 p-2">
					<SidebarGroup>
						<SidebarGroupContent>
							<SidebarMenu>
								<SidebarMenuItem>
									<SidebarMenuButton
										onClick={() =>
											navigate({
												to: "/app/mail/$accountId",
												params: { accountId },
											})
										}
									>
										<InboxIcon className="size-4" />
										{t("All Mail")}
									</SidebarMenuButton>
								</SidebarMenuItem>
								{systemFolders.map((folder) => {
									const Icon = FOLDER_ICONS[folder.kind] ?? FolderIcon;
									return (
										<SidebarMenuItem key={folder.id}>
											<SidebarMenuButton onClick={() => navigateToFolder(folder.id)}>
												<Icon className="size-4" />
												{folder.name}
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>

					{customFolders.length > 0 && (
						<SidebarGroup>
							<SidebarGroupLabel>{t("Folders")}</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{customFolders.map((folder) => (
										<SidebarMenuItem key={folder.id}>
											<SidebarMenuButton onClick={() => navigateToFolder(folder.id)}>
												<FolderIcon className="size-4" />
												{folder.name}
											</SidebarMenuButton>
										</SidebarMenuItem>
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					)}

					{userLabels.length > 0 && (
						<SidebarGroup>
							<SidebarGroupLabel>{t("Labels")}</SidebarGroupLabel>
							<SidebarGroupContent>
								<SidebarMenu>
									{userLabels.map((label) => (
										<SidebarMenuItem key={label.id}>
											<SidebarMenuButton>
												{label.color && (
													<span
														className="size-2.5 shrink-0 rounded-full"
														style={{ backgroundColor: label.color }}
													/>
												)}
												{label.name}
											</SidebarMenuButton>
										</SidebarMenuItem>
									))}
								</SidebarMenu>
							</SidebarGroupContent>
						</SidebarGroup>
					)}
				</SidebarContent>
			</div>
			<div className="flex min-w-0 flex-1 flex-col">
				<Outlet />
			</div>
		</div>
	);
}
