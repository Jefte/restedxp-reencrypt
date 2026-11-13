import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import { decryptGuideFile } from "../lib/rxp-crypto";

test("bundled Forever export preserves the v4.11.36 addon guide set", () => {
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
  const groups = new Set(
    guides.flatMap((guide) =>
      [...guide.matchAll(/^#group\s+(.+)$/gm)].map((match) => match[1].trim()),
    ),
  );

  assert.equal(result.version, 40000);
  assert.equal(result.guideCount, 204);
  assert.equal(
    crypto.createHash("sha256").update(result.plaintext).digest("hex"),
    "7adba87de3472a3e438879b0e7fe98b4bb236ff9f7e5f9840f18dc0592a20190",
  );
  assert.equal(headers.filter((header) => /^#forever$/m.test(header)).length, 204);
  assert.equal(guides.filter((guide) => /<<\s*Alliance/m.test(guide)).length, 108);
  assert.equal(guides.filter((guide) => /<<\s*Horde/m.test(guide)).length, 98);
  assert.ok(names.has("1-9 Zephras Isle"));
  assert.ok(names.has("9-13 Zephras Isle"));
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
