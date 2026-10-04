import { Losowosc } from './losowosc';
import { krokRynku } from './rynek';
import { K, P, type CywilizacjaProfil } from './stale';
import { Graf, odleglosc } from './trasa';
import { TOWARY_I_PALIWO, type Krawedz, type ProfilCywilizacji, type Rynek, type Swiat, type TowarLubPaliwo, type Wezel } from './typy';

const STOPNIE_W_RADIANACH = Math.PI / 180;

interface Uklad {
  wezly: Wezel[];
  startId: string;
}

function identyfikator(nazwa: string): string {
  return nazwa
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ł/g, 'l')
    .replace(/[^a-z0-9]+/g, '-');
}

/** Próba ułożenia węzłów: hub w środku, ramiona na zewnątrz, punkty tankowania jako mosty. */
function probaUkladu(rng: Losowosc): Uklad | null {
  const U = P.uklad;
  const hub = P.cywilizacje.find((c) => c.rola === 'hub');
  const ramiona = P.cywilizacje.filter((c) => c.rola === 'ramie');
  if (!hub) throw new Error('prototyp.json: brak cywilizacji o roli hub');
  if (ramiona.length !== P.punktyTankowania.length) throw new Error('prototyp.json: liczba ramion musi równać się liczbie punktów tankowania');

  const wezly: Wezel[] = [];
  let startId: string | null = null;

  const dodajPlanete = (c: CywilizacjaProfil, i: number, x: number, y: number) => {
    const p = c.planety[i];
    const id = identyfikator(p.nazwa);
    wezly.push({ id, nazwa: p.nazwa, typ: 'planeta', x, y, cywilizacja: c.id, populacjaMln: p.populacjaMln });
    if (c.start && i === 0) startId = id;
  };

  // Hub: planety na małym pierścieniu wokół środka.
  const katHuba = rng.zakres(0, 360);
  const krokHuba = 360 / hub.planety.length;
  hub.planety.forEach((_, i) => {
    const kat = (katHuba + i * krokHuba + rng.zakres(-U.jitterKatStopnie, U.jitterKatStopnie)) * STOPNIE_W_RADIANACH;
    const r = U.promienHubaPc + rng.zakres(-U.jitterPc, U.jitterPc);
    dodajPlanete(hub, i, r * Math.cos(kat), r * Math.sin(kat));
  });

  // Ramiona: pierwsze pod losowym azymutem, kolejne odsunięte o zadany kąt.
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
    const nazwaT = P.punktyTankowania[j].nazwa;
    wezly.push({ id: identyfikator(nazwaT), nazwa: nazwaT, typ: 'tankowanie', x: t.x, y: t.y });
    c.planety.forEach((_, i) => {
      const pz = pozycja(U.odlegloscTankowaniaPc + U.krokRamieniaPc * (i + 1));
      dodajPlanete(c, i, pz.x, pz.y);
    });
  });

  if (!startId) throw new Error('prototyp.json: żadna cywilizacja nie ma start=true');

  // Walidacja: odstępy, promień, spójność grafu krawędzi ≤ skok podstawowy.
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

export function krawedzie(wezly: Wezel[]): Krawedz[] {
  const wynik: Krawedz[] = [];
  for (let i = 0; i < wezly.length; i++) {
    for (let j = i + 1; j < wezly.length; j++) {
      const d = odleglosc(wezly[i], wezly[j]);
      if (d <= K.skokPodstawowy) wynik.push({ a: wezly[i].id, b: wezly[j].id, dystans: d });
    }
  }
  return wynik;
}

function pusteWartosci(): Record<TowarLubPaliwo, number> {
  const r = {} as Record<TowarLubPaliwo, number>;
  for (const t of TOWARY_I_PALIWO) r[t] = 0;
  return r;
}

