<template>
  <div class="app-container">
    <router-view v-slot="{ Component }">
      <transition name="route-fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
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

.route-fade-enter-active,
.route-fade-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.route-fade-enter-from,
.route-fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
