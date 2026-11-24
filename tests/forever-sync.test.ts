import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

import {
  extractRegisteredGuides,
  inspectAddonArchive,
  validateForeverGuides,
  validateForeverIncludes,
} from "../lib/forever-addon";

const guide = (name: string, group = "Group") =>
  `#forever\n#group ${group}\n#name ${name}\nstep\n.goto 1,2`;

test("extracts Lua long strings with any valid equals depth and preserves bodies", () => {
  const lua = `ignored([[no]])\nRXPGuides.RegisterGuide([[${guide("One")}\r\n]])\n` +
    `RXPGuides.RegisterGuide ( [==[${guide("Two")}\ntext ]=] remains]==] )`;
  assert.deepEqual(extractRegisteredGuides(lua), [
    `${guide("One")}\r\n`,
    `${guide("Two")}\ntext ]=] remains`,
  ]);
});

test("rejects unterminated RegisterGuide long strings", () => {
  assert.throws(() => extractRegisteredGuides("RXPGuides.RegisterGuide([=[broken]]"), /unterminated/i);
});

test("validates required headers, steps, and canonical identity uniqueness", () => {
  assert.throws(() => validateForeverGuides([guide("Same"), guide("Same")], 1), /duplicate/i);
  assert.throws(() => validateForeverGuides(["#group G\n#name N\nstep"], 1), /#forever/i);
  assert.throws(() => validateForeverGuides(["#forever\n#group G\n#name N"], 1), /step/i);
  assert.throws(() => validateForeverGuides([guide("Only")], 2), /minimum/i);
  assert.doesNotThrow(() => validateForeverGuides(["#forever\n#internal\n#group G\n#name Library"], 1));
  assert.throws(() => validateForeverGuides(["#forever\n#group G\n#name Empty"], 1), /not an internal/i);
});

test("requires include targets to resolve uniquely inside the payload", () => {
  const library = guide("Library", "Includes");
  const wrapper = `${guide("Wrapper")}\n#include Includes\\Library`;
  assert.doesNotThrow(() => validateForeverIncludes(validateForeverGuides([library, wrapper], 1)));
  const missing = `${guide("Wrapper")}\n#include Includes\\Missing`;
  assert.throws(() => validateForeverIncludes(validateForeverGuides([library, missing], 1)), /unresolved include/i);
});

test("matches exactly one canonical archive member and reads toc version", () => {
  const root = mkdtempSync(join(tmpdir(), "rxp-addon-"));
  mkdirSync(join(root, "Top/RXPGuides/Guides/forever"), { recursive: true });
  writeFileSync(join(root, "Top/RXPGuides/Guides/forever/RestedXP-Skyborne.lua"), `RXPGuides.RegisterGuide([[${guide("One")}\n]])`);
  writeFileSync(join(root, "Top/RXPGuides/RXPGuides.toc"), "## Version: 9.8.7\n");
  const archive = join(root, "addon.zip");
  execFileSync("zip", ["-qr", archive, "Top"], { cwd: root });

  const result = inspectAddonArchive(archive);
  assert.equal(result.canonicalMember, "Top/RXPGuides/Guides/forever/RestedXP-Skyborne.lua");
  assert.equal(result.addonVersion, "9.8.7");
  assert.equal(result.records.length, 1);
  assert.equal(result.foreverDirectoryRecordCount, 1);

  mkdirSync(join(root, "Other/RXPGuides/Guides/forever"), { recursive: true });
  writeFileSync(join(root, "Other/RXPGuides/Guides/forever/RestedXP-Skyborne.lua"), `RXPGuides.RegisterGuide([[${guide("Two")}\n]])`);
  execFileSync("zip", ["-qr", archive, "Other"], { cwd: root });
  assert.throws(() => inspectAddonArchive(archive), /ambiguous/i);
});
