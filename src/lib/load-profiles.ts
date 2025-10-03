import fs from "node:fs";
import path from "node:path";

export type CsvProfile = {
  profile_id: string;
  profile_name: string;
  gender?: string;
  province?: string;
  city?: string;
  age?: string | number;
  length?: string;
  aboutme?: string;
  profile_image?: string;
};

// tiny CSV reader without deps (expects first line header, comma separated, no quoted commas)
function readCsv(filePath: string): CsvProfile[] {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) return [];
  const raw = fs.readFileSync(abs, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (lines.length === 0) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  const rows = lines.slice(1);
  const records: CsvProfile[] = [];
  for (const line of rows) {
    const cols = line.split(",").map((c) => c.trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = cols[i] ?? ""));
    // normalize keys we expect
    records.push({
      profile_id: obj.profile_id,
      profile_name: obj.profile_name,
      gender: obj.gender || undefined,
      province: obj.province || undefined,
      city: obj.city || undefined,
      age: obj.age || undefined,
      length: obj.length || undefined,
      aboutme: obj.aboutme || undefined,
      profile_image: obj.profile_image || undefined,
    });
  }
  return records.filter((r) => r.profile_id && r.profile_name);
}

export function loadAllProfiles() {
  const primary = readCsv("data/profiles.csv");
  const extra = readCsv("data/popular.csv");
  const byId = new Map<string, CsvProfile>();
  // prefer primary over extra
  for (const r of [...extra, ...primary]) {
    if (!byId.has(r.profile_id)) byId.set(r.profile_id, r);
  }
  return Array.from(byId.values());
}
