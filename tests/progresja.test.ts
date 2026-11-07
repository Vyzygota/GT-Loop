import { afterEach, describe, expect, it } from 'vitest';
import { krokBota, nowyStanBota } from '../bot/strategia';
import { Gra, K, P, TOWARY, placaZTieru, tierZalogi, umiejetnoscZTieru } from '../sim/index';

const OPCJE = { skala: 'M' as const, spread: 'B' as const, progresja: true };
const progOryginalny = P.progresja.progAwansu;
afterEach(() => {
  P.progresja.progAwansu = progOryginalny;
});

/** Leci najkrótszą ścieżką do celu skok po skoku, tankując wszędzie, gdzie jest paliwo. */
function lecDo(g: Gra, cel: string) {
  const sciezka = g.graf.najkrotszaSciezka(g.stan.pozycja, cel)!;
  let raport: ReturnType<Gra['lec']> | null = null;
  for (let i = 0; i + 1 < sciezka.length; i++) {
    if (g.maPaliwo()) {
      const ile = Math.min(g.bak() - g.stan.paliwo, g.maxPaliwo());
      if (ile > 1e-6) g.tankuj(ile);
    }
    raport = g.lec([sciezka[i], sciezka[i + 1]]);
  }
  return raport!;
}

function najblizszaPlaneta(g: Gra, idCyw: string): string {
  const d = g.graf.dijkstra(g.stan.pozycja);
  return g.cywilizacja(idCyw)!.planety.slice().sort((a, b) => (d.get(a)?.dystans ?? Infinity) - (d.get(b)?.dystans ?? Infinity))[0];
}

describe('progresja: awans tieru cywilizacji tylko przez dostawę gracza', () => {
  it('świat żyje setki dób bez dostaw gracza i żadna cywilizacja nie awansuje', () => {
    const g = new Gra('awans-npc', OPCJE);
    const sasiad = g.graf.sasiedzi(g.stan.pozycja)[0].id;
    while (g.stan.doba < 300) {
      lecDo(g, sasiad);
      lecDo(g, g.swiat.startId);
    }
    for (const c of g.swiat.cywilizacje) {
      expect(g.tierCywilizacji(c.id)).toBe(1);
      expect(g.stan.dostawy[c.id]).toEqual({});
    }
    expect(Object.keys(g.stan.kamienie).filter((k) => k.startsWith('tier:'))).toHaveLength(0);
  });

  it('towar kupiony u tej samej cywilizacji nie liczy się jako dostawa; kupiony u innej po przekroczeniu progu awansuje tier i mnoży popyt koszyka', () => {
    P.progresja.progAwansu = 0.0001;
    const g = new Gra('awans-dostawa', OPCJE);
    const tu = g.stan.pozycja;
    const cywTu = g.wezel(tu).cywilizacja!;
    const inna = g.swiat.cywilizacje.find((c) => c.id !== cywTu && g.cywilizacjaZnana(c.id))!;
    const q = Math.min(3, Math.floor(g.maxKupno('Electronics')));
    expect(q).toBeGreaterThanOrEqual(2);
    g.kup('Electronics', q);
    expect(g.stan.ladownia.Electronics.pochodzenie[cywTu]).toBeCloseTo(q, 9);
    g.sprzedaj('Electronics', 1);
    expect(g.postepAwansu(cywTu).towary.find((x) => x.towar === 'Electronics')!.dostarczoneWU).toBe(0);
    expect(g.tierCywilizacji(cywTu)).toBe(1);

    const cel = najblizszaPlaneta(g, inna.id);
    lecDo(g, cel);
    const postep = g.postepAwansu(inna.id);
    expect(postep.nastepny).toBe(2);
    expect(postep.progWU).toBeCloseTo(P.progresja.progAwansu * postep.pkbWU, 6);
    const przed = inna.planety.map((id) => ({ k: g.stan.rynki[id].Electronics.konsumpcja + g.stan.rynki[id].Electronics.konsumpcjaUspiona, n: g.stan.rynki[id].Electronics.norma }));
    const potrzebyPrzed = inna.potrzebyM3NaDobe.Electronics;
    g.sprzedaj('Electronics', g.stan.ladownia.Electronics.m3);
    expect(g.tierCywilizacji(inna.id)).toBe(2);
    expect(g.stan.dostawy[inna.id]).toEqual({});
    expect(g.stan.kamienie[`tier:${inna.id}:2`]).toBeCloseTo(g.stan.doba, 9);
    expect(g.stan.kamienie['cywilizacja:pierwsza:T2']).toBeCloseTo(g.stan.doba, 9);
    const m = P.progresja.mnoznikKonsumpcjiAwansu;
    inna.planety.forEach((id, i) => {
      const poz = g.stan.rynki[id].Electronics;
      expect(poz.konsumpcja + poz.konsumpcjaUspiona).toBeCloseTo(przed[i].k * m, 9);
      expect(poz.norma).toBeCloseTo(przed[i].n * m, 9);
    });
    expect(inna.potrzebyM3NaDobe.Electronics).toBeCloseTo(potrzebyPrzed * m, 9);
    // Następny tier wymaga koszyka T3 (Elektronika + Materiały wybuchowe), więc sama Elektronika już nie wystarczy.
    expect(g.postepAwansu(inna.id).towary.map((x) => x.towar).sort()).toEqual(['Electronics', 'Explosives']);
    // Raport po następnym locie ma linię awansu i nadal sumuje się do zmiany salda.
    const r = lecDo(g, g.graf.sasiedzi(g.stan.pozycja)[0].id);
    const awans = g.stan.raporty.find((x) => x.awanse?.some((a) => a.cywilizacja === inna.id))!;
    expect(awans.linie.some((l) => l.klucz === 'awans')).toBe(true);
    expect(awans.linie.reduce((s, l) => s + l.kr, 0)).toBe(awans.zmianaSalda);
    expect(r.linie.reduce((s, l) => s + l.kr, 0)).toBe(r.zmianaSalda);
  });

  it('bez progresji nie ma koszyków ani awansów', () => {
    const g = new Gra('awans-bez', { skala: 'M', spread: 'B', progresja: false });
    expect(g.limitDob).toBe(P.skale.M.limitDob);
    for (const c of g.swiat.cywilizacje) expect(g.koszykTieru(c.id)).toBeNull();
    expect(g.wycenaSzczebla()).toBeNull();
  });
});

