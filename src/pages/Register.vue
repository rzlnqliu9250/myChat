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
        <div class="form-control">
          <input
            type="text"
            id="username"
            v-model="form.username"
            class="form-input"
            :class="{ filled: !!form.username }"
            maxlength="10"
            required
          />
          <label>
            <span
              v-for="(ch, i) in registerUsernameLabel"
              :key="`${ch}-${i}`"
              :style="{ transitionDelay: `${i * 50}ms` }"
              >{{ ch }}</span
            >
          </label>
        </div>

        <div class="form-control">
          <input
            type="text"
            id="nickname"
            v-model="form.nickname"
            class="form-input"
            :class="{ filled: !!form.nickname }"
            maxlength="10"
            required
          />
          <label>
            <span
              v-for="(ch, i) in registerNicknameLabel"
              :key="`${ch}-${i}`"
              :style="{ transitionDelay: `${i * 50}ms` }"
              >{{ ch }}</span
            >
          </label>
        </div>

        <div class="form-control">
          <input
            type="password"
            id="password"
            v-model="form.password"
            class="form-input"
            :class="{ filled: !!form.password }"
            required
            minlength="6"
          />
          <label>
            <span
              v-for="(ch, i) in registerPasswordLabel"
              :key="`${ch}-${i}`"
              :style="{ transitionDelay: `${i * 50}ms` }"
              >{{ ch }}</span
            >
          </label>
        </div>

        <div class="form-control">
          <input
            type="password"
            id="confirmPassword"
            v-model="form.confirmPassword"
            class="form-input"
            :class="{ filled: !!form.confirmPassword }"
            required
          />
          <label>
            <span
              v-for="(ch, i) in registerConfirmPasswordLabel"
              :key="`${ch}-${i}`"
              :style="{ transitionDelay: `${i * 50}ms` }"
              >{{ ch }}</span
            >
          </label>
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
          :disabled="
            loading ||
            form.password !== form.confirmPassword ||
            !turnstileToken ||
            form.username.length > 10 ||
            form.nickname.length > 10
          "
        >
          <span class="button-text">注册</span>
        </button>

        <p
          v-if="form.username.length > 10 || form.nickname.length > 10"
          class="error-message"
        >
          账号和昵称最多 10 个字符
        </p>

        <div class="footer-turnstile-row">
          <div class="form-footer">
            <p>
              已有账号？<br />
              <router-link to="/login" class="login-link">立即登录</router-link>
            </p>
          </div>

          <div class="turnstile-row">
            <div ref="turnstileEl" class="turnstile-widget"></div>
            <p v-if="turnstileError" class="turnstile-error">
              {{ turnstileError }}
            </p>
          </div>
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

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

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

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined;
const turnstileEl = ref<HTMLElement | null>(null);
const turnstileToken = ref<string | null>(null);
const turnstileError = ref<string | null>(null);
let turnstileWidgetId: string | null = null;

const registerUsernameLabel = "账号".split("");
const registerNicknameLabel = "昵称".split("");
const registerPasswordLabel = "密码".split("");
const registerConfirmPasswordLabel = "确认密码".split("");

const avatarInput = ref<HTMLInputElement | null>(null);
const avatarFile = ref<File | null>(null);
const avatarPreview = ref<string | null>(null);

const waitForTurnstile = async (): Promise<
  NonNullable<Window["turnstile"]>
