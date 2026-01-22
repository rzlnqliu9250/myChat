import { WebSocketEvent } from "../models/WebSocket";
import type {
  WebSocketMessage,
  HeartbeatMessage,
  WebSocketEventType,
} from "../models/WebSocket";

class EventEmitter {
  private listeners: Map<string, Function[]> = new Map();

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      this.listeners.set(
        event,
        callbacks.filter((cb) => cb !== callback),
      );
    }
  }

  emit(event: string, ...args: any[]) {
    const callbacks = this.listeners.get(event);
    callbacks?.forEach((callback) => callback(...args));
  }
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private token: string;
  private isConnecting: boolean = false;
  private isConnected: boolean = false;
  private heartbeatInterval: number | null = null;
  private reconnectTimer: number | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // 初始重连延迟 1s
  private readonly maxReconnectDelay: number = 30000; // 最大重连延迟 30s
  private readonly heartbeatIntervalTime: number = 30000; // 心跳间隔 30s

  public events = new EventEmitter();

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  public setToken(token: string): void {
    this.token = token;
  }

  /**
   * 建立 WebSocket 连接
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected || this.isConnecting) {
        resolve();
        return;
      }

      this.isConnecting = true;

      try {
        // 创建 WebSocket 连接，携带 token 进行身份认证
        this.ws = new WebSocket(`${this.url}?token=${this.token}`);

        this.ws.onopen = () => {
          this.isConnected = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;

          // 启动心跳检测
          this.startHeartbeat();

          this.events.emit(WebSocketEvent.CONNECT);
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        this.ws.onclose = (event) => {
          this.isConnected = false;
          this.isConnecting = false;

          // 停止心跳检测
          this.stopHeartbeat();

          this.events.emit(WebSocketEvent.DISCONNECT, event.code, event.reason);

          // 自动重连
          this.autoReconnect();
        };

        this.ws.onerror = (error) => {
          this.events.emit(WebSocketEvent.ERROR, error);
          reject(error);
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * 断开 WebSocket 连接
   */
  public disconnect(): void {
    // 清除重连计时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 停止心跳检测
    this.stopHeartbeat();

    // 关闭 WebSocket 连接
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.isConnected = false;
    this.isConnecting = false;
  }

  /**
   * 发送消息
   */
  public send<T>(type: WebSocketEventType, data: T): boolean {
    if (!this.isConnected || !this.ws) {
      console.error("WebSocket is not connected");
      return false;
    }

    const message: WebSocketMessage = {
      type,
      data,
      timestamp: Date.now(),
    };

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
      return false;
    }
  }

  /**
   * 获取连接状态
   */
  public getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case WebSocketEvent.HEARTBEAT:
        // 收到心跳响应，无需特殊处理
        break;
      default:
        // 分发业务消息
        this.events.emit(message.type, message.data);
    }
  }

  /**
   * 启动心跳检测
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // 确保只有一个心跳计时器

    this.heartbeatInterval = window.setInterval(() => {
      if (this.isConnected) {
        const heartbeatMessage: HeartbeatMessage = {
          type: WebSocketEvent.HEARTBEAT,
          data: { ping: Date.now() },
          timestamp: Date.now(),
        };

        this.send(WebSocketEvent.HEARTBEAT, heartbeatMessage.data);
      }
    }, this.heartbeatIntervalTime);
  }

  /**
   * 停止心跳检测
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 自动重连逻辑
   */
  private autoReconnect(): void {
    // 清除现有重连计时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // 达到最大重连次数，停止重连
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Max reconnect attempts reached. Stopping.");
      return;
    }

    // 指数退避重连
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );

    console.log(`Attempting to reconnect in ${delay}ms...`);

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Reconnect attempt ${this.reconnectAttempts}...`);
      this.connect().catch((error) => {
        console.error("Reconnect failed:", error);
      });
    }, delay);
  }
}
