import { execFileSync } from "node:child_process";
import { extname } from "node:path";

export const CANONICAL_FOREVER_SUFFIX =
  "RXPGuides/Guides/forever/RestedXP-Skyborne.lua";
const TOC_SUFFIX = "RXPGuides/RXPGuides.toc";

export interface ForeverGuide {
  body: string;
  group: string;
  subgroup: string;
  name: string;
  identity: string;
}

export interface AddonArchiveInspection {
  canonicalMember: string;
  tocMember: string;
  addonVersion: string;
  records: string[];
  foreverDirectoryRecordCount: number;
}

function safeMembers(output: string): string[] {
  return output.split(/\r?\n/).filter(Boolean).map((member) => {
    const normalized = member.replaceAll("\\", "/").replace(/^\.\//, "");
    if (normalized.startsWith("/") || normalized.split("/").includes("..")) {
      throw new Error(`Unsafe archive member path: ${member}`);
    }
    return normalized;
  });
}

function archiveCommand(archive: string, operation: "list" | "read", member?: string): [string, string[]] {
  if (extname(archive).toLowerCase() === ".zip") {
    return operation === "list"
      ? ["unzip", ["-Z1", archive]]
      : ["unzip", ["-p", archive, member!]];
  }
  return operation === "list"
    ? ["bsdtar", ["-tf", archive]]
    : ["bsdtar", ["-xOf", archive, member!]];
}

function runArchive(archive: string, operation: "list" | "read", member?: string): string {
  const [command, args] = archiveCommand(archive, operation, member);
  try {
    return execFileSync(command, args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    throw new Error(`Unable to ${operation} addon archive ${archive} with ${command}`, { cause: error });
  }
}

function uniqueSuffix(members: string[], suffix: string, label: string): string {
  const matches = members.filter((member) => member === suffix || member.endsWith(`/${suffix}`));
  if (matches.length === 0) throw new Error(`Missing ${label} archive member (${suffix})`);
  if (matches.length !== 1) throw new Error(`Ambiguous ${label} archive members: ${matches.join(", ")}`);
  return matches[0];
}

/** Extract only calls whose first argument is a Lua long string. */
export function extractRegisteredGuides(lua: string): string[] {
  const records: string[] = [];
  const call = /RXPGuides\s*\.\s*RegisterGuide\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = call.exec(lua))) {
    let cursor = call.lastIndex;
    while (/\s/.test(lua[cursor] ?? "")) cursor++;
    if (lua[cursor] !== "[") throw new Error(`RegisterGuide at byte ${match.index} does not use a Lua long string`);
    let equals = 0;
    while (lua[cursor + 1 + equals] === "=") equals++;
    if (lua[cursor + 1 + equals] !== "[") {
      throw new Error(`Malformed RegisterGuide long string at byte ${cursor}`);
    }
    const bodyStart = cursor + equals + 2;
    const close = `]${"=".repeat(equals)}]`;
    const bodyEnd = lua.indexOf(close, bodyStart);
    if (bodyEnd < 0) throw new Error(`Unterminated RegisterGuide long string at byte ${cursor}`);
    records.push(lua.slice(bodyStart, bodyEnd));
    call.lastIndex = bodyEnd + close.length;
  }
  return records;
}

function headerValue(header: string, directive: string): string {
  const match = header.match(new RegExp(`^#${directive}[ \\t]+(.+?)[ \\t]*$`, "m"));
  return match?.[1].trim() ?? "";
}

export function validateForeverGuides(records: string[], minimumCount = 100): ForeverGuide[] {
  if (records.length < minimumCount) {
    throw new Error(`Record count ${records.length} is below minimum safety floor ${minimumCount}`);
  }
  const identities = new Set<string>();
  return records.map((body, index) => {
    const step = body.search(/^step(?:[ \t]|$)/m);
    const header = step < 0 ? body : body.slice(0, step);
    if (step < 0 && !/^#internal[ \t]*$/m.test(header)) {
      throw new Error(`Record ${index + 1} has no step and is not an internal library record`);
    }
    if (!/^#forever[ \t]*$/m.test(header)) throw new Error(`Record ${index + 1} has no header #forever tag`);
    const group = headerValue(header, "group");
    const subgroup = headerValue(header, "subgroup");
    const name = headerValue(header, "name");
    if (!group) throw new Error(`Record ${index + 1} has empty or missing #group`);
    if (!name) throw new Error(`Record ${index + 1} has empty or missing #name`);
    const identity = `${group}\x00${subgroup}\x00${name}`;
    if (identities.has(identity)) throw new Error(`Duplicate canonical identity: ${group} / ${subgroup} / ${name}`);
    identities.add(identity);
    return { body, group, subgroup, name, identity };
  });
}

/** Require every RestedXP #include target to exist in the same payload. */
export function validateForeverIncludes(guides: ForeverGuide[]): void {
  const targets = new Map<string, number>();
  for (const guide of guides) {
    const key = `${guide.group}\x00${guide.name}`;
    targets.set(key, (targets.get(key) ?? 0) + 1);
  }

  for (const guide of guides) {
    for (const match of guide.body.matchAll(/^#include[ \t]+(.+?)\\(.+?)(?:@[^\r\n]*)?[ \t]*$/gm)) {
      const target = `${match[1].trim()}\x00${match[2].trim()}`;
      const count = targets.get(target) ?? 0;
      if (count === 0) {
        throw new Error(`Unresolved include in ${guide.group} / ${guide.name}: ${match[1]}\\${match[2]}`);
      }
      if (count !== 1) {
        throw new Error(`Ambiguous include in ${guide.group} / ${guide.name}: ${match[1]}\\${match[2]}`);
      }
    }
  }
}

export function inspectAddonArchive(archive: string): AddonArchiveInspection {
  const members = safeMembers(runArchive(archive, "list"));
  const canonicalMember = uniqueSuffix(members, CANONICAL_FOREVER_SUFFIX, "canonical Forever guide");
  const tocMember = uniqueSuffix(members, TOC_SUFFIX, "RXPGuides toc");
  const toc = runArchive(archive, "read", tocMember);
  const versionMatches = [...toc.matchAll(/^##[ \t]*Version:[ \t]*(\S.*?)[ \t]*$/gmi)];
  if (versionMatches.length !== 1) throw new Error(`Expected exactly one Version in ${tocMember}`);
  const records = extractRegisteredGuides(runArchive(archive, "read", canonicalMember));
  if (records.length === 0) throw new Error(`No RegisterGuide records in ${canonicalMember}`);
  const foreverPrefix = canonicalMember.slice(0, -"RestedXP-Skyborne.lua".length);
  const foreverMembers = members.filter((member) =>
    member.startsWith(foreverPrefix) && member.endsWith(".lua"),
  );
  const foreverDirectoryRecordCount = foreverMembers.reduce(
    (count, member) => count + extractRegisteredGuides(runArchive(archive, "read", member)).length,
    0,
  );
  return {
    canonicalMember,
    tocMember,
    addonVersion: versionMatches[0][1],
    records,
    foreverDirectoryRecordCount,
  };
}
