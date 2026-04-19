import { RotateCcwIcon } from "lucide-react";
import { Outlet, createFileRoute, redirect, useLocation } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { useSettingsRestore } from "../components/settings/SettingsPanels";
import { SETTINGS_NAV_ITEMS } from "../components/settings/SettingsSidebarNav";
import { Button } from "../components/ui/button";
import { SidebarHeaderTrigger, SidebarInset } from "../components/ui/sidebar";
import { isElectron } from "../env";

function RestoreDefaultsButton({ onRestored }: { onRestored: () => void }) {
  const { changedSettingLabels, restoreDefaults } = useSettingsRestore(onRestored);

  return (
    <Button
      size="xs"
      variant="outline"
      disabled={changedSettingLabels.length === 0}
      onClick={() => void restoreDefaults()}
    >
      <RotateCcwIcon className="size-3.5" />
      Restore defaults
    </Button>
  );
}

function SettingsContentLayout() {
  const location = useLocation();
  const [restoreSignal, setRestoreSignal] = useState(0);
  const showRestoreDefaults = location.pathname === "/settings/general";
  const handleRestored = () => setRestoreSignal((value) => value + 1);
  const activeNavItem = useMemo(
    () =>
      SETTINGS_NAV_ITEMS.find((item) => item.to === location.pathname) ??
      SETTINGS_NAV_ITEMS[0] ?? {
        label: "Settings",
        to: "/settings/general",
        icon: () => null,
      },
    [location.pathname],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        window.history.back();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-transparent text-foreground isolate">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[inherit] bg-transparent text-foreground">
        {!isElectron && (
          <header className="px-4 py-2 sm:px-6 sm:py-2.5">
            <div className="flex min-h-7 items-center gap-2 sm:min-h-6">
              <SidebarHeaderTrigger className="size-8 shrink-0 rounded-xl border border-border/60 bg-background/72 text-muted-foreground shadow-sm backdrop-blur hover:bg-accent hover:text-foreground" />
              <span className="text-[15px] font-semibold tracking-tight text-foreground">
                Settings
              </span>
              {showRestoreDefaults ? (
                <div className="ms-auto flex items-center gap-2">
                  <RestoreDefaultsButton onRestored={handleRestored} />
                </div>
              ) : null}
            </div>
          </header>
        )}

        {isElectron && (
          <div className="drag-region flex h-[50px] shrink-0 items-center px-6 wco:h-[env(titlebar-area-height)] wco:pr-[calc(100vw-env(titlebar-area-width)-env(titlebar-area-x)+1em)]">
            <span className="text-xs font-medium tracking-wide text-muted-foreground/70">
              Settings
            </span>
            {showRestoreDefaults ? (
              <div className="ms-auto flex items-center gap-2">
                <RestoreDefaultsButton onRestored={handleRestored} />
              </div>
            ) : null}
          </div>
        )}

        <div key={restoreSignal} className="min-h-0 flex flex-1 flex-col">
          <div className="px-6 pb-1 pt-4 sm:px-8 sm:pt-5">
            <div className="mx-auto w-full max-w-2xl">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {activeNavItem.label}
              </h1>
            </div>
          </div>
          <Outlet />
        </div>
      </div>
    </SidebarInset>
  );
}

function SettingsRouteLayout() {
  return <SettingsContentLayout />;
}

export const Route = createFileRoute("/settings")({
  beforeLoad: async ({ context, location }) => {
    if (context.authGateState.status !== "authenticated") {
      throw redirect({ to: "/pair", replace: true });
    }

    if (location.pathname === "/settings") {
      throw redirect({ to: "/settings/general", replace: true });
    }
  },
  component: SettingsRouteLayout,
});
