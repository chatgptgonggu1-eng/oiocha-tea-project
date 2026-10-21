import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
let html=readFileSync(path.join(root,'public/index.html'),'utf8');
let css=readFileSync(path.join(root,'public/style.css'),'utf8').replace(/@import url\([^)]*\);/,'');
const image=readFileSync(path.join(root,'public/assets/tea-water.png')).toString('base64');
css=css.replace("url('/assets/tea-water.png')",`url('data:image/png;base64,${image}')`);
let app=readFileSync(path.join(root,'public/app.js'),'utf8');
// A standalone attachment cannot connect to the Node server. Keep its local-only
// demonstration explicit; the actual served app always uses the SQLite API.
const localApi=`
const previewKey='oiocha-standalone-preview-v1';
let previewStore;
try { previewStore=JSON.parse(localStorage.getItem(previewKey)||'{"boards":{}}'); } catch { previewStore={boards:{}}; }
function previewSave(){try{localStorage.setItem(previewKey,JSON.stringify(previewStore));}catch{}}
function previewId(){return globalThis.crypto?.randomUUID?.() || Date.now().toString(36)+Math.random().toString(36).slice(2);}
async function api(url,options={}){
 const method=options.method||'GET', data=JSON.parse(options.body||'{}');
 if(url==='/api/boards'&&method==='POST'){const b={...data,id:previewId(),messages:[]};previewStore.boards[b.id]=b;previewSave();return b;}
 const parts=url.split('/').filter(Boolean), b=previewStore.boards[parts[2]];
 if(!b)throw Error('미리보기 찻잔을 찾을 수 없어요. 새 찻잔을 만들어 주세요.');
 if(method==='GET')return JSON.parse(JSON.stringify(b));
 if(method==='POST'){const m={...data,id:previewId()};b.messages.push(m);previewSave();return m;}
 if(method==='PATCH'){const m=b.messages.find(m=>m.id===parts[4]);if(m)Object.assign(m,data);previewSave();return {ok:true};}
}
`;
app=app.replace(/async function api\(url,options\)\{[^\n]+\}/,localApi);
app=app.replace("location.pathname.match(/^\\/garden\\/([\\w-]+)$/)?.[1]","location.hash.match(/^#garden\\/([\\w-]+)$/)?.[1]");
app=app.replace("history.pushState({},'', '/garden/'+b.id)","history.replaceState({},'', '#garden/'+b.id)");
app=app.replace("location.origin+'/garden/'+boardId","location.href.split('#')[0]+'#garden/'+boardId");
html=html.replace('<link rel="stylesheet" href="/style.css">',`<style>${css}</style>`);
html=html.replace('<script type="module" src="/app.js"></script>',`<script type="module">${app}</script>`);
const bottle=readFileSync(path.join(root,'public/assets/oiocha-bottle.png')).toString('base64');
html=html.replace('src="/assets/oiocha-bottle.png"',`src="data:image/png;base64,${bottle}"`);
html=html.replace('</body>','<div style="position:relative;text-align:center;background:#f8fae8;color:#315b37;padding:5px;font:11px sans-serif">디자인 미리보기 · 메시지는 이 브라우저에만 저장됩니다. 여러 기기 공유는 서버 실행 후 사용할 수 있어요.</div></body>');
html=html.replace('href="/" aria-label="오이오차 홈"','href="#" onclick="location.hash=\'\';location.reload();return false" aria-label="오이오차 홈"');
writeFileSync(path.join(root,'index.html'),html);
console.log('Created standalone index.html with embedded styles, background and scripts.');
