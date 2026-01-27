<template>
  <div class="register-container">
    <div id="animation" class="large grid centered square-grid">
      <h2 ref="titleRef" class="text-xl">HELLO MYCHAT</h2>
    </div>
    <div class="register-form-wrapper">
      <h1 class="register-title">注册</h1>
      <form @submit.prevent="handleRegister" class="register-form">
        <div class="form-group">
          <label class="form-label">头像（可选）</label>
          <input
            ref="avatarInput"
            type="file"
            accept="image/*"
            style="display: none"
            @change="handleAvatarChange"
          />
          <div class="avatar-row">
            <div class="avatar-preview">
              <img
                v-if="avatarPreview"
                class="avatar-image"
                :src="avatarPreview"
                alt="avatar"
              />
              <span v-else class="avatar-fallback">{{
                form.nickname.charAt(0) || "U"
              }}</span>
            </div>
            <button
              type="button"
              class="avatar-pick-button"
              @click="triggerAvatarPick"
            >
              选择头像
            </button>
          </div>
        </div>
        <div class="form-group">
          <label for="username" class="form-label">账号</label>
          <input
            type="text"
            id="username"
            v-model="form.username"
            placeholder="请输入账号"
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
          :class="{ loading }"
          :disabled="loading || form.password !== form.confirmPassword"
        >
          注册
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
import { ref, onMounted, nextTick, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../stores/userStore";
import { useWebSocket } from "../composables/useWebSocket";
import { apiPost, apiRequest } from "../services/api";
import { animate, stagger, splitText } from "animejs";

const router = useRouter();
const userStore = useUserStore();
const { connect, wsManager } = useWebSocket();
const titleRef = ref<HTMLElement | null>(null);
let titleAnimation: { pause?: () => void } | null = null;
const loading = ref(false);
const form = ref({
  username: "",
  nickname: "",
  password: "",
  confirmPassword: "",
});

const avatarInput = ref<HTMLInputElement | null>(null);
const avatarFile = ref<File | null>(null);
const avatarPreview = ref<string | null>(null);

const triggerAvatarPick = (): void => {
  avatarInput.value?.click();
};

const handleAvatarChange = (e: Event): void => {
  const input = e.target as HTMLInputElement | null;
  const file = input?.files?.[0];
  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    return;
  }

  if (avatarPreview.value) {
    try {
      URL.revokeObjectURL(avatarPreview.value);
    } catch {
      // ignore
    }
  }

  avatarFile.value = file;
  avatarPreview.value = URL.createObjectURL(file);
};
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

  if (avatarPreview.value) {
    try {
      URL.revokeObjectURL(avatarPreview.value);
    } catch {
      // ignore
    }
  }
});
const handleRegister = async () => {
  if (form.value.password !== form.value.confirmPassword) {
    return;
  }

  loading.value = true;
  try {
    let avatarUrl: string | undefined;
    if (avatarFile.value) {
      const body = new FormData();
      body.append("file", avatarFile.value);
      const uploaded = await apiRequest<{ url: string }>(
        "/api/upload/avatar/temp",
        {
          method: "POST",
          body,
        },
      );
      avatarUrl = uploaded.url;
    }

    await apiPost<{
      user: {
        id: string;
        username: string;
        nickname: string;
        avatarUrl?: string | null;
      };
    }>("/api/register", {
      username: form.value.username,
      nickname: form.value.nickname,
      password: form.value.password,
      avatarUrl,
    });

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
    console.error("注册失败:", error);
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
.register-container {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
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

.avatar-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar-preview {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #646cff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex: 0 0 auto;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  font-weight: 700;
}

.avatar-pick-button {
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
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
  position: relative;
}

.register-button.loading::first-line {
  color: transparent;
}

.register-button.loading::after {
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
  animation: registerButtonSpin 0.8s linear infinite;
}

@keyframes registerButtonSpin {
  to {
    transform: rotate(360deg);
  }
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
