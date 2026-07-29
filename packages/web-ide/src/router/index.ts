import { createRouter, createWebHistory } from "vue-router";
import KonIde from "../pages/KonIde.vue";

const router = createRouter({
  history: createWebHistory("/"),
  routes: [
    {
      path: "/",
      name: "kon-ide",
      component: KonIde,
    },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

export default router;
