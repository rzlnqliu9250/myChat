/**
 * WebSocket 管理器：封装连接生命周期、心跳、自动重连，以及基于事件的消息分发。
 */
import { WebSocketEvent } from "../models/WebSocket";
import type { WebSocketMessage, WebSocketEventType } from "../models/WebSocket";

type Listener = (...args: any[]) => void;

class EventEmitter {
  // 这是一个极简版事件总线：
  // - key: 事件名（WebSocketEventType）
  // - value: 一组监听回调
  // WebSocketManager 收到服务端消息后，会按 message.type 分发给对应监听器。
  private listeners: Map<WebSocketEventType, Listener[]> = new Map();

  on(event: WebSocketEventType, callback: Listener) {
    // 注册监听：允许同一个 event 注册多个 callback（按注册顺序依次执行）
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  off(event: WebSocketEventType, callback: Listener) {
    // 注销监听：只移除传入的那个 callback（引用相等）
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      this.listeners.set(
        event,
        callbacks.filter((cb) => cb !== callback),
      );
    }
  }

  emit(event: WebSocketEventType, ...args: any[]) {
    // 触发事件：把 args 原样透传给每个监听器
    const callbacks = this.listeners.get(event);
    callbacks?.forEach((callback) => callback(...args));
  }
}

export class WebSocketManager {
  // ws: 浏览器 WebSocket 实例。
  // 注意：这里的 WebSocketManager 只管理“单条连接”。重连会重新 new WebSocket。
  private ws: WebSocket | null = null;

  // url: WS 服务端地址（不包含 token 参数）。
  // token: 当前鉴权 token。connect() 时会拼到 URL query 里。
  private url: string;
  private token: string;

  // isConnecting / isConnected 用于约束 connect() 的调用与 send() 的行为：
  // - isConnecting: 正在建立连接（new WebSocket 后，等待 onopen/onerror/onclose）
  // - isConnected: 已建立连接（onopen 之后）
  // 关键不变量：
  // - isConnected => ws != null
  // - connect() 内部会避免并发重复连接（isConnecting/isConnected 保护）
  private isConnecting: boolean = false;
  private isConnected: boolean = false;

  // heartbeatInterval: 心跳定时器 id（setInterval 返回值）。
  // reconnectTimer: 重连定时器 id（setTimeout 返回值）。
  private heartbeatInterval: number | null = null;
  private reconnectTimer: number | null = null;

  private isManuallyDisconnected: boolean = false;
  private isOffline: boolean = typeof navigator !== "undefined" ? !navigator.onLine : false;
  private onlineDetectedAt: number | null = null;

  // reconnectAttempts: 当前累计重连次数。
  // maxReconnectAttempts: 最大重连次数（达到后停止自动重连，避免无限循环）。
  // reconnectDelay: 初始重连延迟（会叠加指数退避）。
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // 初始重连延迟 1s

  // maxReconnectDelay: 指数退避的上限（避免 delay 增长过大）。
  // heartbeatIntervalTime: 心跳间隔。
  // 说明：这里心跳只是“客户端主动 ping”，服务端回 pong。
  // 若网络断开，大多情况下浏览器会触发 onclose，从而开始 autoReconnect。
  private readonly maxReconnectDelay: number = 30000; // 最大重连延迟 30s
  private readonly heartbeatIntervalTime: number = 1000; // 心跳间隔 1s

  // events: 对外暴露的事件总线。
  // 典型使用方式：
  // - events.on(WebSocketEvent.MESSAGE_RECEIVE, handler)
  // - events.on(WebSocketEvent.CONNECT, handler)
  public events = new EventEmitter();

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;

