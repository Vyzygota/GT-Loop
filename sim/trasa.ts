import type { Krawedz, Wezel } from './typy';

export interface Sasiad {
  id: string;
  dystans: number;
}

export function odleglosc(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
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

  /** Dijkstra po dystansie. Zwraca dystans i poprzednika dla każdego osiągalnego węzła. */
  dijkstra(start: string): Map<string, { dystans: number; poprzednik: string | null; skoki: number }> {
    const wynik = new Map<string, { dystans: number; poprzednik: string | null; skoki: number }>();
    const odwiedzone = new Set<string>();
    wynik.set(start, { dystans: 0, poprzednik: null, skoki: 0 });
    while (true) {
      let najblizszy: string | null = null;
      let najmniej = Infinity;
      for (const [id, w] of wynik) {
        if (!odwiedzone.has(id) && w.dystans < najmniej) {
          najmniej = w.dystans;
          najblizszy = id;
        }
      }
      if (najblizszy === null) break;
      odwiedzone.add(najblizszy);
      const biezacy = wynik.get(najblizszy)!;
      for (const s of this.sasiedzi(najblizszy)) {
        const nowy = biezacy.dystans + s.dystans;
        const stary = wynik.get(s.id);
        if (!stary || nowy < stary.dystans) {
          wynik.set(s.id, { dystans: nowy, poprzednik: najblizszy, skoki: biezacy.skoki + 1 });
        }
      }
    }
    return wynik;
  }

  najkrotszaSciezka(a: string, b: string): string[] | null {
    const d = this.dijkstra(a);
    if (!d.has(b)) return null;
    const sciezka: string[] = [];
    let biezacy: string | null = b;
    while (biezacy !== null) {
      sciezka.unshift(biezacy);
      biezacy = d.get(biezacy)!.poprzednik;
    }
    return sciezka;
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