describe('progresja: drabina kadłubów', () => {
  it('cena szczebla = k × mediana zysku na kurs na bieżącym szczeblu, dostępna po minimalnej liczbie kursów i rosnąca z przychodem', () => {
    const g = new Gra('drabina', OPCJE);
    expect(g.limitDob).toBe(P.progresja.horyzontDob);
    const w0 = g.wycenaSzczebla()!;
    expect(w0.nastepny).toBe(1);
    expect(w0.kwotaKr).toBeNull();
    expect(w0.powod).toMatch(/kursach/);
    const min = P.progresja.minKursowDoWycenySzczebla;
    g.stan.zyskiKursow[0] = Array.from({ length: min }, (_, i) => 100000 * (i + 1));
    const w1 = g.wycenaSzczebla()!;
    const mediana = 100000 * ((min + 1) / 2);
    expect(w1.medianaZyskuKr).toBeCloseTo(mediana, 6);
    expect(w1.kwotaKr).toBe(Math.round(P.progresja.k * mediana));
    expect(w1.ladowniaM3).toBeCloseTo(K.ladownia * P.progresja.mnoznikSzczebla, 9);
    g.stan.zyskiKursow[0].push(2000000, 2000000, 2000000);
    const w2 = g.wycenaSzczebla()!;
    expect(w2.kwotaKr!).toBeGreaterThan(w1.kwotaKr!);
    g.stan.zyskiKursow[0] = Array.from({ length: min }, () => -1000);
    expect(g.wycenaSzczebla()!.kwotaKr).toBeNull();
  });

  it('kupno tylko w stoczni stolicy; ładownia, bak i masa × mnoznikSzczebla^N; linia stoczni w raporcie; bez progresji brak stoczni', () => {
    const g = new Gra('stocznia', OPCJE);
    expect(g.wStoczni()).toBe(true);
    const min = P.progresja.minKursowDoWycenySzczebla;
    g.stan.zyskiKursow[0] = Array.from({ length: min }, () => 100000);
    const cena = g.wycenaSzczebla()!.kwotaKr!;
    const krPrzed = g.stan.kr;
    const paliwoPrzed = g.stan.paliwo;
    g.kupSzczebel();
    expect(g.stan.kr).toBe(krPrzed - cena);
    expect(g.stan.szczebel).toBe(1);
    expect(g.stan.paliwo).toBe(paliwoPrzed);
    const m = P.progresja.mnoznikSzczebla;
    expect(g.ladownia()).toBeCloseTo(K.ladownia * m, 9);
    expect(g.bak()).toBeCloseTo(K.bak * m, 9);
    expect(g.maxMasa()).toBeCloseTo(K.maxMasaLadunku * m, 9);
    expect(g.stan.wydanoNaKadlub).toBe(cena);
    expect(g.stan.kamienie['szczebel:1']).toBe(0);
    // Można zatankować ponad stary bak i kupić ponad starą ładownię.
    expect(g.maxPaliwo()).toBeCloseTo(K.bak * m - paliwoPrzed, 6);
    expect(g.maxKupno('Food', Infinity)).toBeLessThanOrEqual(K.ladownia * m + 1e-9);
    // Drugi szczebel wymaga kursów na pierwszym.
    expect(g.wycenaSzczebla()!.kwotaKr).toBeNull();
    expect(() => g.kupSzczebel()).toThrow();
    const r = g.lec([g.stan.pozycja, g.graf.sasiedzi(g.stan.pozycja)[0].id]);
    const linia = r.linie.find((l) => l.klucz === 'stocznia')!;
    expect(linia.kr).toBe(-cena);
    expect(r.kadlub).toEqual({ szczebel: 1, kwotaKr: cena });
    expect(r.linie.reduce((s, l) => s + l.kr, 0)).toBe(r.saldoPo - r.saldoPrzed);
    // Poza stolicą stocznia nie działa.
    const g2 = new Gra('stocznia-2', OPCJE);
    g2.stan.zyskiKursow[0] = Array.from({ length: min }, () => 100000);
    const nieStolica = g2.swiat.wezly.find((w) => w.typ === 'planeta' && g2.cywilizacjaZnana(w.cywilizacja) && !g2.wStoczni(w.id))!;
    lecDo(g2, nieStolica.id);
    expect(g2.wStoczni()).toBe(false);
    expect(() => g2.kupSzczebel()).toThrow(/stolicy/);
    const g3 = new Gra('stocznia-3', { skala: 'M', progresja: false });
    expect(() => g3.kupSzczebel()).toThrow();
    expect(g3.ladownia()).toBe(K.ladownia);
  });

  it('zysk na kurs mierzy gra: pierwsza sprzedaż w doku zamyka kurs od poprzedniego doku ze sprzedażą', () => {
    const g = new Gra('kurs', OPCJE);
    const t = TOWARY.find((x) => g.maxKupno(x) >= 10)!;
    g.kup(t, 10);
    const cel = [...g.zasieg().values()].find((o) => o.id !== g.stan.pozycja && g.rynekZnany(o.id))!;
    g.lec(cel.sciezka);
    const przyPrzylocie = g.wartoscFirmy();
    expect(g.stan.zyskiKursow[0]).toEqual([]);
    g.sprzedaj(t, 5);
    expect(g.stan.zyskiKursow[0]).toEqual([przyPrzylocie - K.startingCredits]);
    g.sprzedaj(t, 5);
    expect(g.stan.zyskiKursow[0]).toHaveLength(1);
    expect(g.stan.kursStart.wartosc).toBe(przyPrzylocie);
  });
});

