import { Losowosc } from './losowosc';
import { krokRynku } from './rynek';
import { K, P, type CywilizacjaProfil } from './stale';
import { Graf, odleglosc } from './trasa';
import {
  TOWARY,
  TOWARY_I_PALIWO,
  type Krawedz,
  type ProfilCywilizacji,
  type Rynek,
  type Skala,
  type Swiat,
  type Towar,
  type TowarLubPaliwo,
  type Wezel,
} from './typy';

const STOPNIE_W_RADIANACH = Math.PI / 180;

export interface Wygenerowany {
  swiat: Swiat;
  rynki: Record<string, Rynek>;
}

function identyfikator(nazwa: string): string {
  return nazwa
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-');
}

function pusteWartosci(): Record<TowarLubPaliwo, number> {
  const r = {} as Record<TowarLubPaliwo, number>;
  for (const t of TOWARY_I_PALIWO) r[t] = 0;
  return r;
}

/** Krawędzie = wszystkie pary węzłów w odległości ≤ skok podstawowy (siatka przestrzenna). */
export function krawedzie(wezly: Wezel[]): Krawedz[] {
  const skok = K.skokPodstawowy;
  const komorki = new Map<string, number[]>();
  const klucz = (x: number, y: number) => `${Math.floor(x / skok)},${Math.floor(y / skok)}`;
  wezly.forEach((w, i) => {
    const k = klucz(w.x, w.y);
    const lista = komorki.get(k);
    if (lista) lista.push(i);
    else komorki.set(k, [i]);
  });
  const wynik: Krawedz[] = [];
  wezly.forEach((w, i) => {
    const cx = Math.floor(w.x / skok);
    const cy = Math.floor(w.y / skok);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const lista = komorki.get(`${cx + dx},${cy + dy}`);
        if (!lista) continue;
        for (const j of lista) {
          if (j <= i) continue;
          const d = odleglosc(w, wezly[j]);
          if (d <= skok) wynik.push({ a: w.id, b: wezly[j].id, dystans: d });
        }
      }
    }
  });
  return wynik;
}

// ====================================================================================
// Świat S: hub + dwa ramiona (dotychczasowy generator, regresja)
// ====================================================================================

interface UkladS {
  wezly: Wezel[];
  startId: string;
}

