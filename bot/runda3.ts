/**
 * Pomiar rundy 3 (PROMPT-runda3.md): skala L, 1 200 dób, spread B, informacja pełna, bot floty (bot/flota.ts).
 * Siatka paliwo{R,D} × bramkaTowaru{G,P} × pamiecFloty{A,B,C} × ziarna oraz przegląd k w R+G+A.
 *
 * npm run runda3 -- siatka [ziaren] [warianty R:G:A,D:P:C,… | all]   liczy warianty, zapisuje wyniki/runda3/<wariant>.json
 * npm run runda3 -- k [ziaren] [k1,k2,…]                               przegląd k (R+G+A), zapisuje wyniki/runda3/k-<k>.json
 * npm run runda3 -- tabele                                             składa tabele (markdown) z wyniki/runda3/*.json
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Gra, K, P, TOWARY, TOWARY_I_PALIWO, type Towar } from '../sim/index';
import { bakSzczeblaM3, ciagTf, konfiguracjaSzczebla, ladowniaM3, masaSuchaT, predkoscPrzyMasie } from '../sim/lot';
import { zagrajFlote } from './flota';

const KATALOG = join('wyniki', 'runda3');
const HORYZONT_CELU = 1000;
const ZNACZNIKI = [0, 600, 1200];

export interface Wariant {
  paliwo: 'R' | 'D';
  bramka: 'G' | 'P';
  pamiec: 'A' | 'B' | 'C';
  k: number;
}

export interface GospodarkaCyw {
  /** Pozycje rynku dostępne (bramka) w tej chwili. */
  pozycje: number;
  /** Pozycje z pustym zapasem (cena na pułapie nacisku). */
  puste: number;
  /** Pozycje na pułapie 6 norm. */
  pelne: number;
  /** Pozycje puste wśród tych, które były dostępne w dobie 0 (bez sektorów otwartych później). */
  pusteStare: number;
  nan: boolean;
}

export interface Gospodarka3 {
  doba: number;
  cywilizacje: Record<string, GospodarkaCyw>;
  nan: boolean;
}

/** Jeden lot bota: [towar dominujący albo '', dystans pc, doby, zysk wartości kr, paliwo kr, płace kr, eksploracja]. */
export type LotZwarty = [string, number, number, number, number, number, 0 | 1];

export interface PojemnoscTowaru {
  /** Dostawy 8 statków najwyższego szczebla (m³/dobę) na medianie dystansu lotów tego przebiegu (pełny ładunek, powrót pusty). */
  flota8M3NaDobe: number;
  medianaKonsumpcjiStolicM3NaDobe: number;
  minKonsumpcjiStolicM3NaDobe: number;
  /** Mediana konsumpcji stolic / dostawy floty: > 1 ⇒ rynek wchłania wszystko, co flota wozi. */
  stosunek: number;
}

export interface WynikRundy3 {
  ziarno: string;
  wariant: Wariant;
  wartoscKoncowa: number;
  utknal: boolean;
  statkow: number;
  poziomFirmy: number;
  szczeble: number[];
  kamienie: Record<string, number>;
  tiery: Record<string, number>;
  znane: string[];
  misje: { rozpoczete: number; dostarczone: number };
  okna: { doba: number; statkow: number }[];
  loty: LotZwarty[];
  gospodarka: Gospodarka3[];
  pojemnosc: Record<Towar, PojemnoscTowaru>;
  /** Doby lotu pustym statkiem szczebla N (pełny bak, pilot 1) do najdalszej stolicy po najkrótszej ścieżce grafu. */
  dniDoNajdalszej: { pusty: number; zLadunkiem: number }[];
  najdalszaPc: number;
  /** (a) wszystkie 9 cywilizacji na T4; (b) wszystkie poznane na T4 — doba albo null. */
  galaktykaA: number | null;
  galaktykaB: number | null;
}

function kwantyl(xs: number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
}

