import { describe, expect, it } from 'vitest';
import { Gra, K, P, TOWARY, TOWARY_I_PALIWO, krokRynku, sufitWymianyNPC, wymianaNPC, type PozycjaRynku } from '../sim/index';

const ZIARNA = Array.from({ length: 20 }, (_, i) => String(i + 1));

describe('galaktyka kanonu: struktura', () => {
  it('graf jest spójny na skali M i L dla 20 ziaren, a każda krawędź ma ≤ skok podstawowy', () => {
    for (const skala of ['M', 'L'] as const) {
      for (const ziarno of ZIARNA) {
        const g = new Gra(ziarno, { skala });
        expect(g.graf.spojny(), `${skala}/${ziarno}`).toBe(true);
        for (const k of g.swiat.krawedzie) expect(k.dystans).toBeLessThanOrEqual(K.skokPodstawowy + 1e-9);
      }
    }
  }, 60000);

  it('brak układów zamieszkiwalnych w martwym rdzeniu i poza strefą; sektory z kanonu', () => {
    const rdzen = K.DeadCoreFraction * K.promienGalaktyki;
    const zewn = K.habitableZoneOuter * K.promienGalaktyki;
    for (const skala of ['M', 'L'] as const) {
      for (const ziarno of ZIARNA.slice(0, 10)) {
        const g = new Gra(ziarno, { skala });
        const zamieszkiwalne = g.swiat.wezly.filter((w) => w.zamieszkiwalny);
        expect(zamieszkiwalne.length).toBe(P.skale[skala].ukladyZamieszkiwalne);
        for (const w of zamieszkiwalne) {
          const r = Math.hypot(w.x, w.y);
          expect(r).toBeGreaterThan(rdzen);
          expect(r).toBeLessThanOrEqual(zewn + 1e-9);
          expect(P.skale[skala].sektory).toContain(w.sektor);
        }
        expect(g.swiat.geometria?.liczbaSektorow).toBe(K.SectorCount);
      }
    }
  }, 60000);

  it('każdy układ zamieszkiwalny jest osiągalny z każdego punktu skokami ≤ 20 pc (jedna składowa grafu)', () => {
    for (const skala of ['M', 'L'] as const) {
      const g = new Gra('osiagalnosc', { skala });
      const start = g.swiat.wezly.find((w) => w.typ === 'przelot')!.id;
      const d = g.graf.dijkstra(start);
      for (const w of g.swiat.wezly) if (w.zamieszkiwalny) expect(d.has(w.id)).toBe(true);
    }
  }, 30000);

  it('terytoria: liczba układów cywilizacji z populacji według kanonu (z rozrzutem), cywilizacje w swoich sektorach', () => {
    const g = new Gra('terytoria', { skala: 'L' });
    for (const c of g.swiat.cywilizacje) {
      const F = K.terytoriumZPopulacji;
      const oczekiwane = F.staly + F.naDekade * Math.log10(c.populacjaMln);
      expect(Math.abs(c.planety.length - oczekiwane)).toBeLessThanOrEqual(P.galaktyka.rozrzutTerytorium + 1);
      const konfig = P.skale.L.cywilizacje!.find((x) => x.id === c.id)!;
      expect(c.sektor).toBe(konfig.sektor);
      expect(c.otwartosc).toBe(K.cywilizacje[c.id].otwartosc);
      expect(c.ssr).toBe(K.cywilizacje[c.id].ssr);
      // SSR z kanonu równa się stosunkowi produkcji do potrzeb żywności w portach.
      expect(c.produkcjaM3NaDobe.Food / c.potrzebyM3NaDobe.Food).toBeCloseTo(c.ssr, 6);
    }
    expect(g.swiat.cywilizacje).toHaveLength(9);
  });

  it('determinizm na M: to samo ziarno daje ten sam świat i te same ceny, inne ziarno inny świat', () => {
    const a = new Gra('det-m', { skala: 'M' });
    const b = new Gra('det-m', { skala: 'M' });
    expect(JSON.stringify(a.swiat)).toBe(JSON.stringify(b.swiat));
    expect(JSON.stringify(a.stan.rynki)).toBe(JSON.stringify(b.stan.rynki));
    expect(JSON.stringify(a.stan.kandydaci)).toBe(JSON.stringify(b.stan.kandydaci));
    const c = new Gra('det-m-2', { skala: 'M' });
    expect(JSON.stringify(c.swiat.wezly)).not.toBe(JSON.stringify(a.swiat.wezly));
  });
});