function probaUkladuS(rng: Losowosc): UkladS | null {
  const U = P.swiatS.uklad;
  const hub = P.swiatS.cywilizacje.find((c) => c.rola === 'hub');
  const ramiona = P.swiatS.cywilizacje.filter((c) => c.rola === 'ramie');
  if (!hub) throw new Error('prototyp.json: brak cywilizacji o roli hub');
  if (ramiona.length !== P.swiatS.punktyTankowania.length) throw new Error('prototyp.json: liczba ramion musi równać się liczbie punktów tankowania');

  const wezly: Wezel[] = [];
  let startId: string | null = null;

  const dodajPlanete = (c: CywilizacjaProfil, i: number, x: number, y: number) => {
    const p = c.planety[i];
    const id = identyfikator(p.nazwa);
    wezly.push({ id, nazwa: p.nazwa, typ: 'planeta', x, y, cywilizacja: c.id, populacjaMln: p.populacjaMln, zamieszkiwalny: true });
    if (c.start && i === 0) startId = id;
  };

  const katHuba = rng.zakres(0, 360);
  const krokHuba = 360 / hub.planety.length;
  hub.planety.forEach((_, i) => {
    const kat = (katHuba + i * krokHuba + rng.zakres(-U.jitterKatStopnie, U.jitterKatStopnie)) * STOPNIE_W_RADIANACH;
    const r = U.promienHubaPc + rng.zakres(-U.jitterPc, U.jitterPc);
    dodajPlanete(hub, i, r * Math.cos(kat), r * Math.sin(kat));
  });

  let azymut = rng.zakres(0, 360);
  ramiona.forEach((c, j) => {
    if (j > 0) azymut += rng.zakres(U.katMiedzyRamionamiStopnie[0], U.katMiedzyRamionamiStopnie[1]);
    const kat = azymut * STOPNIE_W_RADIANACH;
    const kier = { x: Math.cos(kat), y: Math.sin(kat) };
    const prost = { x: -kier.y, y: kier.x };
    const pozycja = (dystans: number) => {
      const d = dystans + rng.zakres(-U.jitterPc, U.jitterPc);
      const b = rng.zakres(-U.jitterPc, U.jitterPc);
      return { x: kier.x * d + prost.x * b, y: kier.y * d + prost.y * b };
    };
    const t = pozycja(U.odlegloscTankowaniaPc);
    const nazwaT = P.swiatS.punktyTankowania[j].nazwa;
    wezly.push({ id: identyfikator(nazwaT), nazwa: nazwaT, typ: 'tankowanie', x: t.x, y: t.y, zamieszkiwalny: true });
    c.planety.forEach((_, i) => {
      const pz = pozycja(U.odlegloscTankowaniaPc + U.krokRamieniaPc * (i + 1));
      dodajPlanete(c, i, pz.x, pz.y);
    });
  });

  if (!startId) throw new Error('prototyp.json: żadna cywilizacja nie ma start=true');

  for (let i = 0; i < wezly.length; i++) {
    if (Math.hypot(wezly[i].x, wezly[i].y) > U.promienGalaktykiPc) return null;
    for (let j = i + 1; j < wezly.length; j++) {
      if (odleglosc(wezly[i], wezly[j]) < U.minOdstepPc) return null;
    }
  }
  const graf = new Graf(wezly, krawedzie(wezly));
  if (!graf.spojny()) return null;
  return { wezly, startId };
}

function profileCywilizacjiS(wezly: Wezel[], rynki: Record<string, Rynek>): ProfilCywilizacji[] {
  return P.swiatS.cywilizacje.map((c) => {
    const planety = wezly.filter((w) => w.cywilizacja === c.id).map((w) => w.id);
    const populacja = c.planety.reduce((s, p) => s + p.populacjaMln, 0);
    const potrzeby = pusteWartosci();
    const produkcja = pusteWartosci();
    for (const id of planety) {
      for (const t of TOWARY_I_PALIWO) {
        potrzeby[t] += rynki[id][t].konsumpcja + rynki[id][t].konsumpcjaUspiona;
        produkcja[t] += rynki[id][t].produkcja;
      }
    }
    return {
      id: c.id,
      nazwa: c.nazwa,
      znanaNaStarcie: c.znanaNaStarcie,
      populacjaMln: populacja,
      planety,
      potrzebyM3NaDobe: potrzeby,
      produkcjaM3NaDobe: produkcja,
      otwartosc: c.otwartosc,
      ssr: potrzeby.Food > 0 ? produkcja.Food / potrzeby.Food : 0,
      kolor: c.kolor,
      stolica: planety[0],
    };
  });
}

/**
 * Rynki planet S. Specjalizacja planety przesuwa produkcję wewnątrz cywilizacji,
 * ale suma produkcji cywilizacji pozostaje równa profilowi per capita × populacja.
 */