function gospodarka(gra: Gra, dostepneD0: Set<string>): Gospodarka3 {
  const cywilizacje: Record<string, GospodarkaCyw> = {};
  let nanGlobal = false;
  for (const c of gra.swiat.cywilizacje) {
    const g: GospodarkaCyw = { pozycje: 0, puste: 0, pelne: 0, pusteStare: 0, nan: false };
    for (const id of c.planety) {
      const rynek = gra.stan.rynki[id];
      for (const t of TOWARY_I_PALIWO) {
        const poz = rynek[t];
        if (![poz.zapas, poz.norma, poz.produkcja, poz.konsumpcja].every(Number.isFinite)) g.nan = true;
        if (poz.dostepny === false || !(poz.norma > 0)) continue;
        g.pozycje++;
        const pusta = poz.zapas <= 1e-9;
        if (pusta) g.puste++;
        if (poz.zapas >= P.maxZapasWNormach * poz.norma - 1e-9) g.pelne++;
        if (pusta && dostepneD0.has(`${id}:${t}`)) g.pusteStare++;
      }
    }
    if (g.nan) nanGlobal = true;
    cywilizacje[c.id] = g;
  }
  return { doba: gra.stan.doba, cywilizacje, nan: nanGlobal };
}

/** Prędkość statku szczebla N: pusty (pełny bak) i z pełną ładownią żywności, pilot 1 (bez załogi). */
function predkosciSzczebla(n: number, towar: Towar = 'Food'): { pusty: number; zLadunkiem: number; ladowniaM3: number } {
  const konf = konfiguracjaSzczebla(n);
  const sucha = masaSuchaT(n, konf);
  const bak = bakSzczeblaM3(n) * K.towary.Fuel.gestosc;
  const ciag = ciagTf(konf);
  const ladownia = ladowniaM3(konf);
  return { pusty: predkoscPrzyMasie(sucha + bak, ciag), zLadunkiem: predkoscPrzyMasie(sucha + bak + ladownia * K.towary[towar].gestosc, ciag), ladowniaM3: ladownia };
}

function najdalszaStolicaPc(gra: Gra): number {
  const d = gra.graf.dijkstra(gra.swiat.startId);
  let naj = 0;
  for (const c of gra.swiat.cywilizacje) naj = Math.max(naj, d.get(c.stolica)?.dystans ?? Infinity);
  return naj;
}

function pojemnosc(gra: Gra, medianaDystansu: number): Record<Towar, PojemnoscTowaru> {
  const n = P.runda3.statek.konfiguracje.length - 1;
  const wynik = {} as Record<Towar, PojemnoscTowaru>;
  const dystans = Number.isFinite(medianaDystansu) && medianaDystansu > 0 ? medianaDystansu : 40;
  for (const t of TOWARY) {
    const v = predkosciSzczebla(n, t);
    // Kurs: tam z pełnym ładunkiem, z powrotem pusto; dostawy na dobę = ładownia / czas kursu.
    const dobyKursu = dystans / v.zLadunkiem + dystans / v.pusty;
    const flota8 = (8 * v.ladowniaM3) / dobyKursu;
    const konsumpcje = gra.swiat.cywilizacje
      .filter((c) => gra.cywilizacjaZnana(c.id))
      .map((c) => gra.stan.rynki[c.stolica][t])
      .filter((p) => p.dostepny !== false && p.konsumpcja > 0)
      .map((p) => p.konsumpcja);
    const med = kwantyl(konsumpcje, 0.5);
    wynik[t] = { flota8M3NaDobe: flota8, medianaKonsumpcjiStolicM3NaDobe: med, minKonsumpcjiStolicM3NaDobe: konsumpcje.length ? Math.min(...konsumpcje) : NaN, stosunek: med / flota8 };
  }
  return wynik;
}

