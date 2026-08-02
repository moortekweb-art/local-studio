import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { buildNetworkLinks, parseSiblingLinks } from "./network-links";

const source = readFileSync(new URL("./network-links.tsx", import.meta.url), "utf8");
const mobileDrawer = readFileSync(
  new URL("./left-sidebar-mobile-drawer.tsx", import.meta.url),
  "utf8",
);
const profileFooter = readFileSync(new URL("./profile-footer.tsx", import.meta.url), "utf8");

describe("NEXT_PUBLIC_SIBLING_LINKS parsing", () => {
  test("absent or blank env renders no links instead of throwing", () => {
    assert.deepEqual(parseSiblingLinks(undefined), []);
    assert.deepEqual(parseSiblingLinks(""), []);
    assert.deepEqual(parseSiblingLinks("   "), []);
    assert.deepEqual(buildNetworkLinks(undefined, undefined), []);
  });

  test("malformed JSON degrades to no links rather than crashing the shell", () => {
    assert.deepEqual(parseSiblingLinks("not json"), []);
    assert.deepEqual(parseSiblingLinks("[{"), []);
    assert.deepEqual(parseSiblingLinks('{"label":"a","href":"https://example.invalid/"}'), []);
    assert.deepEqual(parseSiblingLinks("null"), []);
    assert.deepEqual(parseSiblingLinks("42"), []);
  });

  test("entries missing label or href are dropped, valid siblings survive", () => {
    assert.deepEqual(
      parseSiblingLinks(
        '[{"label":"Hub","href":"https://example.invalid/hub/"},' +
          '{"href":"https://example.invalid/no-label/"},' +
          '{"label":"No href"},' +
          '{"label":"","href":"https://example.invalid/blank/"},' +
          'null,"nope",' +
          '{"label":"Metrics","href":"https://example.invalid/metrics/"}]',
      ),
      [
        { label: "Hub", href: "https://example.invalid/hub/" },
        { label: "Metrics", href: "https://example.invalid/metrics/" },
      ],
    );
  });

  test("only http(s) hrefs are accepted", () => {
    assert.deepEqual(parseSiblingLinks('[{"label":"XSS","href":"javascript:alert(1)"}]'), []);
    assert.deepEqual(parseSiblingLinks('[{"label":"Data","href":"data:text/html,x"}]'), []);
    assert.deepEqual(parseSiblingLinks('[{"label":"Relative","href":"/hub"}]'), []);
    assert.deepEqual(parseSiblingLinks('[{"label":"Plain","href":"http://example.invalid/"}]'), [
      { label: "Plain", href: "http://example.invalid/" },
    ]);
  });

  test("the portal URL becomes a leading link and is validated the same way", () => {
    assert.deepEqual(buildNetworkLinks("https://example.invalid/portal.html", undefined), [
      { label: "Portal", href: "https://example.invalid/portal.html" },
    ]);
    assert.deepEqual(buildNetworkLinks("javascript:alert(1)", undefined), []);
    assert.deepEqual(
      buildNetworkLinks(
        "https://example.invalid/portal.html",
        '[{"label":"Hub","href":"https://example.invalid/hub/"}]',
      ),
      [
        { label: "Portal", href: "https://example.invalid/portal.html" },
        { label: "Hub", href: "https://example.invalid/hub/" },
      ],
    );
  });
});

describe("network links placement", () => {
  test("carries no hardcoded infrastructure fallback", () => {
    assert.ok(!/\.ts\.net/.test(source));
    assert.ok(
      !/https?:\/\/(?!\s)[^"'`\s]*/.test(source.replace(/example\.invalid/g, "")),
      "network-links.tsx must not embed any absolute URL",
    );
  });

  test("renders in both the desktop footer and the mobile drawer", () => {
    assert.ok(profileFooter.includes("<NetworkLinks />"));
    assert.ok(mobileDrawer.includes("<NetworkLinks"));
  });
});
