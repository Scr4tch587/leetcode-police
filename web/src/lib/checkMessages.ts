/** Display server-built debug text from manual submission checks. */
export function manualCheckMessage(res: { message?: string }): string {
  return res.message ?? "Check finished (no details returned).";
}
