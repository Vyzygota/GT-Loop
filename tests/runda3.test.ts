import { describe, expect, it } from 'vitest';
import { Gra, K, P, TOWARY, lot, zasiegPrzyStalejMasie, zasiegNaPaliwie, masaSuchaT, ciagTf, type ParametryLotu } from '../sim/index';

const S = () => P.runda3.statek;

function parametry(masaStartT: number, wariant: 'R' | 'D' = 'R', pilot = 1, mnoznikPaliwa = 1): ParametryLotu {
  return { masaStartT, ciagTf: 2 * K.statek.ciagDyszyTf, pilot, mnoznikPaliwa, wariant };
}

describe('runda 3: lot z hierarchii ciągu', () => {
  it('jedynka (2 dysze, 421,99 t + 100 t paliwa) leci 4,00 pc/dobę; z 4 ładowniami i 1 440 t minerałów ok. 0,99 pc/dobę', () => {
    const jedynka = K.statek.masaJedynkiSuchaT + 100;
    const l = lot(1e-9, parametry(jedynka));
    expect(l.predkoscStart).toBeCloseTo(4.0, 2);
    // Kadłub szczebla 0 w prototypie to jedynka + 4 moduły ładowni (36 t każdy).
    const konf0 = S().konfiguracje[0];
    expect(konf0).toEqual({ reaktory: 1, ladownie: 4 });
    expect(masaSuchaT(0, konf0)).toBeCloseTo(K.statek.masaJedynkiSuchaT + 4 * S().masaModuluLadowniT, 6);
    expect(ciagTf(konf0)).toBe(2 * K.statek.ciagDyszyTf);
    const zMineralami = lot(1e-9, parametry(masaSuchaT(0, konf0) + 100 + 1440));
    expect(zMineralami.predkoscStart).toBeCloseTo(0.99, 2);
  });

  it('zasięgi kontrolne na 100 m³ w wariancie R przy stałej masie: jedynka 100 pc, +4 ładownie puste 78,4 pc, +minerały 24,8 pc; z ubytkiem paliwa dalej', () => {
    const jedynka = K.statek.masaJedynkiSuchaT + 100;
    const zLadowniami = masaSuchaT(0, S().konfiguracje[0]) + 100;
    expect(zasiegPrzyStalejMasie(100, parametry(jedynka))).toBeCloseTo(100, 1);
    expect(zasiegPrzyStalejMasie(100, parametry(zLadowniami))).toBeCloseTo(78.4, 1);
    expect(zasiegPrzyStalejMasie(100, parametry(zLadowniami + 1440))).toBeCloseTo(24.8, 1);
    // Ubytek paliwa: statek lżejszy pod koniec, więc rzeczywisty zasięg jest większy, a spalanie na parsek przy minerałach ok. 4 m³/pc.
    expect(zasiegNaPaliwie(100, parametry(jedynka))).toBeGreaterThan(100);
    const minerały = lot(24.8, parametry(zLadowniami + 1440));
    expect(minerały.paliwoM3 / 24.8).toBeCloseTo(4.0, 0);
  });

  it('ubytek paliwa przyspiesza statek (R i D), a wariant D pali 1 m³/pc niezależnie od masy', () => {
    for (const wariant of ['R', 'D'] as const) {
      const l = lot(80, parametry(K.statek.masaJedynkiSuchaT + 100, wariant));
      expect(l.predkoscMeta).toBeGreaterThan(l.predkoscStart);
      expect(l.doby).toBeGreaterThan(0);
    }
    const lekki = lot(60, parametry(600, 'D'));
    const ciezki = lot(60, parametry(2000, 'D'));
    expect(lekki.paliwoM3).toBeCloseTo(60, 9);
    expect(ciezki.paliwoM3).toBeCloseTo(60, 9);
    expect(ciezki.doby).toBeGreaterThan(lekki.doby);
    // W wariancie R cięższy statek pali więcej na parsek.
    const lekkiR = lot(60, parametry(600, 'R'));
    const ciezkiR = lot(60, parametry(2000, 'R'));
    expect(ciezkiR.paliwoM3).toBeGreaterThan(lekkiR.paliwoM3 * 2);
  });

  it('gra w rundzie 3: pusty bak na starcie, paliwo jest pierwszym zakupem, lot liczy się z masy ładunku', () => {
    const g = new Gra('r3-lot', { skala: 'M', runda3: true, paliwo: 'R' });
    expect(g.runda3).toBe(true);
    expect(g.progresja).toBe(true);
    expect(g.stan.paliwo).toBe(0);
    expect(g.stan.kr).toBe(K.startingCredits);
    expect(g.ladownia()).toBe(4 * S().modulLadowniM3);
    expect(g.bak()).toBe(S().bakM3[0]);
    expect(g.miejscaZalogi()).toBe(3);
    const sasiad = g.graf.sasiedzi(g.stan.pozycja)[0];
    expect(g.sprawdzTrase([g.stan.pozycja, sasiad.id]).blad).toMatch(/paliwa/);
    g.tankuj(g.maxPaliwo());
    expect(g.stan.paliwo).toBeCloseTo(S().bakM3[0], 9);
    const pusty = g.obliczLot(sasiad.dystans);
    const t = TOWARY.find((x) => g.maxKupno(x) >= 100)!;
    g.kup(t, 100);
    const pelny = g.obliczLot(sasiad.dystans);
    expect(pelny.doby).toBeGreaterThan(pusty.doby);
    expect(g.predkoscTeraz()).toBeLessThan(4);
    const paliwoPrzed = g.stan.paliwo;
    const r = g.lec([g.stan.pozycja, sasiad.id]);
    expect(r.doby).toBeCloseTo(pelny.doby, 9);
    expect(paliwoPrzed - g.stan.paliwo).toBeCloseTo(pelny.paliwo, 9);
    expect(r.predkoscMeta!).toBeGreaterThan(r.predkoscStart!);
    expect(r.linie.reduce((s, l) => s + l.kr, 0)).toBe(r.zmianaSalda);
  });

  it('czas ciągły: dwa statki lecą naraz, świat dokuje je w kolejności przylotu, raport każdego sumuje się do jego przepływów', () => {
    const g = new Gra('r3-flota', { skala: 'M', runda3: true });
    g.stan.poziomFirmy = 2;
    g.stan.kr = 50_000_000;
    const drugi = g.kupStatek();
    expect(g.stan.statki).toHaveLength(2);
    expect(drugi.pozycja).toBe(g.stan.pozycja);
    const tu = g.stan.pozycja;
    const sasiedzi = g.graf.sasiedzi(tu).sort((a, b) => a.dystans - b.dystans);
    // Statek 0: krótki skok; statek 1: dłuższy skok.
    g.wybierzStatek(0);
    g.tankuj(g.maxPaliwo());
    g.wystartuj([tu, sasiedzi[0].id]);
    g.wybierzStatek(1);
    g.tankuj(g.maxPaliwo());
    g.wystartuj([tu, sasiedzi[sasiedzi.length - 1].id]);
    expect(g.statkiWDoku()).toEqual([]);
    const r1 = g.nastepnyPrzylot()!;
    expect(r1.statek).toBe(0);
    expect(g.stan.aktywny).toBe(0);
    expect(g.stan.statki[1].wLocie).not.toBeNull();
    expect(r1.linie.reduce((s, l) => s + l.kr, 0)).toBe(r1.zmianaSalda);
    const r2 = g.nastepnyPrzylot()!;
    expect(r2.statek).toBe(1);
    expect(g.stan.doba).toBeCloseTo(r2.dobaKoniec, 9);
    expect(g.nastepnyPrzylot()).toBeNull();
    expect(g.stan.oknaStoczni.filter((o) => o.rodzaj === 'statek')).toHaveLength(1);
  });

  it('poza rundą 3 nic się nie zmienia: pełny bak, prędkość nominalna, jeden statek', () => {
    const g = new Gra('r3-off', { skala: 'S' });
    expect(g.runda3).toBe(false);
    expect(g.stan.paliwo).toBe(K.bak);
    expect(g.stan.statki).toHaveLength(1);
    expect(g.predkoscTeraz()).toBe(K.predkoscNominalna);
    expect(g.limitStatkow()).toBe(1);
  });
});
