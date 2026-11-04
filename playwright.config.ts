import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir:'./tests', testMatch:'ui.spec.ts', use:{ baseURL:'http://127.0.0.1:5173', headless:true }, webServer:{ command:'npm run dev:web', url:'http://127.0.0.1:5173', reuseExistingServer:true, timeout:30000 } });
