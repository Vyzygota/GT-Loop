import { K, P, type Gra, type Wezel } from '../sim/index';
import { esc, liczba1 } from './format';

export function kolorCywilizacji(gra: Gra, id: string | undefined): string {
  if (!id) return 'var(--tankowanie)';
  if (!gra.stan.znaneCywilizacje[id]) return 'var(--nieznana)';
  return gra.cywilizacja(id)?.kolor ?? '#ccc';
}

export interface Widok {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type PoziomMapy = 'daleki' | 'sredni' | 'bliski';

export function poziomMapy(w: number): PoziomMapy {
  if (w > P.ui.poziomyMapy.sredniPc) return 'daleki';
  if (w > P.ui.poziomyMapy.bliskiPc) return 'sredni';
  return 'bliski';
}

const MARGINES = 14;

/** Rzut współrzędnych świata na mapę: świat S obracany tak, by dłuższa oś była pionowa; galaktyka bez obrotu. */
export function rzutMapy(gra: Gra): (p: { x: number; y: number }) => { x: number; y: number } {
  if (gra.swiat.skala !== 'S') return (p) => ({ x: p.x, y: p.y });
  const wezly = gra.swiat.wezly;
  const sx = wezly.reduce((a, w) => a + w.x, 0) / wezly.length;
  const sy = wezly.reduce((a, w) => a + w.y, 0) / wezly.length;
  let cxx = 0;
  let cyy = 0;
  let cxy = 0;
  for (const w of wezly) {
    cxx += (w.x - sx) ** 2;
    cyy += (w.y - sy) ** 2;
    cxy += (w.x - sx) * (w.y - sy);
  }
  const katGlowny = Math.atan2(2 * cxy, cxx - cyy) / 2;
  const obrot = Math.PI / 2 - katGlowny;
  const cos = Math.cos(obrot);
  const sin = Math.sin(obrot);
  return (p) => ({ x: (p.x - sx) * cos - (p.y - sy) * sin, y: (p.x - sx) * sin + (p.y - sy) * cos });
}

/** Okno obejmujące wszystkie węzły. */
export function widokCalosci(gra: Gra): Widok {
  const rzut = rzutMapy(gra);
  const pts = gra.swiat.wezly.map(rzut);
  const minX = Math.min(...pts.map((p) => p.x)) - MARGINES;
  const maxX = Math.max(...pts.map((p) => p.x)) + MARGINES;
  const minY = Math.min(...pts.map((p) => p.y)) - MARGINES;
  const maxY = Math.max(...pts.map((p) => p.y)) + MARGINES;
  let w = maxX - minX;
  let h = maxY - minY;
  // Nie węziej niż 1:2, żeby mapa nie była paskiem.
  if (w < h / 2) w = h / 2;
  if (h < w / 2) h = w / 2;
  return { x: (minX + maxX) / 2 - w / 2, y: (minY + maxY) / 2 - h / 2, w, h };
}

/** Okno wokół statku o zadanej szerokości. */
export function widokStatku(gra: Gra, w: number): Widok {
  const p = rzutMapy(gra)(gra.wezel());
  const calosc = widokCalosci(gra);
  const h = (w * calosc.h) / calosc.w;
  return { x: p.x - w / 2, y: p.y - h / 2, w, h };
}

function kropkaWezla(w: Wezel, p: { x: number; y: number }, kolor: string, j: number, poziom: PoziomMapy, wypelnienie: 'pelne' | 'odczyt' | 'brak'): string {
  if (w.typ === 'przelot') {
    const r = poziom === 'daleki' ? 0.22 * j : 0.35 * j;
    return `<circle cx="${p.x}" cy="${p.y}" r="${r.toFixed(2)}" fill="#5a6678" />`;
  }
  if (w.typ === 'tankowanie') {
    const s = 0.75 * j;
    return `<polygon points="${p.x},${p.y - s} ${p.x + s},${p.y + s * 0.8} ${p.x - s},${p.y + s * 0.8}" fill="${kolor}" stroke="#0e1420" stroke-width="${0.12 * j}" />`;
  }
  const r = (0.7 + Math.sqrt(Math.max(1, w.populacjaMln ?? 1) / 1e5) * 0.15) * j;
  const styl =
    wypelnienie === 'pelne'
      ? `fill="${kolor}" stroke="#e8e8e0" stroke-width="${0.15 * j}"`
      : wypelnienie === 'odczyt'
        ? `fill="${kolor}" fill-opacity="0.45" stroke="${kolor}" stroke-width="${0.18 * j}" stroke-dasharray="${0.5 * j} ${0.35 * j}"`
        : `fill="#0e1420" stroke="${kolor}" stroke-width="${0.18 * j}"`;
  return `<circle cx="${p.x}" cy="${p.y}" r="${Math.min(r, 1.6 * j).toFixed(2)}" ${styl} />`;
}

function granice(gra: Gra, j: number): string {
  const g = gra.swiat.geometria;
  if (!g) return '';
  const okrag = (r: number, klasa: string) => `<circle class="${klasa}" cx="0" cy="0" r="${r.toFixed(1)}" fill="none" stroke-width="${0.25 * j}" />`;
  const linie: string[] = [okrag(g.rdzen, 'rdzen'), okrag(g.strefaOd, 'strefa'), okrag(g.strefaDo, 'strefa')];
  const katSektora = (2 * Math.PI) / g.liczbaSektorow;
  const sektoryDoRysowania = g.sektory.length === g.liczbaSektorow ? g.sektory : [...new Set(g.sektory.flatMap((s) => [s, s + 1]))];
  for (const s of sektoryDoRysowania) {
    const kat = s * katSektora;
    const x1 = g.rdzen * Math.cos(kat);
    const y1 = g.rdzen * Math.sin(kat);
    const x2 = g.promien * 0.62 * Math.cos(kat);
    const y2 = g.promien * 0.62 * Math.sin(kat);
    linie.push(`<line class="sektor" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke-width="${0.25 * j}" />`);
  }
  for (const s of g.sektory) {
    const kat = (s + 0.5) * katSektora;
    const r = g.promien * 0.64;
    linie.push(`<text class="etykieta-sektora" x="${(r * Math.cos(kat)).toFixed(1)}" y="${(r * Math.sin(kat)).toFixed(1)}" font-size="${2.2 * j}" text-anchor="middle">sektor ${s + 1}</text>`);
  }
  return `<g class="granice">${linie.join('')}</g>`;
}

/** Warstwa trasy (osobna, bo zmienia się częściej niż reszta mapy). */
export function warstwaTrasy(gra: Gra, trasa: string[], widok: Widok): string {
  if (trasa.length < 2) return '';
  const j = widok.w / 100;
  const rzut = rzutMapy(gra);
  const pts = trasa.map((id) => rzut(gra.wezel(id)));
  const numery = trasa
    .map((id, i) => {
      if (i === 0 || gra.wezel(id).typ === 'przelot') return '';
      const p = pts[i];
      return `<text x="${p.x + 1.2 * j}" y="${p.y - 1.0 * j}" fill="#ffd166" font-weight="700" font-size="${1.5 * j}">${i}</text>`;
    })
    .join('');
  return `<polyline class="trasa" points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" stroke-width="${0.45 * j}" />${numery}`;
}

/** Mapa SVG: granice, krawędzie, zasięg, łączność, węzły, trasa, statek. Węzły mają data-wezel do obsługi kliknięć. */
export function renderujMape(gra: Gra, trasa: string[], widok: Widok): string {
  const j = widok.w / 100;
  const poziom = poziomMapy(widok.w);
  const rzut = rzutMapy(gra);
  const zasieg = gra.zasieg();
  const tu = gra.stan.pozycja;
  const wezly = gra.swiat.wezly;
  const poz = new Map(wezly.map((w) => [w.id, rzut(w)]));
  // Rysuj tylko to, co w oknie (z zapasem), żeby duża galaktyka nie spowalniała.
  const zapas = widok.w * 0.2;
  const wOknie = (p: { x: number; y: number }) => p.x >= widok.x - zapas && p.x <= widok.x + widok.w + zapas && p.y >= widok.y - zapas && p.y <= widok.y + widok.h + zapas;

  const krawedzie = gra.swiat.krawedzie
    .filter((k) => wOknie(poz.get(k.a)!) || wOknie(poz.get(k.b)!))
    .map((k) => {
      const a = poz.get(k.a)!;
      const b = poz.get(k.b)!;
      return `<line class="krawedz" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke-width="${0.18 * j}" />`;
    })
    .join('');

  const znaczniki = wezly
    .filter((w) => wOknie(poz.get(w.id)!))
    .map((w) => {
      const p = poz.get(w.id)!;
      const wZasiegu = zasieg.has(w.id);
      const nieznana = w.typ === 'planeta' && !gra.cywilizacjaZnana(w.cywilizacja);
      const info = w.typ === 'planeta' ? gra.informacjaORynku(w.id) : null;
      const wypelnienie: 'pelne' | 'odczyt' | 'brak' = !info ? 'brak' : info.tryb === 'zywa' ? 'pelne' : 'odczyt';
      const klasy = ['wezel', `typ-${w.typ}`, wZasiegu ? '' : 'poza-zasiegiem', nieznana ? 'nieznana' : ''].filter(Boolean).join(' ');
      const kolor = kolorCywilizacji(gra, w.cywilizacja);
      const o = zasieg.get(w.id);
      const cyw = gra.cywilizacja(w.cywilizacja);
      const opis = [
        w.nazwa,
        w.typ === 'przelot' ? 'układ przelotowy: bez rynku i paliwa' : w.typ === 'tankowanie' ? 'układ plemion: tylko paliwo po cenie bazowej' : `cywilizacja: ${nieznana ? 'nieznana' : cyw?.nazwa}${w.populacjaMln ? `, ${w.populacjaMln.toLocaleString('pl-PL')} mln` : ''}`,
        w.sektor !== undefined ? `sektor ${w.sektor + 1}` : '',
        info ? (info.tryb === 'zywa' ? 'ceny na żywo' : `ostatni odczyt sprzed ${liczba1(info.wiekDob)} dób`) : w.typ === 'planeta' && !nieznana ? 'brak informacji o cenach (poza łącznością, nieodwiedzona)' : '',
        o ? `${liczba1(o.dystans)} pc, ${o.sciezka.length - 1} skok(ów), paliwo ${liczba1(o.paliwo)} m³` : 'poza zasięgiem na obecnym paliwie',
      ]
        .filter(Boolean)
        .join('\n');
      const pokazNazwe = w.typ === 'planeta' ? poziom !== 'daleki' : w.typ === 'tankowanie' ? poziom === 'bliski' : false;
      const nazwa = pokazNazwe ? `<text x="${p.x + 1.4 * j}" y="${p.y + 0.5 * j}" font-size="${1.5 * j}">${esc(w.nazwa)}</text>` : '';
      return `<g class="${klasy}" data-wezel="${w.id}"><title>${esc(opis)}</title>
        ${w.id === tu ? `<circle class="tu-pierscien" cx="${p.x}" cy="${p.y}" r="${2.2 * j}" stroke-width="${0.18 * j}" />` : ''}
        ${wZasiegu && w.id !== tu && w.typ !== 'przelot' ? `<circle class="zasieg-pierscien" cx="${p.x}" cy="${p.y}" r="${1.8 * j}" stroke-width="${0.16 * j}" />` : ''}
        ${kropkaWezla(w, p, kolor, j, poziom, wypelnienie)}${nazwa}</g>`;
    })
    .join('');

  const pTu = poz.get(tu)!;
  const lacznosc = gra.informacja === 'zasieg' ? `<circle class="lacznosc" cx="${pTu.x}" cy="${pTu.y}" r="${K.zasiegLacznosci}" stroke-width="${0.2 * j}" stroke-dasharray="${0.8 * j} ${0.6 * j}" />` : '';
  const statek = `<g id="statek" class="statek" transform="translate(${pTu.x},${pTu.y})" stroke-width="${0.12 * j}"><polygon points="0,${-1.0 * j} ${0.75 * j},${0.75 * j} 0,${0.35 * j} ${-0.75 * j},${0.75 * j}" /></g>`;

  return `<svg class="mapa poziom-${poziom}" viewBox="${widok.x.toFixed(1)} ${widok.y.toFixed(1)} ${widok.w.toFixed(1)} ${widok.h.toFixed(1)}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    ${granice(gra, j)}<g>${krawedzie}</g>${lacznosc}<g id="warstwa-trasy">${warstwaTrasy(gra, trasa, widok)}</g><g>${znaczniki}</g>${statek}</svg>`;
}

/** Animacja lotu: przesuwa znacznik statku wzdłuż trasy i wywołuje naKlatke z interpolowaną dobą. */
export function animujLot(svg: SVGSVGElement, gra: Gra, trasa: string[], dobaStart: number, dobaKoniec: number, skalaCzasu: number, naKlatke: (doba: number) => void): Promise<void> {
  const rzut = rzutMapy(gra);
  const punkty = trasa.map((id) => rzut(gra.wezel(id)));
  const odcinki: number[] = [];
  let suma = 0;
  for (let i = 0; i + 1 < punkty.length; i++) {
    const d = Math.hypot(punkty[i + 1].x - punkty[i].x, punkty[i + 1].y - punkty[i].y);
    odcinki.push(d);
    suma += d;
  }
  const doby = dobaKoniec - dobaStart;
  const sek = Math.min(P.ui.lotMaxSek, Math.max(P.ui.lotMinSek, doby * P.ui.lotSekNaDobe)) * skalaCzasu;
  const statek = svg.querySelector('#statek') as SVGGElement | null;
  return new Promise((resolve) => {
    const start = performance.now();
    const klatka = (teraz: number) => {
      const t = Math.min(1, (teraz - start) / (sek * 1000));
      let przebyte = t * suma;
      let i = 0;
      while (i < odcinki.length - 1 && przebyte > odcinki[i]) {
        przebyte -= odcinki[i];
        i++;
      }
      const a = punkty[i];
      const b = punkty[i + 1] ?? a;
      const u = odcinki[i] > 0 ? Math.min(1, przebyte / odcinki[i]) : 1;
      const x = a.x + (b.x - a.x) * u;
      const y = a.y + (b.y - a.y) * u;
      const kat = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI + 90;
      if (statek) statek.setAttribute('transform', `translate(${x},${y}) rotate(${kat})`);
      naKlatke(dobaStart + doby * t);
      if (t < 1) requestAnimationFrame(klatka);
      else resolve();
    };
    requestAnimationFrame(klatka);
  });
}
