"""Production acceptance: real localnet, network loss/recovery and funding resources."""
import json,os
from playwright.sync_api import sync_playwright
base=os.environ.get('SCAN_URL','https://tensorscan.vercel.app')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,channel='chrome')
 context=browser.new_context(viewport={'width':1440,'height':1000});page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 print('Checking live localnet and funding resources',flush=True)
 page.goto(base+'/scan?network=local',wait_until='domcontentloaded')
 page.wait_for_function('window.__tensorChain?.network==="local" && window.__tensorChain.decoded>0 && window.__tensorChain.blocks>=3',timeout=90000)
 assert not page.locator('.scan-recovery').count()
 before=page.evaluate('window.__tensorChain')
 page.wait_for_function('(h)=>window.__tensorChain.decoded>h',arg=before['decoded'],timeout=60000)
 page.locator('.scan-network-tools summary').click()
 assert 'Alice' in page.locator('.scan-network-tools').inner_text()
 assert 'read-only' in page.locator('.scan-network-tools').inner_text()
 assert page.get_by_role('link',name='Alice funding guide').get_attribute('href')=='https://guides.learnbittensor.org/local-build/provision-wallets'
 page.screenshot(path='artifacts/localnet-recovery-desktop.png',full_page=True)
 print('Testing browser offline/online recovery',flush=True)
 context.set_offline(True)
 page.get_by_role('link',name='Resume localnet').wait_for(timeout=30000)
 assert page.get_by_role('button',name='Retry connection').count()
 context.set_offline(False)
 page.wait_for_function('window.__tensorChain?.status==="Connected" && window.__tensorChain.decoded>0',timeout=90000)
 after=page.evaluate('window.__tensorChain')
 page.wait_for_function('(h)=>window.__tensorChain.decoded>h',arg=after['decoded'],timeout=60000)
 page.get_by_label('Explorer network',exact=True).select_option('test')
 page.wait_for_function('window.__tensorChain?.network==="test" && window.__tensorChain.decoded>0',timeout=90000)
 tools=page.locator('.scan-network-tools')
 if tools.get_attribute('open') is None:tools.locator('summary').click()
 assert page.get_by_role('link',name='Community faucet').get_attribute('href')=='https://taoswap.org/testnet-faucet'
 assert page.get_by_role('link',name='Request test TAO').count()
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path='artifacts/faucet-mobile.png',full_page=True)
 assert not errors,errors
 result={'before':before,'after_recovery':after,'faucet_links':True,'page_errors':errors,'mobile_overflow':False}
 with open('artifacts/localnet-recovery-verification.json','w') as f:json.dump(result,f,indent=2)
 print(json.dumps(result));browser.close()
