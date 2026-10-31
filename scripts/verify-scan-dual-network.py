"""Read-only production acceptance for separate real testnet and localnet sessions."""
import json,os
from playwright.sync_api import sync_playwright
base=os.environ.get('SCAN_URL','https://tensorscan.vercel.app')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,channel='chrome')
 page=browser.new_page(viewport={'width':1440,'height':1100})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'/scan?network=test',wait_until='networkidle')
 page.wait_for_function('window.__tensorChain?.network==="test" && window.__tensorChain.decoded>0 && window.__tensorChain.subscriptions===2',timeout=90000)
 test=page.evaluate('window.__tensorChain')
 page.get_by_label('Explorer network',exact=True).select_option('local')
 page.wait_for_function('window.__tensorChain?.network==="local" && window.__tensorChain.decoded>0 && window.__tensorChain.subscriptions===2',timeout=90000)
 local=page.evaluate('window.__tensorChain')
 assert local['genesis']!=test['genesis'],(test,local)
 page.wait_for_function('(height)=>window.__tensorChain.decoded>height',arg=local['decoded'],timeout=60000)
 local_after=page.evaluate('window.__tensorChain')
 page.screenshot(path='artifacts/scan-localnet-live.png',full_page=True)
 page.get_by_label('Explorer network',exact=True).select_option('test')
 page.wait_for_function('(genesis)=>window.__tensorChain?.network==="test" && window.__tensorChain.genesis===genesis && window.__tensorChain.decoded>0 && window.__tensorChain.subscriptions===2',arg=test['genesis'],timeout=90000)
 test_after=page.evaluate('window.__tensorChain')
 assert not errors,errors
 report={'testnet':test,'localnet':local,'localnet_advanced':local_after,'testnet_returned':test_after,'page_errors':errors}
 with open('artifacts/scan-dual-network-verification.json','w') as f:json.dump(report,f,indent=2)
 print(json.dumps(report));browser.close()
