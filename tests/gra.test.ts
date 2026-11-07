import { describe, expect, it } from 'vitest';
import { krokBota } from '../bot/strategia';
import { Gra, K, P, TOWARY } from '../sim/index';

function migawkaCen(g: Gra): string {
  const czesci: string[] = [];
  for (const w of g.swiat.wezly) {
    if (w.typ !== 'planeta') continue;
    for (const t of TOWARY) {
      const c = g.ceny(w.id, t, 0);
      czesci.push(c ? `${w.id}:${t}:${c.kupnoKr.toFixed(6)}:${c.sprzedazKr.toFixed(6)}` : `${w.id}:${t}:?`);
    }
  }
  return czesci.join('|');
}

describe('determinizm', () => {
  it('to samo ziarno daje ten sam świat, te same ceny i tych samych kandydatów po tych samych akcjach', () => {
    const a = new Gra('det-1', { skala: 'S' });
    const b = new Gra('det-1', { skala: 'S' });
    expect(JSON.stringify(a.swiat)).toBe(JSON.stringify(b.swiat));
    expect(migawkaCen(a)).toBe(migawkaCen(b));
    expect(JSON.stringify(a.stan.kandydaci)).toBe(JSON.stringify(b.stan.kandydaci));
    for (let i = 0; i < 4; i++) {
      krokBota(a);
      krokBota(b);
      expect(migawkaCen(a)).toBe(migawkaCen(b));
      expect(a.stan.kr).toBe(b.stan.kr);
      expect(JSON.stringify(a.stan.kandydaci)).toBe(JSON.stringify(b.stan.kandydaci));
    }
  });

  it('inne ziarno daje inny świat', () => {
    const a = new Gra('det-1', { skala: 'S' });
    const b = new Gra('det-2', { skala: 'S' });
    expect(JSON.stringify(a.swiat.wezly)).not.toBe(JSON.stringify(b.swiat.wezly));
    expect(migawkaCen(a)).not.toBe(migawkaCen(b));
  });
});