export function zagrajRunde3(ziarno: string, wariant: Wariant): WynikRundy3 {
  const kPoprzednie = P.runda3.awans.k;
  P.runda3.awans.k = wariant.k;
  const pomiary: Gospodarka3[] = [];
  const dostepneD0 = new Set<string>();
  let nastepny = 0;
  const naStarcie = (gra: Gra) => {
    for (const id of Object.keys(gra.stan.rynki)) for (const t of TOWARY_I_PALIWO) if (gra.stan.rynki[id][t].dostepny !== false && gra.stan.rynki[id][t].norma > 0) dostepneD0.add(`${id}:${t}`);
    pomiary.push(gospodarka(gra, dostepneD0));
    nastepny = 1;
  };
  const poLocie = (gra: Gra) => {
    while (nastepny < ZNACZNIKI.length && gra.stan.doba >= ZNACZNIKI[nastepny]) {
      pomiary.push(gospodarka(gra, dostepneD0));
      nastepny++;
    }
  };
  let koncowa: Gra | null = null;
  const w = zagrajFlote(ziarno, { skala: 'L', informacja: 'pelna', spread: 'B', paliwo: wariant.paliwo, bramkaTowaru: wariant.bramka, pamiecFloty: wariant.pamiec }, { naStarcie, poLocie, naKoniec: (gra) => (koncowa = gra) });
  P.runda3.awans.k = kPoprzednie;
  const gra = koncowa! as Gra;
  while (nastepny < ZNACZNIKI.length) {
    pomiary.push({ ...gospodarka(gra, dostepneD0), doba: ZNACZNIKI[nastepny] });
    nastepny++;
  }
  const kamienie: Record<string, number> = {};
  for (const [k, v] of Object.entries(gra.stan.kamienie)) kamienie[k] = Math.round(v * 10) / 10;
  const znane = gra.swiat.cywilizacje.filter((c) => gra.cywilizacjaZnana(c.id)).map((c) => c.id);
  const t4 = (ids: string[]) => (ids.every((id) => kamienie[`tier:${id}:4`] !== undefined) ? Math.max(...ids.map((id) => kamienie[`tier:${id}:4`])) : null);
  const galaktykaA = t4(gra.swiat.cywilizacje.map((c) => c.id));
  const galaktykaB = t4(znane);
  if (galaktykaA !== null) kamienie['galaktyka:a'] = galaktykaA;
  if (galaktykaB !== null) kamienie['galaktyka:b'] = galaktykaB;
  const najdalsza = najdalszaStolicaPc(gra);
  const dniDoNajdalszej = P.runda3.statek.konfiguracje.map((_, n) => {
    const v = predkosciSzczebla(n);
    return { pusty: najdalsza / v.pusty, zLadunkiem: najdalsza / v.zLadunkiem };
  });
  const loty: LotZwarty[] = w.loty.map((l) => [l.towar ?? '', Math.round(l.dystans * 10) / 10, Math.round(l.doby * 10) / 10, Math.round(l.zyskWartosci), Math.round(l.paliwoKr), Math.round(l.placeKr), l.eksploracja ? 1 : 0]);
  const medianaDystansu = kwantyl(w.loty.filter((l) => !l.eksploracja).map((l) => l.dystans), 0.5);
  return {
    ziarno,
    wariant,
    wartoscKoncowa: w.wartoscKoncowa,
    utknal: w.utknal,
    statkow: w.statkow,
    poziomFirmy: gra.stan.poziomFirmy,
    szczeble: gra.stan.statki.map((s) => s.szczebel),
    kamienie,
    tiery: { ...gra.stan.tiery },
    znane,
    misje: { rozpoczete: w.misjeRozpoczete, dostarczone: w.misjeDostarczone },
    okna: gra.stan.oknaStoczni.map((o) => ({ doba: Math.round(o.doba * 10) / 10, statkow: o.statkow })),
    loty,
    gospodarka: pomiary,
    pojemnosc: pojemnosc(gra, medianaDystansu),
    dniDoNajdalszej,
    najdalszaPc: najdalsza,
    galaktykaA,
    galaktykaB,
  };
}

// ---------- Tabele ----------

const fd = (x: number) => (Number.isFinite(x) ? x.toFixed(0) : '> horyzont');
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—');

export function nazwaWariantu(w: Wariant): string {
  return `${w.paliwo}:${w.bramka}:${w.pamiec}${w.k !== P.runda3.awans.k ? `:k${w.k}` : ''}`;
}

interface StatKamienia {
  osiagnelo: number;
  do1000: number;
  mediana: number;
  p10: number;
  p90: number;
}

