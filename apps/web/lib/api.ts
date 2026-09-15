import type { ApiError } from "./types";

export const browserApi = "/api/v1";

export function serverApi(path: string) {
  const base = process.env.API_INTERNAL_URL ?? "http://localhost:8080";
  return `${base}/api/v1${path}`;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${browserApi}${path}`, {
    credentials: "include",
    ...init,
  });
  const body = (await response.json().catch(() => ({}))) as { data: T } & ApiError;
  if (!response.ok) throw new Error(body.error?.message ?? "Permintaan gagal");
  return body.data;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
