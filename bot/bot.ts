import { K, P, TOWARY, type Skala, type Towar, type TrybInformacji, type WariantSpreadu } from '../sim/index';
import { zagrajZiarno, type LotBota, type WynikZiarna } from './strategia';

function mediana(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
}

function korelacja(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

function top(lista: string[], n: number): [string, number][] {
  const licznik = new Map<string, number>();
  for (const x of lista) licznik.set(x, (licznik.get(x) ?? 0) + 1);
  return [...licznik.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export interface Miary {
  skala: Skala;
  informacja: TrybInformacji;
  spread: WariantSpreadu;
  ziarna: number;
  sekundy: number;
  procentZZyskiem: number;
  procentPodwojenia: number;
  medianaPierwszegoZysku: number;
  bezZysku: number;
  udzialTop5: number;
  procentWewnatrzCyw: number;
  medianaSkokowZyskownych: number;
  korelacjaZyskDystans: number;
  korelacjaTras: number;
  procentLotowEksploracji: number;
  procentTrasMiedzyCyw: number;
  medianaDystansuTrasy: number;
  procentKontaktu: number;
  ziarnaUtkniete: string[];
  /** Korelacje zysku/dobę z dystansem per towar dominujący: lot i trasa handlowa. */
  korelacjeTowarow: Record<Towar, { lot: number; trasa: number; n: number }>;
  /** Udział paliwa w kosztach lotów (paliwo / (paliwo + płace)). */
  udzialPaliwa: number;
  medianaDystansuZyskownejMiedzyCyw: number;
  /** Ile pc paliwa pokrywa mediana marży z pełnej ładowni, per towar. */
  pcNaTowar: Record<Towar, number>;
  medianaCenyPaliwa: number;
  medianaMarzyNaM3: Record<Towar, number>;
  /** Struktura gospodarki niezależnie od wyboru bota: korelacje po wszystkich planach dostępnych w dokach. */
  korelacjaPlanowNaDobe: number;
  korelacjaPlanowZysk: number;
  liczbaPlanow: number;
  medianaWartosci: number;
  medianaLotow: number;
  utknelo: number;
  topTrasy: [string, number][];
  topTowary: [string, number][];
}

export function policzMiary(skala: Skala, informacja: TrybInformacji, spread: WariantSpreadu, wyniki: WynikZiarna[], sekundy: number, nazwa: (id: string) => string): Miary {
  const loty: LotBota[] = wyniki.flatMap((w) => w.loty);
  const n = wyniki.length;
  const pierwsze = wyniki.map((w) => w.pierwszyZyskownyLot).filter((x): x is number => x !== null);
  const trasy = loty.map((l) => `${nazwa(l.z)} → ${nazwa(l.do)}`);
  const topTrasy = top(trasy, P.bot.topN);
  const wewnatrz = loty.filter((l) => l.cywZ && l.cywZ === l.cywDo).length;
  const zyskowne = loty.filter((l) => l.zyskWartosci > 0);
  const trasy_ = wyniki.flatMap((w) => w.trasy).filter((t) => t.doby > 0);
  const trasyHandlowe = trasy_.filter((t) => !t.eksploracja);
  const handlowe = loty.filter((l) => !l.eksploracja && l.doby > 0);
  const korelacjeTowarow = {} as Miary['korelacjeTowarow'];
  const pcNaTowar = {} as Record<Towar, number>;
  const medianaMarzyNaM3 = {} as Record<Towar, number>;
  const cenyPaliwa = wyniki.flatMap((w) => w.cenyPaliwa);
  const medianaCenyPaliwa = mediana(cenyPaliwa);
  for (const t of TOWARY) {
    const lotyT = handlowe.filter((l) => l.towar === t);
    const trasyT = trasyHandlowe.filter((x) => x.towar === t);
    korelacjeTowarow[t] = {
      lot: korelacja(
        lotyT.map((l) => l.dystans),
        lotyT.map((l) => l.zyskWartosci / l.doby),
      ),
      trasa: korelacja(
        trasyT.map((x) => x.dystans),
        trasyT.map((x) => x.zyskWartosci / x.doby),
      ),
      n: trasyT.length,
    };
    const marze = wyniki.flatMap((w) => w.marzeNaM3[t]);
    medianaMarzyNaM3[t] = mediana(marze);
    pcNaTowar[t] = (medianaMarzyNaM3[t] * K.ladownia) / (medianaCenyPaliwa * K.kosztPaliwaNaParsek);
  }
  const paliwoKr = loty.reduce((s, l) => s + l.paliwoKr, 0);
  const placeKr = loty.reduce((s, l) => s + l.placeKr, 0);
  const plany = wyniki.flatMap((w) => w.plany);
  return {
    korelacjaPlanowNaDobe: korelacja(
      plany.map((p) => p.dystans),
      plany.map((p) => p.naDobe),
    ),
    korelacjaPlanowZysk: korelacja(
      plany.map((p) => p.dystans),
      plany.map((p) => p.zysk),
    ),
    liczbaPlanow: plany.length,
    skala,
    informacja,
    spread,
    korelacjeTowarow,
    udzialPaliwa: paliwoKr + placeKr > 0 ? (100 * paliwoKr) / (paliwoKr + placeKr) : NaN,
    medianaDystansuZyskownejMiedzyCyw: mediana(trasyHandlowe.filter((x) => x.miedzyCyw && x.zyskWartosci > 0).map((x) => x.dystans)),
    pcNaTowar,
    medianaCenyPaliwa,
    medianaMarzyNaM3,
    ziarna: n,
    sekundy,
    procentZZyskiem: (100 * wyniki.filter((w) => w.zysk).length) / n,
    procentPodwojenia: (100 * wyniki.filter((w) => w.wartoscKoncowa >= K.startingCredits * P.celMnoznikWartosci).length) / n,
    medianaPierwszegoZysku: mediana(pierwsze),
    bezZysku: n - pierwsze.length,
    udzialTop5: loty.length ? (100 * topTrasy.reduce((s, [, c]) => s + c, 0)) / loty.length : NaN,
    procentWewnatrzCyw: loty.length ? (100 * wewnatrz) / loty.length : NaN,
    medianaSkokowZyskownych: mediana(zyskowne.map((l) => l.skoki)),
    korelacjaZyskDystans: korelacja(
      handlowe.map((l) => l.dystans),
      handlowe.map((l) => l.zyskWartosci / l.doby),
    ),
    korelacjaTras: korelacja(
      trasyHandlowe.map((t) => t.dystans),
      trasyHandlowe.map((t) => t.zyskWartosci / t.doby),
    ),
    procentLotowEksploracji: loty.length ? (100 * loty.filter((l) => l.eksploracja).length) / loty.length : NaN,
    procentTrasMiedzyCyw: trasyHandlowe.length ? (100 * trasyHandlowe.filter((t) => t.miedzyCyw).length) / trasyHandlowe.length : NaN,
    medianaDystansuTrasy: mediana(trasyHandlowe.map((t) => t.dystans)),
    ziarnaUtkniete: wyniki.filter((w) => w.utknal).map((w) => w.ziarno),
    procentKontaktu: (100 * wyniki.filter((w) => w.kontaktDoba !== null).length) / n,
    medianaWartosci: mediana(wyniki.map((w) => w.wartoscKoncowa)),
    medianaLotow: mediana(wyniki.map((w) => w.loty.length)),
    utknelo: wyniki.filter((w) => w.utknal).length,
    topTrasy,
    topTowary: top(
      loty.flatMap((l) => l.towary.map((t) => P.nazwyTowarow[t])),
      P.bot.topN,
    ),
  };
}

export function uruchomBota(skala: Skala, informacja: TrybInformacji, liczba: number, pierwsze = P.bot.pierwszeZiarno, spread: WariantSpreadu = P.spread): { wyniki: WynikZiarna[]; miary: Miary } {
  const start = Date.now();
  const wyniki: WynikZiarna[] = [];
  for (let i = 0; i < liczba; i++) {
    const w = zagrajZiarno(String(pierwsze + i), { skala, informacja, spread });
    wyniki.push(w);
  }
  // Nazwy węzłów: identyfikator planety zawiera nazwę (galaktyka) albo jest nią (świat S).
  const nazwa = (id: string) => id;
  const sekundy = (Date.now() - start) / 1000;
  return { wyniki, miary: policzMiary(skala, informacja, spread, wyniki, sekundy, nazwa) };
}

const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—');
const fkr = (x: number) => (Number.isFinite(x) ? Math.round(x).toLocaleString('pl-PL') + ' kr' : '—');

export function tabelaMiar(lista: Miary[]): string {
  const kolumny = lista.map((m) => `${m.skala}/${m.informacja}/${m.spread} (${m.ziarna} z.)`);
  const wiersze: [string, (m: Miary) => string][] = [
    ['Ziarna z zyskiem (próg M ≥ 70%)', (m) => `${f1(m.procentZZyskiem)}%`],
    ['Ziarna z podwojeniem wartości', (m) => `${f1(m.procentPodwojenia)}%`],
    ['Pierwsza zyskowna trasa, mediana lotów (≤ 3)', (m) => `${f1(m.medianaPierwszegoZysku)}${m.bezZysku ? ` (brak w ${m.bezZysku})` : ''}`],
    ['Udział 5 najczęstszych tras (≤ 25%)', (m) => `${f1(m.udzialTop5)}%`],
    ['Loty wewnątrz jednej cywilizacji (≤ 50%)', (m) => `${f1(m.procentWewnatrzCyw)}%`],
    ['Mediana skoków zyskownego lotu (≥ 2)', (m) => f1(m.medianaSkokowZyskownych)],
    ['Korelacja zysk/dobę z dystansem lotu (> 0; bez eksploracji)', (m) => f2(m.korelacjaZyskDystans)],
    ['  loty eksploracyjne', (m) => `${f1(m.procentLotowEksploracji)}%`],
    ['  …z dystansem całej trasy handlowej (zakup → cel)', (m) => f2(m.korelacjaTras)],
    ['  trasy handlowe między cywilizacjami', (m) => `${f1(m.procentTrasMiedzyCyw)}%`],
    ['  mediana dystansu trasy handlowej', (m) => `${f1(m.medianaDystansuTrasy)} pc`],
    ['Kontakt z nieznaną cywilizacją (≥ 50%)', (m) => `${f1(m.procentKontaktu)}%`],
    ['Mediana wartości firmy na koniec', (m) => fkr(m.medianaWartosci)],
    ['Mediana liczby lotów', (m) => f1(m.medianaLotow)],
    ['Ziarna, w których bot utknął', (m) => (m.utknelo ? `${m.utknelo} (${m.ziarnaUtkniete.slice(0, 5).join(', ')})` : '0')],
    ['Czas bota', (m) => `${f1(m.sekundy)} s`],
    ['Korelacja po wszystkich dostępnych planach: stopa/dobę vs dystans', (m) => `${f2(m.korelacjaPlanowNaDobe)} (${m.liczbaPlanow} planów)`],
    ['  …zysk netto na kurs vs dystans', (m) => f2(m.korelacjaPlanowZysk)],
    ['Udział paliwa w kosztach lotów (paliwo / (paliwo + płace))', (m) => `${f1(m.udzialPaliwa)}%`],
    ['Mediana dystansu zyskownej trasy między cywilizacjami', (m) => `${f1(m.medianaDystansuZyskownejMiedzyCyw)} pc`],
    ['Mediana ceny paliwa zapłaconej w dokach', (m) => fkr(m.medianaCenyPaliwa)],
    ...TOWARY.map(
      (t): [string, (m: Miary) => string] => [`Korelacja per towar, ${P.nazwyTowarow[t]}: lot / trasa (n tras)`, (m) => `${f2(m.korelacjeTowarow[t].lot)} / ${f2(m.korelacjeTowarow[t].trasa)} (${m.korelacjeTowarow[t].n})`],
    ),
    ...TOWARY.map(
      (t): [string, (m: Miary) => string] => [`Pc paliwa z mediany marży pełnej ładowni, ${P.nazwyTowarow[t]} (marża kr/m³)`, (m) => `${f1(m.pcNaTowar[t])} pc (${f1(m.medianaMarzyNaM3[t])})`],
    ),
  ];
  const szer = Math.max(...wiersze.map(([e]) => e.length));
  const szerK = Math.max(16, ...kolumny.map((k) => k.length));
  const linie = [`${'Miara'.padEnd(szer)} | ${kolumny.map((k) => k.padStart(szerK)).join(' | ')}`, `${'-'.repeat(szer)}-+-${kolumny.map(() => '-'.repeat(szerK)).join('-+-')}`];
  for (const [e, f] of wiersze) linie.push(`${e.padEnd(szer)} | ${lista.map((m) => f(m).padStart(szerK)).join(' | ')}`);
  return linie.join('\n');
}

export function opisSzczegolow(m: Miary): string {
  return [
    `${m.skala}/${m.informacja}/${m.spread}: najczęstsze trasy: ${m.topTrasy.map(([t, n]) => `${t} (${n})`).join('; ')}`,
    `${m.skala}/${m.informacja}/${m.spread}: najczęstsze towary: ${m.topTowary.map(([t, n]) => `${t} (${n})`).join('; ')}`,
  ].join('\n');
}

const uruchomionyBezposrednio = process.argv[1] && /bot\.ts$|bot\.js$/.test(process.argv[1]);
if (uruchomionyBezposrednio) {
  // npm run bot -- [S|M|L|all] [pelna|zasieg|both] [liczba|-] [A|B|C|D|all]
  const skale: Skala[] = process.argv[2] && process.argv[2] !== 'all' ? [process.argv[2] as Skala] : ['S', 'M', 'L'];
  const tryby: TrybInformacji[] = process.argv[3] && process.argv[3] !== 'both' ? [process.argv[3] as TrybInformacji] : ['pelna', 'zasieg'];
  const liczbaArg = process.argv[4] && process.argv[4] !== '-' ? Number(process.argv[4]) : undefined;
  const warianty: WariantSpreadu[] = process.argv[5] && process.argv[5] !== 'all' ? [process.argv[5] as WariantSpreadu] : process.argv[5] === 'all' ? ['A', 'B', 'C', 'D', 'E'] : [P.spread];
  const miary: Miary[] = [];
  for (const skala of skale) {
    for (const tryb of tryby) {
      for (const wariant of warianty) {
        const liczba = liczbaArg ?? (skala === 'L' ? P.bot.liczbaZiarenL : P.bot.liczbaZiaren);
        const { miary: m } = uruchomBota(skala, tryb, liczba, P.bot.pierwszeZiarno, wariant);
        miary.push(m);
        console.error(`gotowe ${skala}/${tryb}/${wariant}: ${m.sekundy.toFixed(1)} s`);
      }
    }
  }
  console.log(`Bot zachłanny, horyzont dób: ${skale.map((s) => `${s} ${P.skale[s].limitDob}`).join(', ')}; warianty spreadu: ${warianty.join(', ')}`);
  // Jedna tabela na skalę, żeby kolumny się mieściły.
  for (const skala of skale) {
    const lista = miary.filter((m) => m.skala === skala);
    if (lista.length) console.log(`\n${tabelaMiar(lista)}`);
  }
  for (const m of miary) console.log(opisSzczegolow(m));
  const pary = new Map<string, Miary[]>();
  for (const m of miary) pary.set(`${m.skala}/${m.spread}`, [...(pary.get(`${m.skala}/${m.spread}`) ?? []), m]);
  for (const [klucz, lista] of pary) {
    const pelna = lista.find((m) => m.informacja === 'pelna');
    const zasieg = lista.find((m) => m.informacja === 'zasieg');
    if (pelna && zasieg) console.log(`${klucz}: informacja=zasieg vs pelna: mediana wartości firmy ${fkr(zasieg.medianaWartosci)} vs ${fkr(pelna.medianaWartosci)} (${f1((100 * (zasieg.medianaWartosci - pelna.medianaWartosci)) / pelna.medianaWartosci)}%)`);
  }
}
