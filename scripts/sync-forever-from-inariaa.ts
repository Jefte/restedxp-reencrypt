#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import {
  validateForeverGuides,
  validateForeverIncludes,
  type ForeverGuide,
} from "../lib/forever-addon";
import { decryptGuideFile, encryptForBattletag } from "../lib/rxp-crypto";

const UPSTREAM_REPOSITORY = "Inariaa/rxp_decrypter";
const UPSTREAM_PATH = "guide.txt";
const UPSTREAM_TAG = "haha#6767";
const TARGET_TAG = "player#1234";
const EXPECTED_VERSION = 40000;
const MINIMUM_GUIDES = 200;
const MAX_SAFE_ADDITIONS = 50;
const MAX_SAFE_CHANGED_FRACTION = 0.25;
const ASSET = resolve("public/guide_forever_player_1234.txt");
const METADATA = resolve("public/guide_forever_player_1234.metadata.json");

type Mode = "check" | "write";

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeGuide(body: string): string {
  return body.replace(/\r\n?/g, "\n").split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .filter((line) => line.trim() !== "")
    .join("\n");
}

function displayIdentity(identity: string): string {
  return identity.split("\x00").filter(Boolean).join(" / ");
}

function semanticDiff(before: ForeverGuide[], after: ForeverGuide[]) {
  const oldIndex = new Map(before.map((guide) => [guide.identity, guide]));
  const newIndex = new Map(after.map((guide) => [guide.identity, guide]));
  const added = [...newIndex.keys()].filter((key) => !oldIndex.has(key)).map(displayIdentity).sort();
  const removed = [...oldIndex.keys()].filter((key) => !newIndex.has(key)).map(displayIdentity).sort();
  const changed = [...newIndex.keys()].filter((key) => {
    const old = oldIndex.get(key);
    return old && normalizeGuide(old.body) !== normalizeGuide(newIndex.get(key)!.body);
  }).map(displayIdentity).sort();
  return { added, removed, changed };
}

