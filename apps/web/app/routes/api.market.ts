import { json } from '@remix-run/cloudflare';
import { readTaoMarket } from '~/lib/.server/market/tao';
export async function loader(){try{return json(await readTaoMarket(),{headers:{'Cache-Control':'public, max-age=30'}});}catch{return json({error:'TAO market data is unavailable. Retry shortly. Live chain data is independent of this provider.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
