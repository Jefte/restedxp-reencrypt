import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import { decryptGuideFile } from "../lib/rxp-crypto";

test("bundled Forever export preserves v4.11.36 guides with visible Zephras overrides", () => {
  const raw = fs.readFileSync("public/guide_forever_player_1234.txt", "utf8");
  const result = decryptGuideFile(raw, "player#1234");
  const guides = result.plaintext.split("\x00").filter((guide) => guide.trim());
  const headers = guides.map((guide) => guide.split(/\r?\nstep\b/)[0]);
  const names = new Set(
    headers.flatMap((header) => {
      const match = header.match(/^#name\s+(.+)$/m);
      return match ? [match[1].trim()] : [];
    }),
  );
  const versions = headers.map(
    (header) => header.match(/^#version\s+(.+)$/m)?.[1].trim() ?? "none",
  );
  const groups = new Set(
    guides.flatMap((guide) =>
      [...guide.matchAll(/^#group\s+(.+)$/gm)].map((match) => match[1].trim()),
    ),
  );

  assert.equal(result.version, 40000);
  assert.equal(result.guideCount, 204);
  assert.equal(
    crypto.createHash("sha256").update(result.plaintext).digest("hex"),
    "cc495c04add3bf74788aa2914ccfcb321d661f168c8b5924e76dcbad9003fec6",
  );
  assert.equal(headers.filter((header) => /^#forever$/m.test(header)).length, 204);
  assert.equal(versions.filter((version) => version === "24").length, 198);
  assert.equal(versions.filter((version) => version === "2").length, 2);
  assert.equal(versions.filter((version) => version === "1").length, 4);
  assert.equal(guides.filter((guide) => /<<\s*Alliance/m.test(guide)).length, 108);
  assert.equal(guides.filter((guide) => /<<\s*Horde/m.test(guide)).length, 98);
  assert.ok(names.has("1-9 Zephras Isle (Unlocked)"));
  assert.ok(names.has("9-13 Zephras Isle (Unlocked)"));
  assert.equal(
    headers.filter(
      (header) => /Zephras Isle/.test(header) && /^#defaultfor\s+Skyborne$/m.test(header),
    ).length,
    0,
  );
  assert.equal(
    headers.filter((header) => /^#displayname\s+.+Zephras Isle \(Skyborne\)/m.test(header))
      .length,
    2,
  );
  assert.deepEqual([...groups].sort(), [
    "RXP Forever Dungeon Quests (A)",
    "RestedXP Alliance Mage",
    "RestedXP Forever Dungeon Guide (A)",
    "RestedXP Forever Dungeon Guide (H)",
    "RestedXP Forever Dungeon Quests (H)",
    "RestedXP Forever Guide (A)",
    "RestedXP Forever Guide (A) << Alliance",
    "RestedXP Forever Guide (H)",
    "RestedXP Forever Guide (H) << Horde",
    "RestedXP Horde Mage AoE",
    "RestedXP Riverglades (A)",
    "RestedXP Riverglades (H)",
  ]);
});
