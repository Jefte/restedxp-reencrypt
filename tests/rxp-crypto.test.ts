import assert from "node:assert/strict";
import test from "node:test";

import { decryptGuideFile, encryptForBattletag } from "../lib/rxp-crypto";

const TAG = "testplayer#12345";

test("Forever payloads preserve their leading NUL and guide count", () => {
  const plaintext =
    "\x00#forever\n#group RestedXP Forever Guide (A)\n#name Alliance Test\n" +
    "\x00#forever\n#group RestedXP Forever Guide (H)\n#name Horde Test\n";

  const encrypted = encryptForBattletag(plaintext, TAG, 40000);
  const decrypted = decryptGuideFile(encrypted, TAG);

  assert.match(encrypted, /^2\|/);
  assert.equal(decrypted.guideCount, 2);
  assert.equal(decrypted.plaintext, plaintext);
});

test("rejects an envelope whose declared guide count is tampered", () => {
  const plaintext =
    "#forever\n#name First\n\x00#forever\n#name Second\n";
  const encrypted = encryptForBattletag(plaintext, TAG, 40000);
  const tamperedHeader = encrypted.replace(/^2\|/, "1|");

  assert.throws(() => decryptGuideFile(tamperedHeader, TAG), /guide count/i);
});

test("rejects checksum tampering, malformed grammar, and trailing garbage", () => {
  const encrypted = encryptForBattletag("#name One\nstep\n", TAG, 40000);
  assert.throws(
    () => decryptGuideFile(encrypted.replace(/^1\|(-?\d+)/, "1|0"), TAG),
    /checksum/i,
  );
  assert.throws(() => decryptGuideFile(`${encrypted}junk`, TAG), /envelope/i);
  assert.throws(() => decryptGuideFile(encrypted.replace(":", ";"), TAG), /envelope/i);
});
