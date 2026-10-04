import { describe, expect, it } from 'vitest';
import { krokBota, nowyStanBota } from '../bot/strategia';
import { Gra, K, P, TOWARY, calkaNacisku, nacisk, type WariantSpreadu, type Zalogant } from '../sim/index';

const handlowiec = (u: number): Zalogant => ({ id: 'h', imie: 'H', rola: 'handlowiec', cywilizacja: 'ludzie', umiejetnosc: u, placa: K.placa.handlowiec });

/** Leci `n` pojedynczych skoków po krawędziach (tam i z powrotem), tankując, gdzie można. */
function skocz(g: Gra, n: number): void {
  for (let i = 0; i < n; i++) {
    if (g.maPaliwo()) {
      const ile = Math.min(K.bak - g.stan.paliwo, g.maxPaliwo());
      if (ile > 1e-6) g.tankuj(ile);
    }
    const sasiad = g.graf.sasiedzi(g.stan.pozycja).sort((a, b) => a.dystans - b.dystans)[0];
    g.lec([g.stan.pozycja, sasiad.id]);
  }
}

describe('spread: wariant A (punkt odniesienia)', () => {
  it('stały spread tradeSpread na każdej transakcji, bez kary pamięci', () => {
    const g = new Gra('a-1', { skala: 'S', spread: 'A' });
    expect(g.spreadPodstawowy).toBe(K.tradeSpread);
    const t = TOWARY.find((x) => g.maxKupno(x) >= 2)!;
    g.kup(t, 2);
    expect(g.karaSprzedazy(g.stan.pozycja, t)).toBe(0);
    const c = g.ceny(g.stan.pozycja, t, 0)!;
    expect(c.kupnoKr / c.sprzedazKr).toBeCloseTo((1 + K.tradeSpread / 2) / (1 - K.tradeSpread / 2), 9);
  });
});

