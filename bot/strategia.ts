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
  type Raport,
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
  skoki: number;
}

const cacheGrafow = new Map<string, Map<string, Odcinek[]>>();

function najmniejszyMnoznikPaliwa(): number {
  return (1 - P.nawigatorMaxRedukcjaPaliwa) * (1 - P.synergiaRedukcjaPaliwa);
}

function grafTankowania(gra: Gra): Map<string, Odcinek[]> {
  const klucz = gra.runda3 ? `${gra.swiat.skala}:${gra.swiat.ziarno}:r3` : `${gra.swiat.skala}:${gra.swiat.ziarno}:${gra.stan.szczebel}`;
  const gotowy = cacheGrafow.get(klucz);
  if (gotowy) return gotowy;
  // Runda 3: zasięg odcinka zależy od masy statku, więc graf ma stały, szeroki zasięg, a dojazdyZ filtruje odcinki per statek.
  const maxZasieg = gra.runda3 ? P.bot.maxOdcinekGrafuPc : gra.bak() / (K.kosztPaliwaNaParsek * najmniejszyMnoznikPaliwa());
  const odcinki = new Map<string, Odcinek[]>();
  for (const w of gra.swiat.wezly) {
    if (w.typ === 'przelot') continue;
    const d = gra.graf.dijkstra(w.id, maxZasieg);
    const lista: Odcinek[] = [];
    for (const [id, wpis] of d) {
      if (id === w.id) continue;
      if (gra.wezel(id).typ === 'przelot') continue;
      lista.push({ do: id, dystans: wpis.dystans, skoki: wpis.skoki });
    }
    odcinki.set(w.id, lista);
  }
  cacheGrafow.set(klucz, odcinki);
  return odcinki;
}

export interface Dojazd {
  dystans: number;
  odcinki: string[];
  /** Liczba skoków (krawędzi) na całej trasie; licznik pamięci zakupu maleje o skok. */
  skoki: number;
}

/** Najkrótsze dojazdy z bieżącej pozycji do węzłów z paliwem, odcinkami ≤ zasięg baku przy danej załodze. */
export function dojazdy(gra: Gra, zaloga: readonly Zalogant[]): Map<string, Dojazd> {
  return dojazdyZ(gra, gra.stan.pozycja, zaloga);
}

export function dojazdyZ(gra: Gra, start: string, zaloga: readonly Zalogant[], ladunekDodatkowyT = 0): Map<string, Dojazd> {
  const graf = grafTankowania(gra);
  // Odcinek musi zostawić rezerwę: bak tankuje się w krokach, a zużycie nie może przekroczyć stanu baku.
  // Runda 3: zasięg z pełnego baku przy bieżącej masie statku (ładunek spowalnia i w wariancie R zwiększa spalanie).
  const zasiegOdcinka = gra.zasiegNaPaliwie(gra.bak() - P.bot.rezerwaPaliwaOdcinkaM3, zaloga, ladunekDodatkowyT);
  const dystans = new Map<string, number>([[start, 0]]);
  const skokiDo = new Map<string, number>([[start, 0]]);
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
        skokiDo.set(o.do, (skokiDo.get(biezacy) ?? 0) + o.skoki);
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
    wynik.set(id, { dystans: d - odc.length * P.bot.karaPrzystankuPc, odcinki: odc, skoki: skokiDo.get(id) ?? 0 });
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
  /** Progresja: perspektywiczna wartość dostawy do koszyka awansu (nie jest gotówką). */
  premiaKr: number;
}

export interface Plan {
  cel: string;
  pierwszyOdcinek: string;
  odcinki: string[];
  dystans: number;
  skoki: number;
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
  /** Progresja: łączna premia perspektywiczna za dostawy koszyków awansu wliczona w zyskNetto. */
  premiaAwansuKr: number;
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
  private premie = new Map<string, Partial<Record<Towar, { naWU: number; pozostaloWU: number }>>>();
  readonly dojazdyCache = new Map<string, Map<string, Dojazd>>();
  readonly drugiKrokCache = new Map<string, { zysk: number; doby: number }>();
  constructor(
    readonly gra: Gra,
    /** Marże na m³ zaobserwowane przez bota na własnych sprzedażach (do wyceny przyszłego popytu po awansie). */
    readonly marzeNaM3: Partial<Record<Towar, number[]>> = {},
    /** Flota: cele, do których lecą już inne statki firmy (podział floty między trasy). */
    readonly wykluczoneCele: Set<string> = new Set(),
    /** Flota: objętość ładowni zarezerwowana na misję (receptura kontraktu, naukowiec). */
    readonly objetoscZarezerwowanaM3 = 0,
    /** Flota: towary receptury już w ładowni, których nie wolno sprzedać. */
    readonly zarezerwowaneTowary: Partial<Record<Towar, number>> = {},
    /** Flota: inny statek jest już na ekspedycji (albo flota niedawno ją zrobiła) — ten statek nie rusza na kolejną. */
    readonly bezEkspedycji = false,
  ) {}

  /** Marża na m³ towaru, jakiej bot może oczekiwać: mediana własnych sprzedaży (co najmniej minSprzedazyDoMarzy), inaczej 0. */
  marzaOczekiwana(towar: Towar): number {
    const m = this.marzeNaM3[towar] ?? [];
    if (m.length < P.bot.minSprzedazyDoMarzy) return 0;
    const s = [...m].sort((a, b) => a - b);
    const i = Math.floor(s.length / 2);
    return Math.max(0, s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2);
  }

  /**
   * Progresja: ile kr perspektywicznej wartości daje 1 WU dostawy towaru koszyka do cywilizacji.
   * Wartość awansu = Σ towarów koszyka: dodatkowa konsumpcja po awansie (m³/dobę) × marża oczekiwana (kr/m³)
   * × min(pozostałe doby, horyzont) × udział bota w tym popycie; rozłożona liniowo na potrzebną wartość koszyka,
   * ale nie więcej niż maxPremiaUlamekCeny ceny bazowej za m³ (żeby niski próg nie zamienił bota w darczyńcę).
   */
  premiaAwansu(idCyw: string): Partial<Record<Towar, { naWU: number; pozostaloWU: number }>> {
    const gotowa = this.premie.get(idCyw);
    if (gotowa) return gotowa;
    const gra = this.gra;
    const wynik: Partial<Record<Towar, { naWU: number; pozostaloWU: number }>> = {};
    const koszyk = gra.koszykTieru(idCyw);
    const cyw = gra.cywilizacja(idCyw);
    if (koszyk && cyw && gra.cywilizacjaZnana(idCyw)) {
      const postep = gra.postepAwansu(idCyw);
      const doby = Math.max(0, Math.min(gra.limitDob - gra.stan.doba, P.bot.horyzontAwansuDob));
      // „Opłacalne w perspektywie” wymaga, by awans był osiągalny: reszta koszyka (po cenie bazowej, w kr) nie może przekraczać
      // krotności majątku bota; inaczej premia za częściowe dostawy nagradza kupowanie elektroniki ze stratą bez końca.
      const resztaKr = postep.towary.reduce((sum, x) => sum + Math.max(0, x.potrzebneWU - x.dostarczoneWU), 0) * K.kurs;
      const majatek = gra.stan.kr + gra.wartoscLadowni();
      if (resztaKr > P.bot.maxResztaKoszykaKrotnoscMajatku * majatek) {
        this.premie.set(idCyw, wynik);
        return wynik;
      }
      let wartoscAwansu = 0;
      for (const t of Object.keys(koszyk.udzialy) as Towar[]) {
        const dodatkowa = (P.progresja.mnoznikKonsumpcjiAwansu - 1) * cyw.potrzebyM3NaDobe[t];
        wartoscAwansu += dodatkowa * this.marzaOczekiwana(t) * doby * P.bot.udzialWPopycieAwansu;
      }
      for (const x of postep.towary) {
        if (!(x.potrzebneWU > 0)) continue;
        const udzial = koszyk.udzialy[x.towar] ?? 0;
        const naWU = Math.min((wartoscAwansu * udzial) / x.potrzebneWU, P.bot.maxPremiaUlamekCeny * K.kurs);
        if (naWU > 0) wynik[x.towar] = { naWU, pozostaloWU: Math.max(0, x.potrzebneWU - x.dostarczoneWU) };
      }
    }
    this.premie.set(idCyw, wynik);
    return wynik;
  }

