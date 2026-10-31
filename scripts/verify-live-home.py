"""Live read-only network panel and responsive theme checks."""
import json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width':1440,'height':1050})
    page = context.new_page()
    errors=[]
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:5173/', wait_until='domcontentloaded')
    head = page.get_by_test_id('live-head')
    head.wait_for(timeout=60000)
    first = head.inner_text()
    page.wait_for_function('(first) => document.querySelector("[data-testid=live-head]")?.textContent !== first', arg=first, timeout=45000)
    second=head.inner_text()
    assert int(second.replace(',','')) > int(first.replace(',',''))
    page.screenshot(path='artifacts/home-live-desktop.png',full_page=True)
    page.get_by_label('Live network', exact=True).select_option('test')
    page.wait_for_function('() => document.querySelector("[data-testid=live-head]")?.getAttribute("href").endsWith("network=test")', timeout=60000)
    test_head=head.inner_text()
    page.set_viewport_size({'width':390,'height':844})
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
    page.screenshot(path='artifacts/home-live-mobile.png', full_page=True)
    page.get_by_role('button',name='Toggle light and dark theme').click()
    page.wait_for_timeout(350)
    page.screenshot(path='artifacts/home-live-mobile-theme.png',full_page=True)
    page.locator('.studio-network-panel').scroll_into_view_if_needed()
    page.screenshot(path='artifacts/home-live-network-mobile.png',full_page=True)
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
    context.set_offline(True)
    page.get_by_role('button',name='Reconnect',exact=True).wait_for(timeout=55000)
    assert page.get_by_role('status').filter(has_text='Live').count() == 0
    context.set_offline(False)
    page.evaluate('() => Array.from(document.querySelectorAll("button")).find(button => button.textContent === "Reconnect")?.click()')
    page.locator('.studio-network-status').filter(has_text='Live').wait_for(timeout=60000)
    head.click()
    page.get_by_role('heading',name='Block details',exact=True).wait_for(timeout=30000)
    assert 'network=test' in page.url
    assert not errors, errors
    print(json.dumps({'finney_heads':[first,second],'testnet_head':test_head,'offline_recovery':True,'mobile_overflow':False,'page_errors':errors}))
    browser.close()
