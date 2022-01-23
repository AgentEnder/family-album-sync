import * as puppeteer from 'puppeteer';
import { prompt } from 'enquirer';
import { join } from 'path';
import { resolve } from 'path/win32';

const downloadPath = join(__dirname, '../..', 'downloads');
let filesDownloaded = 0;

export async function sync(): Promise<void> {
  const familyAlbumUrl = process.env['FAS_BASEURL'] || 'https://mitene.us'
  const familyAlbumKey = process.env['FAS_ALBUMKEY'] || (await prompt<{ key: string }>({
    type: 'text',
    name: 'key',
    message: 'What album'
  })).key
  const familyAlbumPassword = process.env['FAS_PASSWORD'] || (await prompt<{ pwd: string }>({
    type: 'password',
    name: 'pwd',
    message: 'Password'
  })).pwd

  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage();
  await page.client().send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath
  });

  await page.goto(`${familyAlbumUrl}/f/${familyAlbumKey}`, { waitUntil: 'networkidle0' });
  await page.type('#session_password', familyAlbumPassword);
  await page.click('[value=Login]')
  await page.waitForNetworkIdle();
  while(true) {
    const uuids = await page.$$eval('.media-thumbnail-container', els => els.map(el => el.getAttribute('data-media-file-uuid')));
    for (const mediaUUID of uuids) {
      console.log('Opening Image', mediaUUID)
      const selector = `[data-media-file-uuid="${mediaUUID}"]`
      await page.waitForSelector(selector, {visible: true})
      await page.click(selector);
      await page.waitForSelector('.download-button')
      await page.click('.download-button');
      console.log('Started Download')
      filesDownloaded++;
      await page.waitForSelector('.close-button', { visible: true })
      await page.click('.close-button')
      await page.waitForSelector('.close-button', { hidden: true })
      console.log('Closing image')
    }
    console.log('Finished page')
    const nextLink = await page.$('.follower-paging-next-link');
    if (await nextLink?.evaluate(el => el.classList.contains('disabled'))) {
      console.log('Finished scanning images')
      break;
    }
    await nextLink?.click();
    await page.waitForNetworkIdle()
  }
  console.log(`Downloaded ${filesDownloaded} to ${resolve(downloadPath)}`)
}
