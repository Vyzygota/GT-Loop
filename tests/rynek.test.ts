import { describe, expect, it } from 'vitest';
import { Gra, K, P, TOWARY, calkaNacisku, efektyZalogi, nacisk, type Zalogant } from '../sim/index';

function zaloga(role: Partial<Record<'pilot' | 'nawigator' | 'handlowiec', number>>, cyw = 'agraria'): Zalogant[] {
  return Object.entries(role).map(([rola, u], i) => ({
    id: `t${i}`,
    imie: rola,
    rola: rola as Zalogant['rola'],
    cywilizacja: cyw,
    umiejetnosc: u,
    placa: K.placa[rola as Zalogant['rola']],
  }));
}

describe('nacisk i całka ceny krańcowej', () => {
  it('nacisk mieści się w [min, max] i maleje z zapasem', () => {
    expect(nacisk(0)).toBe(K.StockPressureMax);
    expect(nacisk(1)).toBeCloseTo(1, 12);
    expect(nacisk(1000)).toBe(K.StockPressureMin);
    let poprzedni = Infinity;
    for (let r = 0; r <= 8; r += 0.05) {
      const n = nacisk(r);
      expect(n).toBeLessThanOrEqual(poprzedni + 1e-12);
      poprzedni = n;
    }
  });

  it('całka w postaci zamkniętej zgadza się z sumą numeryczną', () => {
    const przypadki: [number, number][] = [[0, 0.5], [0.01, 0.2], [0.3, 1.7], [1, 4], [4, 9], [0, 9], [0.1, 0.1301], [5.5, 6.2]];
    for (const [r0, r1] of przypadki) {
      const n = 200000;
      const h = (r1 - r0) / n;
      let suma = 0;
      for (let i = 0; i < n; i++) suma += nacisk(r0 + (i + 0.5) * h) * h;
      expect(calkaNacisku(r0, r1)).toBeCloseTo(suma, 5);
    }
    expect(calkaNacisku(2, 1)).toBe(0);
  });

  it('cena krańcowa nie zależy od podziału transakcji na części', () => {
    const g = new Gra('podzial');
    const tu = g.stan.pozycja;
    const towar = 'Food';
    const calosc = g.wycenaKupna(towar, 300, tu, 0).kwotaKr;
    const a = g.wycenaKupna(towar, 100, tu, 0).kwotaKr;
    g.kup(towar, 100);
    const b = g.wycenaKupna(towar, 200, tu, 0).kwotaKr;
    expect(Math.abs(a + b - calosc)).toBeLessThanOrEqual(1);
  });
});

describe('niezmiennik spreadu', () => {
  it('na każdej znanej planecie, dla każdego towaru i każdej załogi sprzedaż < kupno', () => {
    const zalogi = [
      [],
      zaloga({ handlowiec: K.skillFloor }),
      zaloga({ handlowiec: K.skillCeiling }),
      zaloga({ handlowiec: 1.0 }),
      [...zaloga({ handlowiec: K.skillCeiling }), ...zaloga({ handlowiec: K.skillCeiling }, 'kuznia')],
    ];
    for (const ziarno of ['1', '2', '3', 'alfa']) {
      const g = new Gra(ziarno);
      for (const c of g.swiat.cywilizacje) g.stan.znaneCywilizacje[c.id] = true;
      for (const w of g.swiat.wezly) {
        if (w.typ !== 'planeta') continue;
        for (const t of TOWARY) {
          for (const z of zalogi) {
            const u = efektyZalogi(z).udzialHandlowca;
            const c = g.ceny(w.id, t, u)!;
            expect(c.sprzedazKr).toBeLessThan(c.kupnoKr);
            expect(c.kupnoKr).toBeLessThanOrEqual(c.bazowaKr * (1 + K.tradeSpread / 2) + 1e-6);
            expect(c.sprzedazKr).toBeGreaterThanOrEqual(c.bazowaKr * (1 - K.tradeSpread / 2) - 1e-6);
          }
        }
      }
    }
  });

  it('najlepszy handlowiec nigdy nie wychodzi poza okno spreadu', () => {
    expect(P.handlowiecMaxUdzialPolspreadu).toBeLessThan(1);
    const ef = efektyZalogi(zaloga({ handlowiec: K.skillCeiling }));
    expect(ef.udzialHandlowca).toBeLessThan(1);
    expect(ef.udzialHandlowca).toBeCloseTo(P.handlowiecMaxUdzialPolspreadu, 12);
  });
});

