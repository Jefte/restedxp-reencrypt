import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import { decryptGuideFile } from "../lib/rxp-crypto";

test("bundled Forever export matches the supplied both-factions guide", () => {
  const raw = fs.readFileSync("public/guide_forever_player_1234.txt", "utf8");
  const result = decryptGuideFile(raw, "player#1234");
  const guides = result.plaintext.split("\x00").filter((guide) => guide.trim());
  const headers = guides.map((guide) => guide.split(/\r?\nstep\b/)[0]);
  const groups = new Set(
    guides.flatMap((guide) =>
      [...guide.matchAll(/^#group\s+(.+)$/gm)].map((match) => match[1].trim()),
    ),
  );

  assert.equal(result.version, 40000);
  assert.equal(result.guideCount, 202);
  assert.equal(
    crypto.createHash("sha256").update(result.plaintext).digest("hex"),
    "ade21f9922d90078993470cb14d8caa3f33299c77f2fa9a2a089c2514f22ab89",
  );
  assert.equal(headers.filter((header) => /^#forever$/m.test(header)).length, 202);
  assert.equal(guides.filter((guide) => /<<\s*Alliance/m.test(guide)).length, 106);
  assert.equal(guides.filter((guide) => /<<\s*Horde/m.test(guide)).length, 96);
  assert.deepEqual([...groups].sort(), [
    "RXP Forever Dungeon Quests (A)",
    "RestedXP Alliance Mage",
    "RestedXP Forever Dungeon Guide (A)",
    "RestedXP Forever Dungeon Guide (H)",
    "RestedXP Forever Dungeon Quests (H)",
    "RestedXP Forever Guide (A)",
    "RestedXP Forever Guide (H)",
    "RestedXP Horde Mage AoE",
    "RestedXP Riverglades (A)",
    "RestedXP Riverglades (H)",
  ]);
});
