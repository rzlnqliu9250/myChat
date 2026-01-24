/**
 * 前端入口：创建 Vue 应用实例并挂载 Pinia 与 Vue Router。
 */
import { createApp } from "vue";
import { createPinia } from "pinia";
import router from "./router";
import "./style.css";
import App from "./App.vue";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.use(router);
app.mount("#app");
