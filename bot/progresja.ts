/**
 * Pomiar progresji (PROMPT-progresja.md): skala L, horyzont `progresja.horyzontDob`, spread B, informacja pełna,
 * progresja włączona. Kamienie milowe (mediana i zakres 10–90%), odsetek ziaren z maksimum osi do doby 1000,
 * krzywa wartości firmy co 100 dób, stabilność gospodarki i przegląd parametrów `progAwansu`, `k`, `xpNaDobeLotu`.
 *
 * npm run progresja -- [liczba ziaren|-] [przeglad: progAwansu|k|xp|all|-] [wartości przeglądu rozdzielone przecinkami]
 */
import { Gra, K, P, TOWARY_I_PALIWO, type Raport } from '../sim/index';
import { zagrajZiarno } from './strategia';

const HORYZONT_CELU = 1000;
const KROK_KRZYWEJ = 100;

export interface Gospodarka {
  doba: number;
  /** Σ konsumpcja (łącznie z uśpioną) × cena bazowa, WU/dobę, po wszystkich portach. */
  pkbWU: number;
  /** Σ zapas × cena bazowa, WU. */
  zapasWU: number;
  /** Udział pozycji rynku z pustym zapasem albo na pułapie 6 norm. */
  naSufitach: number;
  nan: boolean;
}

export interface WynikProgresji {
  ziarno: string;
  /** Objazd 9 stolic najbliższym sąsiadem po grafie skoków (pc): dolne oszacowanie drogi do kontaktu ze wszystkimi. */
  objazdStolicPc: number;
  kamienie: Record<string, number>;
  /** Wartość firmy (kr + ładunek) i z kadłubem (+ wydatki na stocznię) co KROK_KRZYWEJ dób, indeks = doba / krok. */
  krzywa: { wartosc: number; zKadlubem: number }[];
  gospodarka: Gospodarka[];
  wartoscKoncowa: number;
  wydanoNaKadlub: number;
  szczebel: number;
  tiery: Record<string, number>;
  znanych: number;
  utknal: boolean;
  loty: number;
}

/** Długość objazdu wszystkich stolic od startu heurystyką najbliższego sąsiada po najkrótszych ścieżkach grafu. */
function objazdStolic(gra: Gra): number {
  const pozostale = new Set(gra.swiat.cywilizacje.map((c) => c.stolica));
  let tu = gra.swiat.startId;
  pozostale.delete(tu);
  let suma = 0;
  while (pozostale.size) {
    const d = gra.graf.dijkstra(tu);
    let naj: string | null = null;
    for (const id of pozostale) if (d.has(id) && (naj === null || d.get(id)!.dystans < d.get(naj)!.dystans)) naj = id;
    if (naj === null) return Infinity;
    suma += d.get(naj)!.dystans;
    pozostale.delete(naj);
    tu = naj;
  }
  return suma;
}

function gospodarka(gra: Gra): Gospodarka {
  let pkb = 0;
  let zapas = 0;
  let n = 0;
  let sufity = 0;
  let nan = false;
  for (const rynek of Object.values(gra.stan.rynki)) {
    for (const t of TOWARY_I_PALIWO) {
      const poz = rynek[t];
      const cena = K.towary[t].basePrice;
      pkb += (poz.konsumpcja + poz.konsumpcjaUspiona) * cena;
      zapas += poz.zapas * cena;
      n++;
      if (poz.zapas <= 1e-9 || poz.zapas >= P.maxZapasWNormach * poz.norma - 1e-9) sufity++;
      if (![poz.zapas, poz.norma, poz.produkcja, poz.konsumpcja].every(Number.isFinite)) nan = true;
    }
  }
  return { doba: gra.stan.doba, pkbWU: pkb, zapasWU: zapas, naSufitach: n ? sufity / n : 0, nan };
}

