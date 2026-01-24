/**
 * 鉴权中间件：校验 JWT 并将 userId 写入 req（HTTP）；同时提供 WS 握手阶段的 token 校验函数。
 */
// Express用来写HTTP接口的后端框架
// Request/Response/NextFunction 是 Express 的类型
// import type 表示只导入类型，避免被编译成 JS 的 require/import
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken"; //使用 jsonwebtoken 来做 jwt.verify(...) 校验 token 的签名和有效性

type JwtPayload = {
    //定义 JWT payload 的形状
    userId: string;
};

//给 Express 的 Request 扩展一个 userId 字段
//作用：在后续代码里写 req.userId = ... 时不报类型错误
declare global {
    namespace Express {
        interface Request {
            userId?: string;
        }
    }
}

//一个 Express 鉴权中间件：它在请求进入真正的业务接口之前，
// 先检查请求有没有带 JWT token，并验证 token 是否有效；
// 验证通过就把 userId 放到 req.userId，然后放行；
// 验证失败就直接返回 401，不让请求继续往下走。
// 用法:app.get("/me", requireAuth, (req, res) => ...)
// 把 requireAuth 放在路由前面，后面的接口就都必须先通过鉴权。
export function requireAuth(
    req: Request, //请求对象（客户端发来的所有信息都在这里）
    res: Response, //响应对象（你要回给客户端什么都用它）
    next: NextFunction, //一个函数，用来告诉 Express：“我这个中间件处理完了，请继续执行下一个中间件/路由处理函数”
): void {
    const header = req.headers.authorization; //读取请求头里的 Authorization
    //从 Bearer xxx 中切出真正 token,期望请求头长这样：Authorization: Bearer eyJhbGciOi...
    const token = header?.startsWith("Bearer ")
        ? header.slice("Bearer ".length)
        : undefined;

    if (!token) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        res.status(500).json({ error: "Server misconfigured" });
        return;
    }

    // 校验 token：成功则写入 req.userId 并放行
    //jwt.verify：确认 token 没被伪造/篡改（以及可能的过期检查）
    try {
        const payload = jwt.verify(token, secret) as JwtPayload;
        req.userId = payload.userId;
        next();
    } catch {
        res.status(401).json({ error: "Unauthorized" });
    }
}

//给 WebSocket 握手阶段用的函数（传入 token，解析出 userId）
export function verifyToken(token: string): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("Missing JWT_SECRET in environment");
    }
    const payload = jwt.verify(token, secret) as JwtPayload;
    return payload.userId;
}
// req: Request（请求对象）
// 里面包含常见信息，例如：
// req.headers：请求头（token 就在这里）
// req.query：URL 查询参数 ?a=1
// req.params：路由参数 /users/:id
// req.body：请求体（POST/PUT 提交的数据）
// 你扩展出来的：req.userId（鉴权后写进去的用户 id）

// res: Response（响应对象）
// 你用它来“结束请求并返回数据”，常见用法：
// res.status(401).json({ error: "Unauthorized" })
// res.json({ ok: true })
// res.send("text")
// 只要你调用了 res.xxx 返回响应，一般就不应该再 next() 了，因为请求已经结束

// next: NextFunction（继续往下走的开关）
// next() 是关键：
// 调用 next()：请求继续走到下一个中间件/路由
// 不调用 next()，也不 res.json(...)：请求就会卡住（一直不返回）
// 在你的 requireAuth 里：
// 验证成功才 next()；失败就直接返回 401，不再往下走。
