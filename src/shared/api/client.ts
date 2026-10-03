import axios from "axios";
import { z } from "zod";
import { apiUrl } from "../../app/config";
export type RecordData = Record<string, unknown>;
export const object = (value: unknown): RecordData =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordData)
    : {};
export const str = (value: unknown) =>
  typeof value === "string" || typeof value === "number" ? String(value) : "";
export const rows = (value: unknown): RecordData[] =>
  Array.isArray(value) ? value.map(object) : [];
export class ApiError extends Error {
  status?: number;
  fields: Record<string, string[]> = {};
  uncertain = false;
  retryAfter = 0;
}
export function problem(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const e = new ApiError(
    "Unable to connect. Your changes have been kept. Check the current record before repeating this action.",
  );
  if (axios.isAxiosError(error)) {
    e.status = error.response?.status;
    e.uncertain = !error.response || (e.status ?? 0) >= 500;
    const body = object(error.response?.data),
      detail = object(body.error);
    const safe = str(detail.message || body.message);
    e.message =
      e.status === 404
        ? "This record is missing or has been removed."
        : safe && !/SQLSTATE|No query results|Exception|Stack trace/i.test(safe)
          ? safe
          : e.status === 403
            ? "You do not have permission for this action."
            : e.message;
    const fields = object(body.errors || detail.details);
    for (const [key, value] of Object.entries(fields))
      if (Array.isArray(value) && value.every((v) => typeof v === "string"))
        e.fields[key] = value;
    e.retryAfter = Number(
      error.response?.headers["retry-after"] || body.retry_after || 0,
    );
  }
  return e;
}
export const client = axios.create({
  baseURL: apiUrl + "/",
  timeout: 25000,
  headers: { Accept: "application/json" },
});
let sessionGeneration = 0;
let invalidator: (() => void) | undefined;
export function setInvalidator(fn: () => void) {
  invalidator = fn;
}
export function changeGeneration() {
  sessionGeneration++;
  return sessionGeneration;
}
export function getGeneration() {
  return sessionGeneration;
}
export async function request(
  path: string,
  method = "GET",
  body?: unknown,
  signal?: AbortSignal,
  publicRequest = false,
): Promise<RecordData> {
  if (/^\/?https?:|^\/|\.\./.test(path)) throw new ApiError("Invalid API path");
  const generation = sessionGeneration;
  try {
    const token = sessionStorage.getItem("univybe.token");
    const response = await client.request({
      url: path,
      method,
      data: body,
      signal,
      headers:
        !publicRequest && token ? { Authorization: `Bearer ${token}` } : {},
    });
    const result = z
      .object({
        success: z.boolean(),
        data: z.unknown().optional(),
        message: z.string().optional(),
      })
      .passthrough()
      .safeParse(response.data);
    if (!result.success || !result.data.success)
      throw new ApiError(
        "The server returned an unexpected response. Refresh to reconcile the record.",
      );
    if (generation !== sessionGeneration && !publicRequest)
      throw new ApiError("The session changed; this response was discarded.");
    return result.data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    const normalized = problem(error);
    if (
      normalized.status === 401 &&
      generation === sessionGeneration &&
      sessionStorage.getItem("univybe.token") &&
      !publicRequest
    )
      invalidator?.();
    throw normalized;
  }
}
export function entity(response: RecordData, key: string): RecordData {
  const data = object(response.data),
    value = object(data[key]);
  if (!("id" in value))
    throw new ApiError(
      `Unexpected ${key} response; refresh before continuing.`,
    );
  return value;
}
export function page(response: RecordData, nested = false) {
  const payload = nested ? object(response.data).data : response.data;
  const meta = nested ? object(response.data) : object(response.meta);
  if (!Array.isArray(payload) || typeof meta.total !== "number")
    throw new ApiError(
      "Unexpected collection response; no records have been hidden.",
    );
  return {
    items: rows(payload),
    total: meta.total,
    current: Number(meta.current_page || 1),
    last: Number(
      meta.last_page ||
        Math.ceil(meta.total / Number(meta.per_page || 15)) ||
        1,
    ),
  };
}