describe('progresja: XP i tiery załogi według progów kanonu', () => {
  it('progi 0 / 500 / 1 500 / 9 999 XP, umiejętność w paśmie tieru, płaca w widełkach kanonu', () => {
    expect(K.tierZalogi.progiXP).toEqual([0, 500, 1500, 9999]);
    expect(K.TierCount).toBe(4);
    expect(tierZalogi(0)).toBe(0);
    expect(tierZalogi(499.9)).toBe(0);
    expect(tierZalogi(500)).toBe(1);
    expect(tierZalogi(1499)).toBe(1);
    expect(tierZalogi(1500)).toBe(2);
    expect(tierZalogi(9998)).toBe(2);
    expect(tierZalogi(9999)).toBe(3);
    expect(tierZalogi(50000)).toBe(3);
    const krok = (K.skillCeiling - K.skillFloor) / K.TierCount;
    for (let tier = 0; tier < K.TierCount; tier++) {
      for (const talent of [0, 0.37, 1]) {
        const u = umiejetnoscZTieru(tier, talent);
        expect(u).toBeGreaterThanOrEqual(K.skillFloor + krok * tier - 0.006);
        expect(u).toBeLessThanOrEqual(K.skillFloor + krok * (tier + 1) + 0.006);
        const [lo, hi] = K.tierZalogi.placaKrNaDobe[tier];
        const p = placaZTieru(tier, talent);
        expect(p).toBeGreaterThanOrEqual(lo);
        expect(p).toBeLessThanOrEqual(hi);
      }
    }
    expect(umiejetnoscZTieru(0, 0)).toBeCloseTo(K.skillFloor, 9);
    expect(umiejetnoscZTieru(K.TierCount - 1, 1)).toBeCloseTo(K.skillCeiling, 9);
    expect(placaZTieru(3, 0)).toBe(1100);
    expect(placaZTieru(3, 1)).toBe(1800);
  });

  it('XP rośnie o xpNaDobeLotu za dobę lotu i xpZaKontakt za kontakt; tier, umiejętność i płaca zmieniają się na progach', () => {
    const g = new Gra('xp', { skala: 'S', spread: 'B', progresja: true });
    expect(g.stan.kandydaci.length).toBeGreaterThan(0);
    for (const k of g.stan.kandydaci) {
      expect(k.xp).toBe(P.progresja.xpStartoweKandydata);
      expect(k.talent).toBeGreaterThanOrEqual(0);
      expect(k.talent).toBeLessThanOrEqual(1);
      expect(k.umiejetnosc).toBe(umiejetnoscZTieru(tierZalogi(k.xp!), k.talent!));
      expect(k.placa).toBe(placaZTieru(tierZalogi(k.xp!), k.talent!));
    }
    const z = g.zatrudnij(g.stan.kandydaci[0].id);
    const tu = g.stan.pozycja;
    const r = g.lec([tu, g.graf.sasiedzi(tu)[0].id]);
    expect(z.xp).toBeCloseTo(P.progresja.xpNaDobeLotu * r.doby, 9);
    expect(tierZalogi(z.xp!)).toBe(0);
    // Tuż pod progiem: następny lot przenosi na tier 1 i zmienia umiejętność oraz płacę.
    z.xp = K.tierZalogi.progiXP[1] - 0.001;
    const przed = { u: z.umiejetnosc, p: z.placa };
    g.lec([g.stan.pozycja, tu]);
    expect(tierZalogi(z.xp!)).toBe(1);
    expect(z.umiejetnosc).toBe(umiejetnoscZTieru(1, z.talent!));
    expect(z.placa).toBe(placaZTieru(1, z.talent!));
    expect(z.umiejetnosc).toBeGreaterThan(przed.u);
    expect(z.placa).toBeGreaterThan(przed.p);
    expect(g.stan.kamienie['zaloga:tier:1']).toBeCloseTo(g.stan.doba, 9);
    // Kontakt z nieznaną cywilizacją: xpZaKontakt ponad XP za doby lotu.
    const nieznana = g.swiat.cywilizacje.find((c) => !c.znanaNaStarcie)!;
    const xpPrzed = z.xp!;
    const dobaPrzed = g.stan.doba;
    const ostatni = lecDo(g, nieznana.planety[0]);
    expect(ostatni.kontakt?.cywilizacja).toBe(nieznana.id);
    expect(z.xp).toBeCloseTo(xpPrzed + P.progresja.xpNaDobeLotu * (g.stan.doba - dobaPrzed) + P.progresja.xpZaKontakt, 6);
  });

  it('cała załoga na Legendzie to kamień milowy dopiero przy pełnej załodze', () => {
    const g = new Gra('legenda', OPCJE);
    const tu = g.stan.pozycja;
    for (const k of [...g.stan.kandydaci]) g.zatrudnij(k.id);
    expect(g.stan.zaloga.length).toBe(P.liczbaKandydatow);
    for (const z of g.stan.zaloga) z.xp = K.tierZalogi.progiXP[3] - 0.001;
    const sasiad = g.graf.sasiedzi(tu)[0].id;
    g.lec([tu, sasiad]);
    expect(g.stan.zaloga.every((z) => tierZalogi(z.xp!) === 3)).toBe(true);
    expect(g.stan.kamienie['zaloga:tier:3']).toBeDefined();
    expect(g.stan.kamienie['zaloga:wszyscy:legenda']).toBeUndefined();
    g.lec([sasiad, tu]);
    expect(g.stan.kandydaci.length).toBeGreaterThan(0);
    g.zatrudnij(g.stan.kandydaci[0].id);
    const nowy = g.stan.zaloga[g.stan.zaloga.length - 1];
    nowy.xp = K.tierZalogi.progiXP[3] - 0.001;
    g.lec([tu, sasiad]);
    expect(g.stan.zaloga.length).toBe(K.miejscaZalogi);
    expect(g.stan.kamienie['zaloga:wszyscy:legenda']).toBeCloseTo(g.stan.doba, 9);
  });

  it('bez progresji kandydaci nie mają XP, umiejętność jest losowa z pasma kanonu, a płaca kanonu per rola', () => {
    const g = new Gra('bez-xp', { skala: 'M', progresja: false });
    for (const k of g.stan.kandydaci) {
      expect(k.xp).toBeUndefined();
      expect(k.placa).toBe(K.placa[k.rola]);
      expect(k.umiejetnosc).toBeGreaterThanOrEqual(K.skillFloor);
      expect(k.umiejetnosc).toBeLessThanOrEqual(K.skillCeiling);
    }
  });
});

