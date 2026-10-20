import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import { decryptGuideFile } from "../lib/rxp-crypto";

test("bundled Classic Era export matches the supplied both-factions guide", () => {
  const raw = fs.readFileSync("public/guide_classic_player_1234.txt", "utf8");
  const result = decryptGuideFile(raw, "player#1234");
  const guides = result.plaintext.split("\x00").filter((guide) => guide.trim());
  const groups = new Set(
    guides.flatMap((guide) =>
      [...guide.matchAll(/^#group\s+(.+)$/gm)].map((match) => match[1].trim()),
    ),
  );

  assert.equal(result.version, 40000);
  assert.equal(result.guideCount, 117);
  assert.equal(
    crypto.createHash("sha256").update(result.plaintext).digest("hex"),
    "a888b8458b3fddf51bb2ac090d634308bd5fa88d1175411156863dc9fbf1be6b",
  );
  assert.equal(guides.filter((guide) => /^#classic$/m.test(guide)).length, 117);
  assert.equal(guides.filter((guide) => /<<\s*Alliance/m.test(guide)).length, 81);
  assert.equal(guides.filter((guide) => /<<\s*Horde/m.test(guide)).length, 36);
  assert.deepEqual([...groups].sort(), [
    "RestedXP ADV AoE Alliance Mage",
    "RestedXP Alliance 20-30",
    "RestedXP Alliance 30-40",
    "RestedXP Alliance 40-50",
    "RestedXP Alliance 50-60",
    "RestedXP Alliance Mage",
    "RestedXP Horde 22-30",
    "RestedXP Horde 30-40",
    "RestedXP Horde 40-50",
    "RestedXP Horde 40-50 << !sod",
    "RestedXP Horde 50-60",
    "RestedXP Horde 50-60 << sod",
    "RestedXP Horde Mage AoE",
  ]);
});
