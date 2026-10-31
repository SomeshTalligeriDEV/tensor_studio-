"""Exercise real authenticated HTTP and WebSocket runner access through the UI."""
import json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1360, 'height': 900})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:5173/runner', wait_until='networkidle')
    page.get_by_role('button', name='Run command', exact=True).click()
    page.wait_for_function("document.querySelector('[aria-label=\"Runner output\"]')?.textContent.includes('Exited with code 0')", timeout=20000)
    output = page.get_by_label('Runner output').inner_text()
    assert 'Python 3.11' in output, output
    page.screenshot(path='artifacts/runner-authenticated-terminal.png', full_page=True)
    page.goto('http://localhost:5173/nodes', wait_until='networkidle')
    assert not errors, errors
    print(json.dumps({'terminal': output, 'page_errors': errors}))
    browser.close()
