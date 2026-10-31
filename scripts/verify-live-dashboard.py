"""Real testnet dashboard/account reads and shared-session navigation."""
import json
from playwright.sync_api import sync_playwright
HOTKEY='5DSL6RqG33yhd8ECwdNwHPb3gvdsqf5SEqYvw9ncc8KvmiFG'
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':1440,'height':1000})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto('http://localhost:5173/dashboard/1?network=test',wait_until='domcontentloaded')
 try:
  page.locator('[aria-label="Subnet metrics"] strong').first.wait_for(timeout=90000)
  initial=page.evaluate('window.__tensorChain')
  snapshot=page.locator('.scan-index-status').inner_text()
  metrics=page.locator('[aria-label="Subnet metrics"]').inner_text()
  print(json.dumps({'initial':initial,'snapshot':snapshot,'metrics':metrics}),flush=True)
  page.screenshot(path='artifacts/dashboard-testnet.png',full_page=True)
  page.wait_for_function('(n)=>window.__tensorChain?.decoded>n',arg=initial['decoded'],timeout=45000)
  page.locator('a',has_text='Open subnet in explorer').click()
  page.get_by_role('heading',name='Subnet neurons',exact=True).wait_for(timeout=60000)
  assert page.evaluate('window.__tensorChain.generation')==initial['generation']
  page.locator('tbody tr a').first.click()
  page.get_by_role('heading',name='Hotkey subnet registrations',exact=True).wait_for(timeout=60000)
  page.locator('.scan-memberships a').first.wait_for(timeout=60000)
  print(json.dumps({'account_url':page.url,'registrations':page.locator('.scan-memberships').inner_text(),'session':page.evaluate('window.__tensorChain')}),flush=True)
  page.set_viewport_size({'width':390,'height':844})
  assert not page.evaluate('document.documentElement.scrollWidth>innerWidth')
  page.screenshot(path='artifacts/account-testnet-mobile.png',full_page=True)
  assert not errors, errors
 finally:
  print(json.dumps({'errors':errors,'body':page.locator('main').inner_text()[:1400]}),flush=True)
  b.close()
