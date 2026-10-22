import React,{useState,useEffect,useRef,useLayoutEffect} from 'react';
import{createRoot}from'react-dom/client';
import{displayProducts,imagePath,matchYear,validateYear,type Product,type Result}from'./matching';
import{downloadReceipt}from'./receipt';
import'./style.css';
type Phase='idle'|'dispensing'|'printing'|'receipt_ready'|'receipt_open';
const durations={dispensing:1250,printing:1750};
function Receipt({result}:{result:Result}){return <article className="receipt-paper"><header>NONGSHIM<br/>VINTAGE MACHINE</header><div className="receipt-meta"><p>출생연도 <b>{result.birthYear}</b></p><p className="receipt-product">{result.product.name}</p><p>상품 기준연도 <b>{result.product.year}</b></p></div><div className="receipt-copy">{result.intro.map(line=><p key={line}>{line}</p>)}<div className="receipt-body">{result.body.split('\n').map(line=><p key={line}>{line}</p>)}</div></div></article>}
function ProductImage({product}:{product:Product}){const src=imagePath(product);return src?<img src={src} alt={product.name} draggable={false}/>:<span className="text-product"><small>{product.year}</small>{product.name}</span>}
function App(){
 const[year,setYear]=useState('');const[phase,setPhase]=useState<Phase>('idle');const[result,setResult]=useState<Result|null>(null);const[error,setError]=useState('');const[saving,setSaving]=useState(false);const[reduced,setReduced]=useState(false);
 const machine=useRef<HTMLDivElement>(null),tray=useRef<HTMLDivElement>(null),flight=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDialogElement>(null),yearInput=useRef<HTMLInputElement>(null),receiptButton=useRef<HTMLButtonElement>(null);
 const slots=useRef(new Map<string,HTMLDivElement>());const busy=phase==='dispensing'||phase==='printing';const busyRef=useRef(false);const timer=useRef<ReturnType<typeof setTimeout>|null>(null);const generation=useRef(0);
 useEffect(()=>{const q=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(q.matches);update();q.addEventListener('change',update);return()=>{q.removeEventListener('change',update);generation.current++;if(timer.current)clearTimeout(timer.current)}},[]);
 useEffect(()=>{if(phase==='receipt_open'){dialog.current?.showModal();}else if(dialog.current?.open)dialog.current.close();},[phase]);
 function draw(e:React.FormEvent){e.preventDefault();if(busyRef.current||phase!=='idle')return;try{const value=validateYear(year);const next=matchYear(value);busyRef.current=true;setError('');setResult(next);setPhase('dispensing');}catch(e){setError((e as Error).message);yearInput.current?.focus();}}
 useLayoutEffect(()=>{
  if(phase!=='dispensing'||!result||!flight.current||!tray.current||!machine.current)return;
  const node=flight.current;const token=++generation.current;let animation:Animation|null=null;let finished=false;
  const complete=()=>{if(finished||generation.current!==token)return;finished=true;setPhase('printing');};
  const measure=()=>{
   if(animation)return;
   const own=node.getBoundingClientRect();
   const sourceSlot=slots.current.get(result.product.id)??slots.current.get('caprisun_apple');
   const source=(sourceSlot?.querySelector('.product-photo')??sourceSlot)!.getBoundingClientRect();
   const dx=source.x+source.width/2-(own.x+own.width/2);const dy=source.y+source.height/2-(own.y+own.height/2);
   const form=result.product.id.startsWith('caprisun')?'pouch':result.product.brand==='welchs'?'can':'bottle';
   const angle=form==='can'?-95:form==='pouch'?-16:23;
   if(!reduced&&typeof node.animate==='function'){
    animation=node.animate([{transform:`translate(${dx}px,${dy}px) rotate(0deg)`,opacity:1,offset:0},{transform:`translate(${dx*.25}px,${dy*.3}px) rotate(${angle}deg)`,opacity:1,offset:.68},{transform:`translate(0px,8px) rotate(${angle*.3}deg)`,opacity:1,offset:.84},{transform:'translate(0px,-7px) rotate(-4deg)',opacity:1,offset:.93},{transform:'translate(0px,0px) rotate(0deg)',opacity:1,offset:1}],{duration:durations.dispensing,easing:'cubic-bezier(.32,.01,.62,1)',fill:'both'});
    animation.finished.then(complete).catch(()=>{});
   }
   timer.current=setTimeout(complete,reduced?120:durations.dispensing+50);
  };measure();
  // During resizing, finish the flight into its responsive tray instead of retaining stale coordinates.
  const resize=()=>complete();window.addEventListener('resize',resize);
  return()=>{window.removeEventListener('resize',resize);animation?.cancel();if(timer.current)clearTimeout(timer.current);};
 },[phase,result,reduced]);
 useEffect(()=>{if(phase!=='printing')return;timer.current=setTimeout(()=>{busyRef.current=false;setPhase('receipt_ready');},reduced?120:durations.printing);return()=>{if(timer.current)clearTimeout(timer.current)}},[phase,reduced]);
 function reset(){generation.current++;busyRef.current=false;if(timer.current)clearTimeout(timer.current);setPhase('idle');setResult(null);setError('');setTimeout(()=>yearInput.current?.focus(),0)}
 async function save(){if(!result||saving)return;setSaving(true);setError('');try{await downloadReceipt(result)}catch(e){setError((e as Error).message)}finally{setSaving(false)}}
 const ready=phase==='receipt_ready'||phase==='receipt_open';
 return <main className="page"><div className="machine-wrap"><div className="machine" ref={machine} data-phase={phase} aria-busy={busy}>
  <header className="machine-header"><h1>NONGSHIM<span>VINTAGE MACHINE</span></h1></header>
  <section className="display-window" aria-label="음료 진열대">{displayProducts.map(p=><div className={'product-bay'+(phase==='dispensing'&&result?.product.id===p.id?' selected':'')} key={p.id} ref={node=>{if(node)slots.current.set(p.id,node)}}><div className="product-photo"><ProductImage product={p}/></div><div className="product-label">{p.name}</div></div>)}</section>
  <form className="year-panel" onSubmit={draw} noValidate><label htmlFor="birth-year">출생연도를 입력하세요</label><div className="year-controls"><input id="birth-year" ref={yearInput} type="text" inputMode="numeric" autoComplete="bday-year" placeholder="YYYY" maxLength={4} value={year} onChange={e=>{setYear(e.target.value);setError('')}} disabled={phase!=='idle'} aria-invalid={!!error} aria-describedby={error?'input-error':undefined}/><button className="draw-button" type="submit" disabled={phase!=='idle'}>{busy?'출력 중':'뽑기'}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13m-5-5 5 5-5 5"/></svg></button></div></form>
  <div className="error-slot">{error&&phase!=='receipt_open'&&<p id="input-error" role="alert">{error}</p>}</div>
  <section className="receipt-zone" aria-label="영수증 출력구"><div className="receipt-topline"><span>영수증 출력구</span><svg viewBox="0 0 20 24" aria-hidden="true"><path d="M4 2h12v20l-3-2-3 2-3-2-3 2zm3 5h6M7 11h6M7 15h4"/></svg></div><div className="printer-mouth"/><div className={'printer-paper-mask '+(phase==='printing'?'printing':ready?'printed':'')}><div className="printed-slip" aria-hidden="true"><span>NONGSHIM<br/>VINTAGE MACHINE</span><i/><small>{result?.birthYear}</small><b>{result?.product.name}</b><i/></div></div>{ready&&<button ref={receiptButton} className="receipt-open" onClick={()=>setPhase('receipt_open')}>영수증 확인 <span>↗</span></button>}</section>
  <section className="dispense-zone" aria-label="음료 배출구"><span className="tray-label">음료 배출구</span><div className="tray" ref={tray}>{result&&<div className={'dispensed-product '+(phase==='dispensing'?'in-flight':'landed')} ref={flight} data-kind={result.product.id}><ProductImage product={result.product}/></div>}</div></section>
  <div className="machine-base" aria-hidden="true"/>
 </div><div className="machine-feet" aria-hidden="true"><i/><i/></div></div>
 <p className="sr-only" role="status">{phase==='dispensing'?'음료가 나오고 있습니다.':phase==='printing'?'영수증을 인쇄하고 있습니다.':ready?'영수증 인쇄가 끝났습니다. 영수증 확인을 눌러 주세요.':''}</p>
 {ready&&phase!=='receipt_open'&&<button className="outside-reset" onClick={reset}>다시 뽑기</button>}
 <dialog ref={dialog} className="receipt-dialog" aria-label="나의 음료 영수증" onCancel={e=>{e.preventDefault();setPhase('receipt_ready');setTimeout(()=>receiptButton.current?.focus(),0)}} onClick={e=>{if(e.target===dialog.current){const r=dialog.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)setPhase('receipt_ready')}}}>
  <button className="modal-close" aria-label="영수증 닫기" onClick={()=>{setPhase('receipt_ready');setTimeout(()=>receiptButton.current?.focus(),0)}}>×</button>
  {result&&phase==='receipt_open'&&<Receipt result={result}/>}<div className="result-actions"><button onClick={save} disabled={saving}>{saving?'저장 중…':'이미지 저장'}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5"/></svg></button><button onClick={reset}>다시 뽑기</button></div>{error&&<p role="alert" className="save-error">{error}</p>}
 </dialog></main>
}
createRoot(document.getElementById('root')!).render(<App/>);
