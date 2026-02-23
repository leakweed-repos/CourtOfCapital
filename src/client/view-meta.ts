export function readPostField(postData: unknown, name: "weekId" | "weekNumber"): string | number | null {
  if (typeof postData !== "object" || postData === null) {
    return null;
  }
  const value = Reflect.get(postData, name);
  if (typeof value === "string" || typeof value === "number") {
    return value;
  }
  return null;
}

export function readWeekIdFromPostData(postData: unknown): string {
  const weekId = readPostField(postData, "weekId");
  return typeof weekId === "string" && weekId.trim().length > 0 ? weekId : "unknown-week";
}

export function readWeekNumberFromPostData(postData: unknown): number {
  const weekNumber = readPostField(postData, "weekNumber");
  if (typeof weekNumber === "number" && Number.isFinite(weekNumber) && weekNumber >= 0) {
    return Math.floor(weekNumber);
  }
  return 0;
}

export function factionLabel(faction: string): string {
  return faction.replace(/_/g, " ");
}
