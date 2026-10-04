import type { Krawedz, Wezel } from './typy';

export interface Sasiad {
  id: string;
  dystans: number;
}

export interface WpisDijkstry {
  dystans: number;
  poprzednik: string | null;
  skoki: number;
}

export function odleglosc(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Kopiec binarny (min) na parach [klucz, id]. */
class Kopiec {
  private dane: { k: number; id: string }[] = [];
  get rozmiar(): number {
    return this.dane.length;
  }
  wloz(k: number, id: string): void {
    const d = this.dane;
    d.push({ k, id });
    let i = d.length - 1;
    while (i > 0) {
      const r = (i - 1) >> 1;
      if (d[r].k <= d[i].k) break;
      [d[r], d[i]] = [d[i], d[r]];
      i = r;
    }
  }
  zdejmij(): { k: number; id: string } {
    const d = this.dane;
    const wynik = d[0];
    const ostatni = d.pop()!;
    if (d.length > 0) {
      d[0] = ostatni;
      let i = 0;
      while (true) {
        const l = 2 * i + 1;
        const p = l + 1;
        let m = i;
        if (l < d.length && d[l].k < d[m].k) m = l;
        if (p < d.length && d[p].k < d[m].k) m = p;
        if (m === i) break;
        [d[m], d[i]] = [d[i], d[m]];
        i = m;
      }
    }
    return wynik;
  }
}

export class Graf {
  private sasiedztwo = new Map<string, Sasiad[]>();
  readonly wezly: Map<string, Wezel>;

  constructor(wezly: Wezel[], krawedzie: Krawedz[]) {
    this.wezly = new Map(wezly.map((w) => [w.id, w]));
    for (const w of wezly) this.sasiedztwo.set(w.id, []);
    for (const k of krawedzie) {
      this.sasiedztwo.get(k.a)!.push({ id: k.b, dystans: k.dystans });
      this.sasiedztwo.get(k.b)!.push({ id: k.a, dystans: k.dystans });
    }
  }

  sasiedzi(id: string): Sasiad[] {
    return this.sasiedztwo.get(id) ?? [];
  }

  dystansKrawedzi(a: string, b: string): number | undefined {
    return this.sasiedzi(a).find((s) => s.id === b)?.dystans;
  }

  /** Dijkstra po dystansie (kopiec). `maxDystans` ucina przeszukiwanie. */
  dijkstra(start: string, maxDystans = Infinity): Map<string, WpisDijkstry> {
    const wynik = new Map<string, WpisDijkstry>();
    const zamkniete = new Set<string>();
    const kopiec = new Kopiec();
    wynik.set(start, { dystans: 0, poprzednik: null, skoki: 0 });
    kopiec.wloz(0, start);
    while (kopiec.rozmiar > 0) {
      const { k, id } = kopiec.zdejmij();
      if (zamkniete.has(id)) continue;
      zamkniete.add(id);
      const biezacy = wynik.get(id)!;
      if (k > biezacy.dystans) continue;
      for (const s of this.sasiedzi(id)) {
        const nowy = biezacy.dystans + s.dystans;
        if (nowy > maxDystans) continue;
        const stary = wynik.get(s.id);
        if (!stary || nowy < stary.dystans) {
          wynik.set(s.id, { dystans: nowy, poprzednik: id, skoki: biezacy.skoki + 1 });
          kopiec.wloz(nowy, s.id);
        }
      }
    }
    return wynik;
  }

  /** Ścieżka do `cel` odczytana z gotowej mapy poprzedników. */
  static sciezkaZ(d: Map<string, WpisDijkstry>, cel: string): string[] | null {
    if (!d.has(cel)) return null;
    const sciezka: string[] = [];
    let biezacy: string | null = cel;
    while (biezacy !== null) {
      sciezka.unshift(biezacy);
      biezacy = d.get(biezacy)!.poprzednik;
    }
    return sciezka;
  }

  najkrotszaSciezka(a: string, b: string): string[] | null {
    return Graf.sciezkaZ(this.dijkstra(a), b);
  }

  /** Długość trasy jako ciągu skoków; rzuca, gdy któryś skok nie jest krawędzią. */
  dlugoscTrasy(trasa: string[]): number {
    let suma = 0;
    for (let i = 0; i + 1 < trasa.length; i++) {
      const d = this.dystansKrawedzi(trasa[i], trasa[i + 1]);
      if (d === undefined) throw new Error(`Brak skoku ${trasa[i]} → ${trasa[i + 1]}`);
      suma += d;
    }
    return suma;
  }

  spojny(): boolean {
    const [pierwszy] = this.wezly.keys();
    if (pierwszy === undefined) return true;
    return this.dijkstra(pierwszy).size === this.wezly.size;
  }
}