describe('informacja o cenach', () => {
  it('tryb zasieg: poza łącznością widać tylko ostatni odczyt odwiedzonej planety, nieodwiedzonej nie widać wcale', () => {
    const g = new Gra('zasieg-info', { skala: 'M', informacja: 'zasieg' });
    const start = g.stan.pozycja;
    const znane = g.swiat.wezly.filter((w) => w.typ === 'planeta' && g.cywilizacjaZnana(w.cywilizacja) && w.id !== start);
    const daleka = znane.find((w) => g.odlegloscOdStatku(w.id) > K.zasiegLacznosci)!;
    const bliska = znane.find((w) => g.odlegloscOdStatku(w.id) <= K.zasiegLacznosci)!;
    expect(g.informacjaORynku(daleka.id)).toBeNull();
    expect(g.ceny(daleka.id, 'Food')).toBeNull();
    expect(g.informacjaORynku(bliska.id)?.tryb).toBe('zywa');
    expect(g.informacjaORynku(start)?.tryb).toBe('zywa');
    // Odleć ze startu poza łączność z nim: odczyt startu zostaje z wiekiem, planeta nieodwiedzona dalej niewidoczna.
    let doszedl = false;
    const odStartu = (id: string) => Math.hypot(g.wezel(id).x - g.wezel(start).x, g.wezel(id).y - g.wezel(start).y);
    for (let i = 0; i < 10 && !doszedl; i++) {
      if (g.maPaliwo()) {
        const ile = Math.min(K.bak - g.stan.paliwo, g.maxPaliwo());
        if (ile > 1e-6) g.tankuj(ile);
      }
      // Leć do węzła z paliwem najdalszego od startu, osiągalnego na obecnym baku.
      const cele = [...g.zasieg().values()].filter((o) => o.id !== g.stan.pozycja && g.maPaliwo(o.id)).sort((a, b) => odStartu(b.id) - odStartu(a.id));
      g.lec(cele[0].sciezka);
      doszedl = odStartu(g.stan.pozycja) > K.zasiegLacznosci;
    }
    expect(doszedl).toBe(true);
    const info = g.informacjaORynku(start)!;
    expect(info.tryb).toBe('odczyt');
    expect(info.wiekDob).toBeGreaterThan(0);
    expect(info.wiekDob).toBeLessThanOrEqual(g.stan.doba);
    const cenaOdczytu = g.ceny(start, 'Food')!;
    expect(cenaOdczytu.informacja).toBe('odczyt');
    const nieodwiedzonaDaleka = znane.find((w) => g.odlegloscOdStatku(w.id) > K.zasiegLacznosci && !(g.stan.wizyty[w.id] > 0));
    if (nieodwiedzonaDaleka) expect(g.informacjaORynku(nieodwiedzonaDaleka.id)).toBeNull();
  });

  it('tryb pelna: każda planeta znanej cywilizacji widoczna na żywo niezależnie od odległości', () => {
    const g = new Gra('zasieg-info', { skala: 'M', informacja: 'pelna' });
    for (const w of g.swiat.wezly) {
      if (w.typ !== 'planeta') continue;
      const info = g.informacjaORynku(w.id);
      if (g.cywilizacjaZnana(w.cywilizacja)) expect(info?.tryb).toBe('zywa');
      else expect(info).toBeNull();
    }
  });
});

describe('otwartość handlowa', () => {
  const poz = (otwartosc: number, zapasUlamek: number): PozycjaRynku => ({ zapas: 300 * zapasUlamek, norma: 300, produkcja: 5, konsumpcja: 10, konsumpcjaUspiona: 0, otwartosc });

  it('otwartość ogranicza dobową wymianę NPC do otwartość × konsumpcja × mnożnik', () => {
    for (const otw of [0.04, 0.26, 0.77, 1.66]) {
      const p = poz(otw, 0.1);
      const f = wymianaNPC(p);
      expect(Math.abs(f)).toBeLessThanOrEqual(sufitWymianyNPC(p) + 1e-12);
      expect(sufitWymianyNPC(p)).toBeCloseTo(otw * p.konsumpcja * P.galaktyka.mnoznikSufituNPC, 12);
      expect(f).toBeGreaterThan(0);
    }
    const pusty = poz(0.04, 0.1);
    expect(wymianaNPC(pusty)).toBeCloseTo(sufitWymianyNPC(pusty), 12);
    const otwarty = poz(1.66, 0.9);
    expect(wymianaNPC(otwarty)).toBeCloseTo(P.galaktyka.tempoWymianyNPC * (otwarty.norma - otwarty.zapas), 12);
    expect(wymianaNPC(poz(0, 0.1))).toBe(0);
    expect(wymianaNPC(poz(1.66, 3))).toBeLessThan(0);
  });

  it('zamknięty rynek odbudowuje się wolniej niż otwarty, a przy otwartości 0 krok rynku jest liniowy jak w świecie S', () => {
    const zamkniety = poz(0.04, 0.2);
    const otwarty = poz(1.66, 0.2);
    krokRynku(zamkniety, 30);
    krokRynku(otwarty, 30);
    expect(otwarty.zapas).toBeGreaterThan(zamkniety.zapas);
    const bez = poz(0, 0.2);
    krokRynku(bez, 30);
    expect(bez.zapas).toBeCloseTo(Math.max(0, 300 * 0.2 + (5 - 10) * 30), 9);
  });

  it('w świecie M cywilizacje mają otwartość z kanonu, a wymiana NPC w dobie nie przekracza sufitu PKB portu', () => {
    const g = new Gra('npc-m', { skala: 'M' });
    for (const c of g.swiat.cywilizacje) {
      let wymianaWU = 0;
      let pkbWU = 0;
      for (const id of c.planety) {
        for (const t of TOWARY_I_PALIWO) {
          const p = g.stan.rynki[id][t];
          expect(p.otwartosc).toBe(c.otwartosc);
          wymianaWU += Math.abs(wymianaNPC(p)) * K.towary[t].basePrice;
          pkbWU += p.konsumpcja * K.towary[t].basePrice;
        }
      }
      expect(wymianaWU).toBeLessThanOrEqual(c.otwartosc * P.galaktyka.mnoznikSufituNPC * pkbWU + 1e-6);
    }
    expect(TOWARY.length).toBe(5);
  });
});
