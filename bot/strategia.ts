import {
  Gra,
  Graf,
  K,
  P,
  TOWARY,
  efektyZalogi,
  kr,
  kwotaKupnaWU,
  kwotaSprzedazyWU,
  zapasPo,
  type OpcjeGry,
  type PozycjaRynku,
  type Towar,
  type Zalogant,
} from '../sim/index';

// ------------------------------------------------------------------------------------
// Graf tankowania: węzły z paliwem (planety i plemiona) połączone najkrótszymi ścieżkami
// nie dłuższymi niż zasięg pełnego baku przy najlepszej załodze. Liczony raz na świat.
// ------------------------------------------------------------------------------------

interface Odcinek {
  do: string;
  dystans: number;
}

const cacheGrafow = new Map<string, Map<string, Odcinek[]>>();

function najmniejszyMnoznikPaliwa(): number {
  return (1 - P.nawigatorMaxRedukcjaPaliwa) * (1 - P.synergiaRedukcjaPaliwa);
}

function grafTankowania(gra: Gra): Map<string, Odcinek[]> {
  const klucz = `${gra.swiat.skala}:${gra.swiat.ziarno}`;
  const gotowy = cacheGrafow.get(klucz);
  if (gotowy) return gotowy;
  const maxZasieg = K.bak / (K.kosztPaliwaNaParsek * najmniejszyMnoznikPaliwa());
  const odcinki = new Map<string, Odcinek[]>();
  for (const w of gra.swiat.wezly) {
    if (w.typ === 'przelot') continue;
    const d = gra.graf.dijkstra(w.id, maxZasieg);
    const lista: Odcinek[] = [];
    for (const [id, wpis] of d) {
      if (id === w.id) continue;
      if (gra.wezel(id).typ === 'przelot') continue;
      lista.push({ do: id, dystans: wpis.dystans });
    }
    odcinki.set(w.id, lista);
  }
  cacheGrafow.set(klucz, odcinki);
  return odcinki;
}

export interface Dojazd {
  dystans: number;
  odcinki: string[];
}

/** Najkrótsze dojazdy z bieżącej pozycji do węzłów z paliwem, odcinkami ≤ zasięg baku przy danej załodze. */
export function dojazdy(gra: Gra, zaloga: readonly Zalogant[]): Map<string, Dojazd> {
  return dojazdyZ(gra, gra.stan.pozycja, zaloga);
}

export function dojazdyZ(gra: Gra, start: string, zaloga: readonly Zalogant[]): Map<string, Dojazd> {
  const graf = grafTankowania(gra);
  const mnoznik = efektyZalogi(zaloga).mnoznikPaliwa;
  // Odcinek musi zostawić rezerwę: bak tankuje się w krokach, a zużycie nie może przekroczyć stanu baku.
  const zasiegOdcinka = (K.bak - P.bot.rezerwaPaliwaOdcinkaM3) / (K.kosztPaliwaNaParsek * mnoznik);
  const dystans = new Map<string, number>([[start, 0]]);
  const poprzednik = new Map<string, string | null>([[start, null]]);
  const odwiedzone = new Set<string>();
  // Prosty Dijkstra po grafie tankowania (kilkaset węzłów).
  while (true) {
    let biezacy: string | null = null;
    let najmniej = Infinity;
    for (const [id, d] of dystans) {
      if (!odwiedzone.has(id) && d < najmniej) {
        najmniej = d;
        biezacy = id;
      }
    }
    if (biezacy === null) break;
    odwiedzone.add(biezacy);
    const lista = graf.get(biezacy);
    if (!lista) continue;
    for (const o of lista) {
      if (o.dystans > zasiegOdcinka + 1e-9) continue;
      // Każdy przystanek kosztuje czas i uwagę: kara w pc preferuje mniej, dłuższych odcinków.
      const nowy = najmniej + o.dystans + P.bot.karaPrzystankuPc;
      if (nowy < (dystans.get(o.do) ?? Infinity)) {
        dystans.set(o.do, nowy);
        poprzednik.set(o.do, biezacy);
      }
    }
  }
  const wynik = new Map<string, Dojazd>();
  for (const [id, d] of dystans) {
    if (id === start) continue;
    const odc: string[] = [];
    let x: string | null = id;
    while (x !== null && x !== start) {
      odc.unshift(x);
      x = poprzednik.get(x) ?? null;
    }
    wynik.set(id, { dystans: d - odc.length * P.bot.karaPrzystankuPc, odcinki: odc });
  }
  return wynik;
}

// ------------------------------------------------------------------------------------
// Plan lotu
// ------------------------------------------------------------------------------------

export interface Zakup {
  towar: Towar;
  m3: number;
  kosztKr: number;
  przychodKr: number;
}

