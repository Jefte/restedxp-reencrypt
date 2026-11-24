import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import { decryptGuideFile } from "../lib/rxp-crypto";

test("bundled Forever export matches its committed upstream provenance", () => {
  const raw = fs.readFileSync("public/guide_forever_player_1234.txt", "utf8");
  const metadata = JSON.parse(fs.readFileSync("public/guide_forever_player_1234.metadata.json", "utf8"));
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
  assert.ok(result.guideCount >= 200);
  assert.equal(result.guideCount, guides.length);
  assert.equal(metadata.recordCount, guides.length);
  assert.equal(metadata.envelopeVersion, result.version);
  assert.equal(metadata.provenance, "public-encrypted-export-rekeyed");
  assert.equal(metadata.upstreamRepository, "Inariaa/rxp_decrypter");
  assert.match(metadata.upstreamCommit, /^[0-9a-f]{40}$/);
  assert.equal(crypto.createHash("sha256").update(result.plaintext).digest("hex"), metadata.plaintextSha256);
  assert.equal(crypto.createHash("sha256").update(raw).digest("hex"), metadata.encryptedSha256);
  assert.equal(headers.filter((header) => /^#forever$/m.test(header)).length, guides.length);
  assert.ok(names.has("60-60 Mount Hyjal"));
  assert.ok(names.has("59-60 Winterspring/Silithus II"));
  assert.deepEqual([...groups].sort(), [
    "RXP Forever Dungeon Quests (A)",
    "RXP-Hyjal",
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
