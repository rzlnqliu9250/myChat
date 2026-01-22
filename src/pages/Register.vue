<template>
  <div class="register-container">
    <div class="register-form-wrapper">
      <h1 class="register-title">注册</h1>
      <form @submit.prevent="handleRegister" class="register-form">
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
          <label for="nickname" class="form-label">昵称</label>
          <input
            type="text"
            id="nickname"
            v-model="form.nickname"
            placeholder="请输入昵称"
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
            placeholder="请输入密码（至少6位）"
            class="form-input"
            required
            minlength="6"
          />
        </div>
        <div class="form-group">
          <label for="confirmPassword" class="form-label">确认密码</label>
          <input
            type="password"
            id="confirmPassword"
            v-model="form.confirmPassword"
            placeholder="请再次输入密码"
            class="form-input"
            required
          />
          <p
            v-if="form.password !== form.confirmPassword"
            class="error-message"
          >
            两次输入的密码不一致
          </p>
        </div>
        <button
          type="submit"
          class="register-button"
          :disabled="loading || form.password !== form.confirmPassword"
        >
          {{ loading ? "注册中..." : "注册" }}
        </button>
        <div class="form-footer">
          <p>
            已有账号？
            <router-link to="/login" class="login-link">立即登录</router-link>
          </p>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../stores/userStore";
import { useWebSocket } from "../composables/useWebSocket";

const router = useRouter();
const userStore = useUserStore();
const { connect, wsManager } = useWebSocket();

const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8080";

const loading = ref(false);
const form = ref({
  username: "",
  nickname: "",
  password: "",
  confirmPassword: "",
});

const handleRegister = async () => {
  if (form.value.password !== form.value.confirmPassword) {
    return;
  }

  loading.value = true;
  try {
    const registerResp = await fetch(`${apiBase}/api/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: form.value.username,
        password: form.value.password,
      }),
    });

    if (!registerResp.ok) {
      const err = (await registerResp.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(err?.error || "注册失败");
    }

    const loginResp = await fetch(`${apiBase}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username: form.value.username,
        password: form.value.password,
      }),
    });

    if (!loginResp.ok) {
      const err = (await loginResp.json().catch(() => null)) as {
        error?: string;
      } | null;
      throw new Error(err?.error || "登录失败");
    }

    const loginData = (await loginResp.json()) as {
      token: string;
      user: { id: string; username: string; avatarUrl?: string | null };
    };

    userStore.setCurrentUser({
      id: loginData.user.id,
      username: loginData.user.username,
      nickname: form.value.nickname || loginData.user.username,
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
    console.error("注册失败:", error);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.register-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f5f5;
}

.register-form-wrapper {
  width: 100%;
  max-width: 400px;
  background-color: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.register-title {
  text-align: center;
  margin-bottom: 30px;
  color: #333;
  font-size: 24px;
  font-weight: 600;
}

.register-form {
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

.register-button {
  padding: 14px;
  background-color: #42b883;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.3s;
}

.register-button:hover:not(:disabled) {
  background-color: #36a474;
}

.register-button:disabled {
  background-color: #a5dbb8;
  cursor: not-allowed;
}

.error-message {
  margin: 0;
  padding: 0;
  font-size: 12px;
  color: #ff5252;
  margin-top: 4px;
}

.form-footer {
  margin-top: 10px;
  text-align: center;
  font-size: 14px;
  color: #666;
}

.login-link {
  color: #42b883;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s;
}

.login-link:hover {
  color: #36a474;
  text-decoration: underline;
}
</style>
