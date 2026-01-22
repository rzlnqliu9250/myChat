<template>
  <div class="app-container">
    <router-view />
  </div>
</template>

<script setup lang="ts">
import { provide } from "vue";
import { WebSocketManager } from "./services/WebSocketManager";
import { wsUrl } from "./config/endpoints";

// 提供 WebSocketManager 实例
// 实际应用中，WebSocket URL 应该从环境变量或配置文件中获取
const token = localStorage.getItem("token") || "";

const wsManager = new WebSocketManager(wsUrl, token);
provide("wsManager", wsManager);
</script>

<style scoped>
.app-container {
  width: 100vw;
  height: 100vh;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  background-color: #f5f5f5;
}
</style>