function rynkiStartoweS(wezly: Wezel[], rng: Losowosc): Record<string, Rynek> {
  const S = P.swiatS;
  const rynki: Record<string, Rynek> = {};
  for (const c of S.cywilizacje) {
    const populacja = c.planety.reduce((s, p) => s + p.populacjaMln, 0);
    for (const t of TOWARY_I_PALIWO) {
      const wazona = c.planety.reduce((s, p) => s + p.populacjaMln * (p.specjalizacja[t] ?? 1), 0);
      const normalizacja = wazona > 0 ? populacja / wazona : 0;
      for (const p of c.planety) {
        const id = identyfikator(p.nazwa);
        rynki[id] ??= {} as Rynek;
        const konsumpcja = c.potrzebyM3NaMlnNaDobe[t] * p.populacjaMln;
        const produkcja = c.produkcjaM3NaMlnNaDobe[t] * p.populacjaMln * (p.specjalizacja[t] ?? 1) * normalizacja;
        const norma = K.normaZapasu * konsumpcja;
        const start = S.zapasStartowyUlamekNormy + S.zapasStartowyJitter * rng.zakres(-1, 1);
        const uspiona = !c.znanaNaStarcie && t === 'Electronics';
        rynki[id][t] = {
          zapas: norma * start,
          norma,
          produkcja,
          konsumpcja: uspiona ? 0 : konsumpcja,
          konsumpcjaUspiona: uspiona ? konsumpcja : 0,
          otwartosc: c.otwartosc,
        };
      }
    }
  }
  void wezly;
  for (const rynek of Object.values(rynki)) {
    for (const t of TOWARY_I_PALIWO) krokRynku(rynek[t], S.dobyRozruchuRynku);
  }
  for (const c of S.cywilizacje) {
    if (c.znanaNaStarcie) continue;
    for (const p of c.planety) {
      const poz = rynki[identyfikator(p.nazwa)].Electronics;
      poz.zapas = poz.norma * P.kontaktZapasElektronikiUlamekNormy;
    }
  }
  return rynki;
}

function generujSwiatS(ziarno: string): Wygenerowany {
  const rng = new Losowosc(ziarno);
  const rngUkladu = rng.odgalezienie('uklad');
  let uklad: UkladS | null = null;
  for (let proba = 0; proba < P.swiatS.uklad.maxProb && !uklad; proba++) uklad = probaUkladuS(rngUkladu);
  if (!uklad) throw new Error(`Nie udało się ułożyć spójnej galaktyki dla ziarna "${ziarno}"`);
  const rynki = rynkiStartoweS(uklad.wezly, rng.odgalezienie('rynki'));
  const swiat: Swiat = {
    ziarno,
    skala: 'S',
    wezly: uklad.wezly,
    krawedzie: krawedzie(uklad.wezly),
    cywilizacje: profileCywilizacjiS(uklad.wezly, rynki),
    startId: uklad.startId,
  };
  return { swiat, rynki };
}

// ====================================================================================
// Galaktyka kanonu (skale M i L): pierścień zamieszkiwalny, sektory, terytoria, szlaki
// ====================================================================================

interface Uklad {
  x: number;
  y: number;
  r: number;
  sektor: number;
}

interface Terytorium {
  id: string;
  sektor: number;
  start: boolean;
  znanaNaStarcie: boolean;
  uklady: number[];
  stolica: number;
  wagi: number[];
  T: number;
}

/** Zdatność do zamieszkania w funkcji promienia (ułamek R): 0 w rdzeniu, liniowo do 1, 1 w strefie, 0 poza nią. */
export function zdatnosc(r: number): number {
  const R = K.promienGalaktyki;
  const od = K.gradientZdatnosci.od * R;
  const doPelnej = K.gradientZdatnosci.do * R;
  const zewn = K.habitableZoneOuter * R;
  if (r <= od) return 0;
  if (r < doPelnej) return (r - od) / (doPelnej - od);
  if (r <= zewn) return 1;
  return 0;
}

