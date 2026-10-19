import {defineConfig} from 'playwright/test';
export default defineConfig({testDir:'tests/browser',timeout:30000,workers:1,use:{baseURL:'http://127.0.0.1:4318',viewport:{width:1280,height:900},screenshot:'only-on-failure',trace:'retain-on-failure'},webServer:{command:'node node_modules/tsx/dist/cli.mjs tests/browser/fixture-server.ts',url:'http://127.0.0.1:4318',reuseExistingServer:false}});