  /** Premia perspektywiczna za sprzedaż m3 towaru na planecie (0 bez progresji albo poza koszykiem). */
  premiaZa(idPlanety: string, towar: Towar, m3: number): number {
    if (!this.gra.progresja || m3 <= 0) return 0;
    const cyw = this.gra.wezel(idPlanety).cywilizacja;
    if (!cyw) return 0;
    const p = this.premiaAwansu(cyw)[towar];
    if (!p) return 0;
    return Math.round(Math.min(m3 * K.towary[towar].basePrice, p.pozostaloWU) * p.naWU);
  }

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
    const poz = !info || info.rynek[towar].dostepny === false ? null : info.tryb === 'zywa' ? zapasPo(info.rynek[towar], doby) : info.rynek[towar];
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
    // Runda 3: rynki z ludności są głębokie (norma w milionach m³), więc ładunku jednego statku nie trzeba rozwozić
    // po sąsiadach; klaster to sam cel, bo objazd po sąsiadach był czystym kosztem, który zaniżał każdy plan.
    if (gra.runda3) {
      const sam: PlanetaKlastra[] = [{ id: cel, odleglosc: 0 }];
      this.klastry.set(cel, sam);
      return sam;
    }
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
  /**
   * Przychód ze sprzedaży m3 w klastrze celu po `skoki` skokach: ilość dzielona proporcjonalnie do norm rynków,
   * z karą pamięci zakupu tam, gdzie licznik jeszcze nie zgaśnie (bot zna regułę).
   */
  przychodSprzedazy(cel: string, towar: Towar, m3: number, doby: number, udzial: number, zKlastrem = true, skoki = 0): { kwota: number; objazd: number; premia: number } | null {
    if (m3 <= 0) return { kwota: 0, objazd: 0, premia: 0 };
    const klaster = zKlastrem ? this.klaster(cel) : [{ id: cel, odleglosc: 0 }];
    const pozycje: { id: string; poz: PozycjaRynku; odleglosc: number }[] = [];
    for (const k of klaster) {
      const poz = this.rynekZa(k.id, towar, doby);
      if (!poz) {
        if (k.id === cel) return null;
        continue;
      }
      pozycje.push({ id: k.id, poz, odleglosc: k.odleglosc });
    }
    const sumaNorm = pozycje.reduce((s, p) => s + p.poz.norma, 0);
    if (!(sumaNorm > 0)) return { kwota: 0, objazd: 0, premia: 0 };
    let kwota = 0;
    let objazd = 0;
    for (const p of pozycje) {
      const czesc = (m3 * p.poz.norma) / sumaNorm;
      if (czesc <= 0) continue;
      kwota += Math.round(kr(kwotaSprzedazyWU(K.towary[towar].basePrice, p.poz, czesc, udzial, this.gra.spreadPodstawowy, this.gra.karaSprzedazy(p.id, towar, skoki), this.gra.obciecieNacisku)));
      objazd = Math.max(objazd, p.odleglosc);
    }
    // Klaster to jedna cywilizacja, więc premia awansu liczy się od całej ilości.
    return { kwota, objazd, premia: this.premiaZa(cel, towar, m3) };
  }

  /** Przychód ze sprzedaży tutaj (rynek na żywo, kara pamięci zakupu bez skoków w przód). */
  przychodTutaj(towar: Towar, m3: number, udzial: number): number {
    if (m3 <= 0) return 0;
    const tu = this.gra.stan.pozycja;
    const poz = this.gra.stan.rynki[tu][towar];
    if (poz.dostepny === false) return 0;
    return Math.round(kr(kwotaSprzedazyWU(K.towary[towar].basePrice, poz, m3, udzial, this.gra.spreadPodstawowy, this.gra.karaSprzedazy(tu, towar, 0), this.gra.obciecieNacisku)));
  }

  kosztKupnaTutaj(towar: Towar, m3: number, udzial: number): number {
    const poz = this.gra.stan.rynki[this.gra.stan.pozycja][towar];
    return Math.round(kr(kwotaKupnaWU(K.towary[towar].basePrice, poz, m3, udzial, this.gra.spreadPodstawowy, this.gra.obciecieNacisku)));
  }

  /** Koszt kupna na innej planecie za `doby` dób (rzut rynku), null bez informacji. */
  kosztKupnaNa(id: string, towar: Towar, m3: number, doby: number, udzial: number): number | null {
    const poz = this.rynekZa(id, towar, doby);
    if (!poz) return null;
    return Math.round(kr(kwotaKupnaWU(K.towary[towar].basePrice, poz, Math.min(m3, poz.zapas), udzial, this.gra.spreadPodstawowy, this.gra.obciecieNacisku)));
  }
}

