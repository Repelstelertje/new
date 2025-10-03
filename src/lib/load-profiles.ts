import fs from "node:fs";
import path from "node:path";

export type CsvProfile = {
  profile_id: string;
  profile_name: string;
  gender?: string;
  province?: string;
  city?: string;
  age?: string;
  length?: string;
  aboutme?: string;
  profile_image?: string;
};

function stripQuotes(s: string) {
  if (s == null) return "";
  const t = s.trim();
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t;
}

function splitSafe(line: string, delim: string): string[] {
  // Eenvoudige CSV-splitter met quote-ondersteuning (geen escaped quotes nodig in onze data)
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCsv(text: string): CsvProfile[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const headerLine = lines[0];
  const delim = headerLine.includes(";") ? ";" : ",";
  const headers = headerLine.split(delim).map((h) => stripQuotes(h));
  const rows: CsvProfile[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitSafe(lines[i], delim).map(stripQuotes);
    const rec: Record<string, string> = {};
    for (let c = 0; c < headers.length; c++) {
      rec[headers[c]] = cells[c] ?? "";
    }
    rows.push(rec as CsvProfile);
  }
  return rows;
}

function readCsv(relPath: string): CsvProfile[] {
  const abs = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(abs)) return [];
  const txt = fs.readFileSync(abs, "utf8");
  return parseCsv(txt);
}

export function loadAllProfiles(): CsvProfile[] {
  // Merge, met voorkeur voor 'profiles.csv' waarden
  const primary = readCsv("data/profiles.csv");
  const popular = readCsv("data/popular.csv");
  const byId = new Map<string, CsvProfile>();
  for (const row of [...popular, ...primary]) {
    if (!row?.profile_id || !row?.profile_name) continue;
    // primary overschrijft popular: daarom duwen we 'popular' eerst
    byId.set(String(row.profile_id), row);
  }
  return Array.from(byId.values());
}
