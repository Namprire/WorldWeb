import { chromium } from 'playwright';
import { mkdir, writeFile, rename, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = 'assets/launch';
const base = process.env.WEBWORLD_URL || 'http://127.0.0.1:5179';
for (const dir of ['screenshots', 'video', 'source']) await mkdir(`${root}/${dir}`, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const shots = [], clips = [], errors = [];
const retake = process.argv.includes('--retake-rides');
const discoveryRetake = process.argv.includes('--retake-discovery');
const nightTitle = process.argv.includes('--night-title');
if (retake || discoveryRetake || nightTitle) {
  const previous = JSON.parse(await readFile(`${root}/manifest.json`, 'utf8'));
  const replaceShots = nightTitle ? [] : retake ? ['03-autumn-scooter-clean', '09-northern-lights-scooter', '10-northern-lights-exhibits'] : ['04-company-search', '05-company-profile', '06-helsinki-city-view'];
  const replaceClips = nightTitle ? ['01-title-to-game'] : retake ? ['02-autumn-scooter', '06-northern-lights-scooter'] : ['03-company-discovery', '04-helsinki-city-view'];
  shots.push(...previous.shots.filter(s => !replaceShots.some(n => s.file.includes(n))));
  clips.push(...previous.clips.filter(c => !replaceClips.some(n => c.file.includes(n))));
}
const wait = (p, ms) => p.waitForTimeout(ms);
const state = p => p.evaluate(() => window.__webworldEngine.getSnapshot());
async function screenshot(p, name, description) {
  await p.mouse.move(1910, 1050);
  await p.screenshot({ path: `${root}/screenshots/${name}.png` });
  shots.push({ file: `screenshots/${name}.png`, description, state: await state(p) });
  console.log('Screenshot:', name);
}
async function session(name, query = '') {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1,
    recordVideo: { dir: `${root}/source`, size: { width: 1920, height: 1080 } } });
  const p = await context.newPage();
  const origin = Date.now();
  p.on('pageerror', e => errors.push(e.message));
  await p.goto(`${base}/?q=1&${query}`);
  await p.waitForFunction(() => !!window.__webworld);
  await p.waitForFunction(() => Number(getComputedStyle(document.getElementById('loading')).opacity) < .01);
  await p.evaluate(() => document.fonts.ready);
  // Capture-only styling suppresses temporary control tips, preserving attribution.
  await p.addStyleTag({ content: '#toast { display: none !important; }' });
  await wait(p, 1800);
  return { p, context, origin, name, segments: [] };
}
async function segment(s, name, description, action) {
  console.log('Recording:', name);
  const start = (Date.now() - s.origin) / 1000;
  await action();
  s.segments.push({ file: `video/${name}.mp4`, description, start, duration: (Date.now() - s.origin) / 1000 - start });
}
async function finish(s) {
  const video = s.p.video();
  await s.context.close();
  const source = `${root}/source/${s.name}.webm`;
  await rename(await video.path(), source);
  for (const clip of s.segments) {
    const args = ['-hide_banner', '-loglevel', 'error', '-y', '-ss', clip.start.toFixed(3), '-i', source,
      '-t', clip.duration.toFixed(3), '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '18',
      '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', `${root}/${clip.file}`];
    const result = spawnSync('ffmpeg', args, { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr);
    clips.push({ ...clip, source: `source/${s.name}.webm` });
    console.log('Exported:', clip.file);
  }
}
async function ride(p) {
  await p.click('#enter');
  await p.waitForFunction(() => window.__webworldEngine.getSnapshot().state === 'ride', null, { timeout: 30000 });
}
async function key(p, name, ms) { await p.keyboard.down(name); await wait(p, ms); await p.keyboard.up(name); }
try {
  if (nightTitle) {
    const s = await session('northern-lights-title-transition', 'environment=aurora');
    await segment(s, '01-title-to-game', 'Northern lights: actual continuous night title-to-game camera transition.', async () => {
      await wait(s.p, 1200); await ride(s.p); await key(s.p, 's', 1800);
    });
    if ((await state(s.p)).environment !== 'aurora') throw new Error('Expected northern lights environment');
    await finish(s);
  } else if (discoveryRetake) {
    const s = await session('company-discovery', 'environment=autumn');
    const p = s.p;
    await ride(p);
    await p.evaluate(() => window.__webworldEngine.setUIFocus(true));
    await segment(s, '03-company-discovery', 'Search for Varjo and open its sourced company profile in the square.', async () => {
      await p.click('#discover-toggle'); await wait(p, 1000);
      await p.locator('#company-query').pressSequentially('Varjo', { delay: 180 }); await wait(p, 1400);
      await screenshot(p, '04-company-search', 'Company search over the open Helsinki square.');
      await p.locator('.company-result').click(); await wait(p, 2400);
      await screenshot(p, '05-company-profile', 'Varjo profile over the open Helsinki square.');
      await wait(p, 1700);
    });
    await p.keyboard.press('Escape');
    if (!(await p.locator('#discovery-search').isVisible())) await p.click('#discover-toggle');
    await p.fill('#company-query', ''); await p.click('#search-close');
    await segment(s, '04-helsinki-city-view', 'Rise to the Helsinki atlas with the complete company collection.', async () => {
      await p.click('#map-toggle'); await wait(p, 4500);
      await screenshot(p, '06-helsinki-city-view', 'Full Helsinki company atlas with all search filters cleared.');
      await wait(p, 3500);
    });
    await finish(s);
  } else if (retake) {
    for (const [environment, number, screenshotNumber] of [['autumn', '02', '03'], ['aurora', '06', '09']]) {
      const s = await session(`${environment}-square-ride`, `environment=${environment}`);
      const p = s.p;
      await ride(p);
      // The scooter rolls even without throttle: hold it while theater UI fades.
      await p.evaluate(() => window.__webworldEngine.setUIFocus(true));
      await p.keyboard.press('t'); await wait(p, 3500);
      await segment(s, `${number}-${environment === 'autumn' ? 'autumn' : 'northern-lights'}-scooter`, 'Clean scooter ride north through the open exhibition square.', async () => {
        await screenshot(p, environment === 'autumn' ? '03-autumn-scooter-clean' : '09-northern-lights-scooter', 'Theater-mode scooter ride through the open Helsinki square.');
        await p.evaluate(() => window.__webworldEngine.setUIFocus(false));
        await key(p, 'w', 2800);
        await p.keyboard.down('s'); await wait(p, 2200);
        if (environment === 'aurora') await screenshot(p, '10-northern-lights-exhibits', 'Northern lights above the company exhibition square.');
        await wait(p, 1500); await p.keyboard.up('s');
      });
      await finish(s);
    }
  } else {
  const autumn = await session('autumn-gameplay', 'environment=autumn');
  const p = autumn.p;
  await screenshot(p, '01-autumn-title', 'Framed autumn city and WEB WORLD title.');
  await segment(autumn, '01-title-to-game', 'Actual continuous title-to-game camera transition.', async () => {
    await wait(p, 1200); await ride(p); await wait(p, 1800);
  });
  await screenshot(p, '02-autumn-gameplay', 'Scooter in the square with the normal game HUD.');
  await p.keyboard.press('t'); await wait(p, 3600);
  await segment(autumn, '02-autumn-scooter', 'Clean theater-mode scooter ride toward company exhibits.', async () => {
    await key(p, 'w', 4500); await screenshot(p, '03-autumn-scooter-clean', 'Autumn scooter riding with theater mode enabled.');
    await key(p, 'w', 4500); await key(p, 's', 1000); await wait(p, 1200);
  });
  await p.keyboard.press('t'); await wait(p, 500);
  await segment(autumn, '03-company-discovery', 'Search for Varjo and open its sourced company profile.', async () => {
    await p.click('#discover-toggle'); await wait(p, 1500);
    await p.locator('#company-query').pressSequentially('Varjo', { delay: 180 }); await wait(p, 1500);
    await screenshot(p, '04-company-search', 'Company discovery search for Varjo.');
    await p.locator('.company-result').click(); await wait(p, 3000);
    await screenshot(p, '05-company-profile', 'Varjo company profile in the live city.');
    await wait(p, 1500);
  });
  await p.keyboard.press('Escape');
  if (await p.locator('#discovery-search').isVisible()) await p.click('#search-close');
  await segment(autumn, '04-helsinki-city-view', 'Rise to the Helsinki company atlas, hold the full city view.', async () => {
    await p.click('#map-toggle'); await wait(p, 5500);
    await screenshot(p, '06-helsinki-city-view', 'Top-down Helsinki city view with company locations.');
    await wait(p, 4000);
  });
  await p.keyboard.press('Escape'); await wait(p, 2000);
  await p.keyboard.press('t'); await wait(p, 3500);
  await segment(autumn, '05-autumn-flight', 'Launch from the scooter and fly above the autumn city.', async () => {
    for (let i = 0; i < 3; i++) { await p.keyboard.press('Space'); await wait(p, 120); }
    await key(p, 'Space', 3500); await key(p, 'w', 2500);
    await screenshot(p, '07-autumn-flight', 'Player flying above painted Helsinki.');
    await wait(p, 2000);
  });
  console.log('Autumn final state:', JSON.stringify(await state(p)));
  await finish(autumn);

  const night = await session('northern-lights-gameplay', 'environment=aurora');
  await screenshot(night.p, '08-northern-lights-title', 'Northern lights title painting.');
  await ride(night.p); await night.p.keyboard.press('t'); await wait(night.p, 3500);
  await segment(night, '06-northern-lights-scooter', 'Clean scooter ride beneath the animated northern lights.', async () => {
    await screenshot(night.p, '09-northern-lights-scooter', 'Scooter beneath the aurora in theater mode.');
    await key(night.p, 'w', 6000); await key(night.p, 's', 1000); await wait(night.p, 2500);
    await screenshot(night.p, '10-northern-lights-exhibits', 'Northern lights and company exhibits.');
  });
  await finish(night);

  const park = await session('autumn-park', 'environment=autumn&cam=80,3,-280,10,-4,65,0');
  await screenshot(park.p, '11-autumn-park', 'Clean view into Kaisaniemi Park using the existing free-camera preview.');
  await segment(park, '07-autumn-park-atmosphere', 'Autumn park atmosphere, foliage and falling leaves; fixed scenic camera.', async () => { await wait(park.p, 10000); });
  await finish(park);
  }
} finally {
  await browser.close();
  await writeFile(`${root}/manifest.json`, JSON.stringify({ capturedAt: new Date().toISOString(), base,
    width: 1920, height: 1080, videoFormat: 'H.264 MP4, 30 fps export, no audio', shots, clips, errors }, null, 2));
}
if (errors.length) throw new Error(`Runtime errors: ${errors.join('; ')}`);
console.log(`Finished: ${shots.length} screenshots, ${clips.length} clips.`);
