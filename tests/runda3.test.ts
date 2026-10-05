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

describe('runda 3: rynek z ludności, sektory i bramka towaru', () => {
  it('konsumpcja planety = konsumpcjaNaMlnNaDobe × potrzeby × populacja × koszyk T1; rynek jest bezdenny wobec jednego statku', () => {
    const g = new Gra('r3-rynek', { skala: 'L', runda3: true, bramkaTowaru: 'P' });
    const tu = g.stan.pozycja;
    const w = g.wezel(tu);
    const poz = g.stan.rynki[tu].Food;
    const oczekiwana = P.runda3.rynek.konsumpcjaNaMlnNaDobe.Food * P.cywilizacjeKanonu[w.cywilizacja!].potrzeby.Food * w.populacjaMln!;
    expect(poz.konsumpcja).toBeCloseTo(oczekiwana, 6);
    expect(poz.norma).toBeCloseTo(K.normaZapasu * oczekiwana, 6);
    expect(poz.norma).toBeGreaterThan(1000 * g.ladownia());
  });

  it('bramka G: towar sektora o minTier > 1 nie istnieje na rynku cywilizacji T1, bramka P: istnieje, ale nikt go nie produkuje', () => {
    const gG = new Gra('r3-bramka', { skala: 'L', runda3: true, bramkaTowaru: 'G' });
    const gP = new Gra('r3-bramka', { skala: 'L', runda3: true, bramkaTowaru: 'P' });
    const tu = gG.stan.pozycja;
    expect(K.SectorMinTier).toEqual([1, 2, 1, 1, 2, 3, 1]);
    expect(gG.stan.rynki[tu].Minerals.dostepny).toBe(false);
    expect(gG.ceny(tu, 'Minerals')).toBeNull();
    expect(gG.maxKupno('Minerals')).toBe(0);
    expect(gG.stan.rynki[tu].Minerals.konsumpcja).toBe(0);
    expect(gP.stan.rynki[tu].Minerals.dostepny).toBe(true);
    expect(gP.ceny(tu, 'Minerals')).not.toBeNull();
    expect(gP.stan.rynki[tu].Minerals.konsumpcja).toBeGreaterThan(0);
    expect(gP.stan.rynki[tu].Minerals.produkcja).toBe(0);
    for (const t of ['Food', 'Solvents'] as const) {
      expect(gG.stan.rynki[tu][t].dostepny).toBe(true);
      expect(gG.stan.rynki[tu][t].produkcja).toBeGreaterThan(0);
    }
  });
});

