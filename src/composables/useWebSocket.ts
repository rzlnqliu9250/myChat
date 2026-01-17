import { ref, onUnmounted, inject, provide } from "vue";
import { WebSocketManager } from "../services/WebSocketManager";
import { WebSocketEvent } from "../models/WebSocket";

// 提供 WebSocketManager 实例
export function provideWebSocketManager(url: string, token: string) {
  const wsManager = new WebSocketManager(url, token);
  provide("wsManager", wsManager);
  return wsManager;
}

// 注入 WebSocketManager 实例
export function useWebSocket() {
  const wsManager = inject<WebSocketManager>("wsManager");

  if (!wsManager) {
    throw new Error(
      "WebSocketManager not provided. Call provideWebSocketManager first.",
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
    send: wsManager.send.bind(wsManager),
    connect: wsManager.connect.bind(wsManager),
    disconnect: wsManager.disconnect.bind(wsManager),
    on: wsManager.events.on.bind(wsManager.events),
    off: wsManager.events.off.bind(wsManager.events),
  };
}
