import { P, type Gra, type Wezel } from '../sim/index';
import { esc, liczba1 } from './format';

export const KOLORY_CYW: Record<string, string> = {
  agraria: 'var(--cyw-agraria)',
  kuznia: 'var(--cyw-kuznia)',
  cisi: 'var(--cyw-cisi)',
};

export function kolorCywilizacji(gra: Gra, id: string | undefined): string {
  if (!id) return 'var(--tankowanie)';
  if (!gra.stan.znaneCywilizacje[id]) return 'var(--nieznana)';
  return gra.cywilizacja(id)?.kolor ?? '#ccc';
}

const MARGINES = 14;

export interface Okno {
  x: number;
  y: number;
  w: number;
  h: number;
  /** 1% wysokości okna: jednostka rozmiarów etykiet i znaczników. */
  j: number;
  rzut: (p: { x: number; y: number }) => { x: number; y: number };
}

/**
 * Okno mapy: obrót układu tak, by najdłuższa oś galaktyki była pionowa (czysto wizualny, odległości bez zmian),
 * i dopasowanie do obrysu węzłów. Galaktyka rzadko wypełnia cały dysk.
 */
export function rozmiarMapy(gra: Gra): Okno {
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
  const rzut = (p: { x: number; y: number }) => ({ x: (p.x - sx) * cos - (p.y - sy) * sin, y: (p.x - sx) * sin + (p.y - sy) * cos });
  const pts = wezly.map(rzut);
  const minX = Math.min(...pts.map((p) => p.x)) - MARGINES;
  const maxX = Math.max(...pts.map((p) => p.x)) + MARGINES;
  const minY = Math.min(...pts.map((p) => p.y)) - MARGINES;
  const maxY = Math.max(...pts.map((p) => p.y)) + MARGINES;
  const h = maxY - minY;
  const w = Math.max(maxX - minX, h * 0.42);
  return { x: (minX + maxX) / 2 - w / 2, y: minY, w, h, j: h / 100, rzut };
}

function kropkaWezla(w: Wezel, p: { x: number; y: number }, kolor: string, j: number): string {
  if (w.typ === 'tankowanie') {
    const s = 1.3 * j;
    return `<polygon points="${p.x},${p.y - s} ${p.x + s},${p.y + s * 0.8} ${p.x - s},${p.y + s * 0.8}" fill="${kolor}" stroke="#0e1420" stroke-width="${0.15 * j}" />`;
  }
  const r = (0.8 + Math.sqrt(w.populacjaMln ?? 1) * 0.2) * j;
  return `<circle cx="${p.x}" cy="${p.y}" r="${r.toFixed(2)}" fill="${kolor}" stroke="#e8e8e0" stroke-width="${0.2 * j}" />`;
}

/** Mapa SVG: krawędzie, zasięg, trasa, statek. Węzły mają data-wezel do obsługi kliknięć. */
export function renderujMape(gra: Gra, trasa: string[]): string {
  const okno = rozmiarMapy(gra);
  const j = okno.j;
  const zasieg = gra.zasieg();
  const tu = gra.stan.pozycja;
  const wezly = gra.swiat.wezly;
  const poz = new Map(wezly.map((w) => [w.id, okno.rzut(w)]));

  const krawedzie = gra.swiat.krawedzie
    .map((k) => {
      const a = poz.get(k.a)!;
      const b = poz.get(k.b)!;
      return `<line class="krawedz" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke-width="${0.25 * j}" />`;
    })
    .join('');

  const liniaTrasy =
    trasa.length > 1
      ? `<polyline class="trasa" points="${trasa.map((id) => `${poz.get(id)!.x},${poz.get(id)!.y}`).join(' ')}" stroke-width="${0.5 * j}" />`
      : '';

  const znaczniki = wezly
    .map((w) => {
      const p = poz.get(w.id)!;
      const wZasiegu = zasieg.has(w.id);
      const nieznana = w.typ === 'planeta' && !gra.cywilizacjaZnana(w.cywilizacja);
      const klasy = ['wezel', wZasiegu ? '' : 'poza-zasiegiem', nieznana ? 'nieznana' : ''].filter(Boolean).join(' ');
      const kolor = kolorCywilizacji(gra, w.cywilizacja);
      const o = zasieg.get(w.id);
      const opis = [
        w.nazwa,
        w.typ === 'tankowanie' ? 'punkt tankowania plemion (tylko paliwo)' : `cywilizacja: ${nieznana ? 'nieznana' : gra.swiat.cywilizacje.find((c) => c.id === w.cywilizacja)?.nazwa}`,
        o ? `${liczba1(o.dystans)} pc, ${o.sciezka.length - 1} skok(i), paliwo ${liczba1(o.paliwo)} m³` : 'poza zasięgiem na obecnym paliwie',
      ].join('\n');
      const indeks = trasa.indexOf(w.id);
      const numer = indeks > 0 ? `<text x="${p.x + 1.4 * j}" y="${p.y - 1.2 * j}" fill="#ffd166" font-weight="700" font-size="${1.7 * j}">${indeks}</text>` : '';
      return `<g class="${klasy}" data-wezel="${w.id}"><title>${esc(opis)}</title>
        ${w.id === tu ? `<circle class="tu-pierscien" cx="${p.x}" cy="${p.y}" r="${2.4 * j}" stroke-width="${0.2 * j}" />` : ''}
        ${wZasiegu && w.id !== tu ? `<circle class="zasieg-pierscien" cx="${p.x}" cy="${p.y}" r="${2 * j}" stroke-width="${0.2 * j}" />` : ''}
        ${kropkaWezla(w, p, kolor, j)}
        <text x="${p.x + 1.6 * j}" y="${p.y + 0.6 * j}" font-size="${1.7 * j}">${esc(w.nazwa)}</text>${numer}</g>`;
    })
    .join('');

  const pTu = poz.get(tu)!;
  const statek = `<g id="statek" class="statek" transform="translate(${pTu.x},${pTu.y})" stroke-width="${0.15 * j}"><polygon points="0,${-1.1 * j} ${0.8 * j},${0.8 * j} 0,${0.4 * j} ${-0.8 * j},${0.8 * j}" /></g>`;

  return `<svg class="mapa" viewBox="${okno.x.toFixed(1)} ${okno.y.toFixed(1)} ${okno.w.toFixed(1)} ${okno.h.toFixed(1)}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
    <g>${krawedzie}</g>${liniaTrasy}<g>${znaczniki}</g>${statek}</svg>`;
}

/** Animacja lotu: przesuwa znacznik statku wzdłuż trasy i wywołuje naDoba z interpolowaną dobą. */
export function animujLot(svg: SVGSVGElement, gra: Gra, trasa: string[], dobaStart: number, dobaKoniec: number, skalaCzasu: number, naKlatke: (doba: number) => void): Promise<void> {
  const okno = rozmiarMapy(gra);
  const przez = new Map(gra.swiat.wezly.map((w) => [w.id, okno.rzut(w)]));
  const punkty = trasa.map((id) => przez.get(id)!);
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
