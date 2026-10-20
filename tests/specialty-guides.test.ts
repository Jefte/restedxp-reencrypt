import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import test from "node:test";

import { decryptGuideFile } from "../lib/rxp-crypto";

interface GuideFixture {
  name: string;
  path: string;
  guideCount: number;
  sha256: string;
  requiredTag: "classic" | "tbc" | null;
  groups: string[];
}

const fixtures: GuideFixture[] = [
  {
    name: "Classic Hardcore Survival",
    path: "public/guide_classic_hardcore_player_1234.txt",
    guideCount: 67,
    sha256: "fdc97db1d9037dd28729facd07b45480345a2e85e3a031c8c01b1686bdaddd1b",
    requiredTag: "classic",
    groups: ["RestedXP Survival Guide (A)", "RestedXP Survival Guide (H)"],
  },
  {
    name: "Mists of Pandaria",
    path: "public/guide_mop_player_1234.txt",
    guideCount: 148,
    sha256: "18caaf63c0f4f0f55ab2d543b8a06045abfe10e121171c83308c54e11c29627b",
    requiredTag: null,
    groups: [
      "RXP MoP 1-80 (A)",
      "RXP MoP 1-80 (H)",
      "RXP MoP 60-80 (A)",
      "RXP MoP 60-80 (H)",
      "RXP MoP 80-85 (A)",
      "RXP MoP 80-85 (H)",
      "RXP MoP 85-90 (A)",
      "RXP MoP 85-90 (H)",
      "RXP MoP Reputation Guide",
      "RXP Starting Zone (Pandaren)",
      "RXP-Pandaria",
      "RestedXP MoP Preparation",
    ],
  },
  {
    name: "TBC Hardcore Survival",
    path: "public/guide_tbc_hardcore_player_1234.txt",
    guideCount: 43,
    sha256: "cd4ccc53c48016a5fc4929335365d816b15ad1642b9589b9e1c5ff447ab45aee",
    requiredTag: "tbc",
    groups: [
      "RXP TBC Attunement Guide",
      "RXP TBC Survival Guide (A)",
      "RXP TBC Survival Guide (H)",
    ],
  },
];

for (const fixture of fixtures) {
  test(`bundled ${fixture.name} export preserves the validated guide set`, () => {
    const raw = fs.readFileSync(fixture.path, "utf8");
    const result = decryptGuideFile(raw, "player#1234");
    const guides = result.plaintext.split("\x00").filter((guide) => guide.trim());
    const groups = new Set(
      guides.flatMap((guide) =>
        [...guide.matchAll(/^#group\s+(.+)$/gm)].map((match) => match[1].trim()),
      ),
    );

    assert.equal(result.version, 40000);
    assert.equal(result.guideCount, fixture.guideCount);
    assert.equal(
      crypto.createHash("sha256").update(result.plaintext).digest("hex"),
      fixture.sha256,
    );
    if (fixture.requiredTag) {
      assert.equal(
        guides.filter((guide) =>
          new RegExp(`^#${fixture.requiredTag}$`, "m").test(guide),
        ).length,
        fixture.guideCount,
      );
    }
    assert.deepEqual([...groups].sort(), fixture.groups);
  });
}
