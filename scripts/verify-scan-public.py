"""Verify the standalone explorer recovers stale local URLs and streams real testnet data."""
import json, os
from playwright.sync_api import sync_playwright
base=os.environ.get('SCAN_URL','http://localhost:10000')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,channel='chrome')
 page=browser.new_page(viewport={'width':1600,'height':1100})
 errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base+'/scan?network=local',wait_until='networkidle')
 page.wait_for_function('window.__tensorChain?.network === "test" && window.__tensorChain.decoded > 0 && window.__tensorChain.blocks >= 3',timeout=90000)
 before=page.evaluate('window.__tensorChain')
 assert 'network=test' in page.url,page.url
 text=page.locator('body').inner_text()
 assert 'CoinGecko' not in text and 'CoinGeco' not in text
 assert 'Polkadot.js' not in text and 'Localnet is not connected' not in text
 assert page.get_by_label('Explorer network',exact=True).locator('option[value="local"]').count()==0
 page.get_by_text('Market data by TAO.com',exact=False).wait_for(timeout=20000)
 page.wait_for_function('document.querySelector(".scan-network-art")?.naturalWidth > 0')
 page.locator('.scan-proof summary').click()
 page.get_by_text('RPC endpoint',exact=True).wait_for()
 assert 'wss://test.finney.opentensor.ai' in page.locator('.scan-proof-body').inner_text()
 assert before['genesis'] in page.locator('.scan-proof-body').inner_text()
 page.locator('.scan-proof summary').click()
 page.wait_for_function('(height)=>window.__tensorChain.decoded>height',arg=before['decoded'],timeout=60000)
 after=page.evaluate('window.__tensorChain')
 page.screenshot(path='artifacts/scan-public-desktop.png',full_page=True)
 icon=page.locator('.scan-row-symbol > span').first
 assert icon.evaluate('(e)=>getComputedStyle(e).maskImage !== "none" || getComputedStyle(e).backgroundImage !== "none"'),'missing feed icons'
 page.get_by_label('Toggle color theme',exact=True).click()
 page.screenshot(path='artifacts/scan-public-dark.png',full_page=True)
 inactive=page.locator('.scan-chart-tabs button[aria-pressed="false"]').first
 assert inactive.evaluate('(e)=>{const s=getComputedStyle(e);return s.backgroundColor !== "rgb(239, 239, 239)" && s.color !== s.backgroundColor;}'),'dark controls contrast'
 page.set_viewport_size({'width':390,'height':844})
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),'mobile overflow'
 page.screenshot(path='artifacts/scan-public-mobile.png',full_page=True)
 assert not errors,errors
 print(json.dumps({'url':page.url,'before':before,'after':after,'page_errors':errors,'mobile_overflow':False}))
 browser.close()
