export const formatGHS = (n: number | string | null | undefined): string => {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
  }).format(v);
};

export const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("233")) return "+" + digits;
  if (digits.startsWith("0")) return "+233" + digits.slice(1);
  if (digits.length === 9) return "+233" + digits;
  return raw;
};

export const isSamePhoneNumber = (num1?: string | null, num2?: string | null): boolean => {
  if (!num1 || !num2) return false;
  const clean1 = String(num1).replace(/\D/g, "");
  const clean2 = String(num2).replace(/\D/g, "");
  if (!clean1 || !clean2) return false;
  return clean1.slice(-9) === clean2.slice(-9);
};

export const phoneToEmail = (phone: string): string => {
  const digits = phone.replace(/\D/g, "");
  return `${digits}@phone.onegig.local`;
};

export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 40);

export const formatGB = (mb: number): string => {
  if (mb >= 1000) {
    const gb = mb / 1000;
    return `${gb % 1 === 0 ? gb : gb.toFixed(1)}GB`;
  }
  return `${mb}MB`;
};

export const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
};