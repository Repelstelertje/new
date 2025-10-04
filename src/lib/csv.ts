import fs from "node:fs";
import path from "node:path";

type CsvObj = Record<string, string>;

function looksLikeMojibake(s: string) {
  // snelle heuristiek: veel 'Ã' of 'Â' → waarschijnlijk verkeerde decode
  const bad = (s.match(/[ÃÂ]/g) || []).length;
  return bad >= 2;
}

function decodeSmart(absPath: string): string {
  // Lees als buffer; probeer eerst UTF-8, bij mojibake converteer vanuit latin1
  const buf = fs.readFileSync(absPath);
  let text = buf.toString("utf8");
  if (looksLikeMojibake(text)) {
    // herstel: behandel huidige string als latin1-bytes en decode naar utf8
    text = Buffer.from(text, "latin1").toString("utf8");
  }
  return text;
}

export function readCsv(filePath: string): CsvObj[] {
  const abs = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) return [];
  const text = decodeSmart(abs);
  const lines = text.split(/\r?\n/).filter((ln) => ln.trim() !== "");
  if (lines.length === 0) return [];
  const delim = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delim).map((h) => h.trim());
  const out: CsvObj[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delim).map((c) => c.trim());
    const row: CsvObj = {};
    headers.forEach((h, idx) => (row[h] = cols[idx] ?? ""));
    out.push(row);
  }
  return out;
}

export function fixText(s?: string): string | undefined {
  if (!s) return s;
  // Extra quick-fixes voor veelvoorkomende tekens
  return s
    .replace(/â€™/g, "’")
    .replace(/â€œ/g, "“")
    .replace(/â€\x9D|â€\x9d/g, "”")
    .replace(/Ã«/g, "ë")
    .replace(/Ã©/g, "é")
    .replace(/Ã¡/g, "á")
    .replace(/Ã©/g, "é")
    .replace(/Ã±/g, "ñ")
    .replace(/Â/g, "");
}