describe('runda 3: drabina rozwoju kanonu', () => {
  const OPCJE = { skala: 'L' as const, runda3: true, bramkaTowaru: 'P' as const };

  it('gotowość rośnie z nadwyżki i progu Z₀ × k^(T−1); bez dostawy gracza żadna cywilizacja nie awansuje, choć kontrakty są otwarte', () => {
    const g = new Gra('r3-awans', OPCJE);
    for (const c of g.swiat.cywilizacje) {
      expect(g.tierCywilizacji(c.id)).toBe(1);
      expect(g.rozwoj(c.id).z0WU).toBeGreaterThan(0);
      expect(g.progGotowosciWU(c.id, 2)).toBeCloseTo(g.rozwoj(c.id).z0WU * P.runda3.awans.k, 6);
    }
    g.czekaj(P.runda3.awans.dobyGotowosciT2 * P.runda3.awans.k * 3);
    const zKontraktem = g.swiat.cywilizacje.filter((c) => g.rozwoj(c.id).kontrakt !== null);
    expect(zKontraktem.length).toBeGreaterThan(0);
    for (const c of g.swiat.cywilizacje) expect(g.tierCywilizacji(c.id)).toBe(1);
    const k = g.rozwoj(zKontraktem[0].id).kontrakt!;
    expect(k.tier).toBe(2);
    expect(Object.keys(k.towary).length).toBeGreaterThan(0);
    expect(Object.keys(k.towary)).not.toContain('Minerals');
    expect(Object.keys(k.towary)).not.toContain('Fuel');
  });

  it('awans tylko po kontrakcie: receptura kupiona u innej cywilizacji + naukowiec z innej planety, dostarczone do akademii (stolicy)', () => {
    const g = new Gra('r3-kontrakt', OPCJE);
    const cywStart = g.wezel(g.stan.pozycja).cywilizacja!;
    // Cywilizacja do awansu: inna znana cywilizacja; jej stolica to akademia.
    const cel = g.swiat.cywilizacje.find((c) => c.id !== cywStart && g.cywilizacjaZnana(c.id))!;
    // Wymuś gotowość (bez czekania setek dób) i otwórz kontrakt przez upływ chwili.
    g.rozwoj(cel.id).nadwyzkaWU = g.progGotowosciWU(cel.id, 2);
    g.czekaj(0.01);
    const kontrakt = g.rozwoj(cel.id).kontrakt!;
    expect(kontrakt).not.toBeNull();
    // Przed dostawą: tier 1; dostawa bez naukowca i bez towarów odrzucona.
    expect(g.tierCywilizacji(cel.id)).toBe(1);
    expect(() => g.dostarczKontrakt()).toThrow();
    const lecDo = (celId: string) => {
      const sciezka = g.graf.najkrotszaSciezka(g.stan.pozycja, celId)!;
      for (let i = 0; i + 1 < sciezka.length; i++) {
        if (g.maPaliwo()) {
          const ile = Math.min(g.bak() - g.stan.paliwo, g.maxPaliwo());
          if (ile > 1e-6) g.tankuj(ile);
        }
        g.lec([sciezka[i], sciezka[i + 1]]);
      }
    };
    // Kup recepturę u innej cywilizacji niż cel: tutaj, a gdy tu brak zapasu (deficyt), na najbliższej planecie z zapasem.
    g.tankuj(g.maxPaliwo());
    for (const t of Object.keys(kontrakt.towary) as (keyof typeof kontrakt.towary)[]) {
      const ile = kontrakt.towary[t]!;
      if (g.maxKupno(t) < ile) {
        const d0 = g.graf.dijkstra(g.stan.pozycja);
        const zrodlo = g.swiat.wezly
          .filter((w) => w.typ === 'planeta' && w.cywilizacja !== cel.id && g.rynekZnany(w.id) && g.stan.rynki[w.id][t].zapas >= ile)
          .sort((a, b) => (d0.get(a.id)?.dystans ?? Infinity) - (d0.get(b.id)?.dystans ?? Infinity))[0];
        expect(zrodlo).toBeDefined();
        lecDo(zrodlo.id);
      }
      expect(g.maxKupno(t)).toBeGreaterThanOrEqual(ile);
      g.kup(t, ile);
      expect(g.ladunekSpoza(t, cel.id)).toBeGreaterThanOrEqual(ile);
    }
    // Naukowiec: z planety celu innej niż akademia (lub sąsiedniej); tu (cywilizacja startowa) tylko jeśli sąsiednia.
    const d = g.graf.dijkstra(g.stan.pozycja);
    const planetaNaukowca = cel.planety.filter((id) => id !== cel.stolica).sort((a, b) => (d.get(a)?.dystans ?? Infinity) - (d.get(b)?.dystans ?? Infinity))[0];
    expect(g.naukowiecDostepny(cel.id, cel.stolica)).toBe(false);
    expect(g.naukowiecDostepny(cel.id, planetaNaukowca)).toBe(true);
    lecDo(planetaNaukowca);
    g.zabierzNaukowca(cel.id);
    expect(g.statek().naukowiec?.cywilizacja).toBe(cel.id);
    expect(g.objetoscZajeta()).toBeGreaterThanOrEqual(P.runda3.statek.naukowiecM3);
    lecDo(cel.stolica);
    const dd = g.kontraktDoDostarczenia()!;
    expect(dd.brakuje).toEqual([]);
    const przed = g.stan.rynki[cel.stolica].Minerals;
    expect(przed.produkcja).toBe(0);
    const konsumpcjaMineralowPrzed = przed.konsumpcja;
    const konsumpcjaPaliwaPrzed = g.stan.rynki[cel.stolica].Fuel.konsumpcja;
    g.dostarczKontrakt();
    expect(g.tierCywilizacji(cel.id)).toBe(2);
    expect(g.statek().naukowiec).toBeNull();
    expect(g.rozwoj(cel.id).kontrakt).toBeNull();
    expect(g.rozwoj(cel.id).nadwyzkaWU).toBe(0);
    // T2 otwiera górnictwo i przemysł (SectorMinTier 2): produkcja minerałów rusza, popyt rośnie według koszyka (minerały ×6,38, paliwo ×3,46).
    const po = g.stan.rynki[cel.stolica].Minerals;
    expect(po.produkcja).toBeGreaterThan(0);
    expect(po.konsumpcja / konsumpcjaMineralowPrzed).toBeCloseTo(6.38, 6);
    expect(g.stan.rynki[cel.stolica].Fuel.konsumpcja / konsumpcjaPaliwaPrzed).toBeCloseTo(3.46, 6);
    expect(g.stan.rynki[cel.stolica].Electronics.produkcja).toBe(0);
    expect(g.stan.kamienie[`tier:${cel.id}:2`]).toBeDefined();
    expect(g.stan.kamienie['cywilizacja:pierwsza:T2']).toBeDefined();
    const r = g.stan.raporty[g.stan.raporty.length - 1];
    expect(r.linie.reduce((s, l) => s + l.kr, 0)).toBe(r.zmianaSalda);
  });

  it('bramka G: po awansie na T2 minerały pojawiają się na rynku cywilizacji', () => {
    const g = new Gra('r3-bramka-awans', { skala: 'L', runda3: true, bramkaTowaru: 'G' });
    const cywStart = g.wezel(g.stan.pozycja).cywilizacja!;
    const cel = g.swiat.cywilizacje.find((c) => c.id !== cywStart && g.cywilizacjaZnana(c.id))!;
    expect(g.stan.rynki[cel.stolica].Minerals.dostepny).toBe(false);
    g.rozwoj(cel.id).nadwyzkaWU = g.progGotowosciWU(cel.id, 2);
    g.czekaj(0.01);
    // Dostawa „na skróty” dla testu bramki: symulujemy spełniony kontrakt przez bezpośrednie wywołanie prywatnego awansu.
    (g as unknown as { awansujCywilizacje: (c: string, t: number) => void }).awansujCywilizacje(cel.id, 2);
    expect(g.stan.rynki[cel.stolica].Minerals.dostepny).toBe(true);
    expect(g.stan.rynki[cel.stolica].Minerals.konsumpcja).toBeGreaterThan(0);
    expect(g.stan.rynki[cel.stolica].Electronics.dostepny).toBe(false);
    expect(g.ceny(cel.stolica, 'Minerals')).not.toBeNull();
  });
});