export interface Plan {
  cel: string;
  pierwszyOdcinek: string;
  odcinki: string[];
  dystans: number;
  doby: number;
  /** Ile sprzedać w tym doku (reszta ładunku leci do celu). */
  sprzedaze: { towar: Towar; m3: number }[];
  zakupy: Zakup[];
  kosztPaliwaKr: number;
  placeKr: number;
  zyskNetto: number;
  naDobe: number;
  eksploracja: boolean;
  /** Szacowana gotówka po przylocie i sprzedaży wszystkiego w celu. */
  gotowkaPo: number;
}

export interface OpcjaZalogi {
  zaloga: Zalogant[];
  zatrudnij: string[];
  zwolnij: string[];
}

interface PlanetaKlastra {
  id: string;
  odleglosc: number;
}

/** Kontekst jednego planowania: rzuty rynków celów w przód i klastry dystrybucji, liczone raz. */
export class Kontekst {
  private rzuty = new Map<string, PozycjaRynku | null>();
  private klastry = new Map<string, PlanetaKlastra[]>();
  readonly dojazdyCache = new Map<string, Map<string, Dojazd>>();
  readonly drugiKrokCache = new Map<string, { zysk: number; doby: number }>();
  constructor(readonly gra: Gra) {}

  dojazdyZ(start: string, zaloga: readonly Zalogant[]): Map<string, Dojazd> {
    const klucz = `${start}:${efektyZalogi(zaloga).mnoznikPaliwa.toFixed(4)}`;
    const gotowe = this.dojazdyCache.get(klucz);
    if (gotowe) return gotowe;
    const d = dojazdyZ(this.gra, start, zaloga);
    this.dojazdyCache.set(klucz, d);
    return d;
  }

  /** Pozycja rynku planety po `doby` dobach: na żywo rzutowana, stary odczyt bez rzutowania, brak informacji = null. */
  rynekZa(id: string, towar: Towar, doby: number): PozycjaRynku | null {
    const klucz = `${id}:${towar}:${Math.round(doby)}`;
    const gotowy = this.rzuty.get(klucz);
    if (gotowy !== undefined) return gotowy;
    const info = this.gra.informacjaORynku(id);
    const poz = !info ? null : info.tryb === 'zywa' ? zapasPo(info.rynek[towar], doby) : info.rynek[towar];
    this.rzuty.set(klucz, poz);
    return poz;
  }

  /**
   * Klaster dystrybucji celu: cel i najbliższe widoczne planety tej samej cywilizacji w promieniu,
   * uporządkowane łańcuchem najbliższego sąsiada (na płytkich rynkach ładunek rozwozi się po kilku planetach).
   */
  klaster(cel: string): PlanetaKlastra[] {
    const gotowy = this.klastry.get(cel);
    if (gotowy) return gotowy;
    const gra = this.gra;
    const w = gra.wezel(cel);
    // Bez planety, na której stoimy: to, co można sprzedać tutaj, sprzedaje się teraz, a nie „później przez sąsiada”.
    const tu = gra.stan.pozycja;
    const kandydaci = gra.swiat.wezly
      .filter((x) => x.id !== cel && x.id !== tu && x.typ === 'planeta' && x.cywilizacja === w.cywilizacja && gra.informacjaORynku(x.id) !== null)
      .map((x) => ({ id: x.id, odleglosc: Math.hypot(x.x - w.x, x.y - w.y) }))
      .filter((x) => x.odleglosc <= P.bot.promienDystrybucjiPc)
      .sort((a, b) => a.odleglosc - b.odleglosc || (a.id < b.id ? -1 : 1))
      .slice(0, P.bot.maxPlanetDystrybucji);
    // Odległość w klastrze = łańcuch kolejnych skoków w linii prostej (przybliżenie objazdu).
    const lista: PlanetaKlastra[] = [{ id: cel, odleglosc: 0 }];
    let poprzedni = w;
    let suma = 0;
    for (const k of kandydaci) {
      const x = gra.wezel(k.id);
      suma += Math.hypot(x.x - poprzedni.x, x.y - poprzedni.y);
      lista.push({ id: k.id, odleglosc: suma });
      poprzedni = x;
    }
    this.klastry.set(cel, lista);
    return lista;
  }

  /**
   * Przychód ze sprzedaży m3 w klastrze celu: ilość dzielona proporcjonalnie do norm rynków.
   * Zwraca kwotę i odległość objazdu potrzebną, by sprzedać część poza celem (0, gdy wszystko w celu).
   */
  przychodSprzedazy(cel: string, towar: Towar, m3: number, doby: number, udzial: number, zKlastrem = true): { kwota: number; objazd: number } | null {
    if (m3 <= 0) return { kwota: 0, objazd: 0 };
    const klaster = zKlastrem ? this.klaster(cel) : [{ id: cel, odleglosc: 0 }];
    const pozycje: { poz: PozycjaRynku; odleglosc: number }[] = [];
    for (const k of klaster) {
      const poz = this.rynekZa(k.id, towar, doby);
      if (!poz) {
        if (k.id === cel) return null;
        continue;
      }
      pozycje.push({ poz, odleglosc: k.odleglosc });
    }
    const sumaNorm = pozycje.reduce((s, p) => s + p.poz.norma, 0);
    if (!(sumaNorm > 0)) return { kwota: 0, objazd: 0 };
    let kwota = 0;
    let objazd = 0;
    for (const p of pozycje) {
      const czesc = (m3 * p.poz.norma) / sumaNorm;
      if (czesc <= 0) continue;
      kwota += Math.round(kr(kwotaSprzedazyWU(K.towary[towar].basePrice, p.poz, czesc, udzial)));
      objazd = Math.max(objazd, p.odleglosc);
    }
    return { kwota, objazd };
  }

