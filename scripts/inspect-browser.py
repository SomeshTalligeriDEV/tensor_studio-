from playwright.sync_api import sync_playwright
import json
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':1440,'height':1000})
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.on('console',lambda m: errors.append(m.text) if m.type=='error' else None)
 page.goto('http://localhost:5173/scan?network=finney',wait_until='networkidle',timeout=60000)
 print(json.dumps({'errors':errors,'body':page.locator('body').inner_text()[:5000]}))
 page.screenshot(path='artifacts/bscan-inspect.png',full_page=True)
 b.close()
