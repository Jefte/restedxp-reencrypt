# RestedXP guide re-encrypter

The site serves validated RestedXP guide payloads encrypted for the repository's canonical source BattleTag, then re-keys them in the browser for the player's BattleTag.

## Forever updates

The Forever bundle is synchronized from the public encrypted `guide.txt` in [`Inariaa/rxp_decrypter`](https://github.com/Inariaa/rxp_decrypter). This is a community source, not an official RestedXP feed. Every generated asset records the exact immutable upstream commit and hashes in `public/guide_forever_player_1234.metadata.json`.

```sh
npm run sync:forever:upstream:check
npm run sync:forever:upstream:write
npm run verify
```

The scheduled workflow accepts additive, bounded updates and fails closed on guide removals, count decreases, large additions, mass content changes, invalid envelopes, unresolved includes, or failed encryption round trips. A deliberately breaking migration requires a reviewed local run of:

```sh
npx tsx scripts/sync-forever-from-inariaa.ts --write --allow-breaking
```

Addon-archive checks remain available through `sync:forever:check` and `sync:forever:write` with an explicit `--archive PATH` argument.