function statKamienia(wyniki: WynikRundy3[], klucz: string): StatKamienia {
  const n = wyniki.length;
  const wszystkie = wyniki.map((w) => w.kamienie[klucz] ?? Infinity);
  return {
    osiagnelo: (100 * wszystkie.filter((d) => Number.isFinite(d)).length) / n,
    do1000: (100 * wszystkie.filter((d) => d <= HORYZONT_CELU).length) / n,
    mediana: kwantyl(wszystkie, 0.5),
    p10: kwantyl(wszystkie, 0.1),
    p90: kwantyl(wszystkie, 0.9),
  };
}

/** Kamień „pierwsza cywilizacja na T” liczony z kamieni tier:<cyw>:T (minimum po cywilizacjach). */
function dopiszKamieniePochodne(wyniki: WynikRundy3[]): void {
  for (const w of wyniki) {
    for (const T of [2, 3, 4]) {
      const doby = Object.entries(w.kamienie).filter(([k]) => k.startsWith('tier:') && k.endsWith(`:${T}`)).map(([, v]) => v);
      if (doby.length) w.kamienie[`cywilizacja:pierwsza:T${T}`] = Math.min(...doby);
      const n = doby.length;
      w.kamienie[`cywilizacji:T${T}:liczba`] = n;
    }
    const kontakty = Object.entries(w.kamienie).filter(([k]) => k.startsWith('kontakt:')).map(([, v]) => v);
    if (kontakty.length) w.kamienie['kontakt:ostatni'] = Math.max(...kontakty);
  }
}

const KAMIENIE: { klucz: string; nazwa: string; os?: string }[] = [
  { klucz: 'cywilizacja:pierwsza:T2', nazwa: 'pierwsza cywilizacja T2' },
  { klucz: 'cywilizacja:pierwsza:T3', nazwa: 'pierwsza cywilizacja T3' },
  { klucz: 'cywilizacja:pierwsza:T4', nazwa: 'pierwsza cywilizacja T4', os: 'cywilizacja' },
  { klucz: 'galaktyka:b', nazwa: 'galaktyka (b): wszystkie poznane na T4', os: 'galaktyka (b)' },
  { klucz: 'galaktyka:a', nazwa: 'galaktyka (a): wszystkie 9 na T4', os: 'galaktyka (a)' },
  { klucz: 'firma:T2', nazwa: 'firma T2 (2 statki)' },
  { klucz: 'firma:T3', nazwa: 'firma T3 (4 statki)' },
  { klucz: 'firma:T4', nazwa: 'firma T4 (8 statków)', os: 'firma' },
  { klucz: 'flota:2', nazwa: 'flota: 2. statek' },
  { klucz: 'flota:4', nazwa: 'flota: 4. statek' },
  { klucz: 'flota:8', nazwa: 'flota: 8. statek', os: 'flota' },
  { klucz: 'szczebel:1', nazwa: 'kadłub: szczebel 1' },
  { klucz: 'szczebel:2', nazwa: 'kadłub: szczebel 2' },
  { klucz: 'szczebel:3', nazwa: 'kadłub: szczebel 3' },
  { klucz: 'szczebel:4', nazwa: 'kadłub: szczebel 4' },
  { klucz: 'szczebel:5', nazwa: 'kadłub: szczebel 5', os: 'kadłub' },
  { klucz: 'zaloga:tier:2', nazwa: 'załoga: pierwszy tier 2' },
  { klucz: 'zaloga:tier:3', nazwa: 'załoga: pierwszy tier 3' },
  { klucz: 'zaloga:wszyscy:legenda', nazwa: 'załoga: wszyscy na tierze 3', os: 'załoga' },
  { klucz: 'kontakt:4', nazwa: 'kontakt: 4. cywilizacja' },
  { klucz: 'kontakt:6', nazwa: 'kontakt: 6. cywilizacja' },
  { klucz: 'kontakt:9', nazwa: 'kontakt: wszystkie 9' },
];

export function tabelaKamieni(wyniki: WynikRundy3[]): string {
  const linie = ['| Kamień milowy | mediana doby | 10–90% | do 1000 | do 1200 |', '|---|---|---|---|---|'];
  for (const k of KAMIENIE) {
    const s = statKamienia(wyniki, k.klucz);
    linie.push(`| ${k.nazwa}${k.os ? ` **(maksimum osi: ${k.os})**` : ''} | ${fd(s.mediana)} | ${fd(s.p10)}–${fd(s.p90)} | ${f1(s.do1000)}% | ${f1(s.osiagnelo)}% |`);
  }
  return linie.join('\n');
}

