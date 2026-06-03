type LatestSeen = {
  platform: string;
  problemId: string;
  problemName?: string;
  timestampSeconds: number;
  localDate: string;
  alreadyInDb: boolean;
};

type CollectResult = {
  displayName: string;
  ingested: number;
  skipped: boolean;
  skipReason?: string;
  latestSeen?: LatestSeen;
};

function formatLatestSeen(latest?: LatestSeen): string {
  if (!latest) return "Latest AC: none found from APIs.";
  const when = new Date(latest.timestampSeconds * 1000).toLocaleString();
  const label = latest.problemName
    ? `${latest.problemId} (${latest.problemName})`
    : latest.problemId;
  const status = latest.alreadyInDb ? "already recorded" : "not in DB yet";
  return (
    `Latest AC: ${latest.platform} ${label} on ${latest.localDate} ` +
    `(${when}, ${status})`
  );
}

export function formatCheckResult(r: CollectResult, ingested?: number): string {
  const count = ingested ?? r.ingested;
  if (r.skipped) {
    return `${r.displayName}: skipped — ${r.skipReason ?? "unknown"}. ${formatLatestSeen(r.latestSeen)}`;
  }
  return (
    `${r.displayName}: ${count} new submission(s) ingested. ` +
    formatLatestSeen(r.latestSeen)
  );
}

export function formatGroupCheckResults(
  ingested: number,
  results: CollectResult[]
): string {
  const lines = [
    `Group check done — ${ingested} new submission(s) ingested.`,
    "",
    ...results.map((r) => formatCheckResult(r)),
  ];
  return lines.join("\n");
}
