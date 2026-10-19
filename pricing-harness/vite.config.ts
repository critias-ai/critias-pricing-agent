import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],build:{outDir:'dist/ui',emptyOutDir:true},server:{host:'127.0.0.1',port:5173,proxy:{'/api':{target:'http://127.0.0.1:4317',changeOrigin:true,configure(proxy){proxy.on('proxyReq',(outgoing,request)=>{if(['http://127.0.0.1:5173','http://localhost:5173'].includes(request.headers.origin??''))outgoing.setHeader('origin','http://127.0.0.1:4317');});}}}}});
