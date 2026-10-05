/**
 * Pomiar rundy 3 (PROMPT-runda3.md, cel 4 000 dób): skala L, horyzont `runda3.horyzontDob` = 4 800 dób, spread B, informacja pełna,
 * bot floty (bot/flota.ts). Siatka paliwo{R,D} × bramkaTowaru{G,P} × pamiecFloty{A,B,C} × ziarna oraz przeglądy parametrów w R+G+A:
 * `k` (próg gotowości), `xp` (xpNaDobeLotu), `progFirmy` (mnożnik progów poziomu firmy), `kKadluba` (cena szczebla = k × mediana zysku na kurs).
 *
 * npm run runda3 -- siatka [ziaren] [warianty R:G:A,D:P:C,… | all]        zapisuje wyniki/runda3/<wariant>.json
 * npm run runda3 -- przeglad k|xp|progFirmy|kKadluba [ziaren] [w1,w2,…]  zapisuje wyniki/runda3/<param>-<wartość>.json
 * npm run runda3 -- tabele                                                 składa tabele (markdown) z wyniki/runda3/*.json
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Gra, K, P, TOWARY, TOWARY_I_PALIWO, type Towar } from '../sim/index';
import { bakSzczeblaM3, ciagTf, konfiguracjaSzczebla, ladowniaM3, masaSuchaT, predkoscPrzyMasie } from '../sim/lot';
import { zagrajFlote } from './flota';

const KATALOG = join('wyniki', 'runda3');
/** Cel projektanta: maksimum osi w ok. 4 000 dób; okno 3 600–4 400. */
const HORYZONT_CELU = 4000;
const OKNO: [number, number] = [3600, 4400];
const HORYZONT = (): number => P.runda3.horyzontDob;
const ZNACZNIKI = (): number[] => [0, HORYZONT() / 2, HORYZONT()];
const KROK_KRZYWEJ = 200;

export type Przeglad = 'k' | 'xp' | 'progFirmy' | 'kKadluba';
const PRZEGLADY: Record<Przeglad, { opis: string; domyslne: number[] }> = {
  k: { opis: 'próg gotowości Z₀ × k^(T−1)', domyslne: [1.05, 1.1, 1.2, 1.3, 1.5, 1.75, 2.0] },
  xp: { opis: 'xpNaDobeLotu', domyslne: [1.5, 2, 2.5, 3, 4] },
  progFirmy: { opis: 'mnożnik progów poziomu firmy (progFirmy × m)', domyslne: [1, 5, 25, 100, 500] },
  kKadluba: { opis: 'cena szczebla = k × mediana zysku na kurs', domyslne: [5, 20, 50, 100, 200] },
};

