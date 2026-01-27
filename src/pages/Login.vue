<template>
  <div class="login-container">
    <div id="animation" class="large grid centered square-grid">
      <h2 ref="titleRef" class="text-xl">HELLO MYCHAT</h2>
    </div>
    <div class="login-form-wrapper">
      <h1 class="login-title">登录</h1>
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="username" class="form-label">用户名</label>
          <input
            type="text"
            id="username"
            v-model="form.username"
            placeholder="请输入用户名"
            class="form-input"
            required
          />
        </div>
        <div class="form-group">
          <label for="password" class="form-label">密码</label>
          <input
            type="password"
            id="password"
            v-model="form.password"
            placeholder="请输入密码"
            class="form-input"
            required
          />
        </div>
        <button
          type="submit"
          class="login-button"
          :class="{ loading }"
          :disabled="loading"
        >
          登录
        </button>
        <div class="form-footer">
          <p>
            还没有账号？
            <router-link to="/register" class="register-link"
              >立即注册</router-link
            >
          </p>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../stores/userStore";
import { useWebSocket } from "../composables/useWebSocket";
import { apiPost } from "../services/api";
import { animate, stagger, splitText } from "animejs";

const router = useRouter();
const userStore = useUserStore();
const { connect, wsManager } = useWebSocket();

const titleRef = ref<HTMLElement | null>(null);
let titleAnimation: { pause?: () => void } | null = null;

const loading = ref(false);
const form = ref({
  username: "",
  password: "",
});

onMounted(async () => {
  await nextTick();
  if (!titleRef.value) {
    return;
  }
  const { chars } = splitText(titleRef.value, { words: false, chars: true });
  titleAnimation = animate(chars, {
    y: [
      { to: "-2.75rem", ease: "outExpo", duration: 600 },
      { to: 0, ease: "outBounce", duration: 800, delay: 100 },
    ],
    rotate: {
      from: "-1turn",
      delay: 0,
    },
    delay: stagger(50),
    ease: "inOutCirc",
    loopDelay: 1000,
    loop: true,
  });
});

onUnmounted(() => {
  try {
    titleAnimation?.pause?.();
  } catch {
    // ignore
  }
});
const handleLogin = async () => {
  loading.value = true;
  try {
    const loginData = await apiPost<{
      token: string;
      user: {
        id: string;
        username: string;
        nickname: string;
        avatarUrl?: string | null;
      };
    }>("/api/login", {
      username: form.value.username,
      password: form.value.password,
    });

    userStore.setCurrentUser({
      id: loginData.user.id,
      username: loginData.user.username,
      nickname: loginData.user.nickname || loginData.user.username,
      avatar: loginData.user.avatarUrl || undefined,
      status: "online" as const,
      lastOnline: Date.now(),
    });
    userStore.setToken(loginData.token);

    wsManager.setToken(loginData.token);

    // 连接WebSocket
    await connect();

    // 跳转到聊天页面
    router.push("/chat");
  } catch (error) {
    console.error("登录失败:", error);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
#animation .text-xl {
  font-size: 3rem;
  color: currentColor;
  letter-spacing: 0.06em;
}

#animation {
  margin-bottom: 16px;
}
.login-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  background-color: #f5f5f5;
}

.login-form-wrapper {
  width: 100%;
  max-width: 400px;
  background-color: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.login-title {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
  font-size: 24px;
  font-weight: 600;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 14px;
  font-weight: 500;
  color: #555;
}

.form-input {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  transition: border-color 0.3s;
}

.form-input:focus {
  outline: none;
  border-color: #646cff;
  box-shadow: 0 0 0 2px rgba(100, 108, 255, 0.1);
}

.login-button {
  padding: 14px;
  background-color: #646cff;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s;
  position: relative;
}

.login-button.loading::first-line {
  color: transparent;
}

.login-button.loading::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 18px;
  height: 18px;
  margin-left: -9px;
  margin-top: -9px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.45);
  border-top-color: rgba(255, 255, 255, 1);
  animation: loginButtonSpin 0.8s linear infinite;
}

@keyframes loginButtonSpin {
  to {
    transform: rotate(360deg);
  }
}

.login-button:hover:not(:disabled) {
  background-color: #535bf2;
}

.login-button:disabled {
  background-color: #a5a9ff;
  cursor: not-allowed;
}

.form-footer {
  margin-top: 10px;
  text-align: center;
  font-size: 14px;
  color: #666;
}

.register-link {
  color: #646cff;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s;
}

.register-link:hover {
  color: #535bf2;
  text-decoration: underline;
}
</style>
