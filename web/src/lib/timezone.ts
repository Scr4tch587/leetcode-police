/** Short timezone label, e.g. EST, EDT, PST. */
export function timezoneAbbreviation(
  timeZone: string,
  date = new Date()
): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}
