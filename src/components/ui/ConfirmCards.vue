<template>
  <div v-if="open" class="confirm-overlay" @click.self="emit('cancel')">
    <div class="confirm-panel">
      <h3 class="confirm-title">{{ title }}</h3>
      <p class="confirm-message">{{ message }}</p>

      <div class="cards">
        <div class="card" :class="confirmColor" @click="emit('confirm')">
          <p class="tip">{{ confirmText }}</p>
        </div>
        <div class="card" :class="cancelColor" @click="emit('cancel')">
          <p class="tip">{{ cancelText }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
type CardColor = "red" | "blue" | "green";

defineProps<{
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  confirmColor: CardColor;
  cancelColor: CardColor;
}>();

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();
</script>

<style scoped>
.confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.confirm-panel {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(10px);
  border-radius: 14px;
  padding: 18px;
  min-width: 280px;
}

.confirm-title {
  margin: 0;
  font-size: 25px;
  font-weight: 700;
  color: #111;
  text-align: center;
}

.confirm-message {
  margin: 8px 0 14px;
  font-size: 15px;
  color: #444;
  text-align: center;
}

.cards {
  display: flex;
  flex-direction: row;
  gap: 14px;
  align-items: stretch;
  justify-content: center;
}

.cards .red {
  background-color: #f43f5e;
}

.cards .blue {
  background-color: #3b82f6;
}

.cards .green {
  background-color: #22c55e;
}

.cards .card {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
  height: 40px;
  width: 150px;
  border-radius: 10px;
  color: white;
  cursor: pointer;
  transition: 400ms;
}

.cards .card p.tip {
  font-size: 1.1em;
  font-weight: 700;
  margin: 0;
}

.cards .card p.second-text {
  font-size: 0.9em;
  margin: 6px 0 0;
}

.cards .card:hover {
  transform: scale(1.1, 1.1);
}

.cards:hover > .card:not(:hover) {
  filter: blur(10px);
  transform: scale(0.9, 0.9);
}
</style>
