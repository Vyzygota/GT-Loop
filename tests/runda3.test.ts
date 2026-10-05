import { describe, expect, it } from 'vitest';
import { Gra, K, P, TOWARY, lot, zasiegPrzyStalejMasie, zasiegNaPaliwie, masaSuchaT, ciagTf, type ParametryLotu } from '../sim/index';
import { zagrajFlote } from '../bot/flota';

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

  it('awans tylko po kontrakcie: receptura + naukowiec z innej planety, dostarczone do akademii (stolicy)', () => {
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
    // Kup recepturę (towary własnych sektorów celu, dowolne pochodzenie): tutaj, a gdy tu brak zapasu, na najbliższej planecie z zapasem.
    expect(Object.keys(kontrakt.odSasiada)).toEqual([]);
    g.tankuj(g.maxPaliwo());
    for (const t of Object.keys(kontrakt.towary) as (keyof typeof kontrakt.towary)[]) {
      const ile = kontrakt.towary[t]!;
      if (g.maxKupno(t) < ile) {
        const d0 = g.graf.dijkstra(g.stan.pozycja);
        const zrodlo = g.swiat.wezly
          .filter((w) => w.typ === 'planeta' && g.rynekZnany(w.id) && g.stan.rynki[w.id][t].zapas >= ile)
          .sort((a, b) => (d0.get(a.id)?.dystans ?? Infinity) - (d0.get(b.id)?.dystans ?? Infinity))[0];
        expect(zrodlo).toBeDefined();
        lecDo(zrodlo.id);
      }
      expect(g.maxKupno(t)).toBeGreaterThanOrEqual(ile);
      g.kup(t, ile);
      expect(g.ladunekDoKontraktu(t, cel.id)).toBeGreaterThanOrEqual(ile);
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
    // Sektor otwarty tierem produkuje od razu (normalizacja specjalizacji liczona z konsumpcji potencjalnej, nie z zera).
    expect(g.stan.rynki[cel.stolica].Minerals.produkcja).toBeGreaterThan(0);
    expect(g.stan.rynki[cel.stolica].Electronics.dostepny).toBe(false);
    expect(g.ceny(cel.stolica, 'Minerals')).not.toBeNull();
  });
});

/** Lot po najkrótszej ścieżce z tankowaniem tam, gdzie jest paliwo (pomocnik testów floty). */
function lecDo(g: Gra, celId: string): void {
  const sciezka = g.graf.najkrotszaSciezka(g.stan.pozycja, celId)!;
  for (let i = 0; i + 1 < sciezka.length; i++) {
    if (g.maPaliwo()) {
      const ile = Math.min(g.bak() - g.stan.paliwo, g.maxPaliwo());
      if (ile > 1e-6) g.tankuj(ile);
    }
    g.lec([sciezka[i], sciezka[i + 1]]);
  }
}

/** Do stoczni cywilizacji startowej (stolica), z dużą gotówką na testy floty. */
function doStoczni(g: Gra): void {
  g.stan.kr = 1e9;
  const cyw = g.cywilizacja(g.wezel(g.stan.pozycja).cywilizacja!)!;
  if (!g.wStoczni()) lecDo(g, cyw.stolica);
  expect(g.wStoczni()).toBe(true);
}

