import type {Result} from './matching';
export function receiptText(result:Result){return ['NONGSHIM VINTAGE MACHINE',`출생연도 ${result.birthYear}`,result.product.name,`상품 기준연도 ${result.product.year}`,...result.intro,result.body].join('\n');}
function wrap(ctx:CanvasRenderingContext2D,text:string,width:number):string[]{
 const lines:string[]=[];
 for(const paragraph of text.split('\n')){
  let line='';
  for(const word of paragraph.split(' ')){
   const candidate=line?line+' '+word:word;
   if(ctx.measureText(candidate).width<=width){line=candidate;continue;}
   if(line)lines.push(line);
   line='';
   for(const char of Array.from(word)){
    if(line&&ctx.measureText(line+char).width>width){lines.push(line);line=char;}else line+=char;
   }
  }
  lines.push(line);
 }
 return lines;
}
export async function receiptBlob(result:Result):Promise<Blob>{
 await document.fonts.ready;
 const canvas=document.createElement('canvas');canvas.width=720;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('이미지 저장을 지원하지 않는 브라우저입니다.');
 const font='"Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
 ctx.font=`28px ${font}`;
 const intro=result.intro.flatMap(text=>wrap(ctx,text,572));
 const paragraphs=result.body.split('\n').map(text=>wrap(ctx,text,572));
 const product=wrap(ctx,result.product.name,572);
 canvas.height=430+(product.length-1)*40+intro.length*44+28+paragraphs.reduce((n,p)=>n+p.length*44+24,0)+80;
 ctx.fillStyle='#f9f7f0';ctx.fillRect(0,0,720,canvas.height);ctx.fillStyle='#252320';ctx.textBaseline='top';
 let y=64;ctx.textAlign='center';ctx.font='bold 30px monospace';
 ctx.fillText('NONGSHIM',360,y);ctx.fillText('VINTAGE MACHINE',360,y+40);y+=108;
 const rule=()=>{ctx.strokeStyle='#6c6860';ctx.lineWidth=1;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(74,y);ctx.lineTo(646,y);ctx.stroke();ctx.setLineDash([]);y+=32;};rule();
 ctx.textAlign='left';ctx.font=`25px ${font}`;ctx.fillText(`출생연도 ${result.birthYear}`,74,y);y+=48;
 ctx.font=`bold 28px ${font}`;for(const line of product){ctx.fillText(line,74,y);y+=40;}
 ctx.font=`25px ${font}`;ctx.fillText(`상품 기준연도 ${result.product.year}`,74,y);y+=60;rule();
 ctx.font=`28px ${font}`;for(const line of intro){ctx.fillText(line,74,y);y+=44;}y+=28;
 for(const paragraph of paragraphs){for(const line of paragraph){ctx.fillText(line,74,y);y+=44;}y+=24;}
 if(y>canvas.height-40)throw Error('영수증 이미지 길이를 계산하지 못했습니다. 다시 시도해 주세요.');
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('이미지를 저장하지 못했습니다.')),'image/png'));
}
export async function downloadReceipt(result:Result){
 const blob=await receiptBlob(result);const url=URL.createObjectURL(blob);const a=document.createElement('a');
 a.href=url;a.download=`nongshim-receipt-${result.birthYear}-${result.product.id}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