function atomicWrite(path: string, content: string): void {
  const temporary = join(dirname(path), `.${basename(path)}.${process.pid}.tmp`);
  try {
    writeFileSync(temporary, content, { encoding: "utf8", mode: 0o644, flag: "wx" });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

async function fetchText(url: string, accept: string): Promise<string> {
  const headers: Record<string, string> = {
    Accept: accept,
    "User-Agent": "restedxp-reencrypt-updater",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(url, {
    headers,
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} while fetching ${url}`);
  return response.text();
}

async function fetchUpstream(): Promise<{
  commit: string;
  committedAt: string;
  rawUrl: string;
  raw: string;
}> {
  const commitsUrl = `https://api.github.com/repos/${UPSTREAM_REPOSITORY}/commits?path=${encodeURIComponent(UPSTREAM_PATH)}&per_page=1`;
  const commits = JSON.parse(await fetchText(commitsUrl, "application/vnd.github+json")) as Array<{
    sha?: string;
    commit?: { committer?: { date?: string } };
  }>;
  const commit = commits[0]?.sha ?? "";
  const committedAt = commits[0]?.commit?.committer?.date ?? "";
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error("Upstream returned an invalid guide commit SHA");
  if (!/^\d{4}-\d{2}-\d{2}T/.test(committedAt)) throw new Error("Upstream returned an invalid commit timestamp");

  const rawUrl = `https://raw.githubusercontent.com/${UPSTREAM_REPOSITORY}/${commit}/${UPSTREAM_PATH}`;
  const raw = await fetchText(rawUrl, "text/plain");
  if (raw.length < 100_000) throw new Error(`Upstream guide payload is unexpectedly small (${raw.length} bytes)`);
  return { commit, committedAt, rawUrl, raw };
}

function parseArgs(argv: string[]): { mode: Mode; allowBreaking: boolean } {
  const check = argv.includes("--check");
  const write = argv.includes("--write");
  if (check === write) {
    throw new Error("Usage: sync-forever-from-inariaa.ts (--check|--write) [--allow-breaking]");
  }
  return { mode: write ? "write" : "check", allowBreaking: argv.includes("--allow-breaking") };
}

export async function run(argv = process.argv.slice(2)): Promise<void> {
  const { mode, allowBreaking } = parseArgs(argv);
  const upstream = await fetchUpstream();
  const source = decryptGuideFile(upstream.raw, UPSTREAM_TAG);
  if (source.version !== EXPECTED_VERSION) throw new Error(`Unexpected upstream envelope version ${source.version}`);
  if (!source.plaintext.startsWith("\x00")) throw new Error("Upstream plaintext lost its leading NUL delimiter");
  const upstreamBodies = source.plaintext.split("\x00").filter((body) => body.trim());
  const upstreamGuides = validateForeverGuides(upstreamBodies, MINIMUM_GUIDES);
  validateForeverIncludes(upstreamGuides);
  if (source.guideCount !== upstreamGuides.length) throw new Error("Upstream declared/actual guide counts differ");

  const currentRaw = readFileSync(ASSET, "utf8");
  const current = decryptGuideFile(currentRaw, TARGET_TAG);
  const currentBodies = current.plaintext.split("\x00").filter((body) => body.trim());
  const currentGuides = validateForeverGuides(currentBodies, MINIMUM_GUIDES);
  const diff = semanticDiff(currentGuides, upstreamGuides);
  const changedLimit = Math.max(10, Math.floor(currentGuides.length * MAX_SAFE_CHANGED_FRACTION));

  console.log(`Upstream: ${UPSTREAM_REPOSITORY}@${upstream.commit}`);
  console.log(`Upstream committed: ${upstream.committedAt}`);
  console.log(`Records: ${currentGuides.length} -> ${upstreamGuides.length}`);
  console.log(`Semantic diff: +${diff.added.length} -${diff.removed.length} ~${diff.changed.length}`);

  if (!allowBreaking) {
    if (upstreamGuides.length < currentGuides.length) throw new Error("Guide count decreased; manual review required");
    if (diff.removed.length > 0) throw new Error("Guide identities were removed; manual review required");
    if (diff.added.length > MAX_SAFE_ADDITIONS) throw new Error("Too many guide identities were added; manual review required");
    if (diff.changed.length > changedLimit) throw new Error("Too many existing guide bodies changed; manual review required");
  }

  const encrypted = encryptForBattletag(source.plaintext, TARGET_TAG, source.version);
  const roundtrip = decryptGuideFile(encrypted, TARGET_TAG);
  if (roundtrip.plaintext !== source.plaintext || roundtrip.guideCount !== upstreamGuides.length || roundtrip.version !== source.version) {
    throw new Error("Target encryption roundtrip failed");
  }

  const metadata = {
    schemaVersion: 1,
    provenance: "public-encrypted-export-rekeyed",
    upstreamRepository: UPSTREAM_REPOSITORY,
    upstreamPath: UPSTREAM_PATH,
    upstreamCommit: upstream.commit,
    upstreamCommittedAt: upstream.committedAt,
    upstreamRawUrl: upstream.rawUrl,
    upstreamEncryptedSha256: sha256(upstream.raw),
    sourceBattleTag: UPSTREAM_TAG,
    targetBattleTag: TARGET_TAG,
    envelopeVersion: source.version,
    recordCount: upstreamGuides.length,
    plaintextSha256: sha256(source.plaintext),
    encryptedSha256: sha256(encrypted),
    semanticDiff: {
      added: diff.added.length,
      removed: diff.removed.length,
      changed: diff.changed.length,
      addedIdentities: diff.added,
      removedIdentities: diff.removed,
      changedIdentities: diff.changed,
    },
    records: upstreamGuides.map((guide) => ({
      group: guide.group,
      subgroup: guide.subgroup,
      name: guide.name,
      identitySha256: sha256(guide.identity),
      plaintextSha256: sha256(guide.body),
      normalizedPlaintextSha256: sha256(normalizeGuide(guide.body)),
    })),
  };

  console.log(`Upstream encrypted SHA256: ${metadata.upstreamEncryptedSha256}`);
  console.log(`Plaintext SHA256: ${metadata.plaintextSha256}`);
  console.log(`Target encrypted SHA256: ${metadata.encryptedSha256}`);
  if (mode === "write") {
    if (current.plaintext === source.plaintext && existsSync(METADATA)) {
      const existing = JSON.parse(readFileSync(METADATA, "utf8")) as Record<string, unknown>;
      if (
        existing.upstreamCommit === upstream.commit &&
        existing.plaintextSha256 === metadata.plaintextSha256 &&
        existing.encryptedSha256 === metadata.encryptedSha256
      ) {
        console.log("Current asset and provenance metadata are already up to date; no files written");
        return;
      }
    }
    atomicWrite(ASSET, encrypted);
    atomicWrite(METADATA, `${JSON.stringify(metadata, null, 2)}\n`);
    console.log(`Updated ${ASSET} and ${METADATA}`);
  } else {
    console.log(current.plaintext === source.plaintext ? "Current asset is up to date" : "Update available; check mode wrote nothing");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
