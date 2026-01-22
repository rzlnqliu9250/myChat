// src/utils/logger.ts
enum LogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR",
}

class Logger {
    private getTimestamp(): string {
        return new Date().toISOString();
    }

    private log(level: LogLevel, message: string, ...args: any[]): void {
        const timestamp = this.getTimestamp();
        console.log(`[${timestamp}] [${level}] ${message}`, ...args);
    }

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