describe('raport po locie', () => {
  it('suma linii równa się zmianie salda w każdym locie, także z pełną załogą', () => {
    for (const ziarno of ['raport-1', 'raport-2', 'raport-3']) {
      const g = new Gra(ziarno, { skala: 'S' });
      while (!g.stan.koniec) {
        const saldoPrzed = g.stan.kr;
        krokBota(g);
        const r = g.stan.raporty[g.stan.raporty.length - 1];
        const suma = r.linie.reduce((s, l) => s + l.kr, 0);
        expect(suma).toBe(r.zmianaSalda);
        expect(r.saldoPo - r.saldoPrzed).toBe(r.zmianaSalda);
        expect(r.saldoPrzed).toBe(saldoPrzed);
        expect(r.saldoPo).toBe(g.stan.kr);
        for (const l of r.linie) expect(Number.isInteger(l.kr)).toBe(true);
      }
      expect(g.stan.raporty.some((r) => r.zaloga.sklad.length > 0)).toBe(true);
    }
  });

  it('linie załogi: handlowiec, nawigator, synergia i pilot pojawiają się, gdy załoga jest na pokładzie', () => {
    const g = new Gra('linie', { skala: 'S' });
    const tu = g.stan.pozycja;
    g.stan.zaloga = [
      { id: 'p', imie: 'P', rola: 'pilot', cywilizacja: 'cisi', umiejetnosc: 1.2, placa: K.placa.pilot },
      { id: 'n', imie: 'N', rola: 'nawigator', cywilizacja: 'cisi', umiejetnosc: 1.1, placa: K.placa.nawigator },
      { id: 'h', imie: 'H', rola: 'handlowiec', cywilizacja: 'agraria', umiejetnosc: 1.2, placa: K.placa.handlowiec },
    ];
    const towar = TOWARY.find((t) => g.maxKupno(t) >= 10)!;
    g.kup(towar, 10);
    g.sprzedaj(towar, 5);
    const sasiad = g.graf.sasiedzi(tu)[0];
    const r = g.lec([tu, sasiad.id]);
    const klucze = r.linie.map((l) => l.klucz);
    expect(klucze).toEqual(expect.arrayContaining(['sprzedaz', 'handlowiec_sprzedaz', 'zakup', 'handlowiec_zakup', 'paliwo', 'nawigator', 'synergia', 'place', 'pilot']));
    const linia = (k: string) => r.linie.find((l) => l.klucz === k)!.kr;
    expect(linia('handlowiec_sprzedaz')).toBeGreaterThan(0);
    expect(linia('handlowiec_zakup')).toBeGreaterThan(0);
    expect(linia('nawigator')).toBeGreaterThan(0);
    expect(linia('synergia')).toBeGreaterThan(0);
    expect(linia('pilot')).toBeGreaterThan(0);
    expect(r.linie.reduce((s, l) => s + l.kr, 0)).toBe(r.saldoPo - r.saldoPrzed);
    expect(r.paliwo.zuzytoM3).toBeCloseTo(r.paliwo.bezZalogiM3 - r.paliwo.oszczednoscNawigatoraM3 - r.paliwo.oszczednoscSynergiiM3, 9);
  });

  it('kontakt z nieznaną cywilizacją odsłania rynek i budzi popyt na Elektronikę', () => {
    const g = new Gra('kontakt', { skala: 'S' });
    const nieznana = g.swiat.cywilizacje.find((c) => !c.znanaNaStarcie)!;
    const cel = nieznana.planety[0];
    expect(g.rynekZnany(cel)).toBe(false);
    expect(g.ceny(cel, 'Electronics')).toBeNull();
    expect(g.stan.rynki[cel].Electronics.konsumpcja).toBe(0);
    const trasa = g.graf.najkrotszaSciezka(g.stan.pozycja, cel)!;
    // Lecimy skokami, tankując po drodze gdzie się da.
    let ostatni: ReturnType<Gra['lec']> | null = null;
    for (let i = 0; i + 1 < trasa.length; i++) {
      const ile = Math.min(K.bak - g.stan.paliwo, g.maxPaliwo());
      if (ile > 1e-6) g.tankuj(ile);
      ostatni = g.lec([trasa[i], trasa[i + 1]]);
    }
    expect(ostatni!.kontakt?.cywilizacja).toBe(nieznana.id);
    expect(ostatni!.linie.some((l) => l.klucz === 'kontakt')).toBe(true);
    expect(g.rynekZnany(cel)).toBe(true);
    expect(g.stan.rynki[cel].Electronics.konsumpcja).toBeGreaterThan(0);
    expect(g.ceny(cel, 'Electronics')!.nacisk).toBe(K.StockPressureMax);
  });

  it('wartość firmy = kr + ładunek po cenie sprzedaży w doku, a cel to podwojenie', () => {
    const g = new Gra('wartosc', { skala: 'S' });
    expect(g.wartoscFirmy()).toBe(K.startingCredits);
    expect(g.celWartosci()).toBe(K.startingCredits * P.celMnoznikWartosci);
    const t = TOWARY.find((x) => g.maxKupno(x) >= 20)!;
    g.kup(t, 20);
    expect(g.wartoscFirmy()).toBe(g.stan.kr + g.wycenaSprzedazy(t, 20).kwotaKr);
    expect(g.wartoscFirmy()).toBeLessThan(K.startingCredits);
  });

  it('gra kończy się po przekroczeniu limitu dób', () => {
    const g = new Gra('koniec', { skala: 'S' });
    let loty = 0;
    while (!g.stan.koniec && loty < 500) {
      krokBota(g);
      loty++;
    }
    expect(g.stan.koniec).toBe(true);
    expect(g.stan.doba).toBeGreaterThanOrEqual(g.limitDob);
    expect(g.sprawdzTrase([g.stan.pozycja, g.graf.sasiedzi(g.stan.pozycja)[0].id]).blad).toMatch(/zakończona|paliwa|gotówki/);
  });
});
