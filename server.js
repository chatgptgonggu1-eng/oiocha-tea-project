import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
mkdirSync(path.join(root,'data'),{recursive:true});
const db = new DatabaseSync(process.env.DB_PATH || path.join(root,'data/pond.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS boards(id TEXT PRIMARY KEY,title TEXT NOT NULL,recipient TEXT NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,board_id TEXT NOT NULL REFERENCES boards(id),name TEXT NOT NULL,body TEXT NOT NULL,shape TEXT NOT NULL,x REAL NOT NULL,y REAL NOT NULL,created_at TEXT DEFAULT CURRENT_TIMESTAMP);`);
const shapes=['leaf','heart','star','clover','rabbit'];
const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(Buffer.byteLength(text)>8192)throw Error('요청이 너무 큽니다.');}return JSON.parse(text||'{}');}
const clean=(v,max)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max?v.trim():null;
const coord=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1;
export const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');const p=url.pathname;
 if(p==='/api/health'&&req.method==='GET'){db.prepare('SELECT 1').get();return send(res,200,{ok:true});}
 if(p==='/api/boards'&&req.method==='POST'){
 const b=await body(req),title=clean(b.title,60),recipient=clean(b.recipient,30);if(!title||!recipient)return send(res,400,{error:'받는 분과 제목을 확인해 주세요.'});
 const id=randomUUID();db.prepare('INSERT INTO boards(id,title,recipient) VALUES(?,?,?)').run(id,title,recipient);return send(res,201,{id,title,recipient});}
 const board=p.match(/^\/api\/boards\/([\w-]+)(\/messages)?$/);
 if(board){const id=board[1],b=db.prepare('SELECT * FROM boards WHERE id=?').get(id);if(!b)return send(res,404,{error:'찻물 정원을 찾을 수 없어요. 링크를 확인해 주세요.'});
 if(req.method==='GET'&&!board[2])return send(res,200,{...b,messages:db.prepare('SELECT * FROM messages WHERE board_id=? ORDER BY created_at,rowid').all(id)});
 if(req.method==='POST'&&board[2]){const m=await body(req),name=clean(m.name,20),message=clean(m.body,200);if(!name||!message||!shapes.includes(m.shape)||!coord(m.x)||!coord(m.y))return send(res,400,{error:'이름, 메시지, 잎사귀를 확인해 주세요.'});const mid=randomUUID();db.prepare('INSERT INTO messages(id,board_id,name,body,shape,x,y) VALUES(?,?,?,?,?,?,?)').run(mid,id,name,message,m.shape,m.x,m.y);return send(res,201,db.prepare('SELECT * FROM messages WHERE id=?').get(mid));}}
 const move=p.match(/^\/api\/boards\/([\w-]+)\/messages\/([\w-]+)$/);
 if(move&&req.method==='PATCH'){const m=await body(req);if(!coord(m.x)||!coord(m.y))return send(res,400,{error:'위치가 올바르지 않습니다.'});const result=db.prepare('UPDATE messages SET x=?,y=? WHERE id=? AND board_id=?').run(m.x,m.y,move[2],move[1]);return send(res,result.changes?200:404,result.changes?{ok:true}:{error:'메시지를 찾을 수 없습니다.'});}
 if(p.startsWith('/api/'))return send(res,404,{error:'요청을 찾을 수 없습니다.'});
 if(!['GET','HEAD'].includes(req.method))return send(res,405,{error:'지원하지 않는 요청입니다.'});
 const relative=p==='/'||/^\/garden\/[\w-]+$/.test(p)?'index.html':decodeURIComponent(p).replace(/^\//,'');
 const file=path.resolve(root,'public',relative);if(!file.startsWith(path.join(root,'public')+path.sep))return send(res,403,{error:'접근 불가'});
 try{const data=readFileSync(file);res.writeHead(200,{'Content-Type':({'html':'text/html; charset=utf-8','css':'text/css','js':'text/javascript','svg':'image/svg+xml','jpg':'image/jpeg','png':'image/png'})[path.extname(file).slice(1)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:data);}catch{return send(res,404,{error:'파일을 찾을 수 없습니다.'});}
 }catch(err){send(res,err instanceof SyntaxError?400:500,{error:err instanceof SyntaxError?'요청 형식을 확인해 주세요.':'저장하지 못했어요. 잠시 후 다시 시도해 주세요.'});}
});
if(process.env.NODE_ENV!=='test')server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Tea garden listening on port '+(process.env.PORT||3000)));
