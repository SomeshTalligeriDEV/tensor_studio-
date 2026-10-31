import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page()
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.on('console',lambda m: errors.append(m.text) if m.type=='error' else None)
 page.on('framenavigated',lambda f: print('nav',f.url,flush=True) if f==page.main_frame else None)
 page.goto('http://localhost:5173/editor',wait_until='domcontentloaded',timeout=60000)
 try: page.locator('textarea').first.wait_for(timeout=20000)
 except Exception: pass
 print(json.dumps({'url':page.url,'body':page.locator('body').inner_text()[:4000],'errors':errors}),flush=True)
 page.screenshot(path='artifacts/editor-inspect.png',full_page=True)
 b.close()
