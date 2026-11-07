// Smoke rundy 3 (npm run smoke:runda3 [ziarno] [lotów]): strona ładuje się z &runda3=1, dok pokazuje zamknięte sektory, bot (jeden statek) odtwarza
// kilka lotów przez UI; saldo i doba w UI zgodne z bliźniaczą symulacją; brak błędów w konsoli.
import { chromium } from 'playwright';
import { build, preview } from 'vite';
import { Gra } from '../sim/index';
import { inwestuj, nowyStanBota, wykonaj, zaplanuj } from '../bot/strategia';
const ziarno = process.argv[2] ?? '7';
const maxLotow = Number(process.argv[3] ?? 8);
const liczbaZTekstu = (t: string) => Number(t.replace(/[^\d,-]/g, '').replace(',', '.'));
async function main() {
  await build({ logLevel: 'error' });
  const serwer = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
  const url = serwer.resolvedUrls!.local[0];
  const przegladarka = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium', headless: true });
  const strona = await przegladarka.newPage({ viewport: { width: 1500, height: 1100 } });
  const bledy: string[] = [];
  strona.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') bledy.push(`[konsola:${m.type()}] ${m.text()}`); });
  strona.on('pageerror', (e) => bledy.push(`[pageerror] ${e.message}`));
  await strona.goto(`${url}#ziarno=${ziarno}&skala=M&informacja=pelna&spread=B&progresja=1&runda3=1&szybko=1`);
  await strona.waitForSelector('svg.mapa');
  const wybor = await strona.locator('select#runda3').inputValue();
  if (wybor !== '1') throw new Error('Przełącznik runda3 nie jest włączony');
  const dok = await strona.locator('.panel.rynek').innerText();
  console.log('dok zawiera zamknięty sektor:', dok.includes('sektor zamknięty'));
  const blizniak = new Gra(ziarno, { skala: 'M', informacja: 'pelna', spread: 'B', progresja: true, runda3: true });
  console.log('paliwo na starcie', blizniak.stan.paliwo, 'ładownia', blizniak.ladownia(), 'obsada', blizniak.miejscaZalogi());
  const stanBota = nowyStanBota();
  let loty = 0;
  let flota = false;
  while (!blizniak.stan.koniec && loty < maxLotow && !flota) {
    const inwestycje = inwestuj(blizniak, stanBota);
    const decyzja = zaplanuj(blizniak, stanBota);
    const { akcje, utknal } = wykonaj(blizniak, decyzja);
    if (utknal) throw new Error('bot utknął');
    for (const a of [...inwestycje, ...akcje]) {
      switch (a.typ) {
        case 'kup-szczebel': await strona.locator('button[data-akcja="kup-szczebel"]').click(); break;
        case 'kup-statek':
          // UI gra jednym statkiem (flota tylko w bocie floty): zakup statku kończy porównanie.
          flota = true;
          break;
        case 'sprzedaj-wszystko': await strona.locator(`button[data-akcja="sprzedaj-wszystko"][data-towar="${a.towar}"]`).click(); break;
        case 'sprzedaj': await strona.locator(`input[data-ilosc="${a.towar}"]`).fill(String(a.m3)); await strona.locator(`button[data-akcja="sprzedaj"][data-towar="${a.towar}"]`).click(); break;
        case 'zwolnij': await strona.locator(`button[data-akcja="zwolnij"][data-id="${a.id}"]`).click(); break;
        case 'zatrudnij': await strona.locator(`button[data-akcja="zatrudnij"][data-id="${a.id}"]`).click(); break;
        case 'tankuj': await strona.locator('input[data-ilosc="Fuel"]').fill(String(a.m3)); await strona.locator('button[data-akcja="tankuj"]').click(); break;
        case 'kup': await strona.locator(`input[data-ilosc="${a.towar}"]`).fill(String(a.m3)); await strona.locator(`button[data-akcja="kup"][data-towar="${a.towar}"]`).click(); break;
        case 'lec': {
          const cel = a.trasa[a.trasa.length - 1];
          await strona.locator(`svg.mapa g.wezel[data-wezel="${cel}"]`).dispatchEvent('click');
          await strona.locator('button[data-akcja="lec"]:not([disabled])').click();
          await strona.waitForSelector('[data-modal="raport"]', { timeout: 20000 });
          const raport = await strona.locator('[data-modal="raport"]').innerText();
          if (loty === 0) console.log('raport zawiera prędkość z masy:', raport.includes('Prędkość z masy'));
          loty++;
          await strona.locator('button[data-akcja="zamknij-raport"]').click();
          break;
        }
      }
    }
    if (flota) break;
    const naglowek = await strona.locator('header').innerText();
    const saldoUI = liczbaZTekstu(/Saldo\s+([^\n]+)/.exec(naglowek)![1]);
    const dobaUI = liczbaZTekstu(/Doba\s+([^\s/]+)/.exec(naglowek)![1]);
    if (saldoUI !== Math.round(blizniak.stan.kr)) throw new Error(`saldo UI ${saldoUI} ≠ ${blizniak.stan.kr} po locie ${loty}`);
    if (Math.abs(dobaUI - blizniak.stan.doba) > 0.051) throw new Error(`doba UI ${dobaUI} ≠ ${blizniak.stan.doba}`);
  }
  await przegladarka.close();
  await serwer.close();
  console.log(`UI runda 3: ${loty} lotów, doba ${blizniak.stan.doba.toFixed(1)}, saldo ${Math.round(blizniak.stan.kr)}${flota ? ', zakończone przy zakupie statku (flota poza UI)' : ''}, błędy: ${bledy.length}`);
  for (const b of bledy) console.log(b);
  process.exit(bledy.length ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
