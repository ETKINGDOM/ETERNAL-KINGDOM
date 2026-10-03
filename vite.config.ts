import { defineConfig } from 'vite';
import {readFileSync} from 'node:fs';
import {whitepaperHtml} from './shared/whitepaper';

function whitepaperAssets(){
  const markdown=readFileSync(new URL('./WHITEPAPER_V1.md',import.meta.url),'utf8');
  const pdf=readFileSync(new URL('./output/pdf/Eternal_Kingdom_Whitepaper_V1.pdf',import.meta.url));
  if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-'))||pdf.length>5_000_000||/https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\//i.test(markdown))throw Error('Invalid founding whitepaper assets.');
  return {html:whitepaperHtml(markdown),pdf};
}

export default defineConfig({
  plugins:[{
    name:'founding-whitepaper',
    configureServer(server){
      server.middlewares.use((request,response,next)=>{
        const path=request.url?.split('?')[0];
        if(path==='/whitepaper'){response.writeHead(302,{Location:'/whitepaper/'});response.end();return;}
        if(path!=='/whitepaper/'&&path!=='/whitepaper/index.html'&&path!=='/whitepaper/Eternal_Kingdom_Whitepaper_V1.pdf')return next();
        const assets=whitepaperAssets(),pdf=path.endsWith('.pdf');
        response.setHeader('Content-Type',pdf?'application/pdf':'text/html; charset=utf-8');response.end(pdf?assets.pdf:assets.html);
      });
    },
    generateBundle(){
      const assets=whitepaperAssets();
      this.emitFile({type:'asset',fileName:'whitepaper/index.html',source:assets.html});
      this.emitFile({type:'asset',fileName:'whitepaper/Eternal_Kingdom_Whitepaper_V1.pdf',source:assets.pdf});
    },
  }],
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://127.0.0.1:8787', ws: true, changeOrigin: false } },
  },
  build: { target: 'es2022' },
});
