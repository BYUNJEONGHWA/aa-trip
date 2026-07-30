const { chromium } = require('playwright');

async function findBookmarkSource() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('.png') || url.includes('.pbf') || url.includes('.css') || url.includes('.jpg')) return;

    try {
      const text = await res.text();
      if (text.includes('1434254725') || text.includes('서울편백찜') || text.includes('cc77d75ff5654b95b6e247405ddd63b4')) {
        console.log('\n========================================');
        console.log('MATCHING API URL:', url);
        console.log('STATUS:', res.status());
        console.log('PAYLOAD SNIPPET:', text.substring(0, 2500));
        console.log('========================================\n');
      }
    } catch (e) {}
  });

  console.log('Going to https://naver.me/5t7jn5c6 ...');
  await page.goto('https://naver.me/5t7jn5c6', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);

  await browser.close();
}

findBookmarkSource().catch(console.error);
