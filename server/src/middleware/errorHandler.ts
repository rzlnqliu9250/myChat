/**
 * 全局错误处理中间件：将未捕获错误统一转换为 500 JSON 响应。
 */
import type { NextFunction, Request, Response } from "express";

export function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
): void {
    const message =
        err instanceof Error ? err.message : "Internal Server Error";
    res.status(500).json({ error: message });
}
