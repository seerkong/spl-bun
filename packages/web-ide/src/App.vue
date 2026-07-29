<script setup lang="ts">
import { RouterView } from "vue-router";
</script>

<template>
  <div class="app">
    <nav class="app-nav" aria-label="Application" data-testid="app-navigation">
      <span class="app-brand">SPL IDE</span>
      <span class="app-surface">Kon IDE</span>
    </nav>
    <div class="app-content">
      <RouterView />
    </div>
  </div>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
}

.app {
  width: 100%;
  min-width: 0;
  min-height: 100%;
  padding: 0 16px 16px;
  color: #17211c;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.app-nav {
  position: sticky;
  z-index: 20;
  top: 0;
  display: flex;
  align-items: stretch;
  gap: 20px;
  width: 100%;
  min-width: 0;
  min-height: 44px;
  border-bottom: 1px solid #cad3ce;
  background: #fff;
}

.app-brand {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  color: #243029;
  font-size: 12px;
  font-weight: 800;
}

.app-surface {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  min-height: 44px;
  padding: 0 11px;
  border-bottom: 2px solid transparent;
  color: #59655e;
  font-size: 12px;
  font-weight: 700;
  border-bottom-color: #16835a;
  color: #0e5b3c;
}

.app-content {
  min-width: 0;
  min-height: calc(100vh - 58px);
  padding-top: 14px;
}

@media (max-width: 620px) {
  .app {
    padding: 0 10px 10px;
  }

  .app-nav {
    gap: 8px;
  }

  .app-surface {
    padding: 0 9px;
  }

  .app-content {
    padding-top: 10px;
  }
}
</style>
