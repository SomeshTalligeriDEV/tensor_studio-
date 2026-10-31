"""Read-only live browser smoke checks; never creates wallets or submits chain writes."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width":1440,"height":1000}, color_scheme="light")
    page = context.new_page()
    errors=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:5173/scan?network=finney', wait_until='domcontentloaded')
    page.get_by_role('heading', name='The Bittensor blockchain explorer').wait_for(timeout=60000)
    page.locator('.scan-feed-row').first.wait_for(timeout=90000)
    page.screenshot(path='artifacts/bscan-desktop.png',full_page=True)
    print(json.dumps({'overview':page.locator('.scan-metrics').inner_text(),'errors':errors}))
    page.locator('.scan-feed-row a').first.click()
    page.get_by_role('heading',name='Block details').wait_for(timeout=30000)
    page.locator('.scan-definition').wait_for(timeout=30000)
    page.screenshot(path='artifacts/bscan-block.png',full_page=True)
    print(json.dumps({'block_url':page.url,'detail':page.locator('.scan-definition').inner_text()[:500]}))
    page.locator('.scan-table-wrap tbody tr a').first.click()
    page.get_by_role('heading',name='Transaction details').wait_for(timeout=30000)
    print(json.dumps({'transaction_url':page.url,'transaction':page.locator('.scan-definition').inner_text()[:400]}))
    page.set_viewport_size({'width':390,'height':844})
    page.goto('http://localhost:5173/scan?network=finney',wait_until='domcontentloaded')
    page.get_by_role('heading',name='The Bittensor blockchain explorer').wait_for(timeout=30000)
    page.screenshot(path='artifacts/bscan-mobile.png',full_page=True)
    print(json.dumps({'mobile_overflow':page.evaluate('document.documentElement.scrollWidth > innerWidth')}))
    page.goto('http://localhost:5173/nodes',wait_until='domcontentloaded')
    page.wait_for_selector('text=Local processes',timeout=30000)
    page.screenshot(path='artifacts/nodes-mobile.png',full_page=True)
    print(json.dumps({'node_page':page.locator('main').inner_text()[:500],'errors':errors}))
    browser.close()
