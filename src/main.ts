import { chromium } from 'playwright';

(async () => {
  // ブラウザを起動
  const browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  console.log('ブラウザを起動しました。');

  // 新しいページを作成
  const page = await browser.newPage();
  console.log('ページを作成しました。https://example.com にアクセスします...');

  // 指定したURLに移動
  await page.goto('https://example.com');
  console.log(`アクセス成功: ページのタイトルは "${await page.title()}" です。`);

  // ブラウザを閉じる
  await browser.close();
  console.log('ブラウザを閉じました。');
})();
