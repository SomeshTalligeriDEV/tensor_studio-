import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':1440,'height':1000})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda m:print('CONSOLE',m.text[:500]) if m.type=='error' else None)
 page.on('requestfailed',lambda r:print('FAILED',r.url[:200],r.failure))
 page.goto('http://localhost:5173/scan?network=test',wait_until='domcontentloaded')
 try:
  page.wait_for_function('window.__tensorChain?.decoded > 0',timeout=60000)
  print(json.dumps({'session':page.evaluate('window.__tensorChain'),'errors':errors,'body':page.locator('main').inner_text()[:1800]}))
  page.screenshot(path='artifacts/shared-scan-testnet.png',full_page=True)
 finally:
  print(json.dumps({'final':page.evaluate('window.__tensorChain'),'errors':errors,'body':page.locator('body').inner_text()[:500]}))
  b.close()
