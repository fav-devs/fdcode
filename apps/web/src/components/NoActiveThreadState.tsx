import { AppStatusBar } from "./AppStatusBar";
import { SidebarHeaderTrigger, SidebarInset } from "./ui/sidebar";
import { isElectron } from "../env";
import { cn } from "~/lib/utils";

export function NoActiveThreadState() {
  return (
    <SidebarInset className="h-[calc(100dvh-1rem)] md:h-[calc(100dvh-1.5rem)] min-h-0 overflow-hidden overscroll-y-none bg-transparent text-foreground">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden rounded-[inherit] bg-transparent">
        <header
          className={cn(
            "px-4 sm:px-6",
            isElectron
              ? "drag-region flex h-[50px] items-center wco:h-[env(titlebar-area-height)]"
              : "py-2 sm:py-2.5",
          )}
        >
          {!isElectron && (
            <SidebarHeaderTrigger className="size-8 shrink-0 rounded-xl border border-border/60 bg-background/72 text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-foreground" />
          )}
        </header>

        <div className="flex flex-1 items-center justify-center px-3 sm:px-5">
          <div className="flex w-full max-w-3xl flex-col items-center gap-4 px-6 pb-5 text-center select-none">
            <img
              alt="T3 Code logo"
              className="size-12 rounded-lg object-contain"
              draggable={false}
              src="/favicon-32x32.png"
            />
            <h2 className="text-[26px] font-normal leading-[1.15] tracking-[-0.015em] text-foreground/95 sm:text-[30px]">
              What should we work on?
            </h2>
          </div>
        </div>
      </div>
      <AppStatusBar />
    </SidebarInset>
  );
}