for (const wariant of ['B', 'C', 'D', 'E'] as WariantSpreadu[]) {
  describe(`spread: wariant ${wariant} (pamięć zakupu)`, () => {
    const konfig = P.wariantySpreadu[wariant];

    it('odsprzedaż w miejscu zakupu, dopóki licznik > 0, nigdy nie daje zysku: każdy towar, każda załoga', () => {
      for (const skala of ['S', 'M'] as const) {
        for (const ziarno of ['1', '2', '3']) {
          for (const zaloga of [[], [handlowiec(K.skillFloor)], [handlowiec(K.skillCeiling)]]) {
            const g = new Gra(ziarno, { skala, spread: wariant });
            g.stan.zaloga = zaloga;
            for (const t of TOWARY) {
              const max0 = Math.floor(g.maxKupno(t));
              if (max0 < 1) continue;
              for (const udzialMax of [1 / max0, 0.5, 1]) {
                const q = Math.max(1, Math.min(Math.floor(max0 * udzialMax), Math.floor(g.maxKupno(t))));
                if (q < 1) continue;
                const przed = g.stan.kr;
                g.kup(t, q);
                expect(g.licznikPamieci(g.stan.pozycja, t)).toBe(P.pamiecZakupuSkokow);
                expect(g.karaSprzedazy(g.stan.pozycja, t)).toBeCloseTo(K.tradeSpread, 12);
                // Sprzedaż w częściach też nie pomaga.
                const polowa = Math.floor(q / 2);
                if (polowa > 0) g.sprzedaj(t, polowa);
                g.sprzedaj(t, g.stan.ladownia[t].m3);
                expect(g.stan.kr, `${skala}/${ziarno}/${t}/${q}/${zaloga.length}`).toBeLessThan(przed);
              }
            }
          }
        }
      }
    });

    it('po 5 skokach kara wynosi zero, wcześniej według kształtu kary', () => {
      const g = new Gra('skoki', { skala: 'M', spread: wariant });
      const tu = g.stan.pozycja;
      const t = TOWARY.find((x) => g.maxKupno(x) >= 1)!;
      g.kup(t, 1);
      const pelna = K.tradeSpread;
      expect(g.karaSprzedazy(tu, t)).toBeCloseTo(pelna, 12);
      expect(g.karaSprzedazy(tu, t, 2)).toBeCloseTo(konfig.kara === 'liniowy' ? (pelna * 3) / P.pamiecZakupuSkokow : pelna, 12);
      skocz(g, 2);
      expect(g.licznikPamieci(tu, t)).toBe(P.pamiecZakupuSkokow - 2);
      expect(g.karaSprzedazy(tu, t)).toBeCloseTo(konfig.kara === 'liniowy' ? (pelna * 3) / P.pamiecZakupuSkokow : pelna, 12);
      skocz(g, 3);
      expect(g.licznikPamieci(tu, t)).toBe(0);
      expect(g.karaSprzedazy(tu, t)).toBe(0);
      expect(Object.keys(g.stan.pamiecZakupu)).not.toContain(`${tu}|${t}`);
      // Lot wieloskokowy liczy się jako tyle skoków, ile krawędzi.
      const g2 = new Gra('skoki-2', { skala: 'M', spread: wariant });
      const pozycja = g2.stan.pozycja;
      const towar2 = TOWARY.find((x) => g2.maxKupno(x) >= 1)!;
      g2.kup(towar2, 1);
      const trasa = [...g2.zasieg().values()].filter((o) => o.sciezka.length >= 4 && g2.maPaliwo(o.id)).sort((a, b) => b.sciezka.length - a.sciezka.length)[0];
      g2.lec(trasa.sciezka);
      expect(g2.licznikPamieci(pozycja, towar2)).toBe(Math.max(0, P.pamiecZakupuSkokow - (trasa.sciezka.length - 1)));
    });

    it('pamięć nie przechowuje ceny kupna: tylko (planeta, towar) → licznik skoków', () => {
      const g = new Gra('pamiec', { skala: 'S', spread: wariant });
      for (const t of TOWARY) if (g.maxKupno(t) >= 1) g.kup(t, 1);
      const wpisy = Object.entries(g.stan.pamiecZakupu);
      expect(wpisy.length).toBeGreaterThan(0);
      for (const [klucz, wartosc] of wpisy) {
        expect(klucz.split('|')).toHaveLength(2);
        expect(Number.isInteger(wartosc)).toBe(true);
        expect(wartosc).toBeLessThanOrEqual(P.pamiecZakupuSkokow);
      }
      expect(JSON.stringify(g.stan.pamiecZakupu)).not.toMatch(/kr|cena|koszt/i);
    });

    it('determinizm: to samo ziarno i wariant dają ten sam stan po tych samych decyzjach bota', () => {
      const a = new Gra('det-spread', { skala: 'M', spread: wariant });
      const b = new Gra('det-spread', { skala: 'M', spread: wariant });
      const sa = nowyStanBota();
      const sb = nowyStanBota();
      for (let i = 0; i < 4; i++) {
        krokBota(a, sa);
        krokBota(b, sb);
        expect(a.stan.kr).toBe(b.stan.kr);
        expect(JSON.stringify(a.stan.pamiecZakupu)).toBe(JSON.stringify(b.stan.pamiecZakupu));
      }
    });

    it('raport: linia kary za odsprzedaż sumuje się do zmiany salda', () => {
      const g = new Gra('raport-kara', { skala: 'S', spread: wariant });
      const t = TOWARY.find((x) => g.maxKupno(x) >= 4)!;
      g.kup(t, 4);
      g.sprzedaj(t, 2);
      const sasiad = g.graf.sasiedzi(g.stan.pozycja)[0];
      const r = g.lec([g.stan.pozycja, sasiad.id]);
      const kara = r.linie.find((l) => l.klucz === 'kara_odsprzedazy');
      expect(kara).toBeDefined();
      expect(kara!.kr).toBeLessThan(0);
      expect(r.linie.reduce((s, l) => s + l.kr, 0)).toBe(r.saldoPo - r.saldoPrzed);
    });

    it(`handlowiec działa tylko w oknie spreadu podstawowego (${konfig.spreadPodstawowy})`, () => {
      const g = new Gra('handlowiec', { skala: 'S', spread: wariant });
      const tu = g.stan.pozycja;
      for (const t of TOWARY) {
        const bez = g.ceny(tu, t, 0)!;
        const z = g.ceny(tu, t, P.handlowiecMaxUdzialPolspreadu)!;
        if ((konfig.spreadPodstawowy ?? 0) === 0) {
          expect(z.kupnoKr).toBeCloseTo(bez.kupnoKr, 9);
          expect(z.sprzedazKr).toBeCloseTo(bez.sprzedazKr, 9);
          expect(bez.kupnoKr).toBeCloseTo(bez.sprzedazKr, 9);
        } else {
          expect(z.kupnoKr).toBeLessThan(bez.kupnoKr);
          expect(z.sprzedazKr).toBeGreaterThan(bez.sprzedazKr);
          expect(z.sprzedazKr).toBeLessThan(z.kupnoKr);
          expect(bez.kupnoKr / bez.bazowaKr).toBeCloseTo(1 + konfig.spreadPodstawowy! / 2, 9);
        }
      }
    });
  });
}


