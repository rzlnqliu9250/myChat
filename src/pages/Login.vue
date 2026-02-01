<template>
  <div class="login-container">
    <div id="animation" class="large grid centered square-grid">
      <h2 ref="titleRef" class="text-xl">HELLO MYCHAT</h2>
    </div>
    <div class="login-form-wrapper">
      <h1 class="login-title">登录</h1>
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-control">
          <input
            type="text"
            id="username"
            ref="usernameInput"
            v-model="form.username"
            class="form-input"
            required
          />
          <label>
            <span
              v-for="(ch, i) in loginUsernameLabel"
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
            ref="passwordInput"
            v-model="form.password"
            class="form-input"
            required
          />
          <label>
            <span
              v-for="(ch, i) in loginPasswordLabel"
              :key="`${ch}-${i}`"
              :style="{ transitionDelay: `${i * 50}ms` }"
              >{{ ch }}</span
            >
          </label>
        </div>

        <button
          type="submit"
          class="login-button"
          :class="{ loading }"
          :disabled="loading || !turnstileToken"
        >
          <span class="button-text">登录</span>
        </button>

        <div class="footer-turnstile-row">
          <div class="form-footer">
            <p>
              还没有账号？<br />
              <router-link to="/register" class="register-link"
                >立即注册</router-link
              >
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
import { apiPost } from "../services/api";
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
  password: "",
});

const usernameInput = ref<HTMLInputElement | null>(null);
const passwordInput = ref<HTMLInputElement | null>(null);

const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as
  | string
  | undefined;
const turnstileEl = ref<HTMLElement | null>(null);
const turnstileToken = ref<string | null>(null);
const turnstileError = ref<string | null>(null);
let turnstileWidgetId: string | null = null;

const loginUsernameLabel = "账号".split("");
const loginPasswordLabel = "密码".split("");

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

const syncAutofillToModel = (): void => {
  const usernameDomValue = usernameInput.value?.value ?? "";
  const passwordDomValue = passwordInput.value?.value ?? "";

  if (!form.value.username && usernameDomValue) {
    form.value.username = usernameDomValue;
  }
  if (!form.value.password && passwordDomValue) {
    form.value.password = passwordDomValue;
  }
};

onMounted(async () => {
  await nextTick();

  syncAutofillToModel();
  window.setTimeout(syncAutofillToModel, 50);
  window.setTimeout(syncAutofillToModel, 250);

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
});
const handleLogin = async () => {
  if (!turnstileToken.value) {
    turnstileError.value = "请先完成真人验证";
    return;
  }
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
      turnstileToken: turnstileToken.value,
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
    turnstileError.value = "登录失败，请重新完成验证";
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
  position: relative;
  overflow: hidden;
  color: #111;
  background:
    radial-gradient(
      900px circle at 20% 15%,
      rgba(0, 1, 240, 0.1),
      transparent 60%
    ),
    radial-gradient(
      700px circle at 85% 30%,
      rgba(66, 184, 131, 0.1),
      transparent 55%
    ),
    radial-gradient(
      800px circle at 50% 95%,
      rgba(17, 17, 17, 0.06),
      transparent 55%
    ),
    linear-gradient(180deg, #ffffff 0%, #f6f7fb 100%);
}

.login-container::before,
.login-container::after {
  content: "";
  position: absolute;
  inset: -40% -30%;
  background: radial-gradient(
    closest-side,
    rgba(0, 1, 240, 0.12),
    transparent 70%
  );
  filter: blur(28px);
  opacity: 0.6;
  pointer-events: none;
}

.login-container::after {
  inset: -30% -40%;
  background: radial-gradient(
    closest-side,
    rgba(66, 184, 131, 0.12),
    transparent 70%
  );
  opacity: 0.45;
}

#animation,
.login-form-wrapper {
  position: relative;
  z-index: 1;
}

.login-form-wrapper {
  width: 100%;
  max-width: 400px;
  background-color: rgba(255, 255, 255, 0.82);
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
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
  padding: 30px 0 10px;
  font-size: 18px;
  color: #222;
}

.form-control .form-input:focus,
.form-control .form-input:valid {
  outline: 0;
  border-bottom-color: #111;
}

.form-control label {
  position: absolute;
  top: 21px;
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
.form-control .form-input:valid + label span {
  color: #111;
  transform: translateY(-36px);
}

.form-control .form-input:-webkit-autofill + label span {
  color: #111;
  transform: translateY(-36px);
}

.login-button {
  background-color: rgba(0, 1, 240, 0.08);
  color: #0001f0;
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

.login-button.loading {
  background-color: #0001f0;
  color: #fff;
}

.login-button .button-text {
  transition: opacity 0.2s ease;
}

.login-button.loading .button-text {
  opacity: 0;
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
  background-color: #0001f0;
  box-shadow: 0 0 0 5px rgba(0, 1, 240, 0.37);
  color: #fff;
}

.login-button:disabled {
  background-color: #a5a9ff;
  cursor: not-allowed;
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

.register-link {
  color: #0001f0;
  text-decoration: none;
  font-weight: 500;
  transition: color 0.3s;
}

.register-link:hover {
  color: #0001f0;
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
