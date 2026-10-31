import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':1440,'height':1000})
 errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.goto('http://localhost:5173/',wait_until='networkidle',timeout=60000)
 page.get_by_label('Describe your idea').fill('Suggest a tiny todo list web app. Keep it simple and provide only one app suggestion.')
 page.get_by_role('button',name='Explore idea',exact=True).click()
 page.get_by_role('button',name='Start building',exact=True).first.wait_for(timeout=90000)
 print(json.dumps({'ask':page.locator('.idea-answer').inner_text()[:1200]}),flush=True)
 page.get_by_role('button',name='Start building',exact=True).first.click()
 page.wait_for_url('**/editor',timeout=30000)
 page.wait_for_load_state('networkidle',timeout=60000)
 page.screenshot(path='artifacts/editor-handoff.png',full_page=True)
 print(json.dumps({'editor':page.locator('body').inner_text()[:4500], 'errors':errors}),flush=True)
 b.close()
