import { Gra, K, P, TOWARY, efektyZalogi, type OpcjeGry, type Towar, type Zalogant } from '../sim/index';

export interface Zakup {
  towar: Towar;
  m3: number;
  kosztKr: number;
  przychodKr: number;
}

export interface Plan {
  cel: string;
  trasa: string[];
  dystans: number;
  doby: number;
  zakupy: Zakup[];
  paliwoDoKupienia: number;
  kosztPaliwaKr: number;
  placeKr: number;
  zyskNetto: number;
  naDobe: number;
  eksploracja: boolean;
}

export interface OpcjaZalogi {
  zaloga: Zalogant[];
  zatrudnij: string[];
  zwolnij: string[];
}

function maxKupnoPrzy(gra: Gra, towar: Towar, gotowka: number, objetosc: number, masa: number, tu: string, udzial: number): number {
  const poz = gra.stan.rynki[tu][towar];
  let hi = Math.max(0, Math.min(poz.zapas, objetosc, masa / K.towary[towar].gestosc));
  if (hi <= 0) return 0;
  if (gra.wycenaKupna(towar, hi, tu, udzial).kwotaKr <= gotowka) return hi;
  let lo = 0;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (gra.wycenaKupna(towar, mid, tu, udzial).kwotaKr <= gotowka) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Najlepszy ładunek do planety `cel`: do dwóch towarów, ilość dobrana do głębokości rynku. */
function dobierzLadunek(gra: Gra, cel: string, doby: number, gotowka: number, udzial: number): Zakup[] {
  const tu = gra.stan.pozycja;
  if (!gra.rynekZnany(tu) || !gra.rynekZnany(cel)) return [];
  const zakupy: Zakup[] = [];
  let objetosc = K.ladownia - gra.objetoscZajeta();
  let masa = K.maxMasaLadunku - gra.masaZajeta();
  const uzyte = new Set<Towar>();
  for (let runda = 0; runda < 2; runda++) {
    let najlepszy: Zakup | null = null;
    for (const t of TOWARY) {
      if (uzyte.has(t)) continue;
      const max = maxKupnoPrzy(gra, t, gotowka, objetosc, masa, tu, udzial);
      if (max <= 0) continue;
      for (let k = 1; k <= P.bot.krokiIlosci; k++) {
        const m3 = Math.floor((max * k) / P.bot.krokiIlosci);
        if (m3 <= 0) continue;
        const koszt = gra.wycenaKupna(t, m3, tu, udzial).kwotaKr;
        const przychod = gra.wycenaSprzedazyZa(t, m3, cel, doby, udzial).kwotaKr;
        const marza = przychod - koszt;
        if (marza > 0 && (!najlepszy || marza > najlepszy.przychodKr - najlepszy.kosztKr)) {
          najlepszy = { towar: t, m3, kosztKr: koszt, przychodKr: przychod };
        }
      }
    }
    if (!najlepszy) break;
    zakupy.push(najlepszy);
    uzyte.add(najlepszy.towar);
    gotowka -= najlepszy.kosztKr;
    objetosc -= najlepszy.m3;
    masa -= najlepszy.m3 * K.towary[najlepszy.towar].gestosc;
  }
  return zakupy;
}

/** Plany lotu dla danej załogi: każdy znany cel w zasięgu baku, ładunek z najlepszą marżą netto. */
export function planyDlaZalogi(gra: Gra, zaloga: Zalogant[]): Plan[] {
  const ef = efektyZalogi(zaloga);
  const tu = gra.stan.pozycja;
  const d = gra.graf.dijkstra(tu);
  const cenaPaliwaTu = gra.cenaPaliwaTutaj();
  const plany: Plan[] = [];
  const ktosNieznany = gra.swiat.cywilizacje.some((c) => !gra.stan.znaneCywilizacje[c.id]);
  for (const [id, w] of d) {
    if (id === tu) continue;
    const wezel = gra.wezel(id);
    if (wezel.typ !== 'planeta') continue;
    if (w.skoki > P.bot.maxSkokowTrasy) continue;
    const dystans = w.dystans;
    const paliwo = gra.potrzebnePaliwo(dystans, zaloga);
    if (paliwo > K.bak) continue;
    const doKupienia = Math.max(0, paliwo - gra.stan.paliwo);
    if (doKupienia > gra.maxPaliwo() + 1e-9) continue;
    const kosztTankowania = doKupienia > 0 ? gra.wycenaPaliwa(doKupienia).kwotaKr : 0;
    const doby = dystans / ef.predkosc;
    const place = Math.round(ef.placeNaDobe * doby);
    const kosztPaliwa = Math.round(paliwo * cenaPaliwaTu);
    const znany = gra.rynekZnany(id);
    const eksploracja = !znany && ktosNieznany && gra.stan.doba <= P.bot.eksplorujDoUlamkaHoryzontu * gra.limitDob && dystans <= P.bot.eksplorujMaxPc;
    if (!znany && !eksploracja) continue;
    const gotowka = gra.stan.kr - kosztTankowania - place;
    if (gotowka < 0) continue;
    const zakupy = znany ? dobierzLadunek(gra, id, doby, gotowka, ef.udzialHandlowca) : [];
    const marza = zakupy.reduce((s, z) => s + z.przychodKr - z.kosztKr, 0);
    const zysk = marza - kosztPaliwa - place;
    plany.push({
      cel: id,
      trasa: gra.graf.najkrotszaSciezka(tu, id)!,
      dystans,
      doby,
      zakupy,
      paliwoDoKupienia: doKupienia,
      kosztPaliwaKr: kosztPaliwa,
      placeKr: place,
      zyskNetto: zysk,
      naDobe: zysk / doby,
      eksploracja,
    });
  }
  return plany;
}

/** Warianty załogi: bez zmian, zatrudnienie kandydata, podmiana słabszego w tej samej roli, zwolnienie. */
export function opcjeZalogi(gra: Gra): OpcjaZalogi[] {
  const obecna = gra.stan.zaloga;
  const opcje: OpcjaZalogi[] = [{ zaloga: [...obecna], zatrudnij: [], zwolnij: [] }];
  for (const k of gra.stan.kandydaci) {
    if (obecna.length < K.miejscaZalogi) opcje.push({ zaloga: [...obecna, k], zatrudnij: [k.id], zwolnij: [] });
    for (const z of obecna) {
      if (z.rola === k.rola && z.umiejetnosc < k.umiejetnosc) {
        opcje.push({ zaloga: [...obecna.filter((x) => x.id !== z.id), k], zatrudnij: [k.id], zwolnij: [z.id] });
      }
    }
  }
  for (const z of obecna) opcje.push({ zaloga: obecna.filter((x) => x.id !== z.id), zatrudnij: [], zwolnij: [z.id] });
  return opcje;
}

function lepszy(a: Plan, b: Plan | null): boolean {
  if (!b) return true;
  // Eksploracja ma pierwszeństwo, gdy jest dostępna: to inwestycja w nowy rynek. Wśród eksploracji wygrywa najkrótsza.
  if (a.eksploracja !== b.eksploracja) return a.eksploracja;
  if (a.eksploracja) return a.dystans < b.dystans;
  return a.naDobe > b.naDobe;
}

export interface Decyzja {
  plan: Plan | null;
  opcja: OpcjaZalogi;
}

/** Konkretna akcja wykonana w doku; smoke test odtwarza je w UI jeden do jednego. */
export type Akcja =
  | { typ: 'zwolnij'; id: string }
  | { typ: 'zatrudnij'; id: string }
  | { typ: 'tankuj'; m3: number }
  | { typ: 'kup'; towar: Towar; m3: number }
  | { typ: 'lec'; trasa: string[] };

export interface KrokBota {
  plan: Plan;
  opcja: OpcjaZalogi;
  sprzedano: { towar: Towar; m3: number; kwotaKr: number }[];
  akcje: Akcja[];
}

export function sprzedajWszystko(gra: Gra): KrokBota['sprzedano'] {
  const sprzedano: KrokBota['sprzedano'] = [];
  if (!gra.rynekZnany(gra.stan.pozycja)) return sprzedano;
  for (const t of TOWARY) {
    const m3 = gra.stan.ladownia[t].m3;
    if (m3 > 0) sprzedano.push({ towar: t, m3, kwotaKr: gra.sprzedaj(t, m3).kwotaKr });
  }
  return sprzedano;
}

/** Wybór załogi i planu bez mutacji stanu (po sprzedaży ładunku). */
export function zaplanuj(gra: Gra): Decyzja {
  let najlepszyPlan: Plan | null = null;
  let najlepszaOpcja: OpcjaZalogi | null = null;
  for (const opcja of opcjeZalogi(gra)) {
    for (const plan of planyDlaZalogi(gra, opcja.zaloga)) {
      if (lepszy(plan, najlepszyPlan)) {
        najlepszyPlan = plan;
        najlepszaOpcja = opcja;
      }
    }
  }
  return { plan: najlepszyPlan, opcja: najlepszaOpcja ?? { zaloga: [...gra.stan.zaloga], zatrudnij: [], zwolnij: [] } };
}

/** Ilości paliwa w pełnych dziesiątych m³, żeby UI (pole liczbowe) odtworzyło je bez reszty. */
function zaokrPaliwo(m3: number): number {
  return Math.floor(m3 * 10) / 10;
}

/** Wykonuje decyzję: załoga, tankowanie, zakupy, lot. Zwraca dziennik konkretnych akcji. */
export function wykonaj(gra: Gra, d: Decyzja): { plan: Plan; akcje: Akcja[] } {
  const tu = gra.stan.pozycja;
  const akcje: Akcja[] = [];
  const tankuj = (m3: number) => {
    const ile = zaokrPaliwo(Math.min(m3, K.bak - gra.stan.paliwo, gra.maxPaliwo()));
    if (ile > 0) {
      gra.tankuj(ile);
      akcje.push({ typ: 'tankuj', m3: ile });
    }
  };

  if (!d.plan) {
    // Nic w zasięgu: skocz do najbliższego sąsiada, żeby świat poszedł do przodu.
    const sasiad = gra.graf.sasiedzi(tu).sort((a, b) => a.dystans - b.dystans)[0];
    const potrzebne = gra.potrzebnePaliwo(sasiad.dystans);
    if (potrzebne > gra.stan.paliwo) tankuj(Math.ceil(potrzebne - gra.stan.paliwo));
    const plan: Plan = { cel: sasiad.id, trasa: [tu, sasiad.id], dystans: sasiad.dystans, doby: 0, zakupy: [], paliwoDoKupienia: 0, kosztPaliwaKr: 0, placeKr: 0, zyskNetto: 0, naDobe: 0, eksploracja: false };
    gra.lec(plan.trasa);
    akcje.push({ typ: 'lec', trasa: plan.trasa });
    return { plan, akcje };
  }

  for (const id of d.opcja.zwolnij) {
    gra.zwolnij(id);
    akcje.push({ typ: 'zwolnij', id });
  }
  for (const id of d.opcja.zatrudnij) {
    gra.zatrudnij(id);
    akcje.push({ typ: 'zatrudnij', id });
  }

  const plan = d.plan;
  const rezerwa = plan.placeKr;
  if (plan.paliwoDoKupienia > 0) tankuj(Math.ceil(plan.paliwoDoKupienia * 10) / 10);
  for (const z of plan.zakupy) {
    const m3 = Math.floor(Math.min(z.m3, gra.maxKupno(z.towar, gra.stan.kr - rezerwa)));
    if (m3 > 0) {
      gra.kup(z.towar, m3);
      akcje.push({ typ: 'kup', towar: z.towar, m3 });
    }
  }
  // Tanie paliwo: dotankuj do pełna, jeśli cena poniżej progu i zostaje gotówka.
  if (gra.maPaliwo() && gra.cenaPaliwaTutaj() <= P.bot.tankujGdyCenaPonizejBazyRazy * K.kurs * K.towary.Fuel.basePrice) {
    tankuj(Math.min(K.bak - gra.stan.paliwo, gra.maxPaliwo(gra.stan.kr - rezerwa)));
  }
  // Paliwo na trasę mogło zjeść gotówkę przeznaczoną na towar; upewnij się, że wystarczy na lot.
  const potrzebne = gra.potrzebnePaliwo(plan.dystans);
  if (potrzebne > gra.stan.paliwo + 1e-9) tankuj(Math.ceil((potrzebne - gra.stan.paliwo) * 10) / 10);
  gra.lec(plan.trasa);
  akcje.push({ typ: 'lec', trasa: plan.trasa });
  return { plan, akcje };
}

/** Jeden obrót pętli: sprzedaj wszystko, dobierz załogę i trasę, zatankuj, kup, leć. */
export function krokBota(gra: Gra): KrokBota {
  const sprzedano = sprzedajWszystko(gra);
  const decyzja = zaplanuj(gra);
  const { plan, akcje } = wykonaj(gra, decyzja);
  return { plan, opcja: decyzja.opcja, sprzedano, akcje };
}

export interface WynikZiarna {
  ziarno: string;
  wartoscKoncowa: number;
  zysk: boolean;
  loty: number;
  pierwszyZyskownyLot: number | null;
  trasy: string[];
  towary: Towar[];
  kontaktDoba: number | null;
}

export function zagrajZiarno(ziarno: string, opcje: OpcjeGry = {}): WynikZiarna {
  const gra = new Gra(ziarno, opcje);
  const trasy: string[] = [];
  const towary: Towar[] = [];
  let pierwszy: number | null = null;
  let kontaktDoba: number | null = null;
  while (!gra.stan.koniec) {
    const krok = krokBota(gra);
    const raport = gra.stan.raporty[gra.stan.raporty.length - 1];
    trasy.push(`${gra.wezel(raport.z).nazwa} → ${gra.wezel(raport.do).nazwa}`);
    for (const z of krok.plan.zakupy) towary.push(z.towar);
    if (pierwszy === null && raport.wartoscPo > raport.wartoscPrzed) pierwszy = raport.numerLotu;
    if (raport.kontakt && kontaktDoba === null) kontaktDoba = raport.dobaKoniec;
  }
  const wartosc = gra.wartoscFirmy();
  return { ziarno, wartoscKoncowa: wartosc, zysk: wartosc > K.startingCredits, loty: gra.stan.numerLotu, pierwszyZyskownyLot: pierwszy, trasy, towary, kontaktDoba };
}