export function tabelaWariantow(grupy: { nazwa: string; wyniki: WynikRundy3[] }[]): string {
  const linie = [
    '| Wariant | n | mediana wartości (mln) | bankructwa | statki (mediana) | firma T4 do 1200 | mediana T2 pierwszej cyw. | cyw. T2 / T3 / T4 (śr. liczba) | galaktyka (b) do 1200 | galaktyka (a) do 1200 | misje dostarczone (śr.) |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const g of grupy) {
    const w = g.wyniki;
    const n = w.length;
    const sr = (f: (x: WynikRundy3) => number) => w.reduce((s, x) => s + f(x), 0) / n;
    const t2 = statKamienia(w, 'cywilizacja:pierwsza:T2');
    linie.push(
      `| ${g.nazwa} | ${n} | ${f1(kwantyl(w.map((x) => x.wartoscKoncowa / 1e6), 0.5))} | ${f1((100 * w.filter((x) => x.wartoscKoncowa < 1e6).length) / n)}% | ${kwantyl(w.map((x) => x.statkow), 0.5)} | ${f1(statKamienia(w, 'firma:T4').osiagnelo)}% | ${fd(t2.mediana)} | ${f1(sr((x) => x.kamienie['cywilizacji:T2:liczba'] ?? 0))} / ${f1(sr((x) => x.kamienie['cywilizacji:T3:liczba'] ?? 0))} / ${f1(sr((x) => x.kamienie['cywilizacji:T4:liczba'] ?? 0))} | ${f1(statKamienia(w, 'galaktyka:b').osiagnelo)}% | ${f1(statKamienia(w, 'galaktyka:a').osiagnelo)}% | ${f1(sr((x) => x.misje.dostarczone))} |`,
    );
  }
  return linie.join('\n');
}

const KOSZE = [
  [0, 50],
  [50, 100],
  [100, 200],
  [200, Infinity],
];

/** Zysk na dobę vs dystans na towar, udział paliwa w kosztach i zwrot paliwa (pc, na które starcza marża brutto lotu). */
export function tabelaPaliwa(wyniki: WynikRundy3[], nazwa: string): string {
  const linie = [`**${nazwa}**`, '', '| Towar | kosz dystansu (pc) | lotów | mediana zysku/dobę (kr) | mediana udziału paliwa w kosztach | mediana zwrotu paliwa (pc) |', '|---|---|---|---|---|---|'];
  for (const t of TOWARY) {
    for (const [a, b] of KOSZE) {
      const loty = wyniki.flatMap((w) => w.loty).filter((l) => l[0] === t && l[6] === 0 && l[1] >= a && l[1] < b && l[2] > 0);
      if (!loty.length) continue;
      const naDobe = loty.map((l) => l[3] / l[2]);
      const udzial = loty.map((l) => (l[4] + l[5] > 0 ? l[4] / (l[4] + l[5]) : 0));
      const zwrot = loty.filter((l) => l[4] > 0).map((l) => (l[3] + l[4] + l[5]) / (l[4] / l[1]));
      linie.push(`| ${t} | ${a}–${Number.isFinite(b) ? b : '∞'} | ${loty.length} | ${fd(kwantyl(naDobe, 0.5))} | ${f2(kwantyl(udzial, 0.5))} | ${fd(kwantyl(zwrot, 0.5))} |`);
    }
  }
  return linie.join('\n');
}

export function tabelaPojemnosci(wyniki: WynikRundy3[]): string {
  const linie = ['| Towar | dostawy 8 statków szczebla 5 (m³/dobę, mediana) | mediana konsumpcji stolic (m³/dobę) | min konsumpcji stolic | stosunek konsumpcja / dostawy (mediana) |', '|---|---|---|---|---|'];
  for (const t of TOWARY) {
    const p = wyniki.map((w) => w.pojemnosc[t]);
    linie.push(`| ${t} | ${fd(kwantyl(p.map((x) => x.flota8M3NaDobe), 0.5))} | ${fd(kwantyl(p.map((x) => x.medianaKonsumpcjiStolicM3NaDobe).filter(Number.isFinite), 0.5))} | ${fd(kwantyl(p.map((x) => x.minKonsumpcjiStolicM3NaDobe).filter(Number.isFinite), 0.5))} | ${f1(kwantyl(p.map((x) => x.stosunek).filter(Number.isFinite), 0.5))} |`);
  }
  return linie.join('\n');
}