export function zagrajProgresje(ziarno: string): WynikProgresji {
  const krzywa: WynikProgresji['krzywa'] = [];
  const pomiary: Gospodarka[] = [];
  const znacznikiGospodarki = [0, 600, 1200];
  let nastepnyZnacznik = 0;
  const poLocie = (gra: Gra, _r: Raport) => {
    while (gra.stan.doba >= krzywa.length * KROK_KRZYWEJ && krzywa.length * KROK_KRZYWEJ <= gra.limitDob) {
      krzywa.push({ wartosc: gra.wartoscFirmy(), zKadlubem: gra.wartoscFirmy() + gra.stan.wydanoNaKadlub });
    }
    while (nastepnyZnacznik < znacznikiGospodarki.length && gra.stan.doba >= znacznikiGospodarki[nastepnyZnacznik]) {
      pomiary.push(gospodarka(gra));
      nastepnyZnacznik++;
    }
  };
  const naStarcie = (gra: Gra) => {
    krzywa.push({ wartosc: gra.wartoscFirmy(), zKadlubem: gra.wartoscFirmy() });
    pomiary.push(gospodarka(gra));
    nastepnyZnacznik = 1;
  };
  let koncowa: Gra | null = null;
  const w = zagrajZiarno(ziarno, { skala: 'L', informacja: 'pelna', spread: 'B', progresja: true }, { naStarcie, poLocie, naKoniec: (gra) => (koncowa = gra) });
  const gra = koncowa! as Gra;
  // Uzupełnij krzywą do końca horyzontu, gdy bot utknął albo ostatni lot nie przekroczył znacznika.
  while (krzywa.length * KROK_KRZYWEJ <= gra.limitDob) krzywa.push({ wartosc: gra.wartoscFirmy(), zKadlubem: gra.wartoscFirmy() + gra.stan.wydanoNaKadlub });
  while (nastepnyZnacznik < znacznikiGospodarki.length) {
    pomiary.push({ ...gospodarka(gra), doba: znacznikiGospodarki[nastepnyZnacznik] });
    nastepnyZnacznik++;
  }
  return {
    ziarno,
    objazdStolicPc: objazdStolic(gra),
    kamienie: { ...gra.stan.kamienie },
    krzywa,
    gospodarka: pomiary,
    wartoscKoncowa: w.wartoscKoncowa,
    wydanoNaKadlub: gra.stan.wydanoNaKadlub,
    szczebel: gra.stan.szczebel,
    tiery: { ...gra.stan.tiery },
    znanych: gra.swiat.cywilizacje.filter((c) => gra.stan.znaneCywilizacje[c.id]).length,
    utknal: w.utknal,
    loty: w.loty.length,
  };
}

// ---------- Statystyki ----------

