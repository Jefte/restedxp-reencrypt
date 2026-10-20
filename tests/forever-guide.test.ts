import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import { decryptGuideFile } from "../lib/rxp-crypto";

test("bundled Forever export matches the supplied both-factions guide", () => {
  const raw = fs.readFileSync("public/guide_forever_player_1234.txt", "utf8");
  const result = decryptGuideFile(raw, "player#1234");
  const guides = result.plaintext.split("\x00").filter((guide) => guide.trim());
  const groups = new Set(
    guides.flatMap((guide) =>
      [...guide.matchAll(/^#group\s+(.+)$/gm)].map((match) => match[1].trim()),
    ),
  );

  assert.equal(result.guideCount, 188);
  assert.equal(
    crypto.createHash("sha256").update(result.plaintext).digest("hex"),
    "cbb03a5ab8366f4c6f059931e6dac2cefd08743b13827dee5a17e78ae6302e00",
  );
  assert.equal(guides.filter((guide) => /^#forever$/m.test(guide)).length, 188);
  assert.equal(guides.filter((guide) => /<<\s*Alliance/m.test(guide)).length, 103);
  assert.equal(guides.filter((guide) => /<<\s*Horde/m.test(guide)).length, 85);
  assert.deepEqual([...groups].sort(), [
    "RXP Dungeon Quest Guides (A)",
    "RestedXP Alliance Mage",
    "RestedXP Dungeon Quest Guides (H)",
    "RestedXP Forever Dungeon Guide (A)",
    "RestedXP Forever Dungeon Guide (H)",
    "RestedXP Forever Guide (A)",
    "RestedXP Forever Guide (H)",
    "RestedXP Horde Mage AoE",
  ]);
});