/** Okna stoczni na 100 dób przy 1/2/4/8 statkach: suma okien przy danej liczbie statków / suma dób floty tej wielkości. */
export function tabelaOkien(wyniki: WynikRundy3[]): string {
  const rozmiary = [1, 2, 4, 8];
  const okna: Record<number, number> = {};
  const doby: Record<number, number> = {};
  for (const w of wyniki) {
    // Przedziały wielkości floty z kamieni flota:n (od n do następnego osiągniętego).
    const zmiany = Object.entries(w.kamienie).filter(([k]) => k.startsWith('flota:')).map(([k, v]) => ({ n: Number(k.split(':')[1]), doba: v })).sort((a, b) => a.doba - b.doba);
    const punkty = [{ n: 1, doba: 0 }, ...zmiany, { n: -1, doba: Math.max(1200, ...w.okna.map((o) => o.doba)) }];
    for (let i = 0; i + 1 < punkty.length; i++) {
      const n = punkty[i].n;
      doby[n] = (doby[n] ?? 0) + (punkty[i + 1].doba - punkty[i].doba);
      okna[n] = (okna[n] ?? 0) + w.okna.filter((o) => o.doba >= punkty[i].doba && o.doba < punkty[i + 1].doba).length;
    }
  }
  const linie = ['| Statków | dób floty tej wielkości (suma po ziarnach) | okien stoczni | okien na 100 dób |', '|---|---|---|---|'];
  for (const n of rozmiary) {
    const d = doby[n] ?? 0;
    linie.push(`| ${n} | ${fd(d)} | ${okna[n] ?? 0} | ${d > 0 ? f2((100 * (okna[n] ?? 0)) / d) : '—'} |`);
  }
  return linie.join('\n');
}

export function tabelaStabilnosci(wyniki: WynikRundy3[]): string {
  const linie = ['| Cywilizacja | pozycje d0 → d1200 | puste d0 | puste d600 | puste d1200 | puste wśród dostępnych w d0: d0 → d1200 | pełne (6 norm) d0 → d1200 | NaN |', '|---|---|---|---|---|---|---|---|'];
  const cywy = Object.keys(wyniki[0].gospodarka[0].cywilizacje);
  const med = (i: number, c: string, f: (g: GospodarkaCyw) => number) => kwantyl(wyniki.map((w) => f(w.gospodarka[i].cywilizacje[c])), 0.5);
  for (const c of cywy) {
    const nan = wyniki.some((w) => w.gospodarka.some((g) => g.cywilizacje[c].nan));
    linie.push(`| ${c} | ${fd(med(0, c, (g) => g.pozycje))} → ${fd(med(2, c, (g) => g.pozycje))} | ${fd(med(0, c, (g) => g.puste))} | ${fd(med(1, c, (g) => g.puste))} | ${fd(med(2, c, (g) => g.puste))} | ${fd(med(0, c, (g) => g.pusteStare))} → ${fd(med(2, c, (g) => g.pusteStare))} | ${fd(med(0, c, (g) => g.pelne))} → ${fd(med(2, c, (g) => g.pelne))} | ${nan ? 'TAK' : 'nie'} |`);
  }
  return linie.join('\n');
}

