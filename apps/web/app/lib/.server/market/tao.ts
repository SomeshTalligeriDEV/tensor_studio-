import { z } from 'zod';
const amount = z.string().regex(/^\d+(?:\.\d+)?$/).transform(Number).pipe(z.number().finite().nonnegative());
const latestSchema = z.object({
 price_usd:amount, market_cap_usd:amount, volume_24h_usd:amount,
 price_change_percent_24h:z.number().finite().nullable(), updated_at:z.string().datetime(),
});
const historySchema=z.object({_embedded:z.object({prices:z.array(z.object({time:z.string().datetime(),price_usd:amount.nullable()})).max(1000)})});
export const MARKET_URL='https://api.tao.com/data/v1/tao/price/latest';
export function parseTaoMarket(value:unknown,history?:unknown){
 const row=latestSchema.parse(value);
 const samples=history===undefined?[]:historySchema.parse(history)._embedded.prices.slice().sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
 return {price:row.price_usd,marketCap:row.market_cap_usd,volume24h:row.volume_24h_usd,change24h:row.price_change_percent_24h,
 supply:null as number|null,high24h:null as number|null,low24h:null as number|null,updated:row.updated_at,
 prices:samples.map(p=>p.price_usd),sampleTimes:samples.map(p=>p.time),source:'TAO.com' as const};
}
export type TaoMarket=ReturnType<typeof parseTaoMarket>;
let cache:{at:number;data:TaoMarket}|undefined;
let pending:Promise<TaoMarket>|undefined;
async function request(url:string|URL){
 const response=await fetch(url,{signal:AbortSignal.timeout(10000),headers:{accept:'application/hal+json, application/json'}});
 if(!response.ok)throw new Error(`Market provider returned HTTP ${response.status}`);
 return response.json();
}
export async function readTaoMarket(){
 if(cache && Date.now()-cache.at<60000)return cache.data;
 pending??=(async()=>{
  const end=Date.now(),historyUrl=new URL('https://api.tao.com/data/v1/tao/price/history');
  historyUrl.search=new URLSearchParams({start_time:new Date(end-7*86400000).toISOString(),end_time:new Date(end).toISOString(),granularity:'hour'}).toString();
  const [latest,history]=await Promise.all([request(MARKET_URL),request(historyUrl).then(value=>{historySchema.parse(value);return value;}).catch(()=>undefined)]);
  const data=parseTaoMarket(latest,history);cache={at:Date.now(),data};return data;
 })().finally(()=>{pending=undefined;});
 return pending;
}
