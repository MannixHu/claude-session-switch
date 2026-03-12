import type { AppLanguage } from "./i18n.ts";

export type UpdateChangelogRow = {
  commit: string;
  description: string;
};

export type ParsedUpdateReleaseNotes = {
  changelogRows: UpdateChangelogRow[];
  summaryNotes: string;
};

function normalizeCommitCell(value: string): string {
  const markdownLinkMatch = value.match(/^\[(.+)\]\((.+)\)$/);
  const label = markdownLinkMatch ? markdownLinkMatch[1] : value;
  return label.replace(/^`|`$/g, "");
}

function splitMarkdownTableColumns(line: string): string[] {
  const trimmed = line.trim();
  const withoutLeadingPipe = trimmed.startsWith("|") ? trimmed.slice(1) : trimmed;
  const content = withoutLeadingPipe.endsWith("|")
    ? withoutLeadingPipe.slice(0, -1)
    : withoutLeadingPipe;

  const columns: string[] = [];
  let current = "";

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === "\\" && (next === "|" || next === "\\")) {
      current += next;
      index += 1;
      continue;
    }

    if (char === "|") {
      columns.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  columns.push(current.trim());
  return columns;
}

export function parseUpdateReleaseNotes(releaseNotes: string): ParsedUpdateReleaseNotes {
  const normalized = releaseNotes.trim();
  if (!normalized) {
    return {
      changelogRows: [],
      summaryNotes: "",
    };
  }

  const lines = normalized.split(/\r?\n/);
  const changelogStart = lines.findIndex((line) => line.trim().toLowerCase() === "## changelog");

  if (changelogStart === -1) {
    return {
      changelogRows: [],
      summaryNotes: normalized,
    };
  }

  const rows: UpdateChangelogRow[] = [];
  let tableStarted = false;
  let tableEndedAt = changelogStart + 1;

  for (let index = changelogStart + 1; index < lines.length; index += 1) {
    const line = lines[index].trim();

    if (!line && !tableStarted) {
      tableEndedAt = index + 1;
      continue;
    }

    if (!line.startsWith("|")) {
      tableEndedAt = index;
      break;
    }

    tableStarted = true;
    tableEndedAt = index + 1;
    const columns = splitMarkdownTableColumns(line);

    if (columns.length < 2) {
      continue;
    }

    const [first, second] = columns;
    if (
      first.toLowerCase() === "commit" ||
      /^-+$/.test(first.replace(/:/g, "")) ||
      /^-+$/.test(second.replace(/:/g, ""))
    ) {
      continue;
    }

    rows.push({
      commit: normalizeCommitCell(first),
      description: second,
    });
  }

  const summaryNotes = [...lines.slice(0, changelogStart), ...lines.slice(tableEndedAt)]
    .join("\n")
    .trim();

  return {
    changelogRows: rows,
    summaryNotes,
  };
}

export function formatPublishedDate(value: string, language: AppLanguage): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return "";
  }

  return new Intl.DateTimeFormat(language, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}
