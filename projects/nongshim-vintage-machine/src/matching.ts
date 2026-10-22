import data from '../PRODUCT_DATA.json';
export type Brand = 'welchs' | 'caprisun' | 'power_o2' | 'oi_ocha_green' | 'oi_ocha_jasmine';
export interface Product {id:string;brand:Brand;name:string;intro_name:string;year:number;image:string|null;display:boolean;eligible:boolean;asset_status?:string;year_basis?:string}
export interface Result {birthYear:number;product:Product;intro:[string,string];body:string}
export const products = data.products as Product[];
export const messages = data.messages_by_brand as Partial<Record<Brand,string>>;
export const displayProducts = ['caprisun_orange','caprisun_apple','power_o2_apple_kiwi','power_o2_orange_lemon','oi_ocha_green_tea','welchs_grape'].map(id=>products.find(p=>p.id===id)!);
export function validateYear(input:string,currentYear=new Date().getFullYear()):number {
 if(!/^\d{4}$/.test(input.trim()))throw Error('출생연도를 네 자리 숫자로 입력해 주세요.');
 const year=Number(input.trim());
 if(year<1900||year>currentYear)throw Error(`1900년부터 ${currentYear}년 사이로 입력해 주세요.`);
 return year;
}
const ages=['영','한','두','세','네','다섯','여섯','일곱','여덟','아홉','열','열한','열두','열세','열네','열다섯','열여섯','열일곱','열여덟','열아홉'];
const age=(n:number)=>n<ages.length?`${ages[n]} 살`:`${n}살`;
function subject(name:string){const cp=name.charCodeAt(name.length-1);return name+((cp>=0xac00&&cp<=0xd7a3&&(cp-0xac00)%28!==0)?'이':'가');}
export function makeIntro(birthYear:number,p:Product):[string,string]{
 const first=p.brand==='welchs'?`${p.year}년, 웰치스가 우리 곁에 찾아왔습니다.`:`${p.year}년, ${subject(p.intro_name)} 세상에 나왔습니다.`;
 if(birthYear===p.year)return[first,'그리고 같은 해, 당신의 첫 번째 하루도 시작되었죠.'];
 if(birthYear>p.year)return[first,`그리고 ${birthYear-p.year}년 뒤, 당신의 첫 번째 하루가 시작되었죠.`];
 return[`${birthYear}년, 당신의 첫 번째 하루가 시작되었습니다.`,`그리고 당신이 ${age(p.year-birthYear)}이 되던 해, ${p.intro_name}도 우리 곁에 찾아왔죠.`];
}
export function matchYear(birthYear:number,rng:()=>number=Math.random,currentYear=new Date().getFullYear()):Result{
 validateYear(String(birthYear),currentYear);
 const eligible=products.filter(p=>p.eligible);
 const years=[...new Set(eligible.map(p=>p.year))].sort((a,b)=>a-b);
 // Equal distances select the earlier year; flavor selection remains random.
 const selected=years.reduce((best,year)=>Math.abs(birthYear-year)<Math.abs(birthYear-best)?year:best,years[0]);
 let candidates=eligible.filter(p=>p.year===selected);
 const approved=candidates.filter(p=>messages[p.brand]);
 if(approved.length)candidates=approved;
 const roll=Math.max(0,Math.min(.999999,Number(rng())||0));
 const product=candidates[Math.floor(roll*candidates.length)];
 return{birthYear,product,intro:makeIntro(birthYear,product),body:messages[product.brand]??'문구 준비 중'};
}
export const imagePath=(p:Product)=>p.image?import.meta.env.BASE_URL+p.image:null;
