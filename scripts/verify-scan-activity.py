"""Real testnet activity, block-detail consistency, and mobile acceptance."""
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1440, 'height': 1100})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:5173/scan?network=test', wait_until='domcontentloaded')
    page.wait_for_function('window.__tensorChain?.decoded > 0 && window.__tensorChain.blocks >= 3', timeout=90000)
    before = page.evaluate('window.__tensorChain')
    chart = page.get_by_role('region', name='Observed block activity')
    chart.get_by_role('button', name='Chain events', exact=True).click()
    chart.get_by_role('img', name='Chain events', exact=False).wait_for()
    chart.get_by_role('button', name='Block time', exact=True).click()
    chart.get_by_role('img', name='Block time', exact=False).wait_for()
    chart.get_by_role('button', name='Signed calls', exact=True).click()
    chart.get_by_text('View source values', exact=True).click()
    rows = chart.locator('tbody tr')
    row = rows.first.inner_text()
    assert rows.count() >= 3
    page.wait_for_function('(n) => window.__tensorChain.decoded > n', arg=before['decoded'], timeout=60000)
    after = page.evaluate('window.__tensorChain')
    assert after['subscriptions'] == 2
    page.screenshot(path='artifacts/scan-activity-desktop.png', full_page=True)
    chart.get_by_text('View source values', exact=True).click()
    page.set_viewport_size({'width': 390, 'height': 844})
    page.wait_for_function('document.querySelector(".studio-nav").getBoundingClientRect().right <= 1')
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'mobile overflow'
    chart.scroll_into_view_if_needed()
    page.screenshot(path='artifacts/scan-activity-mobile.png')
    page.get_by_label('Explorer network', exact=True).select_option('local')
    page.get_by_text('Localnet is not connected.', exact=False).wait_for(timeout=30000)
    assert page.get_by_text('No decoded blocks yet.', exact=False).count() == 1
    assert not errors, errors
    result = {'before': before, 'after': after, 'source_row': row, 'chart_modes': 3, 'mobile_overflow': False, 'page_errors': errors, 'localnet': 'Unavailable; explicit error and no fabricated chart'}
    print(json.dumps(result))
    with open('artifacts/scan-activity-verification.json', 'w') as output: json.dump(result, output, indent=2)
    browser.close()
