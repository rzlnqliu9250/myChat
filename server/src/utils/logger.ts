/**
 * 
封装了一个 logger，统一日志格式：时间戳+级别+消息。
业务层只调用 logger.info/warn/error，内部再统一走 log() 输出。
这样比直接到处写 console.log 更规范，也更好排查问题。
 */
// src/utils/logger.ts
enum LogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR",
}

class Logger {
    // 生成统一时间戳
    private getTimestamp(): string {
        return new Date().toISOString();
    }
    //输出格式固定为：[时间戳] [级别] 消息内容
    private log(level: LogLevel, message: string, ...args: any[]): void {
        const timestamp = this.getTimestamp();
        console.log(`[${timestamp}] [${level}] ${message}`, ...args);
    }

    //debug/info/warn/error：对外的简化接口
    debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, message, ...args);
    }

    info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, message, ...args);
    }

    warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, message, ...args);
    }

    error(message: string, ...args: any[]): void {
        this.log(LogLevel.ERROR, message, ...args);
    }
}

export const logger = new Logger();
