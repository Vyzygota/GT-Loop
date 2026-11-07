/** Deterministyczny generator liczb pseudolosowych (mulberry32) zasilany skrótem napisu. */

export function skrot(napis: string): number {
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < napis.length; i++) {
    h ^= napis.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export class Losowosc {
  private s: number;

  constructor(ziarno: string | number) {
    this.s = typeof ziarno === 'number' ? ziarno >>> 0 : skrot(ziarno);
  }

  /** Liczba z przedziału [0, 1). */
  los(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  zakres(a: number, b: number): number {
    return a + (b - a) * this.los();
  }

  /** Liczba całkowita z [a, b]. */
  calkowita(a: number, b: number): number {
    return a + Math.floor(this.los() * (b - a + 1));
  }

  wybierz<T>(lista: readonly T[]): T {
    return lista[this.calkowita(0, lista.length - 1)];
  }

  /** Podgenerator o niezależnym strumieniu. */
  odgalezienie(etykieta: string): Losowosc {
    return new Losowosc(skrot(`${this.s}:${etykieta}`));
  }
}