describe('runda 3: flota, pamięć floty, dostawy częściowe, determinizm', () => {
  it('poziom firmy dopuszcza 1/2/4/8 statków; nowy statek tylko w stoczni i w limicie; okno stoczni nie przesuwa czasu', () => {
    const g = new Gra('r3-flota', { skala: 'L', runda3: true, bramkaTowaru: 'G' });
    doStoczni(g);
    const doba = g.stan.doba;
    const kr = g.stan.kr;
    expect(P.runda3.firma.statkiNaPoziom).toEqual([1, 2, 4, 8]);
    expect(g.limitStatkow()).toBe(1);
    expect(() => g.kupStatek()).toThrow();
    for (const [poziom, limit] of [[2, 2], [3, 4], [4, 8]] as const) {
      g.stan.poziomFirmy = poziom;
      expect(g.limitStatkow()).toBe(limit);
      while (g.stan.statki.length < limit) g.kupStatek();
      expect(() => g.kupStatek()).toThrow();
    }
    expect(g.stan.statki.length).toBe(8);
    expect(g.statkiWDoku()).toHaveLength(8);
    expect(g.stan.oknaStoczni.filter((o) => o.rodzaj === 'statek')).toHaveLength(7);
    expect(g.stan.doba).toBe(doba);
    expect(g.stan.kr).toBe(kr - 7 * P.runda3.firma.cenaNowegoStatkuKr);
    for (const s of g.stan.statki.slice(1)) {
      expect(s.szczebel).toBe(0);
      expect(s.paliwo).toBe(0);
      expect(s.pozycja).toBe(g.stan.pozycja);
    }
    // Poza stocznią nowego statku nie ma.
    const h = new Gra('r3-flota', { skala: 'L', runda3: true, bramkaTowaru: 'G' });
    h.stan.kr = 1e9;
    h.stan.poziomFirmy = 4;
    if (!h.wStoczni()) expect(() => h.kupStatek()).toThrow();
  });

  for (const wariant of ['A', 'B', 'C'] as const) {
    it(`pamięć floty ${wariant}: odsprzedaż w miejscu zakupu przed wygaśnięciem nie daje zysku żadnemu statkowi; wygasa według reguły wariantu`, () => {
      const g = new Gra('r3-pamiec', { skala: 'L', runda3: true, spread: 'B', pamiecFloty: wariant, paliwo: 'D' });
      doStoczni(g);
      g.stan.poziomFirmy = 2;
      g.kupStatek();
      const tu = g.stan.pozycja;
      const towar = 'Food';
      const N = P.pamiecZakupuSkokow;
      g.wybierzStatek(0);
      const q = 10;
      const zakup = g.kup(towar, q);
      const cenaZakupu = zakup.kwotaKr / q;
      // Przed wygaśnięciem: oba statki widzą licznik > 0 i cenę sprzedaży nie wyższą od ceny zakupu.
      for (const i of [0, 1]) {
        g.wybierzStatek(i);
        expect(g.licznikPamieci(tu, towar)).toBe(N);
        expect(g.karaSprzedazy(tu, towar)).toBeGreaterThan(0);
        expect(g.ceny(tu, towar)!.sprzedazKr).toBeLessThanOrEqual(cenaZakupu);
      }
      // Sąsiad do skoków: najbliższy węzeł po grafie (krawędź bezpośrednia).
      const d0 = g.graf.dijkstra(tu);
      let sasiad: { id: string; d: number } | null = null;
      for (const [id, x] of d0) if (id !== tu && x.dystans > 0 && (!sasiad || x.dystans < sasiad.d)) sasiad = { id, d: x.dystans };
      expect(g.graf.najkrotszaSciezka(tu, sasiad!.id)).toHaveLength(2);
      const skocz = (i: number, razy: number) => {
        g.wybierzStatek(i);
        for (let k = 0; k < razy; k++) {
          if (g.maPaliwo()) g.tankuj(Math.min(g.bak() - g.stan.paliwo, g.maxPaliwo()));
          g.lec([g.stan.pozycja, g.stan.pozycja === tu ? sasiad!.id : tu]);
        }
      };
      if (wariant === 'C') {
        // Czas: licznik maleje z dobami niezależnie od skoków, gaśnie po pamiecCzasDob.
        g.czekaj(P.runda3.pamiecCzasDob * 0.4);
        for (const i of [0, 1]) {
          g.wybierzStatek(i);
          expect(g.licznikPamieci(tu, towar)).toBeGreaterThan(0);
          expect(g.licznikPamieci(tu, towar)).toBeLessThan(N);
        }
        g.czekaj(P.runda3.pamiecCzasDob * 0.6 + 0.01);
        for (const i of [0, 1]) {
          g.wybierzStatek(i);
          expect(g.licznikPamieci(tu, towar)).toBe(0);
          expect(g.karaSprzedazy(tu, towar)).toBe(0);
        }
        return;
      }
      const kupujacy = 0;
      const sprzedajacy = 1;
      const pierwszy = wariant === 'A' ? sprzedajacy : kupujacy; // skoki tego statku NIE wygaszają pamięci dla sprzedającego
      const drugi = wariant === 'A' ? kupujacy : sprzedajacy; // skoki tego statku wygaszają
      skocz(pierwszy, 2 * N);
      g.wybierzStatek(sprzedajacy);
      expect(g.licznikPamieci(tu, towar)).toBe(N);
      expect(g.karaSprzedazy(tu, towar)).toBeGreaterThan(0);
      skocz(drugi, N - 1);
      g.wybierzStatek(sprzedajacy);
      expect(g.licznikPamieci(tu, towar)).toBe(1);
      skocz(drugi, 1);
      g.wybierzStatek(sprzedajacy);
      expect(g.licznikPamieci(tu, towar)).toBe(0);
      expect(g.karaSprzedazy(tu, towar)).toBe(0);
    });
  }

  it('dostawa częściowa: receptura w jednym kursie, naukowiec w drugim; awans dopiero po ostatniej dostawie z naukowcem', () => {
    const g = new Gra('r3-czesciowa', { skala: 'L', runda3: true, bramkaTowaru: 'P' });
    const cywStart = g.wezel(g.stan.pozycja).cywilizacja!;
    const cel = g.swiat.cywilizacje.find((c) => c.id !== cywStart && g.cywilizacjaZnana(c.id))!;
    g.rozwoj(cel.id).nadwyzkaWU = g.progGotowosciWU(cel.id, 2);
    g.czekaj(0.01);
    const kontrakt = g.rozwoj(cel.id).kontrakt!;
    expect(kontrakt.dostarczone).toEqual({});
    expect(kontrakt.naukowiecWAkademii).toBe(false);
    g.stan.kr = 1e9;
    g.tankuj(g.maxPaliwo());
    // Zakup całej receptury (tu albo na najbliższej planecie z zapasem).
    for (const t of Object.keys(kontrakt.towary) as (keyof typeof kontrakt.towary)[]) {
      const ile = kontrakt.towary[t]!;
      if (g.maxKupno(t) < ile) {
        const d0 = g.graf.dijkstra(g.stan.pozycja);
        const zrodlo = g.swiat.wezly
          .filter((w) => w.typ === 'planeta' && g.rynekZnany(w.id) && g.stan.rynki[w.id][t].zapas >= ile)
          .sort((a, b) => (d0.get(a.id)?.dystans ?? Infinity) - (d0.get(b.id)?.dystans ?? Infinity))[0];
        lecDo(g, zrodlo.id);
      }
      g.kup(t, ile);
    }
    // Kurs 1: do akademii bez naukowca — dostawa częściowa, kontrakt otwarty, tier bez zmian.
    lecDo(g, cel.stolica);
    const dd1 = g.kontraktDoDostarczenia()!;
    expect(dd1.brakuje).toEqual(['naukowiec']);
    expect(Object.keys(dd1.dostarczalne).length).toBeGreaterThan(0);
    const w1 = g.dostarczKontrakt();
    expect(w1.zamkniety).toBe(false);
    expect(g.tierCywilizacji(cel.id)).toBe(1);
    expect(g.rozwoj(cel.id).kontrakt).not.toBeNull();
    expect(g.pozostaloKontraktu(cel.id)).toEqual({});
    for (const t of Object.keys(kontrakt.towary) as (keyof typeof kontrakt.towary)[]) {
      expect(g.rozwoj(cel.id).kontrakt!.dostarczone[t]).toBeCloseTo(kontrakt.towary[t]!, 6);
      expect(g.stan.ladownia[t].m3).toBeCloseTo(0, 6);
    }
    // Bez niczego na pokładzie dostawa jest błędem.
    expect(() => g.dostarczKontrakt()).toThrow();
    // Kurs 2: naukowiec z innej planety celu, powrót, dostawa końcowa — awans.
    const d = g.graf.dijkstra(g.stan.pozycja);
    const planetaNaukowca = cel.planety.filter((id) => id !== cel.stolica).sort((a, b) => (d.get(a)?.dystans ?? Infinity) - (d.get(b)?.dystans ?? Infinity))[0];
    lecDo(g, planetaNaukowca);
    g.zabierzNaukowca(cel.id);
    lecDo(g, cel.stolica);
    const dd2 = g.kontraktDoDostarczenia()!;
    expect(dd2.brakuje).toEqual([]);
    expect(dd2.naukowiecNaPokladzie).toBe(true);
    const w2 = g.dostarczKontrakt();
    expect(w2.zamkniety).toBe(true);
    expect(g.tierCywilizacji(cel.id)).toBe(2);
    expect(g.statek().naukowiec).toBeNull();
    expect(g.rozwoj(cel.id).kontrakt).toBeNull();
  });

  it('determinizm floty: dwa przebiegi bota floty na L z tym samym ziarnem dają ten sam stan po całym horyzoncie 1 200 dób', () => {
    const opcje = { skala: 'L' as const, informacja: 'pelna' as const, spread: 'B' as const, paliwo: 'R' as const, bramkaTowaru: 'G' as const, pamiecFloty: 'A' as const };
    const zrzut = (g: Gra) =>
      JSON.stringify({
        doba: g.stan.doba,
        kr: g.stan.kr,
        statki: g.stan.statki.map((s) => [s.pozycja, s.paliwo, s.szczebel, s.skoki, s.zaloga.length]),
        tiery: g.stan.tiery,
        kamienie: g.stan.kamienie,
        poziom: g.stan.poziomFirmy,
        okna: g.stan.oknaStoczni.length,
      });
    let a = '';
    let b = '';
    const wa = zagrajFlote('det-flota', opcje, { naKoniec: (g) => (a = zrzut(g)) });
    const wb = zagrajFlote('det-flota', opcje, { naKoniec: (g) => (b = zrzut(g)) });
    expect(a).toBe(b);
    expect(wa.wartoscKoncowa).toBe(wb.wartoscKoncowa);
    expect(wa.loty.length).toBe(wb.loty.length);
    expect(JSON.parse(a).doba).toBeGreaterThanOrEqual(1200);
    expect(Number.isFinite(wa.wartoscKoncowa)).toBe(true);
  }, 120_000);
});
