"""Real public RPC switching and 30-second browser outage. No chain writes."""
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 context=b.new_context(viewport={'width':1440,'height':1000})
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:5173/scan?network=test',wait_until='domcontentloaded')
 page.wait_for_function('window.__tensorChain?.decoded>0',timeout=60000)
 records=[]
 # The unavailable native endpoint is still checked for complete state clearing.
 for target in ['local','test','finney','test','local']:
  page.get_by_label('Explorer network',exact=True).select_option(target)
  page.wait_for_function('(n)=>window.__tensorChain?.network===n',arg=target,timeout=10000)
  state=page.evaluate('window.__tensorChain')
  if target=='local':
   assert state.get('decoded') is None and state['blocks']==0 and state['subscriptions']==0,state
  else:
   page.wait_for_function('window.__tensorChain?.decoded>0 && window.__tensorChain.subscriptions===2',timeout=60000)
   state=page.evaluate('window.__tensorChain')
  records.append(state)
 page.get_by_label('Explorer network',exact=True).select_option('test')
 page.wait_for_function('window.__tensorChain?.network==="test" && window.__tensorChain.decoded>0',timeout=60000)
 before=page.evaluate('window.__tensorChain')
 print(json.dumps({'switches':records,'before_outage':before}),flush=True)
 context.set_offline(True)
 page.wait_for_function('window.__tensorChain?.status!=="Connected"',timeout=10000)
 page.wait_for_timeout(30000)
 context.set_offline(False)
 page.wait_for_function('(n)=>window.__tensorChain?.status==="Connected" && window.__tensorChain.decoded>n && window.__tensorChain.subscriptions===2',arg=before['decoded'],timeout=90000)
 after=page.evaluate('window.__tensorChain')
 assert after['genesis']==before['genesis']
 assert not errors,errors
 print(json.dumps({'after_outage':after,'outage_seconds':30,'errors':errors,'localnet':'not running; state-clearing only'}),flush=True)
 page.screenshot(path='artifacts/testnet-reconnected.png',full_page=True)
 b.close()