describe('spread: wariant E (bez obcięcia nacisku)', () => {
  it('nacisk bez obcięcia to max(zapas/norma, floor)^(−w): od ok. 0,45 przy 6 normach do ok. 5,8 przy pustym zapasie', () => {
    expect(nacisk(0, false)).toBeCloseTo(Math.pow(K.StockRatioFloor, -K.StockPriceWeight), 9);
    expect(nacisk(0, false)).toBeGreaterThan(K.StockPressureMax);
    expect(nacisk(P.maxZapasWNormach, false)).toBeCloseTo(Math.pow(P.maxZapasWNormach, -K.StockPriceWeight), 9);
    expect(nacisk(1, false)).toBeCloseTo(1, 12);
    // Całka zamknięta zgadza się z sumą numeryczną także bez obcięcia.
    for (const [r0, r1] of [[0, 0.5], [0.01, 0.2], [0.05, 3], [2, 6]] as const) {
      const n = 100000;
      const h = (r1 - r0) / n;
      let suma = 0;
      for (let i = 0; i < n; i++) suma += nacisk(r0 + (i + 0.5) * h, false) * h;
      expect(calkaNacisku(r0, r1, false)).toBeCloseTo(suma, 4);
    }
  });

  it('gra w wariancie E pokazuje naciski poza [0,45; 2,5], a w A nie', () => {
    const e = new Gra('e-1', { skala: 'M', spread: 'E' });
    const a = new Gra('e-1', { skala: 'M', spread: 'A' });
    expect(e.obciecieNacisku).toBe(false);
    expect(a.obciecieNacisku).toBe(true);
    let pozaPasmem = 0;
    for (const c of e.swiat.cywilizacje) e.stan.znaneCywilizacje[c.id] = true;
    for (const c of a.swiat.cywilizacje) a.stan.znaneCywilizacje[c.id] = true;
    for (const w of e.swiat.wezly) {
      if (w.typ !== 'planeta') continue;
      for (const t of TOWARY) {
        const ce = e.ceny(w.id, t, 0)!;
        const ca = a.ceny(w.id, t, 0)!;
        expect(ca.nacisk).toBeGreaterThanOrEqual(K.StockPressureMin - 1e-12);
        expect(ca.nacisk).toBeLessThanOrEqual(K.StockPressureMax + 1e-12);
        if (ce.nacisk > K.StockPressureMax + 1e-9) pozaPasmem++;
      }
    }
    expect(pozaPasmem).toBeGreaterThan(0);
  });
});
