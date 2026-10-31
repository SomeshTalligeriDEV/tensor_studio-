"""One live generation; captures build diagnostics and checks the produced preview."""
import json, time
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
 b=p.chromium.launch(headless=True)
 page=b.new_page(viewport={'width':1440,'height':1000})
 errors=[]; logs=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.on('console',lambda m: logs.append(m.text))
 page.goto('http://localhost:5173/editor',wait_until='domcontentloaded')
 page.locator('textarea').first.wait_for(timeout=60000)
 page.locator('textarea').first.fill('Build a minimal todo list with add, checkbox completion and delete buttons, persisting in localStorage. Use vanilla HTML/CSS/JS and Vite 5.3.1. Create package.json, index.html, main.js and style.css; install dependencies and run npm run dev -- --host 0.0.0.0. Keep code under 150 lines. Do not use any external APIs or images.')
 page.get_by_role('button',name='Send message',exact=True).click()
 deadline=time.monotonic()+180
 preview=None
 while time.monotonic()<deadline:
  if page.get_by_role('button',name='Preview',exact=True).count():
   page.get_by_role('button',name='Preview',exact=True).click()
  for frame in page.frames:
   if 'local-corp.webcontainer-api.io' in frame.url:
    preview=frame; break
  if preview: break
  page.wait_for_timeout(1000)
 print(json.dumps({'preview_found':bool(preview),'frames':[f.url for f in page.frames],'errors':errors,'logs':logs[-35:],'body':page.locator('body').inner_text()[-5000:]}),flush=True)
 page.screenshot(path='artifacts/editor-preview-diagnostic.png',full_page=True)
 if preview:
  field=preview.locator('input:not([type=checkbox]):not([type=hidden])').first
  field.wait_for(timeout=30000)
  field.fill('Verify real task persistence')
  field.press('Enter')
  if not preview.get_by_text('Verify real task persistence',exact=True).count():
   preview.get_by_role('button',name='Add',exact=False).first.click()
  preview.get_by_text('Verify real task persistence',exact=True).wait_for(timeout=10000)
  preview.locator('input[type=checkbox]').last.check()
  assert preview.locator('input[type=checkbox]').last.is_checked()
  preview.evaluate('location.reload()')
  preview.get_by_text('Verify real task persistence',exact=True).wait_for(timeout=20000)
  assert preview.locator('input[type=checkbox]').last.is_checked()
  print(json.dumps({'add_complete_persist':True}),flush=True)
  page.screenshot(path='artifacts/editor-live-todo-preview.png',full_page=True)
 b.close()
