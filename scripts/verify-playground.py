"""Browser checks without pretending an extension or localnet exists."""
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:5173/playground?network=test', wait_until='domcontentloaded')
    page.get_by_role('heading', name='Test TAO & funding').wait_for(timeout=60000)
    assert page.get_by_role('link', name='Official testnet guidance').get_attribute('href') == 'https://guides.learnbittensor.org/concepts/bittensor-networks'
    assert page.get_by_role('link', name='Official Bittensor community').get_attribute('href') == 'https://discord.gg/qasY3HA9F9'
    assert page.get_by_role('button', name='Get 1,000 local test TAO').count() == 0
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Mobile overflow'
    page.screenshot(path='artifacts/playground-testnet-mobile.png', full_page=True)
    page.get_by_label('Playground network', exact=True).select_option('local')
    button = page.get_by_role('button', name='Get 1,000 local test TAO')
    button.wait_for()
    assert button.is_disabled()
    page.goto('http://localhost:5173/wallet?network=test', wait_until='domcontentloaded')
    page.get_by_text('Browser development wallet', exact=True).wait_for()
    assert page.get_by_role('button', name='Get 1,000 local test TAO').count() == 0
    assert not errors, errors
    print(json.dumps({'mobile_overflow': False, 'official_testnet_links': True, 'disconnected_local_funding_disabled': True, 'funding_only_in_playground': True, 'page_errors': errors}))
    browser.close()
