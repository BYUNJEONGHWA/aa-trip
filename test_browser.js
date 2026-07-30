const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function testBrowser() {
  console.log('--- Launching Chromium to inspect localhost:3030 map rendering ---');
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    page.on('console', (msg) => console.log('BROWSER LOG:', msg.type(), msg.text()));
    page.on('pageerror', (err) => console.error('BROWSER PAGE ERROR:', err.message));

    page.on('requestfailed', (req) => {
      console.log('REQ FAILED:', req.url(), req.failure()?.errorText);
    });

    page.on('response', async (res) => {
      const url = res.url();
      if (url.includes('naver') || url.includes('ntruss') || url.includes('maps')) {
        console.log('HTTP RESPONSE:', res.status(), url);
      }
    });

    console.log('Navigating to http://localhost:3030 ...');
    await page.goto('http://localhost:3030', { waitUntil: 'networkidle', timeout: 15000 });
    console.log('Page loaded! Waiting 4 seconds...');
    await page.waitForTimeout(4000);

    const screenshotPath = 'C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\7281292b-8295-4439-af84-bf180d25b9b6\\media__browser_shot.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log('Screenshot saved to:', screenshotPath);
  } catch (err) {
    console.error('Test browser error:', err);
  } finally {
    if (browser) await browser.close();
  }
}

testBrowser();