function maxKupnoPrzy(ctx: Kontekst, towar: Towar, gotowka: number, objetosc: number, masa: number, udzial: number): number {
  const poz = ctx.gra.stan.rynki[ctx.gra.stan.pozycja][towar];
  if (poz.dostepny === false) return 0;
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
function dobierzLadunek(ctx: Kontekst, cel: string, doby: number, gotowka: number, udzial: number, bazowe: Record<Towar, number>, objetosc: number, masa: number, skoki = 0): Zakup[] {
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
      const przychodBazy = ctx.przychodSprzedazy(cel, t, bazowe[t], doby, udzial, true, skoki);
      if (przychodBazy === null) break;
      for (let k = 1; k <= P.bot.krokiIlosci; k++) {
        const m3 = Math.floor((max * k) / P.bot.krokiIlosci);
        if (m3 <= 0) continue;
        const koszt = ctx.kosztKupnaTutaj(t, m3, udzial);
        const r = ctx.przychodSprzedazy(cel, t, bazowe[t] + m3, doby, udzial, true, skoki);
        if (!r) break;
        const przychod = r.kwota - przychodBazy.kwota;
        const premia = r.premia - przychodBazy.premia;
        const marza = przychod + premia - koszt;
        if (marza > 0 && (!najlepszy || marza > najlepszy.przychodKr + najlepszy.premiaKr - najlepszy.kosztKr)) najlepszy = { towar: t, m3, kosztKr: koszt, przychodKr: przychod, premiaKr: premia };
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

/**
 * Koszty trasy odcinek po odcinku: każdy odcinek startuje z pełnym bakiem (tankowanie na przystanku), paliwo po cenie
 * w węźle startu odcinka (pierwszy tutaj, plemiona i nieznane planety po cenie bazowej). Runda 3 liczy doby i paliwo
 * z hierarchii ciągu przy bieżącym ładunku statku powiększonym o `ladunekDodatkowyT`; poza rundą 3 to dystans/prędkość i 1 m³/pc.
 */
export function kosztyTrasy(gra: Gra, zaloga: readonly Zalogant[], d: Dojazd, doj: Map<string, Dojazd>, ladunekDodatkowyT = 0): { doby: number; kosztPaliwaKr: number; paliwoM3: number } {
  const cenaBazowaPaliwa = kr(K.towary.Fuel.basePrice);
  let cena = gra.cenaPaliwaTutaj();
  let poprzedni = 0;
  let doby = 0;
  let koszt = 0;
  let paliwo = 0;
  for (const stop of d.odcinki) {
    const dStop = doj.get(stop)?.dystans ?? d.dystans;
    const dl = Math.max(0, dStop - poprzedni);
    const l = gra.obliczLot(dl, zaloga, gra.bak(), ladunekDodatkowyT);
    doby += l.doby;
    koszt += l.paliwo * cena;
    paliwo += l.paliwo;
    poprzedni = dStop;
    cena = gra.cenaPaliwa(stop) ?? cenaBazowaPaliwa;
  }
  return { doby, kosztPaliwaKr: Math.round(koszt), paliwoM3: paliwo };
}

/**
 * Runda 3: największa dodatkowa masa ładunku, przy której pierwszy odcinek (z pełnym bakiem minus rezerwa) jest wykonalny;
 * w wariancie D paliwo nie zależy od masy (bez limitu), w R z postaci zamkniętej: m₀ ≤ F / (1 − e^(−b·d/C)).
 */
function maxMasaDodatkowaT(gra: Gra, zaloga: readonly Zalogant[], pierwszyOdcinekPc: number): number {
  if (!gra.runda3) return Infinity;
  const F = gra.bak() - P.bot.rezerwaPaliwaOdcinkaM3;
  // Szukamy bisekcją: paliwo(d, masa + x) ≤ F.
  const potrzebne = (x: number) => gra.obliczLot(pierwszyOdcinekPc, zaloga, gra.bak(), x).paliwo;
  if (potrzebne(0) > F) return 0;
  let lo = 0;
  let hi = 1;
  while (potrzebne(hi) <= F && hi < 1e7) hi *= 2;
  if (hi >= 1e7) return Infinity;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (potrzebne(mid) <= F) lo = mid;
    else hi = mid;
  }
  return lo;
}

export interface FiltrPlanow {
  cele?: Set<string>;
  /** Tylko wariant „wieź ładunek dalej” (zobowiązanie do celu). */
  tylkoDalej?: boolean;
  /** Ekspedycja do nieznanej cywilizacji: plan eksploracyjny bez ograniczeń zasięgu i horyzontu eksploracji. */
  ekspedycja?: boolean;
}

/** Plany lotu dla danej załogi do wskazanych celów (albo wszystkich znanych). */
export function planyDlaZalogi(gra: Gra, zaloga: Zalogant[], ctx: Kontekst, filtr: FiltrPlanow = {}): Plan[] {
  const tylkoCele = filtr.cele;
  const ef = efektyZalogi(zaloga);
  const tu = gra.stan.pozycja;
  const doj = ctx.dojazdyZ(gra.stan.pozycja, zaloga);
  const cenaPaliwaTu = gra.cenaPaliwaTutaj();
  const rynekTu = gra.rynekZnany(tu);
  const wartoscLadowniTu = gra.wartoscLadowni();
  const ladunek = pustyLadunek();
  // Ładunek do dyspozycji planu: bez towarów receptury misji (te jadą do akademii).
  for (const t of TOWARY) ladunek[t] = Math.max(0, gra.stan.ladownia[t].m3 - (ctx.zarezerwowaneTowary[t] ?? 0));
  const ktosNieznany = gra.swiat.cywilizacje.some((c) => !gra.stan.znaneCywilizacje[c.id]);
  const eksplorujDo = P.bot.eksplorujDoUlamkaHoryzontu * gra.limitDob;
  // Progresja: horyzont jest dłuższy niż standardowy horyzont skali, więc kontakt jest wart proporcjonalnie więcej, a zasięg eksploracji rośnie w tej samej proporcji.
  const skalaHoryzontu = gra.progresja ? Math.max(1, gra.limitDob / P.skale[gra.skala].limitDob) : 1;
  const eksplorujMaxPc = P.bot.eksplorujMaxPc * skalaHoryzontu;
  const premiaEksploracji = P.bot.premiaEksploracjiKr * (gra.progresja ? Math.max(1, (gra.limitDob - gra.stan.doba) / P.skale[gra.skala].limitDob) : 1);
  const plany: Plan[] = [];

  for (const [cel, d] of doj) {
    if (tylkoCele && !tylkoCele.has(cel)) continue;
    const w = gra.wezel(cel);
    if (w.typ !== 'planeta') continue;
    const znany = gra.informacjaORynku(cel) !== null;
    const eksploracja = !znany && ktosNieznany && !gra.cywilizacjaZnana(w.cywilizacja) && (filtr.ekspedycja || (gra.stan.doba <= eksplorujDo && d.dystans <= eksplorujMaxPc));
    if (!znany && !eksploracja) continue;
    // Paliwo odcinek po odcinku: pierwszy po cenie tutaj, każdy następny po znanej cenie w węźle, z którego startuje
    // (plemiona i nieznane planety: cena bazowa). Wycena wszystkich dalszych odcinków po cenie bazowej zawyżała koszt
    // tras przez planety dwukrotnie i odcinała bota od ucieczki z ubogich regionów. Runda 3: doby i paliwo z masy.
    const kt = kosztyTrasy(gra, zaloga, d, doj);
    const doby = kt.doby;
    const kosztPaliwa = kt.kosztPaliwaKr;
    const place = Math.round(ef.placeNaDobe * doby);
    const koszty = kosztPaliwa + place;
    const pierwszy = d.odcinki[0];
    const wspolne = { cel, pierwszyOdcinek: pierwszy, odcinki: d.odcinki, dystans: d.dystans, skoki: d.skoki, doby, kosztPaliwaKr: kosztPaliwa, placeKr: place };

    if (eksploracja) {
      if (filtr.tylkoDalej && filtr.cele && !filtr.cele.has(cel)) continue;
      // Na ekspedycję bot nie wiezie ładunku (rynek celu nieznany): sprzedaje tutaj wszystko, co ma rynek.
      const sprzedazeTu = rynekTu ? TOWARY.filter((t) => ladunek[t] > 0).map((t) => ({ towar: t, m3: ladunek[t] })) : [];
      const przychodTu = sprzedazeTu.reduce((s, x) => s + ctx.przychodTutaj(x.towar, x.m3, ef.udzialHandlowca), 0);
      const zysk = premiaEksploracji - koszty + (rynekTu ? przychodTu - wartoscLadowniTu : 0);
      // Trasa, na którą nie starcza gotówki (paliwo liczone ostrożnie po cenie bazowej za dalsze odcinki), nie jest planem.
      if (gra.stan.kr + przychodTu - koszty < 0) continue;
      plany.push({ ...wspolne, sprzedaze: sprzedazeTu, zakupy: [], zyskNetto: zysk, naDobe: zysk / doby, eksploracja: true, gotowkaPo: gra.stan.kr + przychodTu - koszty, premiaAwansuKr: 0 });
      continue;
    }

    // Ładunek: dla każdego towaru wybierz, ile sprzedać tutaj, a ile wieźć do celu (maksimum łącznego przychodu).
    const sprzedaze: { towar: Towar; m3: number }[] = [];
    const zostaje = pustyLadunek();
    let przychodTu = 0;
    let przychodCel = 0;
    let premia = 0;
    let objazd = 0;
    let znanyCel = true;
    let objetosc = gra.ladownia() - gra.objetoscZajeta() - ctx.objetoscZarezerwowanaM3;
    // Masa: poza rundą 3 limit kanonu; w rundzie 3 tyle, ile pozwala wykonalność pierwszego odcinka z pełnym bakiem.
    const pierwszyDystans = doj.get(pierwszy)?.dystans ?? d.dystans;
    let masa = gra.runda3 ? maxMasaDodatkowaT(gra, zaloga, pierwszyDystans) : gra.maxMasa() - gra.masaZajeta();
    for (const t of TOWARY) {
      const h = ladunek[t];
      if (h <= 0) continue;
      let najlepszy: { q: number; tu: number; cel: number; premia: number; objazd: number } | null = null;
      // Runda 3: rynki z ludności są bezdenne, więc sprzedaż tutaj i w celu bywa warta tyle samo; przy remisie sprzedaj teraz
      // (od największej ilości), zamiast wozić ładunek 150 dób po tę samą cenę.
      for (let kk = 0; kk <= P.bot.krokiIlosci; kk++) {
        const k = gra.runda3 ? P.bot.krokiIlosci - kk : kk;
        const q = k === P.bot.krokiIlosci ? h : Math.floor((h * k) / P.bot.krokiIlosci);
        if (q > 0 && (!rynekTu || filtr.tylkoDalej)) continue;
        const tuKwota = ctx.przychodTutaj(t, q, ef.udzialHandlowca);
        const tuPremia = ctx.premiaZa(tu, t, q);
        // Wieziony ładunek wyceniany jest tylko na samym celu: obietnica „rozwiozę po sąsiadach” realizuje się dopiero tam.
        const dalej = ctx.przychodSprzedazy(cel, t, h - q, doby, ef.udzialHandlowca, false, d.skoki);
        if (!dalej) {
          znanyCel = false;
          break;
        }
        const ocena = tuKwota + tuPremia + dalej.kwota + dalej.premia;
        if (!najlepszy || ocena > najlepszy.tu + najlepszy.cel + najlepszy.premia) najlepszy = { q, tu: tuKwota, cel: dalej.kwota, premia: tuPremia + dalej.premia, objazd: dalej.objazd };
      }
      if (!znanyCel || !najlepszy) break;
      if (najlepszy.q > 0) sprzedaze.push({ towar: t, m3: najlepszy.q });
      zostaje[t] = h - najlepszy.q;
      przychodTu += najlepszy.tu;
      przychodCel += najlepszy.cel;
      premia += najlepszy.premia;
      objazd = Math.max(objazd, najlepszy.objazd);
      objetosc += najlepszy.q;
      masa += najlepszy.q * K.towary[t].gestosc;
    }
    if (!znanyCel) continue;

    const gotowka = gra.stan.kr + przychodTu - koszty;
    // Trasa, na którą nie starcza gotówki po sprzedaży tutaj, nie jest planem: przychód w celu nie zapłaci za paliwo po drodze
    // (bez tej reguły bot z drogim ładunkiem i pustą kasą grzązł u plemion w połowie drogi).
    if (gotowka < 0) continue;
    const zakupy = rynekTu && gotowka > 0 ? dobierzLadunek(ctx, cel, doby, gotowka, ef.udzialHandlowca, zostaje, objetosc, masa, d.skoki) : [];
    const premiaLadunku = premia;
    premia += zakupy.reduce((s, z) => s + z.premiaKr, 0);
    const marza = zakupy.reduce((s, z) => s + z.przychodKr + z.premiaKr - z.kosztKr, 0);
    // Objazd po klastrze, gdy część ładunku sprzeda się poza celem.
    for (const z of zakupy) {
      const r = ctx.przychodSprzedazy(cel, z.towar, zostaje[z.towar] + z.m3, doby, ef.udzialHandlowca, true, d.skoki);
      if (r) objazd = Math.max(objazd, r.objazd);
    }
    // Runda 3: po doborze ładunku statek jest cięższy (minus to, co sprzedał tutaj): doby i paliwo liczone raz jeszcze z masy.
    let dobyTrasy = doby;
    let kosztyTrasyKr = koszty;
    let placeTrasy = place;
    if (gra.runda3) {
      const zmianaMasy = zakupy.reduce((s, z) => s + z.m3 * K.towary[z.towar].gestosc, 0) - sprzedaze.reduce((s, x) => s + x.m3 * K.towary[x.towar].gestosc, 0);
      const kt2 = kosztyTrasy(gra, zaloga, d, doj, zmianaMasy);
      dobyTrasy = kt2.doby;
      placeTrasy = Math.round(ef.placeNaDobe * kt2.doby);
      kosztyTrasyKr = kt2.kosztPaliwaKr + placeTrasy;
      wspolne.doby = dobyTrasy;
      wspolne.kosztPaliwaKr = kt2.kosztPaliwaKr;
      wspolne.placeKr = placeTrasy;
    }
    const dobyObjazdu = objazd / (gra.runda3 ? gra.predkoscTeraz(zaloga) : ef.predkosc);
    const kosztObjazdu = Math.round(gra.obliczLot(objazd, zaloga, gra.bak()).paliwo * cenaPaliwaTu + ef.placeNaDobe * dobyObjazdu);
    let zysk = przychodTu + przychodCel + premiaLadunku - wartoscLadowniTu + marza - kosztyTrasyKr - kosztObjazdu;
    // Premia awansu nie jest gotówką: plan, który spaliłby więcej niż maxStrataNaKoszykUlamek gotówki, traci premię (i zwykle sens).
    if (premia > 0 && zysk - premia < -P.bot.maxStrataNaKoszykUlamek * gra.stan.kr) {
      zysk -= premia;
      premia = 0;
    }
    const dobyLacznie = dobyTrasy + dobyObjazdu;
    const gotowkaPo = gra.stan.kr + przychodTu + przychodCel + zakupy.reduce((s, z) => s + z.przychodKr - z.kosztKr, 0) - kosztyTrasyKr - kosztObjazdu;
    plany.push({ ...wspolne, sprzedaze, zakupy, zyskNetto: zysk, naDobe: zysk / dobyLacznie, eksploracja: false, gotowkaPo, premiaAwansuKr: premia });
  }
  return plany;
}

/**
 * Najlepszy pojedynczy kurs z celu planu (po przylocie, z gotówką po sprzedaży): jeden towar, jeden cel.
 * Dzięki temu bot widzi wartość pozycjonowania się po stronie producenta, nawet gdy pierwszy etap sam w sobie nie zarabia.
 */
export function drugiKrok(ctx: Kontekst, plan: Plan, zaloga: readonly Zalogant[]): { zysk: number; doby: number } {
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
  // Runda 3: na skali L najbliższe planety celu to zwykle ta sama cywilizacja (ten sam profil nadwyżek), więc drugi krok
  // liczy też powrót do doku, z którego startujemy — pętla handlowa między dwiema cywilizacjami (żywność tam, rozpuszczalniki z powrotem).
  const tu = gra.stan.pozycja;
  const dTu = doj.get(tu);
  if (gra.runda3 && dTu && tu !== plan.cel && gra.wezel(tu).typ === 'planeta' && gra.informacjaORynku(tu) !== null && !cele2.some(([c]) => c === tu)) cele2.push([tu, dTu]);
  for (const [cel2, d] of cele2) {
    for (const t of TOWARY) {
      const zrodlo = ctx.rynekZa(plan.cel, t, plan.doby);
      if (!zrodlo || zrodlo.zapas <= 0 || zrodlo.dostepny === false) continue;
      const maxObj = Math.min(gra.ladownia(), gra.maxMasa() / K.towary[t].gestosc, zrodlo.zapas);
      for (let k = 1; k <= P.bot.krokiDrugiegoKroku; k++) {
        const m3 = Math.floor((maxObj * k) / P.bot.krokiDrugiegoKroku);
        if (m3 <= 0) continue;
        // Lot z celu z ładunkiem m3 (runda 3: masa ładunku zamiast bieżącej ładowni, która zostaje w celu).
        const l2 = gra.obliczLot(d.dystans, zaloga, gra.bak(), m3 * K.towary[t].gestosc - gra.masaZajeta());
        const doby2 = l2.doby;
        const koszty = Math.round(l2.paliwo * cenaPaliwa + ef.placeNaDobe * doby2);
        const koszt = ctx.kosztKupnaNa(plan.cel, t, m3, plan.doby, ef.udzialHandlowca);
        if (koszt === null || koszt > plan.gotowkaPo) continue;
        const r = ctx.przychodSprzedazy(cel2, t, m3, plan.doby + doby2, ef.udzialHandlowca, true, plan.skoki + d.skoki);
        if (!r) continue;
        const zysk = r.kwota + r.premia - koszt - koszty;
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
    if (obecna.length < gra.miejscaZalogi()) opcje.push({ zaloga: [...obecna, k], zatrudnij: [k.id], zwolnij: [] });
    // Progresja: XP to inwestycja w załoganta, więc bot nie zwalnia i nie podmienia (kandydat zaczyna od zera).
    if (gra.progresja) continue;
    for (const z of obecna) {
      if (z.rola === k.rola && z.umiejetnosc < k.umiejetnosc) {
        opcje.push({ zaloga: [...obecna.filter((x) => x.id !== z.id), k], zatrudnij: [k.id], zwolnij: [z.id] });
      }
    }
  }
  if (!gra.progresja) for (const z of obecna) opcje.push({ zaloga: obecna.filter((x) => x.id !== z.id), zatrudnij: [], zwolnij: [z.id] });
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

/** Pamięć bota między dokami: cel, do którego wiezie ładunek (trasa wieloetapowa), i własne marże per towar (progresja). */
export interface StanBota {
  cel: string | null;
  marzeNaM3: Partial<Record<Towar, number[]>>;
  /** Progresja: doba startu ostatniej ekspedycji, do rytmu kolejnych. */
  ostatniaEkspedycja: number;
  /** Progresja: dziennik ekspedycji (do diagnostyki i miar). */
  ekspedycje: { doba: number; cel: string; dystans: number; kosztKr: number; gotowkaKr: number; wynik: 'w drodze' | 'kontakt' | 'przerwana' }[];
  /** Progresja: stolica, do której bot jedzie kupić kadłub (stać go na szczebel, ale stocznia jest gdzie indziej). */
  doStoczni: string | null;
  /** Progresja: odwrót z ubogiego regionu — stolica innej cywilizacji, do której bot wraca, gdy kolejne doki nie dają zysku. */
  odwrot: string | null;
  slabychDokow: number;
  /** Runda 3: cel bieżącego etapu misji kontraktowej (planer ogranicza do niego cele, handlując po drodze). */
  celMisji: string | null;
}

export function nowyStanBota(): StanBota {
  return { cel: null, marzeNaM3: {}, ostatniaEkspedycja: 0, ekspedycje: [], doStoczni: null, odwrot: null, slabychDokow: 0, celMisji: null };
}

/**
 * Progresja: odwrót. Po ekspedycji bot bywa w regionie, gdzie żaden plan nie zarabia (mała cywilizacja bez tanich źródeł importu),
 * a zachłanna stopa na dobę każe mu krążyć po małych stratach, aż skończy się gotówka. Po `slabychDokowDoOdwrotu` kolejnych
 * dokach bez dodatniego planu bot ogranicza cele do najbliższej znanej stolicy innej cywilizacji (handlując po drodze).
 */
function odwrotWToku(gra: Gra, stanBota: StanBota): string | null {
  if (!gra.progresja || !stanBota.odwrot) return null;
  if (stanBota.odwrot === gra.stan.pozycja) {
    stanBota.odwrot = null;
    stanBota.slabychDokow = 0;
    return null;
  }
  return stanBota.odwrot;
}

function celOdwrotu(gra: Gra, stanBota: StanBota, ctx: Kontekst): string | null {
  if (!gra.progresja) return null;
  if (stanBota.slabychDokow < P.bot.slabychDokowDoOdwrotu) return null;
  const tu = gra.wezel().cywilizacja;
  const doj = ctx.dojazdyZ(gra.stan.pozycja, gra.stan.zaloga);
  let naj: { id: string; dystans: number } | null = null;
  for (const c of gra.swiat.cywilizacje) {
    if (!gra.cywilizacjaZnana(c.id) || c.id === tu) continue;
    const d = doj.get(c.stolica);
    if (d && (!naj || d.dystans < naj.dystans)) naj = { id: c.stolica, dystans: d.dystans };
  }
  stanBota.odwrot = naj?.id ?? null;
  stanBota.slabychDokow = 0;
  return stanBota.odwrot;
}

/** Koszt pustego lotu do najbliższej znanej stolicy innej cywilizacji niż ta, w której bot stoi („budżet wyjścia” z regionu). */
function kosztWyjscia(gra: Gra, doj: Map<string, Dojazd>): number {
  const tu = gra.wezel().cywilizacja;
  let naj = Infinity;
  for (const c of gra.swiat.cywilizacje) {
    if (!gra.cywilizacjaZnana(c.id) || c.id === tu) continue;
    const d = doj.get(c.stolica);
    if (d && d.dystans < naj) naj = d.dystans;
  }
  return Number.isFinite(naj) ? kosztPustegoLotu(gra, naj) : 0;
}

/**
 * Czy bot może kupić kadłub: gotówka ≥ mnoznikGotowkiNaSzczebel × cena (prompt) i po zakupie zostaje budżet wyjścia,
 * czyli koszt pustego lotu do stolicy innej cywilizacji (bez tego bot kupował kadłub w regionie bez zyskownych tras i grzązł tam).
 */
function stacNaSzczebel(gra: Gra, kwotaKr: number, doj: Map<string, Dojazd>): boolean {
  return gra.stan.kr >= P.bot.mnoznikGotowkiNaSzczebel * kwotaKr && gra.stan.kr - kwotaKr >= kosztWyjscia(gra, doj);
}

/**
 * Progresja: wyprawa do stoczni. Gdy stać go na kolejny szczebel, a nie stoi w stolicy,
 * bot ogranicza cele planów do najbliższej znanej stolicy (handlując po drodze), żeby kadłub nie czekał na przypadkową wizytę.
 */
function celStoczni(gra: Gra, stanBota: StanBota, ctx: Kontekst): string | null {
  if (!gra.progresja) return null;
  const doj = ctx.dojazdyZ(gra.stan.pozycja, gra.stan.zaloga);
  const w = gra.wycenaSzczebla();
  const naKadlub = !!w && w.kwotaKr !== null && stacNaSzczebel(gra, w.kwotaKr, doj);
  // Runda 3: wyprawa po nowy statek, gdy poziom firmy ma wolne miejsce i stać na statek z budżetem wyjścia.
  const cenaStatku = P.runda3.firma.cenaNowegoStatkuKr;
  const naStatek = gra.runda3 && gra.stan.statki.length < gra.limitStatkow() && gra.stan.kr >= P.bot.mnoznikGotowkiNaStatek * cenaStatku && gra.stan.kr - cenaStatku >= kosztWyjscia(gra, doj);
  if ((!naKadlub && !naStatek) || gra.wStoczni()) {
    stanBota.doStoczni = null;
    return null;
  }
  if (stanBota.doStoczni && stanBota.doStoczni !== gra.stan.pozycja) return stanBota.doStoczni;
  let naj: { id: string; dystans: number } | null = null;
  for (const c of gra.swiat.cywilizacje) {
    if (!gra.cywilizacjaZnana(c.id)) continue;
    if (gra.runda3 && naKadlub && !naStatek && !gra.stoczniaDopuszcza(w!.nastepny, c.stolica)) continue;
    const d = doj.get(c.stolica);
    if (d && (!naj || d.dystans < naj.dystans)) naj = { id: c.stolica, dystans: d.dystans };
  }
  stanBota.doStoczni = naj?.id ?? null;
  return stanBota.doStoczni;
}

/** Szacowany koszt pustego lotu o danej długości: paliwo po cenie bazowej (u plemion tyle kosztuje) i płace. */
function kosztPustegoLotu(gra: Gra, dystans: number): number {
  const ef = efektyZalogi(gra.stan.zaloga);
  const l = gra.obliczLot(dystans, gra.stan.zaloga, gra.bak());
  return l.paliwo * kr(K.towary.Fuel.basePrice) + ef.placeNaDobe * l.doby;
}

/**
 * Progresja: ekspedycja. Gracz, który chce maksimum galaktyki, musi poznać wszystkie cywilizacje, a zachłanna stopa na dobę
 * nigdy nie wybierze pustego lotu na kilkaset parseków. Dlatego co `dobyMiedzyEkspedycjami` dób (do `eksplorujDoUlamkaHoryzontu`
 * horyzontu) bot zobowiązuje się do najbliższej planety nieznanej cywilizacji osiągalnej po grafie tankowania.
 */
function celEkspedycji(gra: Gra, stanBota: StanBota, ctx: Kontekst): string | null {
  if (!gra.progresja || stanBota.cel || !gra.rynekZnany(gra.stan.pozycja)) return null;
  // Flota: statek na misji kontraktowej nie rusza na ekspedycję; na ekspedycji jest co najwyżej jeden statek floty naraz.
  if (stanBota.celMisji || ctx.bezEkspedycji) return null;
  if (gra.stan.doba > P.bot.eksplorujDoUlamkaHoryzontu * gra.limitDob) return null;
  if (gra.stan.doba - stanBota.ostatniaEkspedycja < P.bot.dobyMiedzyEkspedycjami) return null;
  if (!gra.swiat.cywilizacje.some((c) => !gra.stan.znaneCywilizacje[c.id])) return null;
  const doj = ctx.dojazdyZ(gra.stan.pozycja, gra.stan.zaloga);
  let najlepszy: { id: string; dystans: number } | null = null;
  for (const [id, d] of doj) {
    const w = gra.wezel(id);
    if (w.typ !== 'planeta' || gra.cywilizacjaZnana(w.cywilizacja)) continue;
    if (!najlepszy || d.dystans < najlepszy.dystans) najlepszy = { id, dystans: d.dystans };
  }
  if (!najlepszy) return null;
  // Runda 3: czas płynie dla całej floty, więc ekspedycja dłuższa niż maxDobyEkspedycji (przy obecnej masie statku) nie ma sensu
  // na horyzoncie 1 200 dób; dalsze cywilizacje czekają na szybszy (większy) kadłub.
  if (gra.runda3 && gra.obliczLot(najlepszy.dystans, gra.stan.zaloga, gra.bak()).doby > P.bot.maxDobyEkspedycji) return null;
  // Ekspedycja to pusty lot: rusza tylko, gdy gotówka (po sprzedaży ładunku tutaj) pokrywa koszt z zapasem.
  const koszt = kosztPustegoLotu(gra, najlepszy.dystans);
  const gotowka = gra.stan.kr + gra.wartoscLadowni();
  if (gotowka < P.bot.mnoznikGotowkiNaEkspedycje * koszt) return null;
  stanBota.ekspedycje.push({ doba: gra.stan.doba, cel: najlepszy.id, dystans: najlepszy.dystans, kosztKr: koszt, gotowkaKr: gotowka, wynik: 'w drodze' });
  return najlepszy.id;
}

/**
 * Ekspedycja w toku: na każdym przystanku bot sprawdza, czy gotówka z ładunkiem nadal pokrywa resztę drogi z zapasem
 * `mnoznikGotowkiNaKontynuacje`; jeśli nie, przerywa (wraca do handlu z miejsca, w którym jest), zamiast spalić wszystko na paliwo.
 */
function kontynuowacEkspedycje(gra: Gra, stanBota: StanBota, ctx: Kontekst): boolean {
  const cel = stanBota.cel!;
  const d = ctx.dojazdyZ(gra.stan.pozycja, gra.stan.zaloga).get(cel);
  if (!d) return false;
  const koszt = kosztPustegoLotu(gra, d.dystans);
  return gra.stan.kr + gra.wartoscLadowni() >= P.bot.mnoznikGotowkiNaKontynuacje * koszt;
}

/** Konkretna akcja wykonana w doku; smoke test odtwarza je w UI jeden do jednego. */
export type Akcja =
  | { typ: 'sprzedaj-wszystko'; towar: Towar }
  | { typ: 'sprzedaj'; towar: Towar; m3: number }
  | { typ: 'zwolnij'; id: string }
  | { typ: 'zatrudnij'; id: string }
  | { typ: 'tankuj'; m3: number }
  | { typ: 'kup'; towar: Towar; m3: number }
  | { typ: 'kup-szczebel'; szczebel: number }
  | { typ: 'kup-statek'; id: number }
  | { typ: 'lec'; trasa: string[] };

export interface KrokBota {
  plan: Plan | null;
  opcja: OpcjaZalogi;
  akcje: Akcja[];
  utknal: boolean;
}

/** Obserwator planów dostępnych w doku (do miar struktury gospodarki, niezależnych od wyboru bota). */
export type ObserwatorPlanow = (plany: Plan[]) => void;

/** Wybór załogi i planu bez mutacji stanu gry; aktualizuje zobowiązanie w stanie bota. */
export interface OpcjeFloty {
  wykluczoneCele?: Set<string>;
  objetoscZarezerwowanaM3?: number;
  zarezerwowaneTowary?: Partial<Record<Towar, number>>;
  bezEkspedycji?: boolean;
}

export function zaplanuj(gra: Gra, stanBota: StanBota = nowyStanBota(), obserwator?: ObserwatorPlanow, flota: OpcjeFloty = {}): Decyzja {
  const ctx = new Kontekst(gra, stanBota.marzeNaM3, flota.wykluczoneCele ?? new Set(), flota.objetoscZarezerwowanaM3 ?? 0, flota.zarezerwowaneTowary ?? {}, flota.bezEkspedycji ?? false);
  const bezZmian: OpcjaZalogi = { zaloga: [...gra.stan.zaloga], zatrudnij: [], zwolnij: [] };
  const maLadunek = TOWARY.some((t) => gra.stan.ladownia[t].m3 > 0);
  const ostatniaEksp = stanBota.ekspedycje[stanBota.ekspedycje.length - 1];
  if (ostatniaEksp?.wynik === 'w drodze' && gra.rynekZnany(ostatniaEksp.cel)) ostatniaEksp.wynik = 'kontakt';
  const ekspedycjaTrwa = stanBota.cel !== null && !gra.rynekZnany(stanBota.cel);
  if (ekspedycjaTrwa && stanBota.cel !== gra.stan.pozycja && !kontynuowacEkspedycje(gra, stanBota, ctx)) {
    if (ostatniaEksp?.wynik === 'w drodze') ostatniaEksp.wynik = 'przerwana';
    stanBota.cel = null;
  }
  if (stanBota.cel === gra.stan.pozycja || (!maLadunek && !ekspedycjaTrwa)) stanBota.cel = null;
  if (stanBota.cel && !ekspedycjaTrwa && !maLadunek) stanBota.cel = null;
  const ekspedycja = celEkspedycji(gra, stanBota, ctx);
  if (ekspedycja) {
    stanBota.cel = ekspedycja;
    stanBota.ostatniaEkspedycja = gra.stan.doba;
  }

  // Zobowiązanie: wieziemy ładunek do celu, więc na przystanku tylko tankujemy, dokupujemy i lecimy dalej.
  if (stanBota.cel) {
    const cel = stanBota.cel;
    let najlepszy: Plan | null = null;
    let opcjaNaj: OpcjaZalogi = bezZmian;
    const doNieznanej = !gra.rynekZnany(cel);
    for (const opcja of opcjeZalogi(gra)) {
      for (const plan of planyDlaZalogi(gra, opcja.zaloga, ctx, { cele: new Set([cel]), tylkoDalej: !doNieznanej, ekspedycja: doNieznanej })) {
        if (lepszy(plan, najlepszy)) {
          najlepszy = plan;
          opcjaNaj = opcja;
        }
      }
    }
    if (najlepszy) return { plan: najlepszy, opcja: opcjaNaj };
    stanBota.cel = null;
  }

  // 1. Plany dla obecnej załogi (misja, odwrót w toku albo droga do stoczni: tylko do tego celu); 2. dla najlepszych z nich
  // dolicz najlepszy kurs powrotny z celu (dwa kroki); 3. dok, w którym nawet dwa kroki nie zarabiają, liczy się jako słaby —
  // po progu odwrót; 4. dla wybranego celu sprawdź warianty załogi.
  const ocenPlany = (lista: Plan[]): { plan: Plan | null; ocena: number } => {
    lista.sort((a, b) => b.naDobe - a.naDobe);
    let naj: Plan | null = null;
    let najOcena = -Infinity;
    for (const p of lista.slice(0, gra.runda3 ? P.bot.planowDoDrugiegoKrokuRunda3 : P.bot.planowDoDrugiegoKroku)) {
      const dalej = drugiKrok(ctx, p, bezZmian.zaloga);
      let ocena = Math.max(p.naDobe, (p.zyskNetto + dalej.zysk) / (p.doby + dalej.doby));
      // Flota: cel, do którego leci już inny statek firmy, jest gorszy o karaWspolnegoCelu (podział floty między trasy przy remisie,
      // ale nie kosztem pustego lotu w inną stronę: rynki z ludności wchłaniają ładunek kilku statków).
      if (ctx.wykluczoneCele.has(p.cel)) ocena -= Math.abs(ocena) * P.bot.karaWspolnegoCelu;
      if (ocena > najOcena) {
        najOcena = ocena;
        naj = p;
      }
    }
    return { plan: naj, ocena: najOcena };
  };
  const wyprawa = stanBota.celMisji ?? odwrotWToku(gra, stanBota) ?? celStoczni(gra, stanBota, ctx);
  let wstepne = wyprawa ? planyDlaZalogi(gra, bezZmian.zaloga, ctx, { cele: new Set([wyprawa]) }) : [];
  if (wstepne.length === 0) wstepne = planyDlaZalogi(gra, bezZmian.zaloga, ctx);
  obserwator?.(wstepne);
  let { plan: najlepszyPlan, ocena: ocenaWstepna } = ocenPlany(wstepne);
  // Licznik słabych doków (do odwrotu): dok ze znanym rynkiem, w którym nawet najlepszy plan z drugim krokiem nie zarabia
  // (pusty statek w doku bez towaru na sprzedaż ma ujemny pierwszy krok, ale dodatni kurs po nim — to nie jest słaby dok).
  if (gra.rynekZnany(gra.stan.pozycja)) stanBota.slabychDokow = ocenaWstepna > 0 ? 0 : stanBota.slabychDokow + 1;
  if (!wyprawa && ocenaWstepna <= 0) {
    const odwrot = celOdwrotu(gra, stanBota, ctx);
    if (odwrot) {
      const doOdwrotu = planyDlaZalogi(gra, bezZmian.zaloga, ctx, { cele: new Set([odwrot]) });
      if (doOdwrotu.length) najlepszyPlan = ocenPlany(doOdwrotu).plan;
    }
  }
  let najlepszaOpcja: OpcjaZalogi = bezZmian;
  if (najlepszyPlan) {
    const cele = new Set([najlepszyPlan.cel]);
    let najlepszaStopa = najlepszyPlan.naDobe;
    // Progresja: załogant zbiera XP tylko na pokładzie, więc bot toleruje koszt dnia do maxKosztDobyXpKr za zatrudnienie.
    const tolerancja = gra.progresja ? P.bot.maxKosztDobyXpKr : 0;
    let najlepszaOcena = najlepszaStopa;
    for (const opcja of opcjeZalogi(gra)) {
      if (opcja.zatrudnij.length === 0 && opcja.zwolnij.length === 0) continue;
      for (const plan of planyDlaZalogi(gra, opcja.zaloga, ctx, { cele })) {
        const ocena = plan.naDobe + (opcja.zatrudnij.length > 0 ? tolerancja : 0);
        if (ocena > najlepszaOcena && plan.naDobe + tolerancja >= najlepszaStopa) {
          najlepszaOcena = ocena;
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
export function wykonaj(gra: Gra, d: Decyzja, tylkoStart = false): { akcje: Akcja[]; utknal: boolean } {
  const tu = gra.stan.pozycja;
  const akcje: Akcja[] = [];
  const tankuj = (m3: number, rezerwa = 0) => {
    const ile = zaokrPaliwo(Math.min(m3, gra.bak() - gra.stan.paliwo, gra.maxPaliwo(gra.stan.kr - rezerwa)));
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
    if (tylkoStart) gra.wystartuj(trasa);
    else gra.lec(trasa);
    akcje.push({ typ: 'lec', trasa });
    return true;
  };

  /** Lot awaryjny: do najbliższego węzła z paliwem, do którego starczy baku; w ostateczności zwolnij załogę. */
  const lotAwaryjny = (): boolean => {
    tankuj(gra.bak());
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
  // Tanie paliwo: dotankuj do pełna, jeśli cena poniżej progu i zostaje gotówka. W progresji bak bywa kilkakrotnie większy
  // (do 759 m³), więc pełny bak po cenie bazowej kosztowałby miliony: zostaje rezerwa na paliwo i płace całej trasy.
  const rezerwaTankowania = gra.progresja ? rezerwa : plan.placeKr;
  if (gra.maPaliwo() && gra.cenaPaliwaTutaj() <= P.bot.tankujGdyCenaPonizejBazyRazy * K.kurs * K.towary.Fuel.basePrice) tankuj(gra.bak(), rezerwaTankowania);
  // Upewnij się, że paliwa starczy na odcinek (zakupy mogły zjeść gotówkę; w rundzie 3 cięższy statek pali więcej).
  const potrzebnePoZakupach = gra.potrzebnePaliwo(pierwszyDystans);
  if (potrzebnePoZakupach > gra.stan.paliwo + 1e-9) tankuj(Math.ceil((potrzebnePoZakupach - gra.stan.paliwo) * 10) / 10);
  // Runda 3: jeśli z tym ładunkiem pierwszy odcinek nie mieści się w baku, odsprzedaj tutaj najcięższy towar po kawałku.
  if (gra.runda3 && gra.rynekZnany(tu)) {
    for (let proba = 0; proba < 20 && gra.potrzebnePaliwo(pierwszyDystans) > gra.bak() - 1e-9; proba++) {
      const najciezszy = TOWARY.map((t) => ({ t, masa: gra.stan.ladownia[t].m3 * K.towary[t].gestosc })).sort((a, b) => b.masa - a.masa)[0];
      if (!najciezszy || najciezszy.masa <= 0) break;
      const m3 = Math.max(1, Math.floor(gra.stan.ladownia[najciezszy.t].m3 * 0.1));
      gra.sprzedaj(najciezszy.t, Math.min(m3, gra.stan.ladownia[najciezszy.t].m3));
      akcje.push({ typ: 'sprzedaj', towar: najciezszy.t, m3: Math.min(m3, gra.stan.ladownia[najciezszy.t].m3 + m3) });
    }
    const potrzebne = gra.potrzebnePaliwo(pierwszyDystans);
    if (potrzebne > gra.stan.paliwo + 1e-9) tankuj(Math.ceil((potrzebne - gra.stan.paliwo) * 10) / 10);
  }
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
    tankuj(gra.bak());
    if (!lec(plan.pierwszyOdcinek)) return { akcje, utknal: !lotAwaryjny() };
  }
  return { akcje, utknal: false };
}

/**
 * Progresja: inwestycja w kadłub przed planowaniem. W stoczni stolicy bot kupuje kolejny szczebel,
 * gdy ma co najmniej mnoznikGotowkiNaSzczebel × ceny (po sprzedaży ładunku tutaj byłoby więcej, ale liczy się gotówka w kasie).
 */
export function inwestuj(gra: Gra, stanBota: StanBota = nowyStanBota()): Akcja[] {
  const akcje: Akcja[] = [];
  if (!gra.progresja || !gra.wStoczni()) return akcje;
  // W trakcie ekspedycji gotówka jest budżetem na paliwo, nie na kadłub.
  if (stanBota.cel !== null && !gra.rynekZnany(stanBota.cel)) return akcje;
  const doj = dojazdyZ(gra, gra.stan.pozycja, gra.stan.zaloga);
  for (;;) {
    const w = gra.wycenaSzczebla();
    if (!w || w.kwotaKr === null || !stacNaSzczebel(gra, w.kwotaKr, doj)) break;
    if (gra.runda3 && !gra.stoczniaDopuszcza(w.nastepny)) break;
    const z = gra.kupSzczebel();
    akcje.push({ typ: 'kup-szczebel', szczebel: z.szczebel });
  }
  // Runda 3: nowy statek, gdy poziom firmy ma wolne miejsce i gotówka ≥ mnożnik × cena (plus budżet wyjścia).
  if (gra.runda3 && gra.stan.statki.length < gra.limitStatkow()) {
    const cena = P.runda3.firma.cenaNowegoStatkuKr;
    if (gra.stan.kr >= P.bot.mnoznikGotowkiNaStatek * cena && gra.stan.kr - cena >= kosztWyjscia(gra, doj)) {
      const s = gra.kupStatek();
      akcje.push({ typ: 'kup-statek', id: s.id });
    }
  }
  return akcje;
}

/** Jeden obrót pętli: inwestycja (progresja), zaplanuj i wykonaj. */
export function krokBota(gra: Gra, stanBota: StanBota = nowyStanBota(), obserwator?: ObserwatorPlanow): KrokBota {
  const inwestycje = inwestuj(gra, stanBota);
  const decyzja = zaplanuj(gra, stanBota, obserwator);
  const { akcje, utknal } = wykonaj(gra, decyzja);
  // Własne marże (kr/m³) ze sprzedaży w tym doku: wycena przyszłego popytu po awansie opiera się na nich.
  const raport = gra.stan.raporty[gra.stan.raporty.length - 1];
  if (raport && gra.progresja) for (const w of raport.wynikHandlowy) if (w.m3 > 0) (stanBota.marzeNaM3[w.towar] ??= []).push(w.zyskKr / w.m3);
  return { plan: decyzja.plan, opcja: decyzja.opcja, akcje: [...inwestycje, ...akcje], utknal };
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
  /** Dominujący towar trasy handlowej, do której należy lot. */
  towar?: Towar;
  eksploracja: boolean;
  paliwoKr: number;
  placeKr: number;
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
  /** Dominujący towar (największy koszt zakupu na starcie trasy, inaczej największy w ładowni). */
  towar?: Towar;
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
  /** Marża na m³ (przychód − koszt zakupu) z każdej sprzedaży, per towar. */
  marzeNaM3: Record<Towar, number[]>;
  /** Ceny zapłacone za paliwo (kr/m³) przy każdym tankowaniu w doku. */
  cenyPaliwa: number[];
  /** Plany dostępne w dokach (bez eksploracji): dystans, zysk netto na kurs, stopa na dobę. */
  plany: { dystans: number; zysk: number; naDobe: number }[];
  /** Progresja: dziennik ekspedycji bota. */
  ekspedycje: StanBota['ekspedycje'];
}

/** Haki pomiarowe: na starcie, po każdym locie i na końcu rozgrywki (używa ich `bot/progresja.ts`). */
export interface HakiRozgrywki {
  naStarcie?: (gra: Gra) => void;
  poLocie?: (gra: Gra, raport: Raport) => void;
  naKoniec?: (gra: Gra) => void;
}

export function zagrajZiarno(ziarno: string, opcje: OpcjeGry = {}, haki: HakiRozgrywki = {}): WynikZiarna {
  const gra = new Gra(ziarno, opcje);
  haki.naStarcie?.(gra);
  const loty: LotBota[] = [];
  const trasy: TrasaBota[] = [];
  let pierwszy: number | null = null;
  let kontaktDoba: number | null = null;
  let utknal = false;
  const stanBota = nowyStanBota();
  let biezaca: (TrasaBota & { cywStart?: string; wartoscStart: number }) | null = null;
  const marzeNaM3 = {} as Record<Towar, number[]>;
  for (const t of TOWARY) marzeNaM3[t] = [];
  const cenyPaliwa: number[] = [];
  const plany: WynikZiarna['plany'] = [];
  const obserwator: ObserwatorPlanow = (lista) => {
    for (const p of lista) if (!p.eksploracja && p.doby > 0) plany.push({ dystans: p.dystans, zysk: p.zyskNetto, naDobe: p.naDobe });
  };
  while (!gra.stan.koniec) {
    const pozycjaPrzed = gra.stan.pozycja;
    const cywPrzed = gra.wezel(pozycjaPrzed).cywilizacja;
    const ladowniaPrzed = TOWARY.map((t) => ({ t, m3: gra.stan.ladownia[t].m3 })).sort((a, b) => b.m3 - a.m3)[0];
    const krok = krokBota(gra, stanBota, obserwator);
    if (krok.utknal) {
      utknal = true;
      break;
    }
    const raport = gra.stan.raporty[gra.stan.raporty.length - 1];
    // Trasa handlowa: zaczyna się, gdy bot wybiera cel; kończy przylotem do celu.
    if (krok.plan && (!biezaca || biezaca.cel !== krok.plan.cel)) {
      if (biezaca && biezaca.loty > 0) trasy.push(biezaca);
      const najdrozszy = [...krok.plan.zakupy].sort((a, b) => b.kosztKr - a.kosztKr)[0];
      const towar = najdrozszy?.towar ?? (ladowniaPrzed && ladowniaPrzed.m3 > 0 ? ladowniaPrzed.t : undefined);
      biezaca = { cel: krok.plan.cel, dystans: 0, doby: 0, loty: 0, zyskWartosci: 0, miedzyCyw: cywPrzed !== gra.wezel(krok.plan.cel).cywilizacja, eksploracja: krok.plan.eksploracja, towar, cywStart: cywPrzed, wartoscStart: raport.wartoscPrzed };
    }
    for (const w of raport.wynikHandlowy) if (w.m3 > 0) marzeNaM3[w.towar].push(w.zyskKr / w.m3);
    if (raport.paliwo.kupionoM3 > 0) cenyPaliwa.push(raport.paliwo.kosztZakupuKr / raport.paliwo.kupionoM3);
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
      towar: biezaca?.towar,
      eksploracja: krok.plan?.eksploracja ?? false,
      paliwoKr: raport.paliwo.kosztZakupuKr,
      placeKr: Math.round(raport.zaloga.placeNaDobe * raport.doby),
    });
    if (pierwszy === null && raport.wartoscPo > raport.wartoscPrzed) pierwszy = raport.numerLotu;
    if (raport.kontakt && kontaktDoba === null) kontaktDoba = raport.dobaKoniec;
    haki.poLocie?.(gra, raport);
  }
  if (biezaca && biezaca.loty > 0) trasy.push(biezaca);
  haki.naKoniec?.(gra);
  const wartosc = gra.wartoscFirmy();
  return { ziarno, wartoscKoncowa: wartosc, zysk: wartosc > K.startingCredits, loty, trasy, pierwszyZyskownyLot: pierwszy, kontaktDoba, utknal, marzeNaM3, cenyPaliwa, plany, ekspedycje: stanBota.ekspedycje };
}

export { Graf };
