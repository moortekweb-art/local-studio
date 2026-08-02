"use client";

import { ExternalLink } from "@/ui/icon-registry";

/**
 * External links to sibling services on the user's network, shown above the
 * profile footer. Entirely env-driven — NEXT_PUBLIC_PORTAL_URL (single portal
 * URL) and NEXT_PUBLIC_SIBLING_LINKS (JSON array of {label, href}) are inlined
 * at build time — so private hostnames live in deployment env files and are
 * never committed to this public repository. Renders nothing when unset.
 */
type NetworkLink = { label: string; href: string };

function parseSiblingLinks(raw: string | undefined): NetworkLink[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is NetworkLink =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as NetworkLink).label === "string" &&
        typeof (entry as NetworkLink).href === "string",
    );
  } catch {
    return [];
  }
}

const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL;
const networkLinks: NetworkLink[] = [
  ...(portalUrl ? [{ label: "Portal", href: portalUrl }] : []),
  ...parseSiblingLinks(process.env.NEXT_PUBLIC_SIBLING_LINKS),
];

export function NetworkLinks() {
  if (networkLinks.length === 0) return null;
  return (
    <div className="mb-1 border-b border-(--border) pb-1">
      {networkLinks.map((link) => (
        <a
          key={link.href}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          className="flex min-w-0 items-center gap-2.5 rounded-[var(--sidebar-row-radius)] px-2 py-1 text-(--fg)/60 transition-colors hover:bg-(--hover) hover:text-(--fg)"
          title={link.label}
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          <span className="truncate text-[length:var(--fs-md)]">{link.label}</span>
        </a>
      ))}
    </div>
  );
}
