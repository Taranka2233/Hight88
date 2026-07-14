import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

HTML = Path('/mnt/data/night-city-net/dist/index.html').read_text(encoding='utf-8')
OUT = Path('/mnt/data/night-city-net/test-artifacts')
OUT.mkdir(exist_ok=True)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        context = await browser.new_context(viewport={'width': 360, 'height': 800}, device_scale_factor=1)
        page = await context.new_page()
        page.set_default_timeout(6000)
        console_errors = []
        page_errors = []
        page.on('console', lambda msg: console_errors.append(msg.text) if msg.type == 'error' else None)
        page.on('pageerror', lambda err: page_errors.append(str(err)))
        await page.evaluate("""Object.defineProperty(window,'localStorage',{configurable:true,value:{_d:{},getItem(k){return Object.prototype.hasOwnProperty.call(this._d,k)?this._d[k]:null},setItem(k,v){this._d[k]=String(v)},removeItem(k){delete this._d[k]},clear(){this._d={}}}});""")

        print('set content'); await page.set_content(HTML, wait_until='load')
        await page.wait_for_selector('.auth-screen'); print('auth visible')
        assert await page.locator('.auth-screen').count() == 1
        await page.locator('#email').fill('operator@ncn.net')
        await page.locator('#password').fill('secure-key')
        await page.locator('.primary-button').click(); print('login clicked')
        await page.wait_for_selector('.chat-list-panel'); print('list visible')
        await page.screenshot(path=str(OUT / 'mobile-chat-list.png'), full_page=True)

        await page.locator('.chat-item').first.click(); print('chat clicked')
        await page.wait_for_selector('.conversation-panel .chat-header'); print('conversation visible')
        await page.wait_for_timeout(150)
        assert await page.locator('.message-row').count() >= 4

        hit = page.locator('[data-message-hit]').first
        await hit.dispatch_event('pointerdown', {'pointerId': 11, 'pointerType': 'touch', 'button': 0, 'clientX': 120, 'clientY': 300})
        await page.wait_for_timeout(620)
        await page.locator('#app').dispatch_event('pointerup', {'pointerId': 11, 'pointerType': 'touch', 'button': 0, 'clientX': 120, 'clientY': 300})
        await page.wait_for_selector('.selection-header'); print('selection visible')
        assert (await page.locator('.selection-count strong').inner_text()).strip() == '1'
        await page.locator('.message-row').nth(2).click(); print('second selected')
        assert (await page.locator('.selection-count strong').inner_text()).strip() == '2'
        await page.screenshot(path=str(OUT / 'mobile-selection.png'), full_page=True)
        await page.locator('[data-action="selection-clear"]').click()
        assert await page.locator('.selection-header').count() == 0

        composer = page.locator('[data-role="composer-input"]')
        await composer.fill('Smoke test message'); print('composer filled')
        await page.locator('form[data-action="send-message"] .send-button').click()
        await page.wait_for_timeout(250)
        assert await page.get_by_text('Smoke test message', exact=True).count() == 1

        overflow_360 = await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        assert overflow_360

        await page.set_viewport_size({'width': 320, 'height': 640})
        await page.set_content(HTML, wait_until='load')
        await page.wait_for_selector('.chat-list-panel')
        assert await page.locator('.chat-list-panel').count() == 1
        assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        await page.screenshot(path=str(OUT / 'mobile-320.png'), full_page=True)

        await page.set_viewport_size({'width': 800, 'height': 360})
        await page.set_content(HTML, wait_until='load')
        await page.wait_for_selector('.chat-list-panel')
        await page.locator('.chat-item').first.click()
        await page.wait_for_timeout(150)
        assert await page.locator('.composer-wrap').count() == 1
        assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        await page.screenshot(path=str(OUT / 'landscape.png'), full_page=True)

        await page.set_viewport_size({'width': 1440, 'height': 900})
        await page.set_content(HTML, wait_until='load')
        await page.wait_for_selector('.chat-header')
        await page.wait_for_timeout(200)
        assert await page.locator('.details-panel').count() == 1
        assert await page.locator('.chat-header').count() == 1
        await page.locator('[data-chat-id="chat-group-1"]').click()
        await page.wait_for_timeout(160)
        assert 'Afterlife / Core' in await page.locator('.header-title').inner_text()
        await page.locator('[data-chat-id="chat-channel-1"]').click()
        await page.wait_for_timeout(160)
        assert 'Broadcast' in await page.locator('.header-title').inner_text()
        await page.evaluate("document.documentElement.style.fontSize='24px'")
        assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        assert await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
        await page.screenshot(path=str(OUT / 'desktop.png'), full_page=True)

        if console_errors or page_errors:
            raise AssertionError(f'console_errors={console_errors}, page_errors={page_errors}')
        print('UI smoke OK: mobile auth/list/chat/selection/send, 320px, landscape, desktop')
        await browser.close()

asyncio.run(main())