function profileCywilizacji(wezly: Wezel[]): ProfilCywilizacji[] {
  return P.cywilizacje.map((c) => {
    const populacja = c.planety.reduce((s, p) => s + p.populacjaMln, 0);
    const potrzeby = pusteWartosci();
    const produkcja = pusteWartosci();
    for (const t of TOWARY_I_PALIWO) {
      potrzeby[t] = c.potrzebyM3NaMlnNaDobe[t] * populacja;
      produkcja[t] = c.produkcjaM3NaMlnNaDobe[t] * populacja;
    }
    return {
      id: c.id,
      nazwa: c.nazwa,
      znanaNaStarcie: c.znanaNaStarcie,
      populacjaMln: populacja,
      planety: wezly.filter((w) => w.cywilizacja === c.id).map((w) => w.id),
      potrzebyM3NaDobe: potrzeby,
      produkcjaM3NaDobe: produkcja,
    };
  });
}

/**
 * Rynki planet. Specjalizacja planety przesuwa produkcję wewnątrz cywilizacji,
 * ale suma produkcji cywilizacji pozostaje równa profilowi per capita × populacja.
 */
function rynkiStartowe(wezly: Wezel[], rng: Losowosc): Record<string, Rynek> {
  const rynki: Record<string, Rynek> = {};
  for (const c of P.cywilizacje) {
    const populacja = c.planety.reduce((s, p) => s + p.populacjaMln, 0);
    for (const t of TOWARY_I_PALIWO) {
      const wazona = c.planety.reduce((s, p) => s + p.populacjaMln * (p.specjalizacja[t] ?? 1), 0);
      const normalizacja = wazona > 0 ? populacja / wazona : 0;
      for (const p of c.planety) {
        const id = identyfikator(p.nazwa);
        const wezel = wezly.find((w) => w.id === id)!;
        rynki[id] ??= {} as Rynek;
        const konsumpcja = c.potrzebyM3NaMlnNaDobe[t] * p.populacjaMln;
        const produkcja = c.produkcjaM3NaMlnNaDobe[t] * p.populacjaMln * (p.specjalizacja[t] ?? 1) * normalizacja;
        const norma = K.normaZapasu * konsumpcja;
        const start = P.zapasStartowyUlamekNormy + P.zapasStartowyJitter * rng.zakres(-1, 1);
        const uspiona = !c.znanaNaStarcie && t === 'Electronics';
        rynki[id][t] = {
          zapas: norma * start,
          norma,
          produkcja,
          konsumpcja: uspiona ? 0 : konsumpcja,
          konsumpcjaUspiona: uspiona ? konsumpcja : 0,
        };
        void wezel;
      }
    }
  }
  // Rozruch: świat już jakiś czas żyje, więc nadwyżki i braki zdążyły się ujawnić.
  for (const rynek of Object.values(rynki)) {
    for (const t of TOWARY_I_PALIWO) krokRynku(rynek[t], P.dobyRozruchuRynku);
  }
  // Nieznana cywilizacja: Elektroniki prawie nie ma, popyt obudzi dopiero kontakt.
  for (const c of P.cywilizacje) {
    if (c.znanaNaStarcie) continue;
    for (const p of c.planety) {
      const poz = rynki[identyfikator(p.nazwa)].Electronics;
      poz.zapas = poz.norma * P.kontaktZapasElektronikiUlamekNormy;
    }
  }
  return rynki;
}

export function generujSwiat(ziarno: string): { swiat: Swiat; rynki: Record<string, Rynek> } {
  const rng = new Losowosc(ziarno);
  const rngUkladu = rng.odgalezienie('uklad');
  let uklad: Uklad | null = null;
  for (let proba = 0; proba < P.uklad.maxProb && !uklad; proba++) uklad = probaUkladu(rngUkladu);
  if (!uklad) throw new Error(`Nie udało się ułożyć spójnej galaktyki dla ziarna "${ziarno}"`);
  const swiat: Swiat = {
    ziarno,
    wezly: uklad.wezly,
    krawedzie: krawedzie(uklad.wezly),
    cywilizacje: profileCywilizacji(uklad.wezly),
    startId: uklad.startId,
  };
  return { swiat, rynki: rynkiStartowe(uklad.wezly, rng.odgalezienie('rynki')) };
}
