/**
 * HTTP 请求封装：统一处理 baseURL、请求头（含 token）、错误解析与 JSON 解析。
 */
import { apiBase } from "../config/endpoints";

type ApiErrorBody = {
  error?: string;
  message?: string;
};

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);

  const bodyIsFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  if (
    !bodyIsFormData &&
    options.body !== undefined &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const resp = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
  });

  if (!resp.ok) {
    const errBody = (await resp
      .json()
      .catch(() => null)) as ApiErrorBody | null;
    throw new Error(errBody?.error || errBody?.message || "请求失败");
  }

  if (resp.status === 204) {
    return undefined as T;
  }

  const text = await resp.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<T> {
  return apiRequest<T>(
    path,
    {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    token,
  );
}

export function apiGet<T>(path: string, token?: string | null): Promise<T> {
  return apiRequest<T>(path, { method: "GET" }, token);
}

export function apiDelete<T>(path: string, token?: string | null): Promise<T> {
  return apiRequest<T>(path, { method: "DELETE" }, token);
}
