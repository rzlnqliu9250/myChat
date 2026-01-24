/**
 * 在服务端启动时读取环境变量，创建一个可复用的 Supabase 客户端实例 supabase，供其他路由/业务模块访问数据库。
 */
import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js"; //Supabase 官方 SDK，用来创建客户端

//兼容不同目录启动服务（比如从 server/ 启动或从项目根目录启动），都能读到环境变量。
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

const supabaseUrl = process.env.SUPABASE_URL; //SUPABASE_URL：Supabase 项目地址
//按优先级挑 key：SERVICE_ROLE_KEY > ANON_KEY > SUPABASE_KEY
const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY;

//尽早失败 + 错误更好定位
if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL in environment");
}

if (!supabaseKey) {
    throw new Error(
        "Missing Supabase key in environment (set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY or SUPABASE_KEY)",
    );
}

//创建并导出 Supabase 客户端实例
export const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});