  /** Przychód ze sprzedaży tutaj (rynek na żywo). */
  przychodTutaj(towar: Towar, m3: number, udzial: number): number {
    if (m3 <= 0) return 0;
    const poz = this.gra.stan.rynki[this.gra.stan.pozycja][towar];
    return Math.round(kr(kwotaSprzedazyWU(K.towary[towar].basePrice, poz, m3, udzial)));
  }

  kosztKupnaTutaj(towar: Towar, m3: number, udzial: number): number {
    const poz = this.gra.stan.rynki[this.gra.stan.pozycja][towar];
    return Math.round(kr(kwotaKupnaWU(K.towary[towar].basePrice, poz, m3, udzial)));
  }

  /** Koszt kupna na innej planecie za `doby` dób (rzut rynku), null bez informacji. */
  kosztKupnaNa(id: string, towar: Towar, m3: number, doby: number, udzial: number): number | null {
    const poz = this.rynekZa(id, towar, doby);
    if (!poz) return null;
    return Math.round(kr(kwotaKupnaWU(K.towary[towar].basePrice, poz, Math.min(m3, poz.zapas), udzial)));
  }
}

function maxKupnoPrzy(ctx: Kontekst, towar: Towar, gotowka: number, objetosc: number, masa: number, udzial: number): number {
  const poz = ctx.gra.stan.rynki[ctx.gra.stan.pozycja][towar];
  let hi = Math.max(0, Math.min(poz.zapas, objetosc, masa / K.towary[towar].gestosc));
  if (hi <= 0) return 0;
  if (ctx.kosztKupnaTutaj(towar, hi, udzial) <= gotowka) return hi;
  let lo = 0;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (ctx.kosztKupnaTutaj(towar, mid, udzial) <= gotowka) lo = mid;
    else hi = mid;
  }
  return lo;
}

/**
 * Najlepszy dokupiony ładunek do `cel` ponad to, co już wieziemy (`bazowe`): do dwóch towarów,
 * ilość dobrana w krokach do głębokości rynku docelowego.
 */
