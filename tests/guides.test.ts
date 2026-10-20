import assert from "node:assert/strict";
import test from "node:test";

import { GUIDES } from "../lib/guides";

test("catalog includes the WoW Forever both-factions guide", () => {
  const forever = GUIDES.find((guide) => guide.id === "forever");

  assert.ok(forever);
  assert.equal(forever.expansion, "WoW Forever");
  assert.equal(forever.levels, "1-60");
  assert.equal(forever.guideUrl, "/guide_forever_player_1234.txt");
  assert.equal(forever.sourceTag, "player#1234");
});

test("catalog includes the Classic Era both-factions guide", () => {
  const classic = GUIDES.find((guide) => guide.id === "classic");

  assert.ok(classic);
  assert.equal(classic.expansion, "Classic Era");
  assert.equal(classic.levels, "1-60");
  assert.equal(classic.guideUrl, "/guide_classic_player_1234.txt");
  assert.equal(classic.sourceTag, "player#1234");
});