    if (typeof window !== "undefined") {
      window.addEventListener("offline", this.handleOffline);
      window.addEventListener("online", this.handleOnline);
    }
  }

  private handleOffline = (): void => {
    this.isOffline = true;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  };

  private handleOnline = (): void => {
    this.isOffline = false;
    this.onlineDetectedAt = Date.now();
    if (!this.isConnected && !this.isConnecting && this.token) {
      void this.connect();
    }
  };

  public setToken(token: string): void {
    // 只更新 token，不主动 connect/disconnect。
    // 上层（App.vue）通常会在 token 变化后显式重连，确保鉴权一致。
    this.token = token;
  }

  /**
   * 建立 WebSocket 连接
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.isManuallyDisconnected = false;

      if (this.isOffline) {
        resolve();
        return;
      }

      // 防重复：如果已经连上或正在连接，则认为 connect 已满足。
      // 这样可以避免多个组件同时调用 connect() 导致并发创建多条连接。
      if (this.isConnected || this.isConnecting) {
        resolve();
        return;
      }

      this.isConnecting = true;

      try {
        // 创建 WebSocket 连接，携带 token 进行身份认证
        // 注意：token 是拼在 query 上；服务端会在握手时验证 token。
        // 如果 token 为空或非法，服务端可能会立即 close。
        this.ws = new WebSocket(`${this.url}?token=${this.token}`);

        this.ws.onopen = () => {
          console.log(`[WebSocket] 连接成功: ${new Date().toISOString()}`);

          if (this.onlineDetectedAt !== null) {
            const elapsedMs = Date.now() - this.onlineDetectedAt;
            console.log(
              `[WebSocket] 从检测到网络恢复到重连成功耗时: ${elapsedMs}ms`,
            );
            this.onlineDetectedAt = null;
          }
          // onopen 代表握手完成：连接正式可用
          this.isConnected = true;
          this.isConnecting = false;

          // 连接成功后重置重连状态（下次断线从第 0 次开始退避）
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;

          // 启动心跳检测
          this.startHeartbeat();

          // 向外广播：已连接
          this.events.emit(WebSocketEvent.CONNECT);
          resolve();
        };

        this.ws.onmessage = (event) => {
          // 收到服务端数据：解析为 WebSocketMessage，交给 handleMessage 分发
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error("Failed to parse WebSocket message:", error);
          }
        };

        this.ws.onclose = (event) => {
          console.log(`[WebSocket] 连接断开: ${new Date().toISOString()}, code: ${event.code}`);
          // onclose：连接已关闭（可能是断网、服务端主动断开、鉴权失败、浏览器 tab 关闭等）
          // 注意：此处会触发自动重连（autoReconnect）。
          this.isConnected = false;
          this.isConnecting = false;

          // 停止心跳检测
          this.stopHeartbeat();

          // 向外广播：已断开（上层可以用来更新 UI / 提示“已离线”）
          this.events.emit(WebSocketEvent.DISCONNECT, event.code, event.reason);

          // 自动重连
          if (this.isManuallyDisconnected) {
            return;
          }

          this.autoReconnect();
        };

        this.ws.onerror = (error) => {
          // onerror：底层错误。
          // 一般 onerror 后会跟着触发 onclose，但不同浏览器行为可能略有差异。
          this.events.emit(WebSocketEvent.ERROR, error);
          reject(error);
        };
      } catch (error) {
        // new WebSocket 抛异常的兜底（一般很少发生）
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * 断开 WebSocket 连接
   */
  public disconnect(): void {
    // 这是“主动断开”，用于：
    // - 登出
    // - token 变化后重连（先断开再 connect）
    // 注意：这里会清理重连计时器，避免主动断开后仍然自动重连。

    this.isManuallyDisconnected = true;
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
    // 只有在连接已建立时才能发送。
    // 当前实现：如果未连接，直接返回 false（不做发送队列/重试）。
    if (!this.isConnected || !this.ws) {
      console.error("WebSocket is not connected");
      return false;
    }

    // 统一信封结构：type + data + timestamp。
    // 这样前后端协议更清晰，服务端也能基于 type 分发。
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
    // 对外只暴露一个布尔状态。
    // 如果需要更细粒度（connecting / reconnecting），可以扩展状态机。
    return this.isConnected;
  }

  /**
   * 处理接收到的消息
   */
  private handleMessage(message: WebSocketMessage): void {
    // 这里做两件事：
    // 1) 对系统级消息做内部处理（例如 HEARTBEAT）
    // 2) 其他消息交给 events.emit 分发给业务层（Chat.vue 等）
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
    // 确保只有一个心跳计时器：每次 start 之前先 stop。
    this.stopHeartbeat(); // 确保只有一个心跳计时器

    this.heartbeatInterval = window.setInterval(() => {
      if (this.isConnected) {
        // 心跳包：这里只用来保活/探测。
        // 注意：当前实现不会根据 pong 来计算 RTT，也不会在“长期无 pong”时主动 close。
        const data = { ping: Date.now() };
        this.send(WebSocketEvent.HEARTBEAT, data);
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
    // 断线后重连：
    // - 清理旧 timer（避免多次 onclose 触发多个重连）
    // - 超过最大次数就停止
    // - 使用指数退避，逐步拉长重连间隔，避免网络抖动时疯狂重连
    // 清除现有重连计时器
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.isOffline) {
      return;
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
      // attempts 在真正发起 connect 之前递增。
      // 这样第 1 次重连会打印 attempts=1，并且 delay 计算用 attempts=0 得到 1s。
      this.reconnectAttempts++;
      console.log(`Reconnect attempt ${this.reconnectAttempts}...`);
      this.connect().catch((error) => {
        console.error("Reconnect failed:", error);
      });
    }, delay);
  }
}