export interface Wariant {
  paliwo: 'R' | 'D';
  bramka: 'G' | 'P';
  pamiec: 'A' | 'B' | 'C';
  przeglad?: { param: Przeglad; wartosc: number };
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
  /** Zamożność: dzienny PKB = Σ (konsumpcja + uśpiona) × cena bazowa (WU/dobę) i wartość zapasów po cenach bazowych (WU). */
  pkbWU: number;
  zapasWU: number;
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
  wydanoNaKadlub: number;
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
  /** Wartość firmy (kr + ładunek) i z kadłubami/statkami po cenie zakupu co KROK_KRZYWEJ dób (indeks = doba / krok). */
  krzywa: { wartosc: number; zKadlubem: number }[];
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
    const g: GospodarkaCyw = { pozycje: 0, puste: 0, pelne: 0, pusteStare: 0, pkbWU: 0, zapasWU: 0, nan: false };
    for (const id of c.planety) {
      const rynek = gra.stan.rynki[id];
      for (const t of TOWARY_I_PALIWO) {
        const poz = rynek[t];
        if (![poz.zapas, poz.norma, poz.produkcja, poz.konsumpcja].every(Number.isFinite)) g.nan = true;
        if (poz.dostepny === false || !(poz.norma > 0)) continue;
        g.pozycje++;
        g.pkbWU += (poz.konsumpcja + poz.konsumpcjaUspiona) * K.towary[t].basePrice;
        g.zapasWU += poz.zapas * K.towary[t].basePrice;
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

/** Prędkość statku szczebla N: pusty (pełny bak) i z pełną ładownią towaru, pilot 1 (bez załogi). */
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

/** Ustawia parametr przeglądu w `P` i zwraca funkcję przywracającą. */
function ustawPrzeglad(przeglad: Wariant['przeglad']): () => void {
  if (!przeglad) return () => {};
  const { param, wartosc } = przeglad;
  if (param === 'k') {
    const stare = P.runda3.awans.k;
    P.runda3.awans.k = wartosc;
    return () => (P.runda3.awans.k = stare);
  }
  if (param === 'xp') {
    const stare = P.progresja.xpNaDobeLotu;
    P.progresja.xpNaDobeLotu = wartosc;
    return () => (P.progresja.xpNaDobeLotu = stare);
  }
  if (param === 'progFirmy') {
    const stare = [...P.runda3.firma.progFirmy];
    P.runda3.firma.progFirmy = stare.map((x) => x * wartosc);
    return () => (P.runda3.firma.progFirmy = stare);
  }
  const stare = P.progresja.k;
  P.progresja.k = wartosc;
  return () => (P.progresja.k = stare);
}

export function zagrajRunde3(ziarno: string, wariant: Wariant): WynikRundy3 {
  const przywroc = ustawPrzeglad(wariant.przeglad);
  const pomiary: Gospodarka3[] = [];
  const krzywa: WynikRundy3['krzywa'] = [];
  const dostepneD0 = new Set<string>();
  const znaczniki = ZNACZNIKI();
  let nastepny = 0;
  const zKadlubem = (gra: Gra) => ({ wartosc: gra.wartoscFirmy(), zKadlubem: gra.wartoscFirmy() + gra.stan.wydanoNaKadlub });
  const naStarcie = (gra: Gra) => {
    for (const id of Object.keys(gra.stan.rynki)) for (const t of TOWARY_I_PALIWO) if (gra.stan.rynki[id][t].dostepny !== false && gra.stan.rynki[id][t].norma > 0) dostepneD0.add(`${id}:${t}`);
    pomiary.push(gospodarka(gra, dostepneD0));
    krzywa.push(zKadlubem(gra));
    nastepny = 1;
  };
  const poLocie = (gra: Gra) => {
    while (gra.stan.doba >= krzywa.length * KROK_KRZYWEJ && krzywa.length * KROK_KRZYWEJ <= gra.limitDob) krzywa.push(zKadlubem(gra));
    while (nastepny < znaczniki.length && gra.stan.doba >= znaczniki[nastepny]) {
      pomiary.push(gospodarka(gra, dostepneD0));
      nastepny++;
    }
  };
  let koncowa: Gra | null = null;
  let w;
  try {
    w = zagrajFlote(ziarno, { skala: 'L', informacja: 'pelna', spread: 'B', paliwo: wariant.paliwo, bramkaTowaru: wariant.bramka, pamiecFloty: wariant.pamiec }, { naStarcie, poLocie, naKoniec: (gra) => (koncowa = gra) });
  } finally {
    przywroc();
  }
  const gra = koncowa! as Gra;
  while (krzywa.length * KROK_KRZYWEJ <= gra.limitDob) krzywa.push(zKadlubem(gra));
  while (nastepny < znaczniki.length) {
    pomiary.push({ ...gospodarka(gra, dostepneD0), doba: znaczniki[nastepny] });
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
    wydanoNaKadlub: gra.stan.wydanoNaKadlub,
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
    krzywa,
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
const fmln = (x: number) => (Number.isFinite(x) ? (x / 1e6).toFixed(1) : '—');
const wOknie = (mediana: number) => (mediana >= OKNO[0] && mediana <= OKNO[1] ? '**tak**' : Number.isFinite(mediana) ? (mediana < OKNO[0] ? 'za wcześnie' : 'za późno') : 'poza horyzontem');

export function nazwaWariantu(w: Wariant): string {
  return w.przeglad ? `${w.przeglad.param}-${w.przeglad.wartosc}` : `${w.paliwo}:${w.bramka}:${w.pamiec}`;
}

interface StatKamienia {
  osiagnelo: number;
  doCelu: number;
  mediana: number;
  p10: number;
  p90: number;
}

function statKamienia(wyniki: WynikRundy3[], klucz: string): StatKamienia {
  const n = wyniki.length;
  const wszystkie = wyniki.map((w) => w.kamienie[klucz] ?? Infinity);
  return {
    osiagnelo: (100 * wszystkie.filter((d) => Number.isFinite(d)).length) / n,
    doCelu: (100 * wszystkie.filter((d) => d <= HORYZONT_CELU).length) / n,
    mediana: kwantyl(wszystkie, 0.5),
    p10: kwantyl(wszystkie, 0.1),
    p90: kwantyl(wszystkie, 0.9),
  };
}

/** Kamienie pochodne: „pierwsza cywilizacja na T” (minimum po cywilizacjach), liczba cywilizacji na T, ostatni kontakt, pierwsza gotowość T2. */
function dopiszKamieniePochodne(wyniki: WynikRundy3[]): void {
  for (const w of wyniki) {
    for (const T of [2, 3, 4]) {
      const doby = Object.entries(w.kamienie).filter(([k]) => k.startsWith('tier:') && k.endsWith(`:${T}`)).map(([, v]) => v);
      if (doby.length) w.kamienie[`cywilizacja:pierwsza:T${T}`] = Math.min(...doby);
      w.kamienie[`cywilizacji:T${T}:liczba`] = doby.length;
    }
    const kontakty = Object.entries(w.kamienie).filter(([k]) => k.startsWith('kontakt:')).map(([, v]) => v);
    if (kontakty.length) w.kamienie['kontakt:ostatni'] = Math.max(...kontakty);
    const gotowosci = Object.entries(w.kamienie).filter(([k]) => k.startsWith('gotowosc:') && k.endsWith(':T2')).map(([, v]) => v);
    if (gotowosci.length) w.kamienie['gotowosc:pierwsza:T2'] = Math.min(...gotowosci);
  }
}

const KAMIENIE: { klucz: string; nazwa: string; os?: string }[] = [
  { klucz: 'gotowosc:pierwsza:T2', nazwa: 'pierwsza gotowość T2 (kontrakt otwarty)' },
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
  const linie = [`| Kamień milowy | mediana doby | 10–90% | do ${HORYZONT_CELU} | do ${HORYZONT()} | w oknie ${OKNO[0]}–${OKNO[1]}? |`, '|---|---|---|---|---|---|'];
  for (const k of KAMIENIE) {
    const s = statKamienia(wyniki, k.klucz);
    linie.push(`| ${k.nazwa}${k.os ? ` **(maksimum osi: ${k.os})**` : ''} | ${fd(s.mediana)} | ${fd(s.p10)}–${fd(s.p90)} | ${f1(s.doCelu)}% | ${f1(s.osiagnelo)}% | ${k.os ? wOknie(s.mediana) : ''} |`);
  }
  return linie.join('\n');
}

export function tabelaWariantow(grupy: { nazwa: string; wyniki: WynikRundy3[] }[]): string {
  const linie = [
    `| Wariant | n | mediana wartości (mln) | bankructwa | statki (mediana) | firma T4 do ${HORYZONT_CELU} | szczebel 5 do ${HORYZONT_CELU} | mediana T2 / T3 / T4 pierwszej cyw. | cyw. T2 / T3 / T4 (śr. liczba) | galaktyka (b): mediana / do ${HORYZONT_CELU} | galaktyka (a) do ${HORYZONT_CELU} | misje dostarczone (śr.) |`,
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const g of grupy) {
    const w = g.wyniki;
    const n = w.length;
    const sr = (f: (x: WynikRundy3) => number) => w.reduce((s, x) => s + f(x), 0) / n;
    const b = statKamienia(w, 'galaktyka:b');
    linie.push(
      `| ${g.nazwa} | ${n} | ${f1(kwantyl(w.map((x) => x.wartoscKoncowa / 1e6), 0.5))} | ${f1((100 * w.filter((x) => x.wartoscKoncowa < 1e6).length) / n)}% | ${kwantyl(w.map((x) => x.statkow), 0.5)} | ${f1(statKamienia(w, 'firma:T4').doCelu)}% | ${f1(statKamienia(w, 'szczebel:5').doCelu)}% | ${fd(statKamienia(w, 'cywilizacja:pierwsza:T2').mediana)} / ${fd(statKamienia(w, 'cywilizacja:pierwsza:T3').mediana)} / ${fd(statKamienia(w, 'cywilizacja:pierwsza:T4').mediana)} | ${f1(sr((x) => x.kamienie['cywilizacji:T2:liczba'] ?? 0))} / ${f1(sr((x) => x.kamienie['cywilizacji:T3:liczba'] ?? 0))} / ${f1(sr((x) => x.kamienie['cywilizacji:T4:liczba'] ?? 0))} | ${fd(b.mediana)} / ${f1(b.doCelu)}% | ${f1(statKamienia(w, 'galaktyka:a').doCelu)}% | ${f1(sr((x) => x.misje.dostarczone))} |`,
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
    const zmiany = Object.entries(w.kamienie).filter(([k]) => k.startsWith('flota:')).map(([k, v]) => ({ n: Number(k.split(':')[1]), doba: v })).sort((a, b) => a.doba - b.doba);
    const punkty = [{ n: 1, doba: 0 }, ...zmiany, { n: -1, doba: Math.max(HORYZONT(), ...w.okna.map((o) => o.doba)) }];
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
  const [, d1, d2] = ZNACZNIKI();
  const linie = [
    `| Cywilizacja | PKB (WU/dobę) d0 → d${d1} → d${d2} | wzrost PKB d0–${d1} / d${d1}–${d2} | zapasy (WU) wzrost d0–${d1} / d${d1}–${d2} | pozycje d0 → d${d2} | puste d0 / d${d1} / d${d2} | puste wśród dostępnych w d0: d0 → d${d2} | pełne (6 norm) d0 → d${d2} | NaN |`,
    '|---|---|---|---|---|---|---|---|---|',
  ];
  const cywy = Object.keys(wyniki[0].gospodarka[0].cywilizacje);
  const med = (i: number, c: string, f: (g: GospodarkaCyw) => number) => kwantyl(wyniki.map((w) => f(w.gospodarka[i].cywilizacje[c])), 0.5);
  const wzrost = (c: string, f: (g: GospodarkaCyw) => number, i: number, j: number) => kwantyl(wyniki.map((w) => f(w.gospodarka[j].cywilizacje[c]) / f(w.gospodarka[i].cywilizacje[c])).filter(Number.isFinite), 0.5);
  for (const c of cywy) {
    const nan = wyniki.some((w) => w.gospodarka.some((g) => g.cywilizacje[c].nan));
    const w1 = wzrost(c, (g) => g.pkbWU, 0, 1);
    const w2 = wzrost(c, (g) => g.pkbWU, 1, 2);
    const z1 = wzrost(c, (g) => g.zapasWU, 0, 1);
    const z2 = wzrost(c, (g) => g.zapasWU, 1, 2);
    linie.push(`| ${c} | ${fmln(med(0, c, (g) => g.pkbWU))} → ${fmln(med(1, c, (g) => g.pkbWU))} → ${fmln(med(2, c, (g) => g.pkbWU))} mln | ×${f2(w1)} / ×${f2(w2)}${w2 <= w1 + 1e-9 ? '' : ' **(szybciej w 2. połowie)**'} | ×${f2(z1)} / ×${f2(z2)} | ${fd(med(0, c, (g) => g.pozycje))} → ${fd(med(2, c, (g) => g.pozycje))} | ${fd(med(0, c, (g) => g.puste))} / ${fd(med(1, c, (g) => g.puste))} / ${fd(med(2, c, (g) => g.puste))} | ${fd(med(0, c, (g) => g.pusteStare))} → ${fd(med(2, c, (g) => g.pusteStare))} | ${fd(med(0, c, (g) => g.pelne))} → ${fd(med(2, c, (g) => g.pelne))} | ${nan ? 'TAK' : 'nie'} |`);
  }
  return linie.join('\n');
}

export function tabelaKrzywej(wyniki: WynikRundy3[]): string {
  const dl = Math.max(...wyniki.map((w) => w.krzywa.length));
  const linie = ['| Doba | mediana wartości firmy (kr + ładunek) | mediana z kadłubami i statkami | × kapitał startowy | 10–90% (z kadłubem, mln) |', '|---|---|---|---|---|'];
  for (let i = 0; i < dl; i++) {
    const w1 = kwantyl(wyniki.map((w) => w.krzywa[Math.min(i, w.krzywa.length - 1)].wartosc), 0.5);
    const zk = wyniki.map((w) => w.krzywa[Math.min(i, w.krzywa.length - 1)].zKadlubem);
    const w2 = kwantyl(zk, 0.5);
    linie.push(`| ${i * KROK_KRZYWEJ} | ${fmln(w1)} mln | ${fmln(w2)} mln | ×${(w2 / K.startingCredits).toFixed(1)} | ${fmln(kwantyl(zk, 0.1))}–${fmln(kwantyl(zk, 0.9))} |`);
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

/** Kamienie kluczowe dla każdego przeglądu: wiersz na wartość parametru, kolumna na kamień (mediana, 10–90%, % do celu). */
const KAMIENIE_PRZEGLADU: Record<Przeglad, { klucz: string; nazwa: string; cel?: boolean }[]> = {
  k: [
    { klucz: 'gotowosc:pierwsza:T2', nazwa: 'gotowość T2' },
    { klucz: 'cywilizacja:pierwsza:T2', nazwa: '1. cyw. T2' },
    { klucz: 'cywilizacja:pierwsza:T3', nazwa: '1. cyw. T3' },
    { klucz: 'cywilizacja:pierwsza:T4', nazwa: '1. cyw. T4', cel: true },
    { klucz: 'galaktyka:b', nazwa: 'galaktyka (b)', cel: true },
    { klucz: 'galaktyka:a', nazwa: 'galaktyka (a)', cel: true },
  ],
  xp: [
    { klucz: 'zaloga:tier:2', nazwa: 'pierwszy Weteran' },
    { klucz: 'zaloga:tier:3', nazwa: 'pierwszy Mistrz' },
    { klucz: 'zaloga:wszyscy:legenda', nazwa: 'wszyscy na Legendzie', cel: true },
  ],
  progFirmy: [
    { klucz: 'firma:T2', nazwa: 'firma T2' },
    { klucz: 'firma:T3', nazwa: 'firma T3' },
    { klucz: 'firma:T4', nazwa: 'firma T4', cel: true },
    { klucz: 'flota:8', nazwa: '8. statek', cel: true },
  ],
  kKadluba: [
    { klucz: 'szczebel:1', nazwa: 'szczebel 1' },
    { klucz: 'szczebel:2', nazwa: 'szczebel 2' },
    { klucz: 'szczebel:3', nazwa: 'szczebel 3' },
    { klucz: 'szczebel:4', nazwa: 'szczebel 4' },
    { klucz: 'szczebel:5', nazwa: 'szczebel 5', cel: true },
  ],
};

export function tabelaPrzegladu(param: Przeglad, grupy: { wartosc: number; wyniki: WynikRundy3[] }[]): string {
  const kam = KAMIENIE_PRZEGLADU[param];
  const linie = [`| ${param} (${PRZEGLADY[param].opis}) | n | ${kam.map((k) => `${k.nazwa}: mediana (10–90%), do ${HORYZONT_CELU}${k.cel ? ', w oknie?' : ''}`).join(' | ')} | cyw. T2 / T3 / T4 (śr.) | mediana wartości (mln) |`, `|---|---|${kam.map(() => '---').join('|')}|---|---|`];
  for (const g of grupy) {
    const w = g.wyniki;
    const n = w.length;
    const sr = (f: (x: WynikRundy3) => number) => w.reduce((s, x) => s + f(x), 0) / n;
    const komorki = kam.map((k) => {
      const s = statKamienia(w, k.klucz);
      return `${fd(s.mediana)} (${fd(s.p10)}–${fd(s.p90)}), ${f1(s.doCelu)}%${k.cel ? `, ${wOknie(s.mediana)}` : ''}`;
    });
    linie.push(`| ${g.wartosc} | ${n} | ${komorki.join(' | ')} | ${f1(sr((x) => x.kamienie['cywilizacji:T2:liczba'] ?? 0))} / ${f1(sr((x) => x.kamienie['cywilizacji:T3:liczba'] ?? 0))} / ${f1(sr((x) => x.kamienie['cywilizacji:T4:liczba'] ?? 0))} | ${f1(kwantyl(w.map((x) => x.wartoscKoncowa / 1e6), 0.5))} |`);
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

/** Wartość domyślna parametru przeglądu: wariant bazowy R:G:A jest jego wierszem bez osobnego przebiegu. */
function wartoscBazowa(param: Przeglad): number {
  return param === 'k' ? P.runda3.awans.k : param === 'xp' ? P.progresja.xpNaDobeLotu : param === 'progFirmy' ? 1 : P.progresja.k;
}

function main(): void {
  const [tryb = 'tabele', ...reszta] = process.argv.slice(2);
  if (tryb === 'siatka') {
    const n = Number(reszta[0]) || 30;
    const lista = reszta[1];
    const wszystkie: Wariant[] = [];
    for (const paliwo of ['R', 'D'] as const) for (const bramka of ['G', 'P'] as const) for (const pamiec of ['A', 'B', 'C'] as const) wszystkie.push({ paliwo, bramka, pamiec });
    const wybrane = !lista || lista === 'all' ? wszystkie : lista.split(',').map((s) => {
      const [paliwo, bramka, pamiec] = s.split(':') as [Wariant['paliwo'], Wariant['bramka'], Wariant['pamiec']];
      return { paliwo, bramka, pamiec };
    });
    for (const w of wybrane) licz(nazwaWariantu(w), w, n);
    return;
  }
  if (tryb === 'przeglad' || tryb === 'k') {
    const param = (tryb === 'k' ? 'k' : reszta.shift()) as Przeglad;
    if (!PRZEGLADY[param]) throw new Error(`Nieznany przegląd: ${param} (k | xp | progFirmy | kKadluba)`);
    const n = Number(reszta[0]) || 30;
    const wartosci = (reszta[1] ? reszta[1].split(',').map(Number) : PRZEGLADY[param].domyslne).filter((v) => v !== wartoscBazowa(param));
    for (const v of wartosci) licz(`${param}-${v}`, { paliwo: 'R', bramka: 'G', pamiec: 'A', przeglad: { param, wartosc: v } }, n);
    return;
  }
  // Tabele.
  const mapa = wczytajWyniki();
  if (!mapa.size) {
    console.log(`Brak wyników w ${KATALOG}. Uruchom: npm run runda3 -- siatka 30 all; npm run runda3 -- przeglad k 30`);
    return;
  }
  const jestPrzeglad = (k: string) => Object.keys(PRZEGLADY).some((p) => k.startsWith(`${p}-`));
  const siatka = [...mapa.entries()].filter(([k]) => !jestPrzeglad(k)).sort(([a], [b]) => (a < b ? -1 : 1));
  const baza = mapa.get('R:G:A') ?? siatka[0]?.[1] ?? [];
  const out: string[] = [];
  if (baza.length) out.push(`## Kamienie milowe — wariant bazowy R:G:A (${baza.length} ziaren, horyzont ${HORYZONT()} dób, cel ${HORYZONT_CELU})`, '', tabelaKamieni(baza), '');
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
  }
  if (baza.length) {
    out.push('## Krzywa wartości firmy (R:G:A)', '', tabelaKrzywej(baza), '');
    out.push('## Pojemność rynku dla 8 statków szczebla 5 (R:G:A)', '', tabelaPojemnosci(baza), '');
    out.push('## Okna stoczni na 100 dób (R:G:A)', '', tabelaOkien(baza), '');
    out.push(`## Stabilność ${HORYZONT()} dób na cywilizację (R:G:A, mediany po ziarnach)`, '', tabelaStabilnosci(baza), '');
    out.push('## Zasięg kadłubów: doby do najdalszej stolicy', '', tabelaZasiegu(baza), '');
  }
  for (const param of Object.keys(PRZEGLADY) as Przeglad[]) {
    const grupy = [...mapa.entries()].filter(([k]) => k.startsWith(`${param}-`)).map(([k, w]) => ({ wartosc: Number(k.slice(param.length + 1)), wyniki: w }));
    if (!grupy.length) continue;
    if (baza.length && !grupy.some((g) => g.wartosc === wartoscBazowa(param))) grupy.push({ wartosc: wartoscBazowa(param), wyniki: baza });
    grupy.sort((a, b) => a.wartosc - b.wartosc);
    out.push(`## Przegląd ${param} (R:G:A; ${PRZEGLADY[param].opis})`, '', tabelaPrzegladu(param, grupy), '');
  }
  console.log(out.join('\n'));
}

main();
