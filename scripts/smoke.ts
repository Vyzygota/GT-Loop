/**
 * Smoke test: buduje grę, serwuje statyczny build i przegrywa 120 dób w headless Chromium,
 * klikając wyłącznie w interfejs. Decyzje podejmuje bot zachłanny na bliźniaczej symulacji w Node,
 * a skrypt odtwarza te same akcje w UI i po każdym locie porównuje saldo i dobę z bliźniakiem.
 * Kończy się błędem, gdy w konsoli pojawi się błąd albo UI rozjedzie się z symulacją.
 * Uruchomienie: npm run smoke [ziarno] [katalog-zrzutów]
 */
import { chromium, type Page } from 'playwright';
import { build, preview } from 'vite';
import { mkdirSync } from 'node:fs';
import { Gra } from '../sim/index';
import { sprzedajWszystko, wykonaj, zaplanuj } from '../bot/strategia';

const ziarno = process.argv[2] ?? '7';
const katalogZrzutow = process.argv[3] ?? '';
const sciezkaChromium = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

function liczbaZTekstu(t: string): number {
  return Number(t.replace(/[^\d,-]/g, '').replace(',', '.'));
}

async function kliknijWszystkie(strona: Page, selektor: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const b = strona.locator(selektor).first();
    if (!(await b.count())) break;
    await b.click();
  }
}

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
  const blizniak = new Gra(ziarno);
  const start = Date.now();
  let loty = 0;
  let zrzutRaportu = false;

  while (!blizniak.stan.koniec && loty < 200) {
    // 1. Sprzedaj wszystko (bliźniak i UI).
    sprzedajWszystko(blizniak);
    await kliknijWszystkie(strona, 'button[data-akcja="sprzedaj-wszystko"]:not([disabled])');
    // Ręczna transakcja przez pole ilości, żeby przećwiczyć wycenę: kup 3 m³ pierwszego dostępnego towaru i od razu sprzedaj.
    if (loty % 5 === 1 && blizniak.rynekZnany(blizniak.stan.pozycja)) {
      const towar = (['Food', 'Minerals'] as const).find((t) => blizniak.maxKupno(t) >= 3);
      if (towar) {
        blizniak.kup(towar, 3);
        blizniak.sprzedaj(towar, 3);
        await strona.locator(`input[data-ilosc="${towar}"]`).fill('3');
        await strona.locator(`button[data-akcja="kup"][data-towar="${towar}"]`).click();
        await strona.locator(`input[data-ilosc="${towar}"]`).fill('3');
        await strona.locator(`button[data-akcja="sprzedaj"][data-towar="${towar}"]`).click();
      }
    }
    // 2. Decyzja bota na bliźniaku, wykonana na nim (łącznie z lotem) i odtworzona w UI.
    const decyzja = zaplanuj(blizniak);
    const dobaPrzed = blizniak.stan.doba;
    const { akcje } = wykonaj(blizniak, decyzja);
    for (const a of akcje) {
      switch (a.typ) {
        case 'zwolnij':
          await strona.locator(`button[data-akcja="zwolnij"][data-id="${a.id}"]`).click();
          break;
        case 'zatrudnij':
          await strona.locator(`button[data-akcja="zatrudnij"][data-id="${a.id}"]`).click();
          break;
        case 'tankuj':
          await strona.locator('input[data-ilosc="Fuel"]').fill(String(a.m3));
          await strona.locator('button[data-akcja="tankuj"]').click();
          break;
        case 'kup':
          await strona.locator(`input[data-ilosc="${a.towar}"]`).fill(String(a.m3));
          await strona.locator(`button[data-akcja="kup"][data-towar="${a.towar}"]`).click();
          break;
        case 'lec': {
          const cel = a.trasa[a.trasa.length - 1];
          // Co trzeci lot buduj trasę skok po skoku na mapie, inaczej kliknij wiersz tablicy cen (najkrótsza ścieżka).
          if (loty % 3 === 2 || blizniak.wezel(cel).typ === 'tankowanie') {
            for (const id of a.trasa.slice(1)) await strona.locator(`svg.mapa g.wezel[data-wezel="${id}"]`).dispatchEvent('click');
          } else {
            await strona.locator(`tr[data-cel="${cel}"]`).click();
          }
          const skoki = await strona.locator('.trasa-panel .skok').allInnerTexts();
          const oczekiwane = a.trasa.map((id) => blizniak.wezel(id).nazwa);
          if (skoki.join('→') !== oczekiwane.join('→')) throw new Error(`Smoke: trasa w UI ${skoki.join('→')} ≠ ${oczekiwane.join('→')}`);
          if (katalogZrzutow && loty === 2) await strona.screenshot({ path: `${katalogZrzutow}/dok.png`, fullPage: true });
          await strona.locator('button[data-akcja="lec"]:not([disabled])').click();
          await strona.waitForSelector('[data-modal="raport"]', { timeout: 20000 });
          loty++;
          if (katalogZrzutow && !zrzutRaportu && loty >= 2) {
            await strona.screenshot({ path: `${katalogZrzutow}/raport.png`, fullPage: true });
            zrzutRaportu = true;
          }
          await strona.locator('button[data-akcja="zamknij-raport"]').click();
          break;
        }
      }
    }
    // 3. Zgodność UI z symulacją po locie.
    const naglowek = await strona.locator('header').innerText();
    const saldoUI = liczbaZTekstu(/Saldo\s+([^\n]+)/.exec(naglowek)![1]);
    const dobaUI = liczbaZTekstu(/Doba\s+([^\s/]+)/.exec(naglowek)![1]);
    if (saldoUI !== Math.round(blizniak.stan.kr)) throw new Error(`Smoke: saldo w UI ${saldoUI} ≠ symulacja ${blizniak.stan.kr} po locie ${loty} (${dobaPrzed.toFixed(1)} → ${blizniak.stan.doba.toFixed(1)})`);
    if (Math.abs(dobaUI - blizniak.stan.doba) > 0.051) throw new Error(`Smoke: doba w UI ${dobaUI} ≠ symulacja ${blizniak.stan.doba}`);
  }

  const koniec = await strona.locator('[data-modal="koniec"]').count();
  if (katalogZrzutow) await strona.screenshot({ path: `${katalogZrzutow}/koniec.png`, fullPage: true });
  const wartoscUI = liczbaZTekstu(/Wartość firmy\s+([^\n]+)/.exec(await strona.locator('header').innerText())![1]);
  await przegladarka.close();
  await serwer.close();
  console.log(
    `Smoke: ziarno ${ziarno}, lotów ${loty}, doba ${blizniak.stan.doba.toFixed(1)} / ${blizniak.limitDob}, wartość firmy w UI ${wartoscUI.toLocaleString('pl-PL')} kr (symulacja ${blizniak.wartoscFirmy().toLocaleString('pl-PL')} kr), ekran końca: ${koniec ? 'tak' : 'nie'}, ${((Date.now() - start) / 1000).toFixed(1)} s`,
  );
  if (!koniec || !blizniak.stan.koniec) {
    console.error('Smoke: gra nie doszła do końca');
    process.exit(1);
  }
  if (wartoscUI !== Math.round(blizniak.wartoscFirmy())) {
    console.error('Smoke: wartość firmy w UI różni się od symulacji');
    process.exit(1);
  }
  if (bledy.length) {
    console.error(`Smoke: ${bledy.length} błędów w konsoli:\n${bledy.join('\n')}`);
    process.exit(1);
  }
  console.log('Smoke: brak błędów w konsoli, UI zgodne z symulacją po każdym locie.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
