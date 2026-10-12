export const CLINIC_TIME_ZONE = "Africa/Lagos";

export const CLINIC_SERVICES = [
  "General check-up and cleaning",
  "Scaling and polishing",
  "Fillings",
  "Tooth extraction",
  "Root canal treatment",
  "Teeth whitening",
  "Braces and aligners consultation",
  "Children's dentistry",
] as const;

export type ClinicService = (typeof CLINIC_SERVICES)[number];

export function isValidNigerianPhone(value: string): boolean {
  const normalized = value.trim().replace(/[\s()-]/g, "");
  return /^(0(70|80|81|90|91)|\+234(70|80|81|90|91))[0-9]{8}$/.test(normalized);
}

export function getLagosDate(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const datePart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${datePart("year")}-${datePart("month")}-${datePart("day")}`;
}

function parseIsoDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 2000, (month ?? 1) - 1, day ?? 1));
}

function toIsoDate(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function getBookableDates(today: string, count = 30): string[] {
  const dates: string[] = [];
  const start = parseIsoDate(today);
  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + offset);
    if (date.getUTCDay() !== 0) dates.push(toIsoDate(date));
  }
  return dates;
}

export function getClinicSlots(date: string): string[] {
  const weekday = parseIsoDate(date).getUTCDay();
  if (weekday === 0) return [];
  const lastHour = weekday === 6 ? 13 : 16;
  return Array.from({ length: lastHour - 8 }, (_, index) => `${String(index + 9).padStart(2, "0")}:00`);
}

export function formatDateLabel(date: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: CLINIC_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    ...options,
  }).format(parseIsoDate(date));
}

export function formatClinicTime(time: string): string {
  const [hourText] = time.split(":");
  const hour = Number(hourText);
  return `${hour % 12 || 12}:00 ${hour < 12 ? "am" : "pm"}`;
}

export function formatLagosTime(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-NG", {
    timeZone: CLINIC_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}