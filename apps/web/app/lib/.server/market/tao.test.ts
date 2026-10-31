import { afterEach, expect, it, vi } from 'vitest';
import { parseTaoMarket } from './tao';
const latest = { price_usd:'233.17',market_cap_usd:'2721874700.09',volume_24h_usd:'273004873.95',price_change_percent_24h:-6.09,updated_at:'2026-10-30T09:00:00.000Z' };
const history = {_embedded:{prices:[{time:'2026-10-30T07:00:00.000Z',price_usd:'240'},{time:'2026-10-30T08:00:00.000Z',price_usd:null},{time:'2026-10-30T09:00:00.000Z',price_usd:'233.17'}]}};
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();});
it('parses TAO.com decimal strings, timestamps and explicit history gaps',()=>{
 const result=parseTaoMarket(latest,history);
 expect(result.price).toBe(233.17); expect(result.source).toBe('TAO.com');
 expect(result.prices).toEqual([240,null,233.17]);
 expect(result.sampleTimes).toEqual(history._embedded.prices.map(p=>p.time));
 expect(result.updated).toBe(latest.updated_at);
 expect(result.supply).toBeNull();expect(result.high24h).toBeNull();expect(result.low24h).toBeNull();
});
it('rejects malformed prices instead of coercing absent values to zero',()=>{
 for(const price_usd of ['',null,'NaN','Infinity','-1'])expect(()=>parseTaoMarket({...latest,price_usd},history)).toThrow();
 expect(()=>parseTaoMarket(latest,{_embedded:{prices:[{time:'invalid',price_usd:'1'}]}})).toThrow();
});
it('keeps the latest price available when history is absent',()=>{
 const result=parseTaoMarket(latest);
 expect(result.prices).toEqual([]);expect(result.price).toBe(233.17);
});
it('requests seven-day hourly history and caches concurrent callers',async()=>{
 const fetcher=vi.fn(async(input:URL|string)=>new Response(JSON.stringify(String(input).includes('/history?')?history:latest)));
 vi.stubGlobal('fetch',fetcher);
 const {readTaoMarket}=await import('./tao');
 const [first,second]=await Promise.all([readTaoMarket(),readTaoMarket()]);
 expect(first).toBe(second);expect(fetcher).toHaveBeenCalledTimes(2);
 const url=new URL(String(fetcher.mock.calls.find(([url])=>String(url).includes('/history?'))![0]));
 expect(url.searchParams.get('granularity')).toBe('hour');
 expect(Date.parse(url.searchParams.get('end_time')!)-Date.parse(url.searchParams.get('start_time')!)).toBe(7*86400000);
 await readTaoMarket();expect(fetcher).toHaveBeenCalledTimes(2);
});
it('serves latest data if the history endpoint fails',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(input:URL|string)=>String(input).includes('/history?')?new Response('',{status:503}):new Response(JSON.stringify(latest))));
 const {readTaoMarket}=await import('./tao');
 expect((await readTaoMarket()).price).toBe(233.17);
});