function dobierzLadunek(ctx: Kontekst, cel: string, doby: number, gotowka: number, udzial: number, bazowe: Record<Towar, number>, objetosc: number, masa: number): Zakup[] {
  const gra = ctx.gra;
  if (!gra.rynekZnany(gra.stan.pozycja)) return [];
  const zakupy: Zakup[] = [];
  const uzyte = new Set<Towar>();
  for (let runda = 0; runda < 2; runda++) {
    let najlepszy: Zakup | null = null;
    for (const t of TOWARY) {
      if (uzyte.has(t)) continue;
      const max = maxKupnoPrzy(ctx, t, gotowka, objetosc, masa, udzial);
      if (max <= 0) continue;
      const przychodBazy = ctx.przychodSprzedazy(cel, t, bazowe[t], doby, udzial);
      if (przychodBazy === null) break;
      for (let k = 1; k <= P.bot.krokiIlosci; k++) {
        const m3 = Math.floor((max * k) / P.bot.krokiIlosci);
        if (m3 <= 0) continue;
        const koszt = ctx.kosztKupnaTutaj(t, m3, udzial);
        const przychod = ctx.przychodSprzedazy(cel, t, bazowe[t] + m3, doby, udzial)!.kwota - przychodBazy.kwota;
        const marza = przychod - koszt;
        if (marza > 0 && (!najlepszy || marza > najlepszy.przychodKr - najlepszy.kosztKr)) najlepszy = { towar: t, m3, kosztKr: koszt, przychodKr: przychod };
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

function pustyLadunek(): Record<Towar, number> {
  const r = {} as Record<Towar, number>;
  for (const t of TOWARY) r[t] = 0;
  return r;
}

export interface FiltrPlanow {
  cele?: Set<string>;
  /** Tylko wariant „wieź ładunek dalej” (zobowiązanie do celu). */
  tylkoDalej?: boolean;
}

/** Plany lotu dla danej załogi do wskazanych celów (albo wszystkich znanych). */
export function planyDlaZalogi(gra: Gra, zaloga: Zalogant[], ctx: Kontekst, filtr: FiltrPlanow = {}): Plan[] {
  const tylkoCele = filtr.cele;
  const ef = efektyZalogi(zaloga);
  const tu = gra.stan.pozycja;
  const doj = ctx.dojazdyZ(gra.stan.pozycja, zaloga);
  const cenaPaliwaTu = gra.cenaPaliwaTutaj();
  const cenaBazowaPaliwa = kr(K.towary.Fuel.basePrice);
  const rynekTu = gra.rynekZnany(tu);
  const wartoscLadowniTu = gra.wartoscLadowni();
  const ladunek = pustyLadunek();
  for (const t of TOWARY) ladunek[t] = gra.stan.ladownia[t].m3;
  const ktosNieznany = gra.swiat.cywilizacje.some((c) => !gra.stan.znaneCywilizacje[c.id]);
  const eksplorujDo = P.bot.eksplorujDoUlamkaHoryzontu * gra.limitDob;
  const plany: Plan[] = [];

  for (const [cel, d] of doj) {
    if (tylkoCele && !tylkoCele.has(cel)) continue;
    const w = gra.wezel(cel);
    if (w.typ !== 'planeta') continue;
    const znany = gra.informacjaORynku(cel) !== null;
    const eksploracja = !znany && ktosNieznany && !gra.cywilizacjaZnana(w.cywilizacja) && gra.stan.doba <= eksplorujDo && d.dystans <= P.bot.eksplorujMaxPc;
    if (!znany && !eksploracja) continue;
    const doby = d.dystans / ef.predkosc;
    const paliwo = d.dystans * K.kosztPaliwaNaParsek * ef.mnoznikPaliwa;
    // Pierwszy odcinek po cenie tutaj, dalsze ostrożnie po cenie bazowej (u plemion paliwo kosztuje tyle, ile w kanonie).
    const pierwszyDystans = doj.get(d.odcinki[0])?.dystans ?? d.dystans;
    const paliwoPierwszego = Math.min(paliwo, pierwszyDystans * K.kosztPaliwaNaParsek * ef.mnoznikPaliwa);
    const kosztPaliwa = Math.round(paliwoPierwszego * cenaPaliwaTu + (paliwo - paliwoPierwszego) * Math.max(cenaPaliwaTu, cenaBazowaPaliwa));
    const place = Math.round(ef.placeNaDobe * doby);
    const koszty = kosztPaliwa + place;
    const pierwszy = d.odcinki[0];
    const wspolne = { cel, pierwszyOdcinek: pierwszy, odcinki: d.odcinki, dystans: d.dystans, doby, kosztPaliwaKr: kosztPaliwa, placeKr: place };

    if (eksploracja) {
      if (filtr.tylkoDalej && filtr.cele && !filtr.cele.has(cel)) continue;
      const zysk = P.bot.premiaEksploracjiKr - koszty;
      plany.push({ ...wspolne, sprzedaze: [], zakupy: [], zyskNetto: zysk, naDobe: zysk / doby, eksploracja: true, gotowkaPo: gra.stan.kr - koszty });
      continue;
    }

    // Ładunek: dla każdego towaru wybierz, ile sprzedać tutaj, a ile wieźć do celu (maksimum łącznego przychodu).
    const sprzedaze: { towar: Towar; m3: number }[] = [];
    const zostaje = pustyLadunek();
    let przychodTu = 0;
    let przychodCel = 0;
    let objazd = 0;
    let znanyCel = true;
    let objetosc = K.ladownia - gra.objetoscZajeta();
    let masa = K.maxMasaLadunku - gra.masaZajeta();
    for (const t of TOWARY) {
      const h = ladunek[t];
      if (h <= 0) continue;
      let najlepszy: { q: number; tu: number; cel: number; objazd: number } | null = null;
      for (let k = 0; k <= P.bot.krokiIlosci; k++) {
        const q = k === P.bot.krokiIlosci ? h : Math.floor((h * k) / P.bot.krokiIlosci);
        if (q > 0 && (!rynekTu || filtr.tylkoDalej)) continue;
        const tuKwota = ctx.przychodTutaj(t, q, ef.udzialHandlowca);
        // Wieziony ładunek wyceniany jest tylko na samym celu: obietnica „rozwiozę po sąsiadach” realizuje się dopiero tam.
        const dalej = ctx.przychodSprzedazy(cel, t, h - q, doby, ef.udzialHandlowca, false);
        if (!dalej) {
          znanyCel = false;
          break;
        }
        if (!najlepszy || tuKwota + dalej.kwota > najlepszy.tu + najlepszy.cel) najlepszy = { q, tu: tuKwota, cel: dalej.kwota, objazd: dalej.objazd };
      }
      if (!znanyCel || !najlepszy) break;
      if (najlepszy.q > 0) sprzedaze.push({ towar: t, m3: najlepszy.q });
      zostaje[t] = h - najlepszy.q;
      przychodTu += najlepszy.tu;
      przychodCel += najlepszy.cel;
      objazd = Math.max(objazd, najlepszy.objazd);
      objetosc += najlepszy.q;
      masa += najlepszy.q * K.towary[t].gestosc;
    }
    if (!znanyCel) continue;

    const gotowka = gra.stan.kr + przychodTu - koszty;
    const zakupy = rynekTu && !filtr.tylkoDalej && gotowka > 0 ? dobierzLadunek(ctx, cel, doby, gotowka, ef.udzialHandlowca, zostaje, objetosc, masa) : rynekTu && gotowka > 0 ? dobierzLadunek(ctx, cel, doby, gotowka, ef.udzialHandlowca, zostaje, objetosc, masa) : [];
    const marza = zakupy.reduce((s, z) => s + z.przychodKr - z.kosztKr, 0);
    // Objazd po klastrze, gdy część ładunku sprzeda się poza celem.
    for (const z of zakupy) {
      const r = ctx.przychodSprzedazy(cel, z.towar, zostaje[z.towar] + z.m3, doby, ef.udzialHandlowca);
      if (r) objazd = Math.max(objazd, r.objazd);
    }
    const dobyObjazdu = objazd / ef.predkosc;
    const kosztObjazdu = Math.round(objazd * K.kosztPaliwaNaParsek * ef.mnoznikPaliwa * cenaPaliwaTu + ef.placeNaDobe * dobyObjazdu);
    const zysk = przychodTu + przychodCel - wartoscLadowniTu + marza - koszty - kosztObjazdu;
    const dobyLacznie = doby + dobyObjazdu;
    const gotowkaPo = gra.stan.kr + przychodTu + przychodCel + zakupy.reduce((s, z) => s + z.przychodKr - z.kosztKr, 0) - koszty - kosztObjazdu;
    plany.push({ ...wspolne, sprzedaze, zakupy, zyskNetto: zysk, naDobe: zysk / dobyLacznie, eksploracja: false, gotowkaPo });
  }
  return plany;
}

/**
 * Najlepszy pojedynczy kurs z celu planu (po przylocie, z gotówką po sprzedaży): jeden towar, jeden cel.
 * Dzięki temu bot widzi wartość pozycjonowania się po stronie producenta, nawet gdy pierwszy etap sam w sobie nie zarabia.
 */
function drugiKrok(ctx: Kontekst, plan: Plan, zaloga: readonly Zalogant[]): { zysk: number; doby: number } {
  const gra = ctx.gra;
  if (plan.eksploracja) return { zysk: 0, doby: 0 };
  const kluczCache = `${plan.cel}:${Math.round(plan.doby)}:${Math.round(plan.gotowkaPo / 1e5)}`;
  const gotowe = ctx.drugiKrokCache.get(kluczCache);
  if (gotowe) return gotowe;
  const ef = efektyZalogi(zaloga);
  const doj = ctx.dojazdyZ(plan.cel, zaloga);
  const cenaPaliwa = gra.cenaPaliwa(plan.cel) ?? gra.cenaPaliwaTutaj();
  let najlepszy = { zysk: 0, doby: 0 };
  const cele2 = [...doj.entries()]
    .filter(([cel2]) => cel2 !== plan.cel && gra.wezel(cel2).typ === 'planeta' && gra.informacjaORynku(cel2) !== null)
    .sort((a, b) => a[1].dystans - b[1].dystans)
    .slice(0, P.bot.celowDrugiegoKroku);
  for (const [cel2, d] of cele2) {
    const doby2 = d.dystans / ef.predkosc;
    const koszty = Math.round(d.dystans * K.kosztPaliwaNaParsek * ef.mnoznikPaliwa * cenaPaliwa + ef.placeNaDobe * doby2);
    for (const t of TOWARY) {
      const zrodlo = ctx.rynekZa(plan.cel, t, plan.doby);
      if (!zrodlo || zrodlo.zapas <= 0) continue;
      const maxObj = Math.min(K.ladownia, K.maxMasaLadunku / K.towary[t].gestosc, zrodlo.zapas);
      for (let k = 1; k <= P.bot.krokiDrugiegoKroku; k++) {
        const m3 = Math.floor((maxObj * k) / P.bot.krokiDrugiegoKroku);
        if (m3 <= 0) continue;
        const koszt = ctx.kosztKupnaNa(plan.cel, t, m3, plan.doby, ef.udzialHandlowca);
        if (koszt === null || koszt > plan.gotowkaPo) continue;
        const r = ctx.przychodSprzedazy(cel2, t, m3, plan.doby + doby2, ef.udzialHandlowca);
        if (!r) continue;
        const zysk = r.kwota - koszt - koszty;
        if (zysk > najlepszy.zysk) najlepszy = { zysk, doby: doby2 };
      }
    }
  }
  ctx.drugiKrokCache.set(kluczCache, najlepszy);
  return najlepszy;
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
  return a.naDobe > b.naDobe;
}

export interface Decyzja {
  plan: Plan | null;
  opcja: OpcjaZalogi;
}

/** Pamięć bota między dokami: cel, do którego wiezie ładunek (trasa wieloetapowa). */
export interface StanBota {
  cel: string | null;
}

export function nowyStanBota(): StanBota {
  return { cel: null };
}

/** Konkretna akcja wykonana w doku; smoke test odtwarza je w UI jeden do jednego. */
export type Akcja =
  | { typ: 'sprzedaj-wszystko'; towar: Towar }
  | { typ: 'sprzedaj'; towar: Towar; m3: number }
  | { typ: 'zwolnij'; id: string }
  | { typ: 'zatrudnij'; id: string }
  | { typ: 'tankuj'; m3: number }
  | { typ: 'kup'; towar: Towar; m3: number }
  | { typ: 'lec'; trasa: string[] };

export interface KrokBota {
  plan: Plan | null;
  opcja: OpcjaZalogi;
  akcje: Akcja[];
  utknal: boolean;
}

/** Wybór załogi i planu bez mutacji stanu gry; aktualizuje zobowiązanie w stanie bota. */
export function zaplanuj(gra: Gra, stanBota: StanBota = nowyStanBota()): Decyzja {
  const ctx = new Kontekst(gra);
  const bezZmian: OpcjaZalogi = { zaloga: [...gra.stan.zaloga], zatrudnij: [], zwolnij: [] };
  const maLadunek = TOWARY.some((t) => gra.stan.ladownia[t].m3 > 0);
  if (stanBota.cel === gra.stan.pozycja || !maLadunek) stanBota.cel = null;

  // Zobowiązanie: wieziemy ładunek do celu, więc na przystanku tylko tankujemy, dokupujemy i lecimy dalej.
  if (stanBota.cel) {
    const cel = stanBota.cel;
    let najlepszy: Plan | null = null;
    let opcjaNaj: OpcjaZalogi = bezZmian;
    for (const opcja of opcjeZalogi(gra)) {
      for (const plan of planyDlaZalogi(gra, opcja.zaloga, ctx, { cele: new Set([cel]), tylkoDalej: true })) {
        if (lepszy(plan, najlepszy)) {
          najlepszy = plan;
          opcjaNaj = opcja;
        }
      }
    }
    if (najlepszy) return { plan: najlepszy, opcja: opcjaNaj };
    stanBota.cel = null;
  }

  // 1. Plany dla obecnej załogi; 2. dla najlepszych z nich dolicz najlepszy kurs powrotny z celu (dwa kroki);
  // 3. dla wybranego celu sprawdź warianty załogi.
  const wstepne = planyDlaZalogi(gra, bezZmian.zaloga, ctx);
  wstepne.sort((a, b) => b.naDobe - a.naDobe);
  let najlepszyPlan: Plan | null = null;
  let najlepszaOcena = -Infinity;
  for (const p of wstepne.slice(0, P.bot.planowDoDrugiegoKroku)) {
    const dalej = drugiKrok(ctx, p, bezZmian.zaloga);
    const ocena = Math.max(p.naDobe, (p.zyskNetto + dalej.zysk) / (p.doby + dalej.doby));
    if (ocena > najlepszaOcena) {
      najlepszaOcena = ocena;
      najlepszyPlan = p;
    }
  }
  let najlepszaOpcja: OpcjaZalogi = bezZmian;
  if (najlepszyPlan) {
    const cele = new Set([najlepszyPlan.cel]);
    let najlepszaStopa = najlepszyPlan.naDobe;
    for (const opcja of opcjeZalogi(gra)) {
      if (opcja.zatrudnij.length === 0 && opcja.zwolnij.length === 0) continue;
      for (const plan of planyDlaZalogi(gra, opcja.zaloga, ctx, { cele })) {
        if (plan.naDobe > najlepszaStopa) {
          najlepszaStopa = plan.naDobe;
          najlepszyPlan = plan;
          najlepszaOpcja = opcja;
        }
      }
    }
  }
  const sprzedaneWszystko = (p: Plan) => TOWARY.every((t) => gra.stan.ladownia[t].m3 <= (p.sprzedaze.find((x) => x.towar === t)?.m3 ?? 0));
  const wiezie = !!najlepszyPlan && (najlepszyPlan.eksploracja || najlepszyPlan.zakupy.length > 0 || !sprzedaneWszystko(najlepszyPlan));
  stanBota.cel = wiezie && najlepszyPlan!.cel !== najlepszyPlan!.pierwszyOdcinek ? najlepszyPlan!.cel : null;
  return { plan: najlepszyPlan, opcja: najlepszaOpcja };
}

/** Ilości paliwa w pełnych dziesiątych m³, żeby UI (pole liczbowe) odtworzyło je bez reszty. */
function zaokrPaliwo(m3: number): number {
  return Math.floor(m3 * 10) / 10;
}

/** Wykonuje decyzję: sprzedaż, załoga, tankowanie, zakupy, pierwszy odcinek lotu. Zwraca dziennik akcji. */
export function wykonaj(gra: Gra, d: Decyzja): { akcje: Akcja[]; utknal: boolean } {
  const tu = gra.stan.pozycja;
  const akcje: Akcja[] = [];
  const tankuj = (m3: number, rezerwa = 0) => {
    const ile = zaokrPaliwo(Math.min(m3, K.bak - gra.stan.paliwo, gra.maxPaliwo(gra.stan.kr - rezerwa)));
    if (ile > 0) {
      gra.tankuj(ile);
      akcje.push({ typ: 'tankuj', m3: ile });
    }
  };
  const lec = (cel: string): boolean => {
    const trasa = gra.graf.najkrotszaSciezka(tu, cel);
    if (!trasa) return false;
    const s = gra.sprawdzTrase(trasa);
    if (s.blad) return false;
    gra.lec(trasa);
    akcje.push({ typ: 'lec', trasa });
    return true;
  };

  /** Lot awaryjny: do najbliższego węzła z paliwem, do którego starczy baku; w ostateczności zwolnij załogę. */
  const lotAwaryjny = (): boolean => {
    tankuj(K.bak);
    for (let proba = 0; proba < 2; proba++) {
      const zas = gra.zasieg();
      const cele = [...zas.values()].filter((o) => o.id !== tu && gra.wezel(o.id).typ !== 'przelot').sort((a, b) => a.dystans - b.dystans);
      for (const o of cele) if (lec(o.id)) return true;
      // Nie stać na płace: zwolnij załogę i spróbuj jeszcze raz.
      if (gra.stan.zaloga.length === 0) break;
      for (const z of [...gra.stan.zaloga]) {
        gra.zwolnij(z.id);
        akcje.push({ typ: 'zwolnij', id: z.id });
      }
    }
    return false;
  };

  if (!d.plan) return { akcje, utknal: !lotAwaryjny() };

  const plan = d.plan;
  for (const sp of plan.sprzedaze) {
    const m3 = Math.min(sp.m3, gra.stan.ladownia[sp.towar].m3);
    if (m3 <= 0) continue;
    if (m3 >= gra.stan.ladownia[sp.towar].m3) {
      gra.sprzedaj(sp.towar, gra.stan.ladownia[sp.towar].m3);
      akcje.push({ typ: 'sprzedaj-wszystko', towar: sp.towar });
    } else {
      gra.sprzedaj(sp.towar, m3);
      akcje.push({ typ: 'sprzedaj', towar: sp.towar, m3 });
    }
  }
  for (const id of d.opcja.zwolnij) {
    gra.zwolnij(id);
    akcje.push({ typ: 'zwolnij', id });
  }
  for (const id of d.opcja.zatrudnij) {
    gra.zatrudnij(id);
    akcje.push({ typ: 'zatrudnij', id });
  }
  // Paliwo na pierwszy odcinek, rezerwa gotówki na paliwo i płace całej trasy.
  const pierwszyDystans = gra.graf.dijkstra(tu).get(plan.pierwszyOdcinek)?.dystans ?? plan.dystans;
  const potrzebneNaOdcinek = gra.potrzebnePaliwo(pierwszyDystans);
  const rezerwa = plan.placeKr + Math.max(0, plan.kosztPaliwaKr - Math.round(potrzebneNaOdcinek * gra.cenaPaliwaTutaj()));
  if (potrzebneNaOdcinek > gra.stan.paliwo + 1e-9) tankuj(Math.ceil((potrzebneNaOdcinek - gra.stan.paliwo) * 10) / 10);
  for (const z of plan.zakupy) {
    const m3 = Math.floor(Math.min(z.m3, gra.maxKupno(z.towar, gra.stan.kr - rezerwa)));
    if (m3 > 0) {
      gra.kup(z.towar, m3);
      akcje.push({ typ: 'kup', towar: z.towar, m3 });
    }
  }
  // Tanie paliwo: dotankuj do pełna, jeśli cena poniżej progu i zostaje gotówka.
  if (gra.maPaliwo() && gra.cenaPaliwaTutaj() <= P.bot.tankujGdyCenaPonizejBazyRazy * K.kurs * K.towary.Fuel.basePrice) tankuj(K.bak, plan.placeKr);
  // Upewnij się, że paliwa starczy na odcinek (zakupy mogły zjeść gotówkę).
  if (potrzebneNaOdcinek > gra.stan.paliwo + 1e-9) tankuj(Math.ceil((potrzebneNaOdcinek - gra.stan.paliwo) * 10) / 10);
  if (!lec(plan.pierwszyOdcinek)) {
    // Nie stać na płace albo paliwo: sprzedaj co się da i spróbuj dolecieć gdziekolwiek.
    if (gra.rynekZnany(tu)) {
      for (const t of TOWARY) {
        if (gra.stan.ladownia[t].m3 > 0) {
          gra.sprzedaj(t, gra.stan.ladownia[t].m3);
          akcje.push({ typ: 'sprzedaj-wszystko', towar: t });
        }
      }
    }
    tankuj(K.bak);
    if (!lec(plan.pierwszyOdcinek)) return { akcje, utknal: !lotAwaryjny() };
  }
  return { akcje, utknal: false };
}

/** Jeden obrót pętli: zaplanuj i wykonaj. */
export function krokBota(gra: Gra, stanBota: StanBota = nowyStanBota()): KrokBota {
  const decyzja = zaplanuj(gra, stanBota);
  const { akcje, utknal } = wykonaj(gra, decyzja);
  return { plan: decyzja.plan, opcja: decyzja.opcja, akcje, utknal };
}

// ------------------------------------------------------------------------------------
// Rozgrywka jednego ziarna i miary
// ------------------------------------------------------------------------------------

export interface LotBota {
  z: string;
  do: string;
  cywZ?: string;
  cywDo?: string;
  dystans: number;
  doby: number;
  skoki: number;
  zyskWartosci: number;
  towary: Towar[];
  eksploracja: boolean;
}

/** Cała trasa handlowa bota: od zakupu (albo decyzji) do przylotu do celu planu, przez przystanki. */
export interface TrasaBota {
  cel: string;
  dystans: number;
  doby: number;
  loty: number;
  zyskWartosci: number;
  miedzyCyw: boolean;
  eksploracja: boolean;
}

export interface WynikZiarna {
  ziarno: string;
  wartoscKoncowa: number;
  zysk: boolean;
  loty: LotBota[];
  trasy: TrasaBota[];
  pierwszyZyskownyLot: number | null;
  kontaktDoba: number | null;
  utknal: boolean;
}

export function zagrajZiarno(ziarno: string, opcje: OpcjeGry = {}): WynikZiarna {
  const gra = new Gra(ziarno, opcje);
  const loty: LotBota[] = [];
  const trasy: TrasaBota[] = [];
  let pierwszy: number | null = null;
  let kontaktDoba: number | null = null;
  let utknal = false;
  const stanBota = nowyStanBota();
  let biezaca: (TrasaBota & { cywStart?: string; wartoscStart: number }) | null = null;
  while (!gra.stan.koniec) {
    const pozycjaPrzed = gra.stan.pozycja;
    const cywPrzed = gra.wezel(pozycjaPrzed).cywilizacja;
    const krok = krokBota(gra, stanBota);
    if (krok.utknal) {
      utknal = true;
      break;
    }
    const raport = gra.stan.raporty[gra.stan.raporty.length - 1];
    // Trasa handlowa: zaczyna się, gdy bot wybiera cel; kończy przylotem do celu.
    if (krok.plan && (!biezaca || biezaca.cel !== krok.plan.cel)) {
      if (biezaca && biezaca.loty > 0) trasy.push(biezaca);
      biezaca = { cel: krok.plan.cel, dystans: 0, doby: 0, loty: 0, zyskWartosci: 0, miedzyCyw: cywPrzed !== gra.wezel(krok.plan.cel).cywilizacja, eksploracja: krok.plan.eksploracja, cywStart: cywPrzed, wartoscStart: raport.wartoscPrzed };
    }
    if (biezaca) {
      biezaca.dystans += raport.dystansPc;
      biezaca.doby += raport.doby;
      biezaca.loty += 1;
      biezaca.zyskWartosci = raport.wartoscPo - biezaca.wartoscStart;
      if (raport.do === biezaca.cel) {
        trasy.push(biezaca);
        biezaca = null;
      }
    }
    loty.push({
      z: raport.z,
      do: raport.do,
      cywZ: gra.wezel(raport.z).cywilizacja,
      cywDo: gra.wezel(raport.do).cywilizacja,
      dystans: raport.dystansPc,
      doby: raport.doby,
      skoki: raport.trasa.length - 1,
      zyskWartosci: raport.wartoscPo - raport.wartoscPrzed,
      towary: krok.plan?.zakupy.map((z) => z.towar) ?? [],
      eksploracja: krok.plan?.eksploracja ?? false,
    });
    if (pierwszy === null && raport.wartoscPo > raport.wartoscPrzed) pierwszy = raport.numerLotu;
    if (raport.kontakt && kontaktDoba === null) kontaktDoba = raport.dobaKoniec;
  }
  if (biezaca && biezaca.loty > 0) trasy.push(biezaca);
  const wartosc = gra.wartoscFirmy();
  return { ziarno, wartoscKoncowa: wartosc, zysk: wartosc > K.startingCredits, loty, trasy, pierwszyZyskownyLot: pierwszy, kontaktDoba, utknal };
}

export { Graf };
