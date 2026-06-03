/** Display server-built debug text from manual submission checks. */
export function manualCheckMessage(res: {
  message?: string;
  results: Array<{ debugMessage?: string }>;
}): string {
  if (res.message) return res.message;
  return res.results.map((r) => r.debugMessage ?? "").filter(Boolean).join("\n\n");
}
