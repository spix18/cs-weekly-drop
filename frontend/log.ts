const TAG = "[CS Weekly Drop]";
const VERBOSE = false;

function safe(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function line(parts: unknown[]): string {
  return `${TAG} ${parts.map(safe).join(" ")}`;
}

export function debug(...parts: unknown[]): void {
  if (VERBOSE) console.log(line(parts));
}

export function warn(...parts: unknown[]): void {
  console.warn(line(parts));
}

export function fail(...parts: unknown[]): void {
  console.error(line(parts));
}