describe('progresja: determinizm na 1 200 dób', () => {
  it('dwa przebiegi bota na L z tym samym ziarnem dają ten sam stan po całym horyzoncie', () => {
    const opcje = { skala: 'L' as const, informacja: 'pelna' as const, spread: 'B' as const, progresja: true };
    const a = new Gra('det-prog', opcje);
    const b = new Gra('det-prog', opcje);
    expect(a.limitDob).toBe(P.progresja.horyzontDob);
    const sa = nowyStanBota();
    const sb = nowyStanBota();
    while (!a.stan.koniec && !b.stan.koniec) {
      const ka = krokBota(a, sa);
      const kb = krokBota(b, sb);
      expect(a.stan.kr).toBe(b.stan.kr);
      expect(JSON.stringify(ka.akcje)).toBe(JSON.stringify(kb.akcje));
      if (ka.utknal || kb.utknal) break;
    }
    expect(a.stan.doba).toBeGreaterThanOrEqual(P.progresja.horyzontDob);
    expect(a.stan.doba).toBe(b.stan.doba);
    expect(JSON.stringify(a.stan.kamienie)).toBe(JSON.stringify(b.stan.kamienie));
    expect(JSON.stringify(a.stan.tiery)).toBe(JSON.stringify(b.stan.tiery));
    expect(a.stan.szczebel).toBe(b.stan.szczebel);
    expect(JSON.stringify(a.stan.zaloga)).toBe(JSON.stringify(b.stan.zaloga));
    expect(JSON.stringify(a.stan.rynki)).toBe(JSON.stringify(b.stan.rynki));
  }, 180000);
});
