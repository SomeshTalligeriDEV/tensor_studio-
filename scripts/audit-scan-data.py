"""Compare a rendered block against an independent real RPC read; never write to chain."""
import json,re,subprocess,urllib.request
from playwright.sync_api import sync_playwright
RPC_CHECK = r'''
import {createRequire} from 'node:module';
const require=createRequire(process.cwd()+'/apps/web/package.json');
const {ApiPromise,WsProvider}=require('@polkadot/api');
const api=new ApiPromise({provider:new WsProvider('wss://test.finney.opentensor.ai:443',false),noInitWarn:true});
let timer=setTimeout(()=>{console.error('RPC audit timed out');process.exit(1);},30000);
try{
 await api.connect();await api.isReadyOrError;
 const hash=await api.rpc.chain.getBlockHash(Number(process.argv[2]));
 const [block,at]=await Promise.all([api.rpc.chain.getBlock(hash),api.at(hash)]);
 const events=await at.query.system.events();
 console.log(JSON.stringify({height:block.block.header.number.toNumber(),hash:hash.toHex(),genesis:api.genesisHash.toHex(),extrinsics:block.block.extrinsics.length,events:events.length}));
}finally{clearTimeout(timer);await api.disconnect();}
'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,channel='chrome')
 page=browser.new_page()
 page.goto('https://tensorscan.vercel.app/scan?network=test',wait_until='networkidle')
 page.wait_for_function('window.__tensorChain?.decoded>0 && window.__tensorChain.blocks>=3',timeout=90000)
 row=page.locator('.scan-feeds .scan-panel').first.locator('.scan-feed-row').first
 label=row.inner_text()
 height=int(row.locator('a').first.inner_text().replace(',',''))
 observed={'height':height,'extrinsics':int(re.search(r'(\d+) extrinsics',label)[1]),'events':int(re.search(r'(\d+) events recorded',label)[1])}
 result=subprocess.run(['node','--input-type=module','-',str(height)],input=RPC_CHECK,text=True,capture_output=True,timeout=45,check=True)
 chain=json.loads(result.stdout.strip().splitlines()[-1])
 assert chain['genesis']=='0x8f9cf856bf558a14440e75569c9e58594757048d7b3a84b5d25f6bd978263105',chain
 for key in observed: assert observed[key]==chain[key],(observed,chain)
 with urllib.request.urlopen('https://tensorscan.vercel.app/api/market',timeout=20) as response:market=json.load(response)
 assert market['source']=='TAO.com' and market['price']>0
 assert len(market['prices'])==len(market['sampleTimes']) and len(market['prices'])>0
 assert market['supply'] is None and market['high24h'] is None and market['low24h'] is None
 report={'rendered':observed,'independent_rpc':chain,'matched':True,'market':{'source':market['source'],'updated':market['updated'],'samples':len(market['prices']),'refresh_seconds':60}}
 print(json.dumps(report))
 with open('artifacts/scan-data-audit.json','w') as f:json.dump(report,f,indent=2)
 browser.close()