export function sektorKata(kat: number): number {
  const katSektora = (2 * Math.PI) / K.SectorCount;
  const znorm = ((kat % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  return Math.min(K.SectorCount - 1, Math.floor(znorm / katSektora));
}

/** Liczba układów cywilizacji z populacji według kanonu: round(3 + 2,2 × log10(pop_mln) + rozrzut). */
export function terytoriumZPopulacji(populacjaMln: number, rozrzut: number): number {
  const F = K.terytoriumZPopulacji;
  return Math.max(1, Math.round(F.staly + F.naDekade * Math.log10(populacjaMln) + rozrzut));
}

function nazwaZSylab(rng: Losowosc, sylaby: string[], zajete: Set<string>): string {
  for (let proba = 0; proba < 50; proba++) {
    const n = rng.calkowita(2, 3);
    let s = '';
    for (let i = 0; i < n; i++) s += rng.wybierz(sylaby);
    const nazwa = s.charAt(0).toUpperCase() + s.slice(1);
    if (!zajete.has(nazwa)) {
      zajete.add(nazwa);
      return nazwa;
    }
  }
  const nazwa = `${rng.wybierz(sylaby)}${zajete.size}`;
  zajete.add(nazwa);
  return nazwa;
}

function probaGalaktyki(rng: Losowosc, skala: 'M' | 'L', tryb: TrybRynku): Wygenerowany | null {
  const cfg = P.skale[skala];
  const G = P.galaktyka;
  const R = K.promienGalaktyki;
  const rRdzen = K.DeadCoreFraction * R;
  const rZewn = K.habitableZoneOuter * R;
  const katSektora = (2 * Math.PI) / K.SectorCount;
  const sektory = cfg.sektory!;
  const N = cfg.ukladyZamieszkiwalne!;

  // 1. Układy zamieszkiwalne: gęstość ∝ zdatność × promień, w wybranych sektorach, z minimalnym odstępem.
  const uklady: Uklad[] = [];
  for (let proba = 0; proba < G.maxProbLosowania && uklady.length < N; proba++) {
    const r = rng.zakres(rRdzen, rZewn);
    if (rng.los() > zdatnosc(r) * (r / rZewn)) continue;
    const sektor = rng.wybierz(sektory);
    const kat = (sektor + rng.los()) * katSektora;
    const x = r * Math.cos(kat);
    const y = r * Math.sin(kat);
    let zaBlisko = false;
    for (const u of uklady) {
      if (Math.hypot(u.x - x, u.y - y) < G.minOdstepZamieszkiwalnychPc) {
        zaBlisko = true;
        break;
      }
    }
    if (zaBlisko) continue;
    uklady.push({ x, y, r, sektor });
  }
  if (uklady.length < N) return null;

  // 2. Terytoria cywilizacji: rozmiar z populacji, zwarty obszar wokół zalążka w swoim sektorze.
  const wlasciciel: (string | null)[] = uklady.map(() => null);
  const lista = cfg.cywilizacje!.map((c, i) => ({
    ...c,
    i,
    T: terytoriumZPopulacji(P.cywilizacjeKanonu[c.id].populacjaMln, rng.zakres(-G.rozrzutTerytorium, G.rozrzutTerytorium)),
  }));
  lista.sort((a, b) => b.T - a.T || a.i - b.i);
  const terytoria: Terytorium[] = [];
  const srodki: { sektor: number; x: number; y: number }[] = [];
  const zajeteUklady: number[] = [];
  for (const c of lista) {
    const wSektorze = () => uklady.map((_, i) => i).filter((i) => wlasciciel[i] === null && uklady[i].sektor === c.sektor);
    const wolne = () => uklady.map((_, i) => i).filter((i) => wlasciciel[i] === null);
    let pula = wSektorze();
    if (pula.length === 0) pula = wolne();
    if (pula.length === 0) return null;
    const inniWSektorze = srodki.filter((s) => s.sektor === c.sektor);
    let zalazek: number;
    if (inniWSektorze.length === 0) {
      zalazek = rng.wybierz(pula);
    } else {
      // Kolejna cywilizacja w sektorze: przy granicy poprzednich (sąsiedztwo = krótkie trasy międzycywilizacyjne)
      // albo najdalej od nich, zależnie od ustawienia.
      zalazek = pula[0];
      let najlepiej = G.sasiedztwoTerytoriow ? Infinity : -1;
      for (const i of pula) {
        const d = Math.min(...zajeteUklady.map((j) => odleglosc(uklady[j], uklady[i])));
        if (G.sasiedztwoTerytoriow ? d < najlepiej : d > najlepiej) {
          najlepiej = d;
          zalazek = i;
        }
      }
    }
    const czlonkowie = [zalazek];
    wlasciciel[zalazek] = c.id;
    zajeteUklady.push(zalazek);
    let sx = uklady[zalazek].x;
    let sy = uklady[zalazek].y;
    while (czlonkowie.length < c.T) {
      let kandydaci = wSektorze();
      if (kandydaci.length === 0) kandydaci = wolne();
      if (kandydaci.length === 0) break;
      const cx = sx / czlonkowie.length;
      const cy = sy / czlonkowie.length;
      let najblizszy = kandydaci[0];
      let najmniej = Infinity;
      for (const i of kandydaci) {
        const d = Math.hypot(uklady[i].x - cx, uklady[i].y - cy);
        if (d < najmniej) {
          najmniej = d;
          najblizszy = i;
        }
      }
      czlonkowie.push(najblizszy);
      wlasciciel[najblizszy] = c.id;
      zajeteUklady.push(najblizszy);
      sx += uklady[najblizszy].x;
      sy += uklady[najblizszy].y;
    }
    const cx = sx / czlonkowie.length;
    const cy = sy / czlonkowie.length;
    srodki.push({ sektor: c.sektor, x: cx, y: cy });
    let stolica = czlonkowie[0];
    let najmniej = Infinity;
    for (const i of czlonkowie) {
      const d = Math.hypot(uklady[i].x - cx, uklady[i].y - cy);
      if (d < najmniej) {
        najmniej = d;
        stolica = i;
      }
    }
    // Wagi układów: ranga odległości od stolicy, w ∝ ranga^(−wykładnik), średnia 1.
    const wgOdleglosci = [...czlonkowie].sort((a, b) => odleglosc(uklady[a], uklady[stolica]) - odleglosc(uklady[b], uklady[stolica]) || a - b);
    const surowe = wgOdleglosci.map((_, r) => Math.pow(r + 1, -G.wykladnikWagiUkladu));
    const srednia = surowe.reduce((s, w) => s + w, 0) / surowe.length;
    terytoria.push({ id: c.id, sektor: c.sektor, start: c.start, znanaNaStarcie: c.znanaNaStarcie, uklady: wgOdleglosci, stolica, wagi: surowe.map((w) => w / srednia), T: c.T });
  }

  // 3. Węzły zamieszkiwalne: planety cywilizacji i układy plemion (tylko paliwo).
  const wezly: Wezel[] = [];
  const idUkladu: string[] = uklady.map(() => '');
  const zajeteNazwy = new Set<string>();
  let startId: string | null = null;
  for (const t of terytoria) {
    const profil = P.cywilizacjeKanonu[t.id];
    const populacja = profil.populacjaMln;
    t.uklady.forEach((i, r) => {
      const u = uklady[i];
      const nazwa = nazwaZSylab(rng, profil.sylaby, zajeteNazwy);
      const id = `${t.id}-${identyfikator(nazwa)}`;
      idUkladu[i] = id;
      wezly.push({ id, nazwa, typ: 'planeta', x: u.x, y: u.y, cywilizacja: t.id, populacjaMln: Math.round((populacja * t.wagi[r]) / t.T), sektor: u.sektor, zamieszkiwalny: true });
      if (t.start && i === t.stolica) startId = id;
    });
  }
  let nrPlemion = 0;
  uklady.forEach((u, i) => {
    if (wlasciciel[i] !== null) return;
    nrPlemion++;
    const id = `plemiona-${nrPlemion}`;
    idUkladu[i] = id;
    wezly.push({ id, nazwa: `Plemiona ${nrPlemion}`, typ: 'tankowanie', x: u.x, y: u.y, sektor: u.sektor, zamieszkiwalny: true });
  });
  if (!startId) return null;

  // 4. Szlaki: minimalne drzewo rozpinające układów zamieszkiwalnych + najbliżsi sąsiedzi; wzdłuż szlaków układy przelotowe.
  const szlaki = new Set<string>();
  const dodajSzlak = (a: number, b: number) => szlaki.add(a < b ? `${a}:${b}` : `${b}:${a}`);
  const wDrzewie = new Array<boolean>(N).fill(false);
  const najblizszyDystans = new Array<number>(N).fill(Infinity);
  const najblizszyZ = new Array<number>(N).fill(0);
  wDrzewie[0] = true;
  for (let i = 1; i < N; i++) {
    najblizszyDystans[i] = odleglosc(uklady[i], uklady[0]);
  }
  for (let krok = 1; krok < N; krok++) {
    let wybrany = -1;
    let najmniej = Infinity;
    for (let i = 0; i < N; i++) {
      if (!wDrzewie[i] && najblizszyDystans[i] < najmniej) {
        najmniej = najblizszyDystans[i];
        wybrany = i;
      }
    }
    if (wybrany < 0) break;
    wDrzewie[wybrany] = true;
    dodajSzlak(wybrany, najblizszyZ[wybrany]);
    for (let i = 0; i < N; i++) {
      if (wDrzewie[i]) continue;
      const d = odleglosc(uklady[i], uklady[wybrany]);
      if (d < najblizszyDystans[i]) {
        najblizszyDystans[i] = d;
        najblizszyZ[i] = wybrany;
      }
    }
  }
  // Graf względnego sąsiedztwa: szlak a–b istnieje, gdy żaden układ c nie leży bliżej obu końców niż one siebie.
  const maxSzlak = G.maxDlugoscSzlakuDodatkowegoPc;
  for (let a = 0; a < N; a++) {
    for (let b = a + 1; b < N; b++) {
      const dab = odleglosc(uklady[a], uklady[b]);
      if (dab > maxSzlak) continue;
      let blokuje = false;
      for (let c = 0; c < N && !blokuje; c++) {
        if (c === a || c === b) continue;
        if (odleglosc(uklady[a], uklady[c]) < dab && odleglosc(uklady[b], uklady[c]) < dab) blokuje = true;
      }
      if (!blokuje) dodajSzlak(a, b);
    }
  }
  let nrPrzelotu = 0;
  for (const klucz of [...szlaki].sort()) {
    const [a, b] = klucz.split(':').map(Number);
    const A = uklady[a];
    const B = uklady[b];
    const dl = odleglosc(A, B);
    const n = Math.ceil(dl / G.krokPrzelotuPc);
    if (n <= 1) continue;
    const prost = { x: -(B.y - A.y) / dl, y: (B.x - A.x) / dl };
    for (let t = 1; t < n; t++) {
      const bok = rng.zakres(-G.jitterPrzelotuPc, G.jitterPrzelotuPc);
      const x = A.x + ((B.x - A.x) * t) / n + prost.x * bok;
      const y = A.y + ((B.y - A.y) * t) / n + prost.y * bok;
      nrPrzelotu++;
      wezly.push({ id: `przelot-${nrPrzelotu}`, nazwa: `Przelot ${nrPrzelotu}`, typ: 'przelot', x, y, sektor: sektorKata(Math.atan2(y, x)), zamieszkiwalny: false });
    }
  }

  const kraw = krawedzie(wezly);
  const graf = new Graf(wezly, kraw);
  if (!graf.spojny()) return null;

  // 5. Rynki portowe cywilizacji kanonu (runda 3: z ludności planet).
  const populacje = uklady.map((_, i) => wezly.find((w) => w.id === idUkladu[i])?.populacjaMln ?? 0);
  const rynki = rynkiGalaktyki(rng.odgalezienie('rynki'), terytoria, idUkladu, populacje, tryb);
  const cywilizacje: ProfilCywilizacji[] = terytoria.map((t) => {
    const kanon = K.cywilizacje[t.id];
    const planety = t.uklady.map((i) => idUkladu[i]);
    const potrzeby = pusteWartosci();
    const produkcja = pusteWartosci();
    for (const id of planety) {
      for (const g of TOWARY_I_PALIWO) {
        potrzeby[g] += rynki[id][g].konsumpcja + rynki[id][g].konsumpcjaUspiona;
        produkcja[g] += rynki[id][g].produkcja;
      }
    }
    return {
      id: t.id,
      nazwa: kanon.nazwa,
      znanaNaStarcie: t.znanaNaStarcie,
      populacjaMln: P.cywilizacjeKanonu[t.id].populacjaMln,
      planety,
      potrzebyM3NaDobe: potrzeby,
      produkcjaM3NaDobe: produkcja,
      otwartosc: kanon.otwartosc,
      ssr: kanon.ssr,
      kolor: P.cywilizacjeKanonu[t.id].kolor,
      sektor: t.sektor,
      stolica: idUkladu[t.stolica],
    };
  });
  // Kolejność cywilizacji jak w konfiguracji skali.
  const kolejnosc = new Map(cfg.cywilizacje!.map((c, i) => [c.id, i]));
  cywilizacje.sort((a, b) => kolejnosc.get(a.id)! - kolejnosc.get(b.id)!);

  const swiat: Swiat = {
    ziarno: '',
    skala,
    wezly,
    krawedzie: kraw,
    cywilizacje,
    startId,
    geometria: { promien: R, rdzen: rRdzen, strefaOd: K.habitableZoneInner * R, strefaDo: rZewn, sektory, liczbaSektorow: K.SectorCount },
  };
  return { swiat, rynki };
}

/**
 * Rynek portowy układu: konsumpcja = port bazowy × potrzeby cywilizacji × waga układu × głębokość portu (z otwartości),
 * produkcja = konsumpcja × (produkcja/potrzeby cywilizacji; dla Żywności SSR z kanonu) × specjalizacja układu,
 * znormalizowana tak, by suma produkcji cywilizacji była dokładnie równa stosunkowi × suma konsumpcji.
 */
/** Runda 3: minimalny tier sektora produkującego towar (`SectorMinTier` kanonu przez mapowanie sektorów prototypu); Infinity, gdy brak sektora. */
export function minTierTowaru(g: TowarLubPaliwo): number {
  const i = P.runda3.rynek.sektory.findIndex((s) => s.towar === g);
  return i >= 0 ? K.SectorMinTier[i] : Infinity;
}

/**
 * Runda 3: konsumpcja planety z ludności = konsumpcjaNaMlnNaDobe × potrzeby rasy × populacja (mln) × koszyk tieru.
 */
export function konsumpcjaZLudnosci(idCyw: string, populacjaMln: number, g: TowarLubPaliwo, tier: number): number {
  const R = P.runda3.rynek;
  const koszyk = R.koszykTieru[Math.min(tier, R.koszykTieru.length) - 1];
  return R.konsumpcjaNaMlnNaDobe[g] * P.cywilizacjeKanonu[idCyw].potrzeby[g] * populacjaMln * koszyk[g];
}

export interface TrybRynku {
  runda3: boolean;
  bramka: 'G' | 'P';
}

function rynkiGalaktyki(rng: Losowosc, terytoria: Terytorium[], idUkladu: string[], populacje: number[], tryb: TrybRynku): Record<string, Rynek> {
  const G = P.galaktyka;
  const rynki: Record<string, Rynek> = {};
  for (const t of terytoria) {
    const kanon = K.cywilizacje[t.id];
    const profil = P.cywilizacjeKanonu[t.id];
    const glebokosc = Math.min(G.glebokoscPortuMax, Math.max(G.glebokoscPortuMin, kanon.otwartosc));
    const specjalnosci: Towar[] = t.uklady.map(() => rng.wybierz(TOWARY));
    for (const g of TOWARY_I_PALIWO) {
      const stosunek = g === 'Food' ? kanon.ssr : (profil.produkcjaDoPotrzeb[g] ?? 1);
      // Runda 3: konsumpcja z ludności (populacja planety × koszyk T1), bez głębokości portu; sektor otwarty, gdy T1 ≥ SectorMinTier.
      const otwarty = !tryb.runda3 || minTierTowaru(g) <= 1;
      const naRynku = !tryb.runda3 || tryb.bramka === 'P' || otwarty;
      const konsumpcje = t.uklady.map((i, r) => (tryb.runda3 ? (naRynku ? konsumpcjaZLudnosci(t.id, populacje[i], g, 1) : 0) : G.portNaUkladM3NaDobe[g] * profil.potrzeby[g] * t.wagi[r] * (g === 'Fuel' ? 1 : glebokosc)));
      const spec = t.uklady.map((_, r) => (g !== 'Fuel' && specjalnosci[r] === g ? G.specjalizacjaMnoznik : g === 'Fuel' ? 1 : G.specjalizacjaReszta));
      const sumaK = konsumpcje.reduce((s, k) => s + k, 0);
      const sumaKS = konsumpcje.reduce((s, k, r) => s + k * spec[r], 0);
      const normalizacja = sumaKS > 0 ? sumaK / sumaKS : 0;
      t.uklady.forEach((i, r) => {
        const id = idUkladu[i];
        rynki[id] ??= {} as Rynek;
        const konsumpcja = konsumpcje[r];
        const mnoznikSpecjalizacji = spec[r] * normalizacja;
        const produkcja = otwarty ? konsumpcja * stosunek * mnoznikSpecjalizacji : 0;
        const norma = K.normaZapasu * konsumpcja;
        const start = G.zapasStartowyUlamekNormy + G.zapasStartowyJitter * rng.zakres(-1, 1);
        const uspiona = !t.znanaNaStarcie && g === 'Electronics';
        rynki[id][g] = {
          zapas: norma * start,
          norma,
          produkcja,
          konsumpcja: uspiona ? 0 : konsumpcja,
          konsumpcjaUspiona: uspiona ? konsumpcja : 0,
          otwartosc: kanon.otwartosc,
          ...(tryb.runda3 ? { dostepny: naRynku, mnoznikSpecjalizacji } : {}),
        };
      });
    }
  }
  for (const rynek of Object.values(rynki)) {
    for (const g of TOWARY_I_PALIWO) krokRynku(rynek[g], G.dobyRozruchuRynku);
  }
  for (const t of terytoria) {
    if (t.znanaNaStarcie) continue;
    for (const i of t.uklady) {
      const poz = rynki[idUkladu[i]].Electronics;
      poz.zapas = poz.norma * P.kontaktZapasElektronikiUlamekNormy;
    }
  }
  return rynki;
}

function generujGalaktyke(ziarno: string, skala: 'M' | 'L', tryb: TrybRynku): Wygenerowany {
  const rngBaza = new Losowosc(ziarno).odgalezienie(`galaktyka:${skala}`);
  for (let proba = 0; proba < P.galaktyka.maxProbUkladu; proba++) {
    const wynik = probaGalaktyki(rngBaza.odgalezienie(`proba:${proba}`), skala, tryb);
    if (wynik) {
      wynik.swiat.ziarno = ziarno;
      return wynik;
    }
  }
  throw new Error(`Nie udało się wygenerować galaktyki ${skala} dla ziarna "${ziarno}"`);
}

export function generujSwiat(ziarno: string, skala: Skala = P.skala, tryb: TrybRynku = { runda3: false, bramka: 'G' }): Wygenerowany {
  return skala === 'S' ? generujSwiatS(ziarno) : generujGalaktyke(ziarno, skala, tryb);
}
