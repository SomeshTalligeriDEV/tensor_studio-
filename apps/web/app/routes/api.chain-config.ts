import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
export function loader({context,request}:LoaderFunctionArgs){
  if(context.cloudflare.env.SCAN_PUBLIC_ONLY==='1')return json({localEndpoint:'',publicOnly:true},{headers:{'Cache-Control':'no-store'}});
  const endpoint=(context.cloudflare.env.CHAIN_WS || (typeof process!=='undefined'?process.env.CHAIN_WS:undefined) || 'ws://127.0.0.1:9944').trim();
  try {
    const url=new URL(endpoint);
    if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error();
    const appUrl = new URL(request.url);
    const localApp = ['localhost', '127.0.0.1', '[::1]'].includes(appUrl.hostname);
    if (!localApp && (url.protocol !== 'wss:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
      return json({error:'Hosted localnet requires a reachable secure wss:// CHAIN_WS endpoint. Configure your private development chain host.'},{status:503,headers:{'Cache-Control':'no-store'}});
    }
    return json({localEndpoint:url.href},{headers:{'Cache-Control':'no-store'}});
  } catch {return json({error:'CHAIN_WS must be a WebSocket URL without credentials, query or fragment.'},{status:503});}
}
