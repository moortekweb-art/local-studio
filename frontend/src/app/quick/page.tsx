"use client";

import { Suspense, useSyncExternalStore } from "react";
import Link from "next/link";
import { AgentWorkspace } from "@/features/agent/ui/agent-workspace-shell";
import { ToolsProvider } from "@/features/agent/tools/context";
import { getQuickPanelBridge } from "@/features/agent/ui/quick-panel/quick-panel-bridge";
import { useMountSubscription } from "@/hooks/use-mount-subscription";

function useDismissOnEscape(): void {
  useMountSubscription(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const bridge = getQuickPanelBridge();
      if (!bridge) return;
      event.preventDefault();
      void bridge.dismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

export default function QuickPanelPage() {
  useDismissOnEscape();
  // The quick panel is designed for the desktop overlay (dismissed via the
  // bridge / Escape). In a plain browser there is no bridge and the route
  // hides the app sidebar, making it a navigation dead-end — so offer a way
  // back into the full app when no desktop bridge is present. The bridge is
  // injected before hydration (or never), so a no-op subscription suffices;
  // the server snapshot hides the link to keep SSR markup stable.
  const showAppLink = useSyncExternalStore(
    () => () => {},
    () => getQuickPanelBridge() === null,
    () => false,
  );
  return (
    <ToolsProvider>
      {showAppLink ? (
        <div className="flex justify-end px-3 pt-2">
          <Link
            href="/"
            className="text-[length:var(--fs-xs)] text-(--color-foreground-subtle) underline-offset-2 hover:underline"
          >
            Open full app
          </Link>
        </div>
      ) : null}
      <Suspense fallback={null}>
        <AgentWorkspace compact />
      </Suspense>
    </ToolsProvider>
  );
}
