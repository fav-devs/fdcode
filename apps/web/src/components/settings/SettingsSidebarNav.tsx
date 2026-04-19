import type { ComponentType } from "react";
import { ActivityIcon, ArchiveIcon, ArrowLeftIcon, Link2Icon, Settings2Icon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

import {
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "../ui/sidebar";

export type SettingsSectionPath =
  | "/settings/general"
  | "/settings/usage"
  | "/settings/connections"
  | "/settings/archived";

export const SETTINGS_NAV_ITEMS: ReadonlyArray<{
  label: string;
  description: string;
  to: SettingsSectionPath;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    label: "General",
    description: "Theme, behavior, and defaults.",
    to: "/settings/general",
    icon: Settings2Icon,
  },
  {
    label: "Usage",
    description: "Provider usage windows and remaining quota.",
    to: "/settings/usage",
    icon: ActivityIcon,
  },
  {
    label: "Connections",
    description: "Pairing, remote backends, and sessions.",
    to: "/settings/connections",
    icon: Link2Icon,
  },
  {
    label: "Archive",
    description: "Review and restore archived threads.",
    to: "/settings/archived",
    icon: ArchiveIcon,
  },
];

export function SettingsSidebarNav({ pathname }: { pathname: string }) {
  const navigate = useNavigate();

  return (
    <>
      <SidebarContent className="overflow-x-hidden">
        <SidebarGroup className="px-2 py-3">
          <SidebarMenu>
            {SETTINGS_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.to;
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    size="sm"
                    isActive={isActive}
                    className={
                      isActive
                        ? "h-auto items-start gap-2.5 rounded-2xl border border-border/60 bg-background/72 px-3 py-3 text-left text-[13px] font-medium text-foreground shadow-sm backdrop-blur"
                        : "h-auto items-start gap-2.5 rounded-2xl px-3 py-3 text-left text-[13px] text-muted-foreground/74 hover:bg-background/44 hover:text-foreground/84"
                    }
                    onClick={() => void navigate({ to: item.to, replace: true })}
                  >
                    <Icon
                      className={
                        isActive
                          ? "mt-0.5 size-4 shrink-0 text-foreground"
                          : "mt-0.5 size-4 shrink-0 text-muted-foreground/58"
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{item.label}</div>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="sm"
              className="gap-2 px-2 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => window.history.back()}
            >
              <ArrowLeftIcon className="size-4" />
              <span>Back</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </>
  );
}