function kwantyl(xs: number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export const KAMIENIE: { klucz: string; nazwa: string; os?: 'galaktyka' | 'firma' | 'zaloga' }[] = [
  ...[1, 2, 3, 4, 5].map((n) => ({ klucz: `szczebel:${n}`, nazwa: `Kadłub: szczebel ${n}`, os: n === 5 ? ('firma' as const) : undefined })),
  { klucz: 'kontakt:wszystkie', nazwa: 'Kontakt ze wszystkimi cywilizacjami' },
  { klucz: 'cywilizacja:pierwsza:T2', nazwa: 'Pierwsza cywilizacja na T2' },
  { klucz: 'cywilizacja:pierwsza:T3', nazwa: 'Pierwsza cywilizacja na T3' },
  { klucz: 'cywilizacja:pierwsza:T4', nazwa: 'Pierwsza cywilizacja na T4' },
  { klucz: 'cywilizacja:polowa:T4', nazwa: 'Połowa cywilizacji na T4' },
  { klucz: 'cywilizacja:wszystkie:T4', nazwa: 'Wszystkie cywilizacje na T4', os: 'galaktyka' },
  { klucz: 'zaloga:tier:1', nazwa: 'Pierwszy załogant: Weteran (500 XP)' },
  { klucz: 'zaloga:tier:2', nazwa: 'Pierwszy załogant: Mistrz (1 500 XP)' },
  { klucz: 'zaloga:tier:3', nazwa: 'Pierwszy załogant: Legenda (9 999 XP)' },
  { klucz: 'zaloga:wszyscy:legenda', nazwa: 'Cała załoga (4 miejsca) na Legendzie', os: 'zaloga' },
];

export interface StatKamienia {
  klucz: string;
  nazwa: string;
  osiagnelo: number;
  do1000: number;
  mediana: number;
  p10: number;
  p90: number;
}

export function statKamienia(wyniki: WynikProgresji[], klucz: string, nazwa = klucz): StatKamienia {
  const n = wyniki.length;
  const doby = wyniki.map((w) => w.kamienie[klucz]).filter((x): x is number => x !== undefined);
  const wszystkie = wyniki.map((w) => w.kamienie[klucz] ?? Infinity);
  return {
    klucz,
    nazwa,
    osiagnelo: (100 * doby.length) / n,
    do1000: (100 * wszystkie.filter((d) => d <= HORYZONT_CELU).length) / n,
    mediana: kwantyl(wszystkie, 0.5),
    p10: kwantyl(wszystkie, 0.1),
    p90: kwantyl(wszystkie, 0.9),
  };
}

const fd = (x: number) => (Number.isFinite(x) ? x.toFixed(0) : '> horyzont');
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');
const fmln = (x: number) => (Number.isFinite(x) ? (x / 1e6).toFixed(1) : '—');

export function tabelaKamieni(wyniki: WynikProgresji[]): string {
  const linie = ['| Kamień milowy | mediana doby | 10–90% | osiągnęło do 1000 | osiągnęło do 1200 |', '|---|---|---|---|---|'];
  for (const k of KAMIENIE) {
    const s = statKamienia(wyniki, k.klucz, k.nazwa);
    linie.push(`| ${k.nazwa}${k.os ? ` **(maksimum osi: ${k.os})**` : ''} | ${fd(s.mediana)} | ${fd(s.p10)}–${fd(s.p90)} | ${f1(s.do1000)}% | ${f1(s.osiagnelo)}% |`);
  }
  return linie.join('\n');
}

export function tabelaKrzywej(wyniki: WynikProgresji[]): string {
  const dl = Math.max(...wyniki.map((w) => w.krzywa.length));
  const linie = ['| Doba | mediana wartości firmy (kr + ładunek) | mediana z kadłubem | × start |', '|---|---|---|---|'];
  for (let i = 0; i < dl; i++) {
    const w1 = kwantyl(wyniki.map((w) => w.krzywa[Math.min(i, w.krzywa.length - 1)].wartosc), 0.5);
    const w2 = kwantyl(wyniki.map((w) => w.krzywa[Math.min(i, w.krzywa.length - 1)].zKadlubem), 0.5);
    linie.push(`| ${i * KROK_KRZYWEJ} | ${fmln(w1)} mln | ${fmln(w2)} mln | ×${(w2 / K.startingCredits).toFixed(2)} |`);
  }
  return linie.join('\n');
}

export function tabelaGospodarki(wyniki: WynikProgresji[]): string {
  const linie = ['| Miara | d0 | d600 | d1200 | wzrost d0–600 | wzrost d600–1200 |', '|---|---|---|---|---|---|'];
  const med = (i: number, f: (g: Gospodarka) => number) => kwantyl(wyniki.map((w) => f(w.gospodarka[i])), 0.5);
  const wiersz = (nazwa: string, f: (g: Gospodarka) => number, wzgledny: boolean) => {
    const a = med(0, f);
    const b = med(1, f);
    const c = med(2, f);
    const w1 = wyniki.map((w) => (wzgledny ? f(w.gospodarka[1]) / f(w.gospodarka[0]) : f(w.gospodarka[1]) - f(w.gospodarka[0])));
    const w2 = wyniki.map((w) => (wzgledny ? f(w.gospodarka[2]) / f(w.gospodarka[1]) : f(w.gospodarka[2]) - f(w.gospodarka[1])));
    const fw = (x: number) => (wzgledny ? `×${x.toFixed(3)}` : `${(100 * x).toFixed(1)} pkt`);
    const fv = (x: number) => (wzgledny ? `${(x / 1e6).toFixed(2)} mln WU` : `${(100 * x).toFixed(1)}%`);
    linie.push(`| ${nazwa} | ${fv(a)} | ${fv(b)} | ${fv(c)} | ${fw(kwantyl(w1, 0.5))} | ${fw(kwantyl(w2, 0.5))} |`);
  };
  wiersz('Dzienny PKB portów (mediana ziaren)', (g) => g.pkbWU, true);
  wiersz('Wartość zapasów portów', (g) => g.zapasWU, true);
  wiersz('Pozycje rynku na sufitach (zapas 0 albo 6 norm)', (g) => g.naSufitach, false);
  const nan = wyniki.filter((w) => w.gospodarka.some((g) => g.nan)).length;
  linie.push(`| Ziarna z NaN w rynkach | ${nan} | | | | |`);
  return linie.join('\n');
}

export function uruchomProgresje(liczba: number, pierwsze = P.bot.pierwszeZiarno): { wyniki: WynikProgresji[]; sekundy: number } {
  const start = Date.now();
  const wyniki: WynikProgresji[] = [];
  for (let i = 0; i < liczba; i++) wyniki.push(zagrajProgresje(String(pierwsze + i)));
  return { wyniki, sekundy: (Date.now() - start) / 1000 };
}

export type Parametr = 'progAwansu' | 'k' | 'xp';

const DOMYSLNE_WARTOSCI: Record<Parametr, number[]> = {
  progAwansu: [0.25, 0.5, 1, 2, 5, 10],
  k: [2, 5, 10, 20, 40],
  xp: [2, 5, 8, 10, 12, 15],
};

function ustaw(parametr: Parametr, wartosc: number): () => void {
  const pr = P.progresja;
  if (parametr === 'progAwansu') {
    const stara = pr.progAwansu;
    pr.progAwansu = wartosc;
    return () => void (pr.progAwansu = stara);
  }
  if (parametr === 'k') {
    const stara = pr.k;
    pr.k = wartosc;
    return () => void (pr.k = stara);
  }
  const stara = pr.xpNaDobeLotu;
  pr.xpNaDobeLotu = wartosc;
  return () => void (pr.xpNaDobeLotu = stara);
}

/** Przegląd jednego parametru: dla każdej wartości mediana dób do maksimum osi (i do kamieni pośrednich). */
export function przeglad(parametr: Parametr, wartosci: number[], liczba: number): string {
  const klucze: Record<Parametr, string[]> = {
    progAwansu: ['cywilizacja:pierwsza:T2', 'cywilizacja:pierwsza:T3', 'cywilizacja:pierwsza:T4', 'cywilizacja:polowa:T4', 'cywilizacja:wszystkie:T4'],
    k: ['szczebel:1', 'szczebel:3', 'szczebel:5'],
    xp: ['zaloga:tier:1', 'zaloga:tier:2', 'zaloga:tier:3', 'zaloga:wszyscy:legenda'],
  };
  const naglowek = `| \`${parametr === 'xp' ? 'xpNaDobeLotu' : parametr}\` | ${klucze[parametr].map((k) => KAMIENIE.find((x) => x.klucz === k)?.nazwa ?? k).join(' | ')} | maksimum do 1000 | mediana wartości z kadłubem d1200 | utknęło |`;
  const linie = [naglowek, `|---|${klucze[parametr].map(() => '---').join('|')}|---|---|---|`];
  for (const v of wartosci) {
    const przywroc = ustaw(parametr, v);
    const { wyniki, sekundy } = uruchomProgresje(liczba);
    przywroc();
    const kom = klucze[parametr].map((k) => {
      const s = statKamienia(wyniki, k);
      return `${fd(s.mediana)} (${fd(s.p10)}–${fd(s.p90)})`;
    });
    const maks = statKamienia(wyniki, klucze[parametr][klucze[parametr].length - 1]);
    const wart = kwantyl(wyniki.map((w) => w.krzywa[w.krzywa.length - 1].zKadlubem), 0.5);
    linie.push(`| ${v} | ${kom.join(' | ')} | ${f1(maks.do1000)}% | ${fmln(wart)} mln | ${wyniki.filter((w) => w.utknal).length} |`);
    console.error(`przegląd ${parametr}=${v}: ${sekundy.toFixed(0)} s`);
  }
  return linie.join('\n');
}

const uruchomionyBezposrednio = process.argv[1] && /progresja\.ts$|progresja\.js$/.test(process.argv[1]);
if (uruchomionyBezposrednio) {
  const liczba = process.argv[2] && process.argv[2] !== '-' ? Number(process.argv[2]) : P.bot.liczbaZiarenL;
  const co = process.argv[3] ?? '-';
  const wartosci = process.argv[4] ? process.argv[4].split(',').map(Number) : null;
  const pr = P.progresja;
  console.log(`Progresja: L, ${pr.horyzontDob} dób, spread B, informacja pełna, ${liczba} ziaren; progAwansu ${pr.progAwansu}, k ${pr.k}, mnoznikSzczebla ${pr.mnoznikSzczebla}, xpNaDobeLotu ${pr.xpNaDobeLotu}, xpZaKontakt ${pr.xpZaKontakt}`);
  if (co === '-' || co === 'glowny') {
    const { wyniki, sekundy } = uruchomProgresje(liczba);
    console.log(`\n### Kamienie milowe (${liczba} ziaren, ${sekundy.toFixed(0)} s)\n`);
    console.log(tabelaKamieni(wyniki));
    console.log(`\n### Krzywa wartości firmy\n`);
    console.log(tabelaKrzywej(wyniki));
    console.log(`\n### Stabilność gospodarki\n`);
    console.log(tabelaGospodarki(wyniki));
    const znanych = kwantyl(wyniki.map((w) => w.znanych), 0.5);
    const szczebel = kwantyl(wyniki.map((w) => w.szczebel), 0.5);
    const tierSuma = wyniki.map((w) => Object.values(w.tiery).reduce((s, t) => s + t, 0) / Object.keys(w.tiery).length);
    console.log(`\nMediana znanych cywilizacji na koniec: ${znanych}; mediana szczebla: ${szczebel}; mediana średniego tieru cywilizacji: ${kwantyl(tierSuma, 0.5).toFixed(2)}; utknęło: ${wyniki.filter((w) => w.utknal).length}; mediana lotów: ${kwantyl(wyniki.map((w) => w.loty), 0.5)}`);
    const objazd = kwantyl(wyniki.map((w) => w.objazdStolicPc), 0.5);
    console.log(`Objazd 9 stolic (najbliższy sąsiad po grafie skoków), mediana: ${objazd.toFixed(0)} pc = ${(objazd / K.predkoscNominalna).toFixed(0)} dób przy ${K.predkoscNominalna} pc/dobę; paliwo ${(objazd * K.kosztPaliwaNaParsek).toFixed(0)} m³ = ${((objazd * K.kosztPaliwaNaParsek * K.kurs * K.towary.Fuel.basePrice) / 1e6).toFixed(1)} mln kr po cenie bazowej (kapitał startowy ${(K.startingCredits / 1e6).toFixed(1)} mln).`);
  } else {
    const lista: Parametr[] = co === 'all' ? ['progAwansu', 'k', 'xp'] : [co as Parametr];
    for (const p of lista) {
      console.log(`\n### Przegląd: ${p}\n`);
      console.log(przeglad(p, wartosci ?? DOMYSLNE_WARTOSCI[p], liczba));
    }
  }
}
