/**
 * 类型补丁：为 bcryptjs 提供最小模块声明，避免 TypeScript 在构建时找不到类型定义。
 */
declare module "bcryptjs" {
    const bcryptjs: any;
    export default bcryptjs;
}