describe('ładownia: objętość i masa', () => {
  it('nie da się przekroczyć objętości ani masy', () => {
    const g = new Gra('masa');
    const tu = g.stan.pozycja;
    g.stan.kr = 1e12;
    for (const t of TOWARY) g.stan.rynki[tu][t].zapas = 1e6;
    g.kup('Minerals', K.maxMasaLadunku / K.towary.Minerals.gestosc);
    expect(g.masaZajeta()).toBeCloseTo(K.maxMasaLadunku, 9);
    expect(() => g.kup('Minerals', 1)).toThrow();
    expect(() => g.kup('Food', 1)).toThrow();
    g.sprzedaj('Minerals', g.stan.ladownia.Minerals.m3);
    expect(g.objetoscZajeta()).toBe(0);
    g.kup('Food', K.ladownia);
    expect(g.objetoscZajeta()).toBeCloseTo(K.ladownia, 9);
    expect(g.masaZajeta()).toBeLessThan(K.maxMasaLadunku);
    expect(() => g.kup('Food', 1)).toThrow(/miejsca/);
  });

  it('maxKupno respektuje zapas, miejsce, masę i gotówkę', () => {
    const g = new Gra('maxkupno');
    const tu = g.stan.pozycja;
    for (const t of TOWARY) {
      const m = g.maxKupno(t);
      expect(m).toBeLessThanOrEqual(g.stan.rynki[tu][t].zapas + 1e-9);
      expect(m).toBeLessThanOrEqual(K.ladownia + 1e-9);
      expect(m * K.towary[t].gestosc).toBeLessThanOrEqual(K.maxMasaLadunku + 1e-9);
      if (m > 0) expect(g.wycenaKupna(t, m).kwotaKr).toBeLessThanOrEqual(g.stan.kr);
    }
  });
});

describe('paliwo i zasięg', () => {
  it('zużycie = dystans × koszt na parsek × mnożnik załogi, a lot poza zasięg jest odrzucany', () => {
    const g = new Gra('paliwo');
    const tu = g.stan.pozycja;
    const sasiad = g.graf.sasiedzi(tu)[0];
    const przed = g.stan.paliwo;
    g.lec([tu, sasiad.id]);
    expect(przed - g.stan.paliwo).toBeCloseTo(sasiad.dystans * K.kosztPaliwaNaParsek, 9);

    g.stan.paliwo = 1;
    const dalej = g.graf.sasiedzi(g.stan.pozycja).find((s) => s.dystans > 1)!;
    expect(g.sprawdzTrase([g.stan.pozycja, dalej.id]).blad).toMatch(/paliwa/);
    expect(() => g.lec([g.stan.pozycja, dalej.id])).toThrow(/paliwa/);
    expect(g.zasieg().has(dalej.id)).toBe(false);
  });

  it('nawigator i synergia zmniejszają zużycie zgodnie ze wzorem', () => {
    const naw = efektyZalogi(zaloga({ nawigator: K.skillCeiling }));
    expect(naw.mnoznikPaliwa).toBeCloseTo(1 - P.nawigatorMaxRedukcjaPaliwa, 12);
    const slaby = efektyZalogi(zaloga({ nawigator: K.skillFloor }));
    expect(slaby.mnoznikPaliwa).toBeCloseTo(1, 12);
    const zgrani = efektyZalogi(zaloga({ nawigator: 1.0, pilot: 1.1 }, 'cisi'));
    expect(zgrani.synergia).toBe(true);
    expect(zgrani.mnoznikPaliwa).toBeCloseTo(zgrani.mnoznikNawigatora * (1 - P.synergiaRedukcjaPaliwa), 12);
    const niezgrani = efektyZalogi([...zaloga({ nawigator: 1.0 }, 'cisi'), ...zaloga({ pilot: 1.1 }, 'agraria')]);
    expect(niezgrani.synergia).toBe(false);
    const dwoch = efektyZalogi([...zaloga({ nawigator: 1.0 }), ...zaloga({ nawigator: 1.2 }, 'kuznia')]);
    expect(dwoch.mnoznikNawigatora).toBeCloseTo(efektyZalogi(zaloga({ nawigator: 1.2 })).mnoznikNawigatora, 12);
  });

  it('zasięg zawiera dokładnie węzły, do których starcza paliwa', () => {
    const g = new Gra('zasieg');
    const d = g.graf.dijkstra(g.stan.pozycja);
    const z = g.zasieg();
    for (const [id, w] of d) {
      expect(z.has(id)).toBe(w.dystans * K.kosztPaliwaNaParsek <= g.stan.paliwo + 1e-9);
    }
    expect(z.size).toBeGreaterThan(1);
  });

  it('graf jest spójny, a każda krawędź ma długość ≤ skok podstawowy', () => {
    for (const ziarno of ['1', '7', '42', 'x']) {
      const g = new Gra(ziarno);
      expect(g.graf.spojny()).toBe(true);
      for (const k of g.swiat.krawedzie) expect(k.dystans).toBeLessThanOrEqual(K.skokPodstawowy);
      expect(g.swiat.wezly.filter((w) => w.typ === 'planeta')).toHaveLength(12);
      expect(g.swiat.wezly.filter((w) => w.typ === 'tankowanie')).toHaveLength(2);
    }
  });
});
