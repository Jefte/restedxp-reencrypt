#!/usr/bin/env tsx
import { createHash } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

import {
  inspectAddonArchive,
  validateForeverGuides,
  validateForeverIncludes,
  type ForeverGuide,
} from "../lib/forever-addon";
import { decryptGuideFile, encryptForBattletag } from "../lib/rxp-crypto";

const SOURCE_TAG = "player#1234";
const ENVELOPE_VERSION = 40000;
const MINIMUM_GUIDES = 100;
const ASSET = resolve("public/guide_forever_player_1234.txt");
const METADATA = resolve("public/guide_forever_player_1234.metadata.json");

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function normalizeGuide(body: string): string {
  return body.replace(/\r\n?/g, "\n").split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .filter((line) => line.trim() !== "")
    .join("\n");
}

function indexGuides(guides: ForeverGuide[]): Map<string, ForeverGuide> {
  return new Map(guides.map((guide) => [guide.identity, guide]));
}

function displayIdentity(identity: string): string {
  return identity.split("\x00").filter(Boolean).join(" / ");
}

function semanticDiff(before: ForeverGuide[], after: ForeverGuide[]) {
  const oldIndex = indexGuides(before);
  const newIndex = indexGuides(after);
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

function parseArgs(argv: string[]): { archive: string; mode: "check" | "write" } {
  const archiveIndex = argv.indexOf("--archive");
  const check = argv.includes("--check");
  const write = argv.includes("--write");
  if (archiveIndex < 0 || !argv[archiveIndex + 1] || check === write) {
    throw new Error("Usage: sync-forever-from-addon.ts --archive PATH (--check|--write)");
  }
  return { archive: resolve(argv[archiveIndex + 1]), mode: write ? "write" : "check" };
}

export function run(argv = process.argv.slice(2)): void {
  const { archive, mode } = parseArgs(argv);
  const archiveBytes = readFileSync(archive);
  const inspection = inspectAddonArchive(archive);
  const extracted = validateForeverGuides(inspection.records, 1);
  validateForeverIncludes(extracted);
  const plaintext = `\x00${inspection.records.join("\x00")}`;

  const currentRaw = readFileSync(ASSET, "utf8");
  const current = decryptGuideFile(currentRaw, SOURCE_TAG);
  const currentBodies = current.plaintext.split("\x00").filter((body) => body.trim());
  const currentGuides = validateForeverGuides(currentBodies, MINIMUM_GUIDES);
  const diff = semanticDiff(currentGuides, extracted);

  console.log(`Archive: ${archive}`);
  console.log(`Addon version: ${inspection.addonVersion}`);
  console.log(`Canonical member: ${inspection.canonicalMember}`);
  console.log(`Canonical records: ${extracted.length}`);
  console.log(`English forever directory records: ${inspection.foreverDirectoryRecordCount}`);
  const identityOverlap = extracted.length - diff.added.length;
  const unchangedOverlap = identityOverlap - diff.changed.length;
  console.log(`Identity-key overlap with current asset: ${identityOverlap}`);
  console.log(`Unchanged semantic overlap with current asset: ${unchangedOverlap}`);
  console.log(`Diff: +${diff.added.length} -${diff.removed.length} ~${diff.changed.length}`);
  if (extracted.length < MINIMUM_GUIDES) {
    throw new Error(
      `Incomplete/unsupported addon archive: canonical record count ${extracted.length} is below minimum safety floor ${MINIMUM_GUIDES}; asset was not written`,
    );
  }

  const encrypted = encryptForBattletag(plaintext, SOURCE_TAG, ENVELOPE_VERSION);
  const roundtrip = decryptGuideFile(encrypted, SOURCE_TAG);
  if (roundtrip.version !== ENVELOPE_VERSION || roundtrip.plaintext !== plaintext || roundtrip.guideCount !== extracted.length) {
    throw new Error("Strict encryption roundtrip failed");
  }

  const exact = current.plaintext === plaintext;
  const normalizedExact = currentBodies.length === inspection.records.length &&
    currentBodies.every((body, index) => normalizeGuide(body) === normalizeGuide(inspection.records[index]));
  const summary = {
    added: diff.added.length,
    removed: diff.removed.length,
    changed: diff.changed.length,
    addedIdentities: diff.added,
    removedIdentities: diff.removed,
    changedIdentities: diff.changed,
  };
  const metadata = {
    schemaVersion: 1,
    provenance: "archive-derived",
    archiveSha256: sha256(archiveBytes),
    addonVersion: inspection.addonVersion,
    canonicalArchiveMember: inspection.canonicalMember,
    recordCount: extracted.length,
    plaintextSha256: sha256(plaintext),
    encryptedSha256: sha256(encrypted),
    semanticDiff: summary,
    records: extracted.map((guide) => ({
      group: guide.group,
      subgroup: guide.subgroup,
      name: guide.name,
      identitySha256: sha256(guide.identity),
      plaintextSha256: sha256(guide.body),
      normalizedPlaintextSha256: sha256(normalizeGuide(guide.body)),
    })),
  };

  console.log(`Records: ${extracted.length}`);
  console.log(`Current plaintext: exact=${exact}, normalizedExact=${normalizedExact}`);
  console.log(`Archive SHA256: ${metadata.archiveSha256}`);
  console.log(`Plaintext SHA256: ${metadata.plaintextSha256}`);
  console.log(`Encrypted SHA256: ${metadata.encryptedSha256}`);

  if (mode === "write") {
    atomicWrite(ASSET, encrypted);
    atomicWrite(METADATA, `${JSON.stringify(metadata, null, 2)}\n`);
    console.log(`Updated ${ASSET} and ${METADATA}`);
  } else {
    console.log("Check mode: no files written");
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