export function tabelaZasiegu(wyniki: WynikRundy3[]): string {
  const linie = ['| Szczebel | prędkość pusty (pc/dobę) | prędkość z pełną ładownią żywności | doby do najdalszej stolicy: pusty (mediana po ziarnach) | z ładunkiem |', '|---|---|---|---|---|'];
  P.runda3.statek.konfiguracje.forEach((_, n) => {
    const v = predkosciSzczebla(n);
    linie.push(`| ${n} | ${f2(v.pusty)} | ${f2(v.zLadunkiem)} | ${fd(kwantyl(wyniki.map((w) => w.dniDoNajdalszej[n].pusty), 0.5))} | ${fd(kwantyl(wyniki.map((w) => w.dniDoNajdalszej[n].zLadunkiem), 0.5))} |`);
  });
  linie.push('', `Najdalsza stolica od startu (najkrótsza ścieżka grafu): mediana ${fd(kwantyl(wyniki.map((w) => w.najdalszaPc), 0.5))} pc, zakres ${fd(Math.min(...wyniki.map((w) => w.najdalszaPc)))}–${fd(Math.max(...wyniki.map((w) => w.najdalszaPc)))} pc.`);
  return linie.join('\n');
}

export function tabelaK(grupy: { k: number; wyniki: WynikRundy3[] }[]): string {
  const linie = ['| k | mediana gotowości T2 (pierwsza cyw.) | mediana T2 pierwszej cyw. | mediana T3 pierwszej cyw. | mediana T4 pierwszej cyw. | cyw. T2 / T3 / T4 (śr.) | galaktyka (b): mediana / do 1200 | galaktyka (a): do 1200 | mediana wartości (mln) |', '|---|---|---|---|---|---|---|---|---|'];
  for (const g of grupy) {
    const w = g.wyniki;
    const n = w.length;
    const sr = (f: (x: WynikRundy3) => number) => w.reduce((s, x) => s + f(x), 0) / n;
    const got = statKamienia(w.map((x) => ({ ...x, kamienie: { got: Math.min(...Object.entries(x.kamienie).filter(([k]) => k.startsWith('gotowosc:') && k.endsWith(':T2')).map(([, v]) => v)) } })), 'got');
    const b = statKamienia(w, 'galaktyka:b');
    linie.push(`| ${g.k} | ${fd(got.mediana)} | ${fd(statKamienia(w, 'cywilizacja:pierwsza:T2').mediana)} | ${fd(statKamienia(w, 'cywilizacja:pierwsza:T3').mediana)} | ${fd(statKamienia(w, 'cywilizacja:pierwsza:T4').mediana)} | ${f1(sr((x) => x.kamienie['cywilizacji:T2:liczba'] ?? 0))} / ${f1(sr((x) => x.kamienie['cywilizacji:T3:liczba'] ?? 0))} / ${f1(sr((x) => x.kamienie['cywilizacji:T4:liczba'] ?? 0))} | ${fd(b.mediana)} / ${f1(b.osiagnelo)}% | ${f1(statKamienia(w, 'galaktyka:a').osiagnelo)}% | ${f1(kwantyl(w.map((x) => x.wartoscKoncowa / 1e6), 0.5))} |`);
  }
  return linie.join('\n');
}

// ---------- CLI ----------

function ziarna(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `r3-${i + 1}`);
}

function wczytajWyniki(): Map<string, WynikRundy3[]> {
  const mapa = new Map<string, WynikRundy3[]>();
  let pliki: string[] = [];
  try {
    pliki = readdirSync(KATALOG).filter((f) => f.endsWith('.json'));
  } catch {
    return mapa;
  }
  for (const f of pliki) {
    const lista = JSON.parse(readFileSync(join(KATALOG, f), 'utf8')) as WynikRundy3[];
    dopiszKamieniePochodne(lista);
    mapa.set(f.replace(/\.json$/, ''), lista);
  }
  return mapa;
}

function zapisz(nazwa: string, lista: WynikRundy3[]): void {
  mkdirSync(KATALOG, { recursive: true });
  writeFileSync(join(KATALOG, `${nazwa}.json`), JSON.stringify(lista));
}

