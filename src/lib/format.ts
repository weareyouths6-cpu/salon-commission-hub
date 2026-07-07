export function fmtMMK(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " MMK";
}

export function fmtNum(n: number | string | null | undefined, digits = 2): string {
  return Number(n ?? 0).toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export const CATEGORY_LABEL: Record<string, string> = {
  service: "Service",
  product: "Product",
  package: "Package",
  ginseng_box: "Ginseng Box",
  freedom: "Freedom",
};