> => {
  const start = Date.now();
  while (!window.turnstile) {
    if (Date.now() - start > 8000) {
      throw new Error("Turnstile 脚本加载超时");
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  return window.turnstile;
};

const renderTurnstile = async (): Promise<void> => {
  if (!turnstileSiteKey) {
    turnstileError.value = "缺少 Turnstile Site Key";
    return;
  }
  if (!turnstileEl.value) {
    return;
  }

  if (turnstileWidgetId && window.turnstile) {
    try {
      window.turnstile.reset(turnstileWidgetId);
    } catch {
      // ignore
    }
    return;
  }

  try {
    const turnstile = await waitForTurnstile();
    turnstileEl.value.innerHTML = "";
    turnstileToken.value = null;
    turnstileError.value = null;
    turnstileWidgetId = turnstile.render(turnstileEl.value, {
      sitekey: turnstileSiteKey,
      callback: (token: string) => {
        turnstileToken.value = token;
        turnstileError.value = null;
      },
      "expired-callback": () => {
        turnstileToken.value = null;
      },
      "error-callback": () => {
        turnstileToken.value = null;
        turnstileError.value = "验证组件加载失败，请刷新重试";
      },
    });
  } catch (err) {
    turnstileToken.value = null;
    turnstileError.value =
      err instanceof Error ? err.message : "验证组件初始化失败";
  }
};

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

  await renderTurnstile();
});
onUnmounted(() => {
  try {
    titleAnimation?.pause?.();
  } catch {
    // ignore
  }

  if (turnstileWidgetId && window.turnstile) {
    try {
      window.turnstile.remove(turnstileWidgetId);
    } catch {
      // ignore
    }
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
  if (form.value.username.length > 10 || form.value.nickname.length > 10) {
    turnstileError.value = "账号和昵称最多 10 个字符";
    return;
  }

  if (form.value.password !== form.value.confirmPassword) {
    return;
  }

  if (!turnstileToken.value) {
    turnstileError.value = "请先完成真人验证";
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

    const registerData = await apiPost<{
      token: string;
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
      turnstileToken: turnstileToken.value,
    });

    userStore.setCurrentUser({
      id: registerData.user.id,
      username: registerData.user.username,
      nickname: registerData.user.nickname || registerData.user.username,
      avatar: registerData.user.avatarUrl || undefined,
      status: "online" as const,
      lastOnline: Date.now(),
    });
    userStore.setToken(registerData.token);

    wsManager.setToken(registerData.token);

    // 连接WebSocket
    await connect();

    // 跳转到聊天页面
    router.push("/chat");
  } catch (error) {
    console.error("注册失败:", error);
    turnstileError.value = "注册失败，请重新完成验证";
    turnstileToken.value = null;
    if (turnstileWidgetId && window.turnstile) {
      try {
        window.turnstile.reset(turnstileWidgetId);
      } catch {
        // ignore
      }
    }
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
  position: relative;
  overflow: hidden;
  color: #111;
  background:
    radial-gradient(
      900px circle at 18% 18%,
      rgba(66, 184, 131, 0.16),
      transparent 60%
    ),
    radial-gradient(
      720px circle at 85% 28%,
      rgba(1, 166, 73, 0.12),
      transparent 58%
    ),
    radial-gradient(
      800px circle at 50% 95%,
      rgba(17, 17, 17, 0.05),
      transparent 55%
    ),
    linear-gradient(180deg, #ffffff 0%, #f3fbf7 100%);
}

.register-container::before,
.register-container::after {
  content: "";
  position: absolute;
  inset: -40% -30%;
  background: radial-gradient(
    closest-side,
    rgba(66, 184, 131, 0.18),
    transparent 70%
  );
  filter: blur(28px);
  opacity: 0.6;
  pointer-events: none;
}

.register-container::after {
  inset: -30% -40%;
  background: radial-gradient(
    closest-side,
    rgba(1, 166, 73, 0.16),
    transparent 70%
  );
  opacity: 0.5;
}

#animation,
.register-form-wrapper {
  position: relative;
  z-index: 1;
}

.register-form-wrapper {
  width: 100%;
  max-width: 420px;
  background-color: rgba(255, 255, 255, 0.82);
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
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
  border: none;
  border-bottom: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
  transition: border-color 0.3s;
}

.form-input:focus {
  outline: none;
  border-color: #0001f0;
  box-shadow: none;
}

.form-control {
  position: relative;
  width: 100%;
  margin: 0;
}

.form-control .form-input {
  background-color: transparent;
  border: 0;
  border-bottom: 2px #f5f5f5 solid;
  display: block;
  width: 100%;
  padding: 20px 0 10px;
  font-size: 18px;
  color: #222;
}

.form-control .form-input:focus,
.form-control .form-input.filled {
  outline: 0;
  border-bottom-color: #111;
}

.form-control label {
  position: absolute;
  top: 20px;
  left: 0;
  pointer-events: none;
}

.form-control label span {
  display: inline-block;
  font-size: 18px;
  min-width: 5px;
  color: #666;
  transition: 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

.form-control .form-input:focus + label span,
.form-control .form-input.filled + label span {
  color: #111;
  transform: translateY(-35px);
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
  background: #0001f0;
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
  font-size: 17px;
  background: transparent;
  border: none;
  padding: 1em 1.5em;
  color: #666;
  text-transform: uppercase;
  position: relative;
  transition: 0.5s ease;
  cursor: pointer;
  border-radius: 10px;
  overflow: hidden; /* 关键：隐藏超出圆角的部分 */
}

.avatar-pick-button::before {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: 0;
  background-color: #def2e9;
  transition: 0.5s ease;
  border-radius: 10px; /* 添加圆角 */
}

.avatar-pick-button:hover {
  color: #1e1e2b;
  transition-delay: 0.5s;
}

.avatar-pick-button:hover::before {
  width: 100%;
}

.avatar-pick-button::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  height: 0;
  width: 100%;
  background-color: #def2e9;
  transition: 0.4s ease;
  z-index: -1;
  border-radius: 10px; /* 添加圆角 */
}

.avatar-pick-button:hover::after {
  height: 100%;
  transition-delay: 0.4s;
  color: aliceblue;
}

.register-button {
  background-color: rgba(66, 184, 131, 0.14);
  color: #42b883;
  border: none;
  cursor: pointer;
  border-radius: 8px;
  width: 100%;
  height: 45px;
  transition: 0.3s;
  font-size: 16px;
  font-weight: 500;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.register-button.loading {
  background-color: #42b883;
  color: #fff;
}

.register-button .button-text {
  transition: opacity 0.2s ease;
}

.register-button.loading .button-text {
  opacity: 0;
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
  background-color: #01a649;
  box-shadow: 0 0 0 5px rgba(1, 166, 73, 0.37);
  color: #fff;
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
  margin-top: 0;
  text-align: left;
  font-size: 14px;
  color: #666;
}

.footer-turnstile-row {
  margin-top: 10px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.footer-turnstile-row .form-footer {
  flex: 1;
}

.footer-turnstile-row .turnstile-row {
  margin-top: 0;
  flex: 1;
  align-items: flex-end;
}

.footer-turnstile-row .turnstile-widget {
  justify-content: flex-end;
}

.login-link {
  color: #42b883;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s;
}

.login-link:hover {
  color: #01a649;
  text-decoration: underline;
}

.turnstile-row {
  margin-top: 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.turnstile-widget {
  width: 100%;
  display: flex;
  justify-content: center;
}

.turnstile-error {
  margin: 6px 0 0;
  padding: 0;
  font-size: 12px;
  color: #ff5252;
  text-align: center;
}
</style>
