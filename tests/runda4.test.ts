import { describe, expect, it } from 'vitest';
import { Gra, K, P, drabinaRundy3, jedynka, ladowniaZReszty, predkoscPrzyMasie, wyprowadzDrabine, zasiegNaPaliwie } from '../sim/index';
import { zagrajFlote } from '../bot/flota';

const stanRef = (k: { masaSuchaT: number; bakM3: number; ladowniaM3: number }) => k.masaSuchaT + k.bakM3 * K.towary.Fuel.gestosc + k.ladowniaM3 * P.runda4.gestoscReferencyjnaTNaM3;

describe('runda 4: procedura wyprowadzenia kadłuba', () => {
  it('BaseShip krok po kroku: obrys 1 000, napęd 271, kajuty 40, konstrukcja 100, bak 100, ładownia 480 m³ (4 moduły, luz 9), masa 421,99 t', () => {
    const j = jedynka();
    expect(j.obrysM3).toBe(1000);
    expect(j.reaktory).toBe(1);
    expect(j.reaktory * K.statek.objetoscReaktoraM3).toBe(271);
    expect(j.dysze).toBe(2);
    expect(j.kajutyM3).toBe(40);
    expect(j.konstrukcjaM3).toBe(100);
    expect(j.bakM3).toBe(100);
    expect(j.zbiorniki).toBe(2);
    expect(j.ladowniaM3).toBe(480);
    expect(j.moduly).toBe(4);
    expect(j.luzM3).toBeCloseTo(9, 9);
    expect(j.masaSuchaT).toBeCloseTo(K.statek.masaJedynkiSuchaT, 9);
    expect(j.ciagTf).toBe(2 * K.statek.ciagDyszyTf);
  });

  it('ładownia = reszta: zmiana obrysu, napędu, kajut albo baku przesuwa liczbę modułów', () => {
    const baza = ladowniaZReszty(1000, 1, 2, 2);
    expect(baza.ladowniaM3).toBe(480);
    expect(ladowniaZReszty(1130, 1, 2, 2).ladowniaM3).toBe(600);
    expect(ladowniaZReszty(1000, 2, 2, 2).ladowniaM3).toBe(120);
    expect(ladowniaZReszty(1000, 1, 3, 2).ladowniaM3).toBe(360);
    expect(ladowniaZReszty(1000, 1, 2, 3).ladowniaM3).toBe(360);
    // Konstrukcja to zawsze 10% obrysu: większy obrys oddaje ładowni tylko 90%.
    expect(ladowniaZReszty(2000, 1, 2, 2).konstrukcjaM3).toBe(200);
  });

  for (const wariant of ['R', 'D'] as const) {
    it(`każdy szczebel drabiny (g 1,5–4, paliwo ${wariant}) z pełną ładownią referencyjną jest co najmniej tak szybki i dalekosiężny jak jedynka; ładownia = 480 × g^N`, () => {
      const j = jedynka();
      const vJ = predkoscPrzyMasie(stanRef(j), j.ciagTf);
      const zJ = zasiegNaPaliwie(j.bakM3, { masaStartT: stanRef(j), ciagTf: j.ciagTf, pilot: 1, mnoznikPaliwa: 1, wariant });
      for (const g of [1.5, 2, 2.5, 3, 4]) {
        const d = wyprowadzDrabine(g, wariant);
        expect(d).toHaveLength(K.drabinaKadlubow.szczebli);
        expect(d[0]).toEqual(j);
        d.forEach((k, n) => {
          if (n === 0) return;
          expect(k.ladowniaM3).toBeGreaterThanOrEqual(480 * Math.pow(g, n) - 1e-9);
          expect(k.ladowniaM3).toBeLessThan(480 * Math.pow(g, n) + K.kadlub.modulLadowniM3);
          expect(predkoscPrzyMasie(stanRef(k), k.ciagTf)).toBeGreaterThanOrEqual(vJ - 1e-9);
          expect(zasiegNaPaliwie(k.bakM3, { masaStartT: stanRef(k), ciagTf: k.ciagTf, pilot: 1, mnoznikPaliwa: 1, wariant })).toBeGreaterThanOrEqual(zJ - 1e-9);
          // Obrys rozlicza się do zera z luzem poniżej modułu, konstrukcja = 10% obrysu, kajuty = 20 m³ × obsada.
          expect(k.reaktory * K.statek.objetoscReaktoraM3 + k.kajutyM3 + k.konstrukcjaM3 + k.bakM3 + k.ladowniaM3 + k.luzM3).toBeCloseTo(k.obrysM3, 6);
          expect(k.luzM3).toBeLessThan(K.kadlub.modulLadowniM3);
          expect(k.konstrukcjaM3).toBeCloseTo(K.kadlub.konstrukcjaUlamekObrysu * k.obrysM3, 9);
          expect(k.kajutyM3).toBe(K.kadlub.kajutaNaOsobeM3 * k.osoby);
          expect(k.osoby).toBe(P.runda3.statek.obsada.kokpit + k.reaktory + Math.ceil(k.moduly / P.runda3.statek.obsada.naModulyLadowni));
          // Minimalność: o jeden reaktor mniej byłoby za wolno (albo to szczebel z 1 reaktorem).
          if (k.reaktory > 1) expect(predkoscPrzyMasie(stanRef(k), k.ciagTf - K.statek.dyszNaReaktor * K.statek.ciagDyszyTf)).toBeLessThan(vJ);
        });
      }
    });
  }

  it('gra w rundzie 4 bierze ładownię, bak, masę, ciąg i obsadę z wyprowadzonej drabiny; runda 3 zostaje przy drabinie prototypu', () => {
    const g4 = new Gra('r4-gra', { skala: 'M', runda4: true, g: 2, paliwo: 'R' });
    expect(g4.runda3).toBe(true);
    expect(g4.drabina[0].ladowniaM3).toBe(480);
    expect(g4.ladownia()).toBe(480);
    expect(g4.bak()).toBe(100);
    expect(g4.miejscaZalogi()).toBe(2);
    expect(g4.masaSuchaT()).toBeCloseTo(K.statek.masaJedynkiSuchaT, 9);
    expect(g4.drabina[1].ladowniaM3).toBe(960);
    expect(g4.drabina[5].ladowniaM3).toBe(15360);
    const g3 = new Gra('r4-gra', { skala: 'M', runda3: true, paliwo: 'R' });
    expect(g3.drabina).toEqual(drabinaRundy3());
    expect(g3.miejscaZalogi()).toBe(3);
    expect(g3.drabina[1].ladowniaM3).toBe(840);
  });

  it('determinizm floty w rundzie 4: dwa przebiegi na L z tym samym ziarnem dają ten sam stan po 4 800 dobach', () => {
    const opcje = { skala: 'L' as const, informacja: 'pelna' as const, spread: 'B' as const, paliwo: 'R' as const, bramkaTowaru: 'G' as const, pamiecFloty: 'A' as const, runda4: true, g: 2 };
    const zrzut = (g: Gra) => JSON.stringify({ doba: g.stan.doba, kr: g.stan.kr, statki: g.stan.statki.map((s) => [s.pozycja, s.paliwo, s.szczebel, s.skoki]), tiery: g.stan.tiery, kamienie: g.stan.kamienie });
    let a = '';
    let b = '';
    const wa = zagrajFlote('det-r4', opcje, { naKoniec: (g) => (a = zrzut(g)) });
    const wb = zagrajFlote('det-r4', opcje, { naKoniec: (g) => (b = zrzut(g)) });
    expect(a).toBe(b);
    expect(wa.wartoscKoncowa).toBe(wb.wartoscKoncowa);
    expect(JSON.parse(a).doba).toBeGreaterThanOrEqual(P.runda3.horyzontDob);
  }, 1_200_000);
});
