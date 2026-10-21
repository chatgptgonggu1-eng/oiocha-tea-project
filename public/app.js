const $=s=>document.querySelector(s);
const labels={leaf:'잎사귀',heart:'하트',star:'별',clover:'네잎클로버',rabbit:'토끼'};
const svg=shape=>`<svg class="leaf-art" viewBox="0 0 200 190" aria-hidden="true"><use href="#${shape}" fill="url(#green)" stroke="#8bab50" stroke-width=".6"/><use href="#${shape}" fill="url(#veins)"/>${shape==='leaf'?'<path d="M25 145Q90 99 177 24M60 119 55 76M90 95 95 52M90 95 134 105" stroke="#789b45" stroke-width="1" fill="none" opacity=".4"/>':''}</svg>`;
let boardId=location.pathname.match(/^\/garden\/([\w-]+)$/)?.[1],messages=[],board,dragging=false,toastTimer;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),4000);}
async function api(url,options){const r=await fetch(url,{...options,headers:{'Content-Type':'application/json'}});const data=await r.json();if(!r.ok)throw Error(data.error||'요청에 실패했어요.');return data;}
function open(id){const d=$(id);d.showModal();setTimeout(()=>d.querySelector('input:not([type=radio]),textarea,.close')?.focus(),0);}
document.querySelectorAll('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
$('#new-board').onclick=$('#create').onclick=()=>open('#create-dialog');
$('#write').onclick=()=>open('#write-dialog');
$('#shape-options').innerHTML=Object.entries(labels).map(([key,label],i)=>`<label class="shape-choice"><input type="radio" name="shape" value="${key}" ${i===0?'checked':''}><span class="choice-art">${svg(key)}</span>${label}</label>`).join('');
$('#write-form textarea').oninput=e=>$('#chars').textContent=e.target.value.length;
async function submit(form,fn){const button=form.querySelector('.submit');button.disabled=true;try{await fn();}catch(e){toast(e.message);let error=form.querySelector('.form-error');if(!error){error=document.createElement('p');error.className='form-error';error.setAttribute('role','alert');error.style.cssText='color:#8e3f2f;font-size:12px;line-height:1.6';form.append(error);}error.textContent=e.message;}finally{button.disabled=false;}}
$('#create-form').onsubmit=e=>{e.preventDefault();submit(e.target,async()=>{const f=new FormData(e.target);const b=await api('/api/boards',{method:'POST',body:JSON.stringify(Object.fromEntries(f))});boardId=b.id;try{history.pushState({},'', '/garden/'+b.id);}catch{}await enterBoard();$('#create-dialog').close();open('#write-dialog');});};
$('#write-form').onsubmit=e=>{e.preventDefault();submit(e.target,async()=>{const f=new FormData(e.target);await api(`/api/boards/${boardId}/messages`,{method:'POST',body:JSON.stringify({...Object.fromEntries(f),x:.15+Math.random()*.7,y:.15+Math.random()*.7})});$('#write-dialog').close();e.target.reset();$('#chars').textContent='0';await load();toast('당신의 마음 한 잎이 도착했어요.');});};
// Sandboxed document previews can allow scripts but prohibit native form submission.
// Invoke the same validated actions directly from ordinary buttons instead.
for(const form of [$('#create-form'),$('#write-form')]){
 const run=()=>{if(!form.reportValidity())return;form.querySelector('.form-error')?.remove();form.onsubmit({preventDefault(){},target:form});};
 const button=form.querySelector('.submit');button.type='button';button.onclick=run;
 form.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'){e.preventDefault();if(!button.disabled)run();}});
}
$('#share').onclick=async()=>{if(!boardId){toast('먼저 찻잔을 만들어 주세요.');open('#create-dialog');return;}$('#share-url').value=location.origin+'/garden/'+boardId;open('#share-dialog');};
$('#copy-link').onclick=async()=>{try{await navigator.clipboard.writeText($('#share-url').value);toast('링크를 복사했어요. 친구에게 보내 주세요.');$('#share-dialog').close();}catch{$('#share-url').select();toast('위 링크를 길게 누르거나 Ctrl+C로 복사해 주세요.');}};
function view(m){$('#read-leaf').innerHTML=svg(m.shape);$('#read-body').textContent=m.body;$('#read-name').textContent='From. '+m.name;open('#read-dialog');}
function note(m,demo=false){const el=document.createElement('button');el.className='note'+(demo?' demo':'');el.dataset.shape=m.shape;el.dataset.id=m.id||'';el.setAttribute('aria-label',m.name+'님의 메시지: '+m.body);el.style.left=(m.x*100)+'%';el.style.top=(m.y*100)+'%';el.style.setProperty('--rotation',((m.x*19)%15-7)+'deg');el.style.setProperty('--delay',(-m.y*10)+'s');el.innerHTML=`<div class="leaf-inner">${svg(m.shape)}<div class="note-copy"><span class="excerpt"></span><small></small></div></div>`;el.querySelector('.excerpt').textContent=m.body;el.querySelector('small').textContent=m.name;
if(!demo){let start,moved=false,old;
el.onpointerdown=e=>{if(e.button!==0)return;start={x:e.clientX,y:e.clientY};old={x:m.x,y:m.y};moved=false;el.setPointerCapture(e.pointerId);};
el.onpointermove=e=>{if(!start)return;if(Math.hypot(e.clientX-start.x,e.clientY-start.y)>6)moved=true;if(!moved)return;dragging=true;const r=$('#leaves').getBoundingClientRect();m.x=Math.max(.06,Math.min(.94,old.x+(e.clientX-start.x)/r.width));m.y=Math.max(.04,Math.min(.96,old.y+(e.clientY-start.y)/r.height));el.style.left=m.x*100+'%';el.style.top=m.y*100+'%';};
async function finish(cancel){if(!start)return;start=null;if(moved){if(cancel){Object.assign(m,old);render();}else{try{await api(`/api/boards/${boardId}/messages/${m.id}`,{method:'PATCH',body:JSON.stringify({x:m.x,y:m.y})});}catch(e){Object.assign(m,old);render();toast(e.message);}}}dragging=false;}
el.onpointerup=()=>finish(false);el.onpointercancel=()=>finish(true);el.onclick=()=>{if(!moved)view(m);};
el.onkeydown=async e=>{const keys={ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,-.025],ArrowDown:[0,.025]};if(!keys[e.key])return;e.preventDefault();m.x=Math.max(.06,Math.min(.94,m.x+keys[e.key][0]));m.y=Math.max(.04,Math.min(.96,m.y+keys[e.key][1]));el.style.left=m.x*100+'%';el.style.top=m.y*100+'%';try{await api(`/api/boards/${boardId}/messages/${m.id}`,{method:'PATCH',body:JSON.stringify({x:m.x,y:m.y})});}catch(err){toast(err.message);await load();}};}
return el;}
function render(){const focused=document.activeElement?.dataset.id;$('#leaves').replaceChildren(...messages.map(m=>note(m)));if(focused)Array.from($('#leaves').children).find(n=>n.dataset.id===focused)?.focus({preventScroll:true});$('#empty').hidden=messages.length>0;$('#count').textContent=`${messages.length}개의 마음이 떠 있어요`;}
let lastData='';async function load(){if(dragging)return;const b=await api('/api/boards/'+boardId);if(dragging)return;board=b;$('#board-title').textContent=b.title;$('#board-description').textContent=b.recipient+'에게 전하는 초록빛 응원';document.title=b.title+' · 오이오차';const json=JSON.stringify(b.messages);if(json!==lastData){messages=b.messages;render();lastData=json;}else if(!messages.length){$('#empty').hidden=false;$('#count').textContent='0개의 마음이 떠 있어요';}}
async function enterBoard(){lastData='';messages=[];$('#leaves').replaceChildren();$('#new-board').hidden=false;$('.pond').classList.add('board-active');$('#intro').hidden=true;$('.edition').hidden=true;$('#board-heading').hidden=false;$('#write').hidden=false;$('#hint').textContent='잎사귀를 끌어 옮기거나 눌러 읽어 보세요';try{await load();}catch(e){$('#empty').hidden=false;$('#empty').textContent=e.message;$('#write').hidden=true;toast(e.message);}}
if(boardId){await enterBoard();}
else{const demos=[{shape:'leaf',name:'마음을 담아',body:'오늘도 너의 편이야.',x:.73,y:.2},{shape:'heart',name:'다정한 한마디',body:'너의 모든 순간을 응원해 ♡',x:.86,y:.66},{shape:'clover',name:'작은 행운',body:'좋은 일이 찾아올 거야.',x:.59,y:.83}];demos.forEach(m=>$('#leaves').append(note(m,true)));}

setInterval(()=>{if(boardId&&!document.hidden)load().catch(()=>{});},3000);
