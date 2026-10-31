import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':1280,'height':900})
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.goto('http://localhost:5173/scan?network=finney',wait_until='domcontentloaded')
 page.locator('.scan-feed-row').first.wait_for(timeout=90000)
 page.wait_for_function('''async () => { return await new Promise(resolve => { const r=indexedDB.open('tensorstudio-explorer',1);r.onsuccess=()=>{const db=r.result;const q=db.transaction('chains').objectStore('chains').getAll();q.onsuccess=()=>{db.close();resolve(q.result.some(v=>v.length>=8));};q.onerror=()=>resolve(false);};r.onerror=()=>resolve(false);}); }''',timeout=120000)
 stored=page.evaluate('''async () => await new Promise(resolve=>{const r=indexedDB.open('tensorstudio-explorer',1);r.onsuccess=()=>{const db=r.result;const q=db.transaction('chains').objectStore('chains').getAll();q.onsuccess=()=>{db.close();resolve(q.result.map(v=>({count:v.length,head:v[0]?.number})));};};})''')
 print(json.dumps({'stored':stored}),flush=True)
 page.reload(wait_until='domcontentloaded')
 page.locator('.scan-feed-row').first.wait_for(timeout=90000)
 page.screenshot(path='artifacts/bscan-cached.png',full_page=True)
 page.locator('.scan-feed-main small a').first.click()
 page.get_by_role('heading',name='Account details').wait_for(timeout=30000)
 print(json.dumps({'account_url':page.url,'account':page.locator('.scan-account-stats').inner_text()}),flush=True)
 page.goto('http://localhost:5173/scan/subnet/1?network=test',wait_until='domcontentloaded')
 page.get_by_role('heading',name='Subnet neurons').wait_for(timeout=90000)
 print(json.dumps({'subnet_rows':page.locator('tbody tr').count(),'errors':errors}),flush=True)
 page.screenshot(path='artifacts/bscan-subnet.png',full_page=True)
 b.close()
