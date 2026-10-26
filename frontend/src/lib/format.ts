import clsx, { type ClassValue } from "clsx";
import type { Status } from "./types";

export const cn = (...inputs: ClassValue[]) => clsx(inputs);

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diff = Date.now() - date.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(value);
}

export const STATUS_META: Record<Status, { label: string; className: string; dot: string }> = {
  draft: { label: "Draft", className: "border-ink-200 bg-ink-50 text-ink-600", dot: "bg-ink-400" },
  in_review: {
    label: "In review",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  approved: {
    label: "Approved",
    className: "border-accent-200 bg-accent-50 text-accent-700",
    dot: "bg-accent-500",
  },
  closed: { label: "Closed", className: "border-ink-300 bg-ink-100 text-ink-700", dot: "bg-ink-500" },
};

export function confidenceTone(value: number): { text: string; bar: string; bg: string } {
  if (value >= 0.78) return { text: "text-accent-700", bar: "bg-accent-600", bg: "bg-accent-100" };
  if (value >= 0.55) return { text: "text-amber-700", bar: "bg-amber-500", bg: "bg-amber-100" };
  return { text: "text-rose-600", bar: "bg-rose-400", bg: "bg-rose-100" };
}

export const pct = (value: number) => `${Math.round(value * 100)}%`;

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function truncate(value: string, max = 120): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max).trimEnd()}…`;
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return `${count} ${count === 1 ? singular : plural ?? `${singular}s`}`;
}
