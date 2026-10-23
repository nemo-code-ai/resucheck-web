export type CodeChecksResult = {
  score: number; // out of 30
  breakdown: {
    parsability: number; // out of 10
    structure: number; // out of 10
    contact: number; // out of 5
    hygiene: number; // out of 5
  };
  findings: string[];
};

// Headings an ATS expects to find. Each pattern is tested against one line.
const SECTION_PATTERNS = {
  education: /^(education|academic background|qualifications?)\b/i,
  experience: /^(work experience|professional experience|experience|employment|internships?)\b/i,
  projects: /^(projects?|personal projects?|selected projects?)\b/i,
  skills: /^(technical skills|skills|technologies|tech stack)\b/i,
};

function round(n: number) {
  return Math.round(n * 10) / 10;
}

// Is something written on the page, hidden behind a hyperlink, or missing?
type Found = "visible" | "hidden" | "missing";

function locate(pattern: RegExp, text: string, links: string[]): Found {
  if (pattern.test(text)) return "visible";
  if (links.some((link) => pattern.test(link))) return "hidden";
  return "missing";
}

export function runCodeChecks(text: string, pages: number, links: string[] = []): CodeChecksResult {
  const findings: string[] = [];
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const words = text.split(/\s+/).filter(Boolean).length;

  // ---------- 1. Parsability (10) ----------
  let parsability = 10;
  if (text.trim().length < 200) {
    parsability = 0;
    findings.push("Almost no text could be extracted. The PDF may be a scan or image, which an ATS cannot read.");
  } else {
    const shortLines = lines.filter((line) => line.length < 15).length;
    if (shortLines / lines.length > 0.4) {
      parsability -= 4;
      findings.push("Many very short text fragments. This often means columns, tables, or graphics are scrambling the reading order.");
    }
    const garbled = (text.match(/[\uFFFD\uE000-\uF8FF]/g) ?? []).length;
    if (garbled > 3) {
      parsability -= 3;
      findings.push("Unreadable symbols found in the extracted text (often caused by custom icons or fonts).");
    }
  }

  // ---------- 2. Structure (10) ----------
  let structure = 0;
  const names: Record<string, string> = {
    education: "Education",
    experience: "Experience",
    projects: "Projects",
    skills: "Skills",
  };
  for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
    // a heading is a short line that matches the pattern
    const found = lines.some((line) => line.length < 40 && pattern.test(line));
    if (found) {
      structure += 2.5;
    } else {
      findings.push(`No standard "${names[key]}" heading found. ATS software may miss that section.`);
    }
  }

  // ---------- 3. Contact and links (5) ----------
  let contact = 0;
  const contactItems = [
    { label: "Email address", pattern: /[\w.+-]+@[\w-]+\.[\w.-]+/, points: 1.5 },
    { label: "Phone number", pattern: /\+?\d[\d\s().-]{8,}\d/, points: 1.5 },
    { label: "LinkedIn link", pattern: /linkedin\.com\/in\//i, points: 1 },
    { label: "GitHub or GitLab link", pattern: /(github\.com|gitlab\.com)\//i, points: 1 },
  ];
  for (const item of contactItems) {
    const where = locate(item.pattern, text, links);
    if (where === "visible") {
      contact += item.points;
    } else if (where === "hidden") {
      contact += item.points / 2; // half credit
      findings.push(`${item.label} exists only as a hidden hyperlink. Also write it out as visible text, because printed copies and some systems lose hidden links.`);
    } else {
      findings.push(`${item.label} not found.`);
    }
  }

  // ---------- 4. Length and hygiene (5) ----------
  let hygiene = 0;
  if (pages <= 1) hygiene += 3;
  else if (pages === 2) {
    hygiene += 2;
    findings.push("Two pages. For students and recent graduates, one page is ideal.");
  } else {
    findings.push(`${pages} pages is too long for a student or graduate resume.`);
  }

  if (words >= 250 && words <= 900) hygiene += 2;
  else if ((words >= 150 && words < 250) || (words > 900 && words <= 1100)) {
    hygiene += 1;
    findings.push(`Word count (${words}) is a bit ${words < 250 ? "low" : "high"}.`);
  } else {
    findings.push(`Word count (${words}) is far ${words < 150 ? "too low" : "too high"}.`);
  }

  const score = parsability + structure + contact + hygiene;

  return {
    score: round(score),
    breakdown: {
      parsability: round(parsability),
      structure: round(structure),
      contact: round(contact),
      hygiene: round(hygiene),
    },
    findings,
  };
}
