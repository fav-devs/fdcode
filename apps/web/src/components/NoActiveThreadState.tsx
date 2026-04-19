import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "./ui/empty";
import { SidebarHeaderTrigger, SidebarInset } from "./ui/sidebar";
import { isElectron } from "../env";
import { cn } from "~/lib/utils";

export function NoActiveThreadState() {
  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-transparent text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden rounded-[inherit] bg-transparent">
        <header
          className={cn(
            "px-4 sm:px-6",
            isElectron
              ? "drag-region flex h-[50px] items-center wco:h-[env(titlebar-area-height)]"
              : "py-2 sm:py-2.5",
          )}
        >
          {isElectron ? (
            <span className="text-xs text-muted-foreground/50 wco:pr-[calc(100vw-env(titlebar-area-width)-env(titlebar-area-x)+1em)]">
              No active thread
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <SidebarHeaderTrigger className="size-8 shrink-0 rounded-xl border border-border/60 bg-background/72 text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-foreground" />
              <span className="text-sm font-medium text-foreground md:text-muted-foreground/60">
                No active thread
              </span>
            </div>
          )}
        </header>

        <Empty className="flex-1 px-6 pb-8 pt-6">
          <div className="w-full max-w-xl rounded-[28px] border border-border/60 bg-background/62 px-8 py-12 shadow-[0_24px_60px_-32px_rgba(0,0,0,0.72)] backdrop-blur">
            <EmptyHeader className="max-w-none">
              <EmptyTitle className="text-foreground text-xl">Pick a thread to continue</EmptyTitle>
              <EmptyDescription className="mt-2 text-sm text-muted-foreground/78">
                Select an existing thread or create a new one to get started.
              </EmptyDescription>
            </EmptyHeader>
          </div>
        </Empty>
      </div>
    </SidebarInset>
  );
}
