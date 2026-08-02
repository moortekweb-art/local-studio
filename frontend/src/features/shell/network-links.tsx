"use client";

import { ExternalLink } from "@/ui/icon-registry";

/**
 * External links to sibling services on the user's network. Rendered in the
 * desktop sidebar footer and in the mobile navigation drawer, so the same
 * links are reachable from every page that shows app navigation.
 *
 * Entirely env-driven — NEXT_PUBLIC_PORTAL_URL (a single portal URL) and
 * NEXT_PUBLIC_SIBLING_LINKS (a JSON array of {label, href}) are inlined at
 * build time — so private hostnames live in deployment env files and are never
 * committed to this public repository. There is deliberately no fallback URL:
 * when neither variable is set, or either is malformed, this renders nothing
 * rather than a broken or misleading nav.
 */
type NetworkLink = { label: string; href: string };

/**
 * Only absolute http(s) URLs are accepted. The value is operator-supplied at
 * build time, but it lands in an `href`, so `javascript:`/`data:` and relative
 * junk are rejected here rather than trusted.
 */
function isUsableHref(href: string): boolean {
  try {
    const { protocol } = new URL(href);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function parseSiblingLinks(raw: string | undefined): NetworkLink[] {
  if (!raw || raw.trim() === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Malformed JSON is a deployment typo, not a reason to crash the shell.
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.flatMap((entry): NetworkLink[] => {
    if (typeof entry !== "object" || entry === null) return [];
    const { label, href } = entry as Partial<NetworkLink>;
    if (typeof label !== "string" || typeof href !== "string") return [];
    const trimmedLabel = label.trim();
    const trimmedHref = href.trim();
    if (trimmedLabel === "" || !isUsableHref(trimmedHref)) return [];
    return [{ label: trimmedLabel, href: trimmedHref }];
  });
}

export function buildNetworkLinks(
  portalUrl: string | undefined,
  siblingLinks: string | undefined,
): NetworkLink[] {
  const portal =
    portalUrl && isUsableHref(portalUrl.trim())
      ? [{ label: "Portal", href: portalUrl.trim() }]
      : [];
  return [...portal, ...parseSiblingLinks(siblingLinks)];
}

// Evaluated once at module load; both reads are literal so Next inlines them.
const networkLinks: NetworkLink[] = buildNetworkLinks(
  process.env.NEXT_PUBLIC_PORTAL_URL,
  process.env.NEXT_PUBLIC_SIBLING_LINKS,
);

export function NetworkLinks({ className = "" }: { className?: string }) {
  if (networkLinks.length === 0) return null;
  return (
    <div className={`mb-1 border-b border-(--border) pb-1 ${className}`}>
      {networkLinks.map((link, index) => (
        <a
          key={`${link.href}-${index}`}
          href={link.href}
          target="_blank"
          rel="noreferrer noopener"
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
