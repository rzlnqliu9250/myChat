/**
 * HTTP 请求封装：统一处理 baseURL、请求头（含 token）、错误解析与 JSON 解析。
 */
import { apiBase } from "../config/endpoints";
import router from "../router";
import { useUserStore } from "../stores/userStore";

type ApiErrorBody = {
  error?: string;
  message?: string;
};

let handlingUnauthorized = false;

/** 登录/注册失败时的 401 不是「登录已过期」 */
const PUBLIC_AUTH_PATHS = new Set(["/api/login", "/api/register"]);

async function readErrorMessage(resp: Response): Promise<string> {
  const errBody = (await resp.json().catch(() => null)) as ApiErrorBody | null;
  return errBody?.error || errBody?.message || "请求失败";
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  // 统一 headers 入口：
  // - 允许调用方传入 headers（例如自定义 Content-Type）
  // - 这里用 Headers 包一层，方便 set/has。
  const headers = new Headers(options.headers);

  // 如果 body 是 FormData：
  // - 浏览器会自动设置正确的 multipart/form-data boundary
  // - 我们不能手动设置 Content-Type，否则 boundary 会丢失导致服务端解析失败
  const bodyIsFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  // 默认行为：如果有 body 且不是 FormData，并且调用方没有显式设置 Content-Type
  // 则认为这是 JSON 请求，自动补上 application/json。
  if (
    !bodyIsFormData &&
    options.body !== undefined &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  // 统一注入鉴权：
  // 这里的 token 由上层传入（一般来自 userStore.token）。
  // 这样做的好处：
  // - apiRequest 本身不强依赖 store（更容易复用/测试）
  // - 调用方可以在少数“无需登录”的接口不传 token。
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // 真正发起请求：
  // - path 是相对路径（例如 /api/login）
  // - apiBase 由环境配置决定（dev/prod）
  // - options 透传 method/body 等
  const resp = await fetch(`${apiBase}${path}`, {
    ...options,
    headers,
  });

  // 统一处理 401：认为登录态失效。
  // handlingUnauthorized 是一个“节流阀”——避免多个请求同时 401 时重复 logout、重复 push、重复 alert。
  if (resp.status === 401) {
    const message = await readErrorMessage(resp);

    if (token && !PUBLIC_AUTH_PATHS.has(path)) {
      if (!handlingUnauthorized) {
        handlingUnauthorized = true;
        try {
          useUserStore().logout();
        } catch {
          // ignore
        }

        try {
          void router.push("/login");
        } catch {
          // ignore
        }

        try {
          alert("登录已过期，请重新登录");
        } catch {
          // ignore
        }

        window.setTimeout(() => {
          handlingUnauthorized = false;
        }, 1000);
      }

      throw new Error(message);
    }

    throw new Error(message);
  }

  if (!resp.ok) {
    throw new Error(await readErrorMessage(resp));
  }

  // 204 No Content：没有响应体，直接返回 undefined。
  if (resp.status === 204) {
    return undefined as T;
  }

  // 兼容“空响应体”：
  // 有的接口成功但不返回 JSON（或者返回空字符串），这里统一返回 undefined。
  const text = await resp.text();
  if (!text) {
    return undefined as T;
  }

  // 统一 JSON parse：
  // 注意：这里假设后端返回的是 JSON 字符串。
  // 如果后端返回非 JSON（例如纯文本），这里会抛异常；那种场景需要扩展 content-type 判断。
  return JSON.parse(text) as T;
}

export function apiPost<T>(
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<T> {
  // POST 的便捷封装：
  // - 默认把 body JSON.stringify
  // - body 省略时传 undefined（fetch 会忽略 body）
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
  // GET 的便捷封装
  return apiRequest<T>(path, { method: "GET" }, token);
}

export function apiPatch<T>(
  path: string,
  body?: unknown,
  token?: string | null,
): Promise<T> {
  // PATCH 的便捷封装：默认 JSON body
  return apiRequest<T>(
    path,
    {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    },
    token,
  );
}

export function apiDelete<T>(path: string, token?: string | null): Promise<T> {
  // DELETE 的便捷封装
  return apiRequest<T>(path, { method: "DELETE" }, token);
}
