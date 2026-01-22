import { ref, onUnmounted, inject } from "vue";
import { WebSocketManager } from "../services/WebSocketManager";
import { WebSocketEvent } from "../models/WebSocket";
import type { WebSocketEventType } from "../models/WebSocket";

// 注入 WebSocketManager 实例
export function useWebSocket() {
  const wsManager = inject<WebSocketManager>("wsManager");

  if (!wsManager) {
    throw new Error(
      "WebSocketManager not provided. Ensure App.vue provides it via provide('wsManager', ...).",
    );
  }

  const isConnected = ref(wsManager.getConnectionStatus());

  // 监听连接状态变化
  const handleConnect = () => {
    isConnected.value = true;
  };

  const handleDisconnect = () => {
    isConnected.value = false;
  };

  wsManager.events.on(WebSocketEvent.CONNECT, handleConnect);
  wsManager.events.on(WebSocketEvent.DISCONNECT, handleDisconnect);

  // 组件卸载时清理事件监听
  onUnmounted(() => {
    wsManager.events.off(WebSocketEvent.CONNECT, handleConnect);
    wsManager.events.off(WebSocketEvent.DISCONNECT, handleDisconnect);
  });

  return {
    wsManager,
    isConnected,
    send: <T>(type: WebSocketEventType, data: T) => wsManager.send(type, data),
    connect: () => wsManager.connect(),
    disconnect: () => wsManager.disconnect(),
    on: (event: WebSocketEventType, callback: (...args: any[]) => void) =>
      wsManager.events.on(event, callback),
    off: (event: WebSocketEventType, callback: (...args: any[]) => void) =>
      wsManager.events.off(event, callback),
  };
}