function licz(nazwa: string, wariant: Wariant, n: number): void {
  const lista: WynikRundy3[] = [];
  const t0 = Date.now();
  for (const z of ziarna(n)) {
    const w = zagrajRunde3(z, wariant);
    lista.push(w);
    console.error(`${nazwa} ${z}: wartość ${(w.wartoscKoncowa / 1e6).toFixed(1)} mln, statków ${w.statkow}, tiery ${Object.values(w.tiery).join('')}, misje ${w.misje.dostarczone}/${w.misje.rozpoczete}${w.utknal ? ', utknął' : ''} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    zapisz(nazwa, lista);
  }
}

function main(): void {
  const [tryb = 'tabele', liczba = '30', lista] = process.argv.slice(2);
  const n = Number(liczba) || 30;
  if (tryb === 'siatka') {
    const wszystkie: Wariant[] = [];
    for (const paliwo of ['R', 'D'] as const) for (const bramka of ['G', 'P'] as const) for (const pamiec of ['A', 'B', 'C'] as const) wszystkie.push({ paliwo, bramka, pamiec, k: P.runda3.awans.k });
    const wybrane = !lista || lista === 'all' ? wszystkie : lista.split(',').map((s) => {
      const [paliwo, bramka, pamiec] = s.split(':') as [Wariant['paliwo'], Wariant['bramka'], Wariant['pamiec']];
      return { paliwo, bramka, pamiec, k: P.runda3.awans.k };
    });
    for (const w of wybrane) licz(nazwaWariantu(w), w, n);
    return;
  }
  if (tryb === 'k') {
    const ki = (lista ?? '1.05,1.10,1.15,1.20,1.30').split(',').map(Number);
    for (const k of ki) licz(`k-${k}`, { paliwo: 'R', bramka: 'G', pamiec: 'A', k }, n);
    return;
  }
  // Tabele.
  const mapa = wczytajWyniki();
  if (!mapa.size) {
    console.log(`Brak wyników w ${KATALOG}. Uruchom: npm run runda3 -- siatka 30 all; npm run runda3 -- k 30`);
    return;
  }
  const siatka = [...mapa.entries()].filter(([k]) => !k.startsWith('k-')).sort(([a], [b]) => (a < b ? -1 : 1));
  const przegladK = [...mapa.entries()].filter(([k]) => k.startsWith('k-')).map(([k, w]) => ({ k: Number(k.slice(2)), wyniki: w })).sort((a, b) => a.k - b.k);
  const out: string[] = [];
  const baza = mapa.get('R:G:A') ?? siatka[0]?.[1] ?? [];
  if (baza.length) {
    out.push(`## Kamienie milowe — wariant bazowy R:G:A (${baza.length} ziaren)`, '', tabelaKamieni(baza), '');
  }
  if (siatka.length) {
    out.push('## Siatka wariantów', '', tabelaWariantow(siatka.map(([nazwa, wyniki]) => ({ nazwa, wyniki }))), '');
    const grupuj = (f: (w: Wariant) => string) => {
      const g = new Map<string, WynikRundy3[]>();
      for (const [, lista] of siatka) for (const w of lista) g.set(f(w.wariant), [...(g.get(f(w.wariant)) ?? []), w]);
      return [...g.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([nazwa, wyniki]) => ({ nazwa, wyniki }));
    };
    out.push('### Osie zbiorczo', '', tabelaWariantow([...grupuj((w) => `paliwo ${w.paliwo}`), ...grupuj((w) => `bramka ${w.bramka}`), ...grupuj((w) => `pamięć ${w.pamiec}`)]), '');
    for (const paliwo of ['R', 'D'] as const) {
      const w = siatka.filter(([k]) => k.startsWith(`${paliwo}:`)).flatMap(([, l]) => l);
      if (w.length) out.push(`## Paliwo i odległość — wariant ${paliwo}`, '', tabelaPaliwa(w, `${paliwo}: zysk na dobę vs dystans, udział paliwa, zwrot paliwa`), '');
    }
    if (baza.length) {
      out.push('## Pojemność rynku dla 8 statków szczebla 5 (R:G:A)', '', tabelaPojemnosci(baza), '');
      out.push('## Okna stoczni na 100 dób (R:G:A)', '', tabelaOkien(baza), '');
      out.push('## Stabilność 1 200 dób na cywilizację (R:G:A, mediany po ziarnach)', '', tabelaStabilnosci(baza), '');
      out.push('## Zasięg kadłubów: doby do najdalszej stolicy', '', tabelaZasiegu(baza), '');
    }
  }
  if (przegladK.length) out.push('## Przegląd k (R:G:A)', '', tabelaK(przegladK), '');
  console.log(out.join('\n'));
}

main();
