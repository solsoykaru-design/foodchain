const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async () => {
  const html = fs.readFileSync(path.join(__dirname, 'techcard-preview.html'), 'utf-8');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: path.join(__dirname, 'techcard-borsh.pdf'),
    format: 'A4',
    printBackground: true,
    margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' },
  });
  await browser.close();
  console.log('PDF created: techcard-borsh.pdf');
})();
