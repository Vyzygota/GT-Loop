/**
 * Smoke test: buduje grę, serwuje statyczny build i przegrywa 120 dób w headless Chromium,
 * klikając wyłącznie w interfejs. Kończy się błędem, gdy w konsoli pojawi się błąd.
 * Uruchomienie: npm run smoke [ziarno] [katalog-zrzutów]
 */
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import { mkdirSync } from 'node:fs';

const ziarno = process.argv[2] ?? '7';
const katalogZrzutow = process.argv[3] ?? '';
const sciezkaChromium = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

async function main(): Promise<void> {
  await build({ logLevel: 'error' });
  const serwer = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
  const url = serwer.resolvedUrls!.local[0];
  const przegladarka = await chromium.launch({ executablePath: sciezkaChromium, headless: true });
  const strona = await przegladarka.newPage({ viewport: { width: 1500, height: 1100 } });
  const bledy: string[] = [];
  strona.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') bledy.push(`[konsola:${m.type()}] ${m.text()}`);
  });
  strona.on('pageerror', (e) => bledy.push(`[pageerror] ${e.message}`));
  strona.on('requestfailed', (r) => bledy.push(`[request] ${r.url()} ${r.failure()?.errorText}`));
  if (katalogZrzutow) mkdirSync(katalogZrzutow, { recursive: true });

  await strona.goto(`${url}#ziarno=${encodeURIComponent(ziarno)}&szybko=1`);
  await strona.waitForSelector('svg.mapa');
  const start = Date.now();
  let loty = 0;
  let zrzutRaportu = false;
  for (let krok = 0; krok < 400; krok++) {
    // Koniec gry: modal końca albo raport z końcem.
    if (await strona.locator('[data-modal="koniec"]').count()) break;

    // Sprzedaj wszystko, co masz.
    for (let i = 0; i < 10; i++) {
      const b = strona.locator('button[data-akcja="sprzedaj-wszystko"]:not([disabled])').first();
      if (!(await b.count())) break;
      await b.click();
    }
    // Zatrudnij pierwszego kandydata, jeśli jest miejsce (i zwolnij kogoś co kilka lotów, żeby przećwiczyć akcję).
    if (loty % 7 === 6) {
      const zw = strona.locator('button[data-akcja="zwolnij"]').first();
      if (await zw.count()) await zw.click();
    }
    const zatrudnij = strona.locator('button[data-akcja="zatrudnij"]:not([disabled])').first();
    if (await zatrudnij.count()) await zatrudnij.click();
    // Zatankuj do pełna.
    const pelny = strona.locator('button[data-akcja="tankuj-pelny"]:not([disabled])');
    if (await pelny.count()) await pelny.click();
    // Kup ręcznie wpisaną ilość jednego towaru, potem „Max” innego.
    const wiersze = await strona.locator('table tbody tr[data-towar]').all();
    if (wiersze.length) {
      const w = wiersze[krok % wiersze.length];
      await w.locator('input[data-ilosc]').fill('5');
      const kup = strona.locator(`button[data-akcja="kup"][data-towar="${await w.getAttribute('data-towar')}"]:not([disabled])`);
      if (await kup.count()) await kup.click();
      const max = strona.locator('button[data-akcja="kup-max"]:not([disabled])');
      const n = await max.count();
      if (n) await max.nth((krok + 1) % n).click();
    }
    // Wybierz cel: wiersz tablicy cen w zasięgu, nie „tu”. Co trzeci lot użyj mapy.
    const cele = await strona.locator('tr[data-cel]').all();
    const dostepne: typeof cele = [];
    for (const c of cele) {
      const tekst = (await c.innerText()).replace(/\s+/g, ' ');
      if (tekst.includes('(tu)') || tekst.includes('poza zasięgiem')) continue;
      dostepne.push(c);
    }
    if (!dostepne.length) {
      // Brak planety w zasięgu: skocz na mapie do najbliższego węzła w zasięgu (np. punkt tankowania).
      const wezly = await strona.locator('svg.mapa g.wezel:not(.poza-zasiegiem)').all();
      let kliknieto = false;
      for (const w of wezly) {
        const id = await w.getAttribute('data-wezel');
        await w.dispatchEvent('click');
        const ok = await strona.locator('button[data-akcja="lec"]:not([disabled])').count();
        if (ok && id) {
          kliknieto = true;
          break;
        }
      }
      if (!kliknieto) throw new Error('Smoke: brak celu w zasięgu');
    } else if (krok % 3 === 2) {
      const id = await dostepne[krok % dostepne.length].getAttribute('data-cel');
      await strona.locator(`svg.mapa g.wezel[data-wezel="${id}"]`).dispatchEvent('click');
    } else {
      await dostepne[krok % dostepne.length].click();
    }
    if (katalogZrzutow && loty === 2) await strona.screenshot({ path: `${katalogZrzutow}/dok.png`, fullPage: true });
    let lec = strona.locator('button[data-akcja="lec"]:not([disabled])');
    if (!(await lec.count())) {
      // Trasa niewykonalna (np. brak gotówki na płace po zakupach): sprzedaj wszystko i spróbuj znów.
      for (let i = 0; i < 10; i++) {
        const b = strona.locator('button[data-akcja="sprzedaj-wszystko"]:not([disabled])').first();
        if (!(await b.count())) break;
        await b.click();
      }
      lec = strona.locator('button[data-akcja="lec"]:not([disabled])');
    }
    if (!(await lec.count())) {
      const wyczysc = strona.locator('button[data-akcja="wyczysc-trase"]:not([disabled])');
      if (await wyczysc.count()) await wyczysc.click();
      continue;
    }
    await lec.click();
    await strona.waitForSelector('[data-modal="raport"]', { timeout: 20000 });
    loty++;
    if (katalogZrzutow && !zrzutRaportu && loty >= 2) {
      await strona.screenshot({ path: `${katalogZrzutow}/raport.png`, fullPage: true });
      zrzutRaportu = true;
    }
    await strona.locator('button[data-akcja="zamknij-raport"]').click();
  }
  const koniec = await strona.locator('[data-modal="koniec"]').count();
  const doba = await strona.locator('#licznik-dob').innerText();
  if (katalogZrzutow) await strona.screenshot({ path: `${katalogZrzutow}/koniec.png`, fullPage: true });
  await przegladarka.close();
  await serwer.close();
  console.log(`Smoke: ziarno ${ziarno}, lotów ${loty}, licznik dób „${doba}”, ekran końca: ${koniec ? 'tak' : 'nie'}, ${((Date.now() - start) / 1000).toFixed(1)} s`);
  if (!koniec) {
    console.error('Smoke: gra nie doszła do końca');
    process.exit(1);
  }
  if (bledy.length) {
    console.error(`Smoke: ${bledy.length} błędów w konsoli:\n${bledy.join('\n')}`);
    process.exit(1);
  }
  console.log('Smoke: brak błędów w konsoli.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
