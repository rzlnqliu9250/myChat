/**
 * 密码工具：封装 bcryptjs 的密码加密与校验，供注册/登录流程使用。
 */
import bcryptjs from "bcryptjs"; //bcryptjs 是一个常用的密码哈希库

const SALT_ROUNDS = 10;// bcrypt 的计算强度（加密要做多少轮运算）数越大越安全越耗时

//注册时用（把明文变成哈希）
export async function hashPassword(plain: string): Promise<string> {
    return bcryptjs.hash(plain, SALT_ROUNDS);
}

//登录时用（对比明文和哈希是否匹配）
export async function verifyPassword(
    plain: string,//用户登录时输入的明文密码
    hashed: string,//数据库里存的哈希密码
): Promise<boolean> {//输出：true/false
    return bcryptjs.compare(plain, hashed);//对比明文和哈希是否匹配
}
