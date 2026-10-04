import { Losowosc } from './losowosc';
import {
  cenaBazowaWU,
  kwotaKupnaWU,
  kwotaPaliwaWU,
  kwotaSprzedazyWU,
  krokRynku,
  mnoznikKupna,
  mnoznikSprzedazy,
  nacisk,
  zapasPo,
} from './rynek';
import { K, P, kr } from './stale';
import { generujSwiat } from './swiat';
import { Graf, odleglosc } from './trasa';
import { aktualizujZaloganta, efektyZalogi, generujKandydatow, tierZalogi } from './zaloga';
import {
  TOWARY,
  TOWARY_I_PALIWO,
  type Ceny,
  type EfektyZalogi,
  type InformacjaORynku,
  type LiniaRaportu,
  type OpcjeGry,
  type Osiagalny,
  type PostepAwansu,
  type PozycjaLadowni,
  type Raport,
  type Rynek,
  type Skala,
  type Swiat,
  type Towar,
  type Transakcja,
  type TrybInformacji,
  type WariantSpreadu,
  type Wezel,
  type Wycena,
  type WycenaSzczebla,
  type WynikHandlowy,
  type Zalogant,
} from './typy';

const EPS = 1e-9;

export interface Odczyt {
  doba: number;
  rynek: Rynek;
}

export interface Stan {
  doba: number;
  kr: number;
  paliwo: number;
  pozycja: string;
  ladownia: Record<Towar, PozycjaLadowni>;
  zaloga: Zalogant[];
  kandydaci: Zalogant[];
  rynki: Record<string, Rynek>;
  znaneCywilizacje: Record<string, boolean>;
  wizyty: Record<string, number>;
  /** Ostatnie odczyty rynków odwiedzonych planet (tryb informacji `zasieg`). */
  odczyty: Record<string, Odczyt>;
  /** Pamięć zakupu: klucz „planeta|towar” → licznik skoków (bez ceny kupna). */
  pamiecZakupu: Record<string, number>;
  numerLotu: number;
  koniec: boolean;
  raporty: Raport[];
  // ---- Progresja (bez progresji pola stoją: tier 1, szczebel 0, puste liczniki) ----
  /** Tier każdej cywilizacji (1…TierCount); podnosi go tylko gracz dostawą koszyka. */
  tiery: Record<string, number>;
  /** Dostawy koszyka kolejnego tieru per cywilizacja: towar → wartość po cenie bazowej (WU). */
  dostawy: Record<string, Partial<Record<Towar, number>>>;
  /** Szczebel drabiny kadłubów (0…szczebli−1). */
  szczebel: number;
  /** Zyski na kurs (kr) zmierzone na każdym szczeblu; kurs = loty między kolejnymi dokami ze sprzedażą. */
  zyskiKursow: Record<number, number[]>;
  /** Bieżący kurs: wartość firmy przy przylocie do ostatniego doku ze sprzedażą, szczebel i wydatki na kadłub od tej chwili. */
  kursStart: { wartosc: number; szczebel: number; kadlubKr: number };
  wydanoNaKadlub: number;
  /** Kamienie milowe: klucz → doba pierwszego osiągnięcia. */
  kamienie: Record<string, number>;
}

interface Okres {
  transakcje: Transakcja[];
  paliwoKupioneM3: number;
  paliwoKosztKr: number;
  saldoNaStarcie: number;
  wartoscNaStarcie: number;
  kadlub: { szczebel: number; kwotaKr: number } | null;
  awanse: { cywilizacja: string; nazwa: string; tier: number }[];
}

function zaokr(x: number): number {
  return Math.round(x);
}

function mediana(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
}

function kopiaRynku(r: Rynek): Rynek {
  const k = {} as Rynek;
  for (const t of TOWARY_I_PALIWO) k[t] = { ...r[t] };
  return k;
}

/** Gra: czysta symulacja bez DOM. UI i bot wywołują wyłącznie jej metody. */
export class Gra {
  readonly swiat: Swiat;
  readonly graf: Graf;
  readonly stan: Stan;
  readonly skala: Skala;
  readonly informacja: TrybInformacji;
  readonly limitDob: number;
  readonly wariantSpreadu: WariantSpreadu;
  /** Spread podstawowy wariantu: A = tradeSpread na każdej transakcji, B/D/E = 0, C = 0,10. */
  readonly spreadPodstawowy: number;
  /** Czy nacisk jest obcinany do [StockPressureMin, StockPressureMax] (wariant E: nie). */
  readonly obciecieNacisku: boolean;
  /** Progresja: tiery cywilizacji, drabina kadłubów, XP załogi. */
  readonly progresja: boolean;
  private okres!: Okres;
  private readonly rng: Losowosc;

  constructor(ziarno: string, opcje: OpcjeGry = {}) {
    this.skala = opcje.skala ?? P.skala;
    this.informacja = opcje.informacja ?? P.informacja;
    this.progresja = opcje.progresja ?? P.progresja.wlaczona;
    this.limitDob = opcje.limitDob ?? (this.progresja ? P.progresja.horyzontDob : P.skale[this.skala].limitDob);
    this.wariantSpreadu = opcje.spread ?? P.spread;
    const konfig = P.wariantySpreadu[this.wariantSpreadu];
    this.spreadPodstawowy = konfig.tryb === 'staly' ? K.tradeSpread : (konfig.spreadPodstawowy ?? 0);
    this.obciecieNacisku = !konfig.bezObcieciaNacisku;
    const { swiat, rynki } = generujSwiat(ziarno, this.skala);
    this.swiat = swiat;
    this.graf = new Graf(swiat.wezly, swiat.krawedzie);
    this.rng = new Losowosc(ziarno);
    const ladownia = {} as Record<Towar, PozycjaLadowni>;
    for (const t of TOWARY) ladownia[t] = { m3: 0, kosztKr: 0, pochodzenie: {} };
    const znane: Record<string, boolean> = {};
    const tiery: Record<string, number> = {};
    const dostawy: Record<string, Partial<Record<Towar, number>>> = {};
    for (const c of swiat.cywilizacje) {
      znane[c.id] = c.znanaNaStarcie;
      tiery[c.id] = 1;
      dostawy[c.id] = {};
    }
    this.stan = {
      doba: 0,
      kr: K.startingCredits,
      paliwo: K.bak,
      pozycja: swiat.startId,
      ladownia,
      zaloga: [],
      kandydaci: [],
      rynki,
      znaneCywilizacje: znane,
      wizyty: {},
      odczyty: {},
      pamiecZakupu: {},
      numerLotu: 0,
      koniec: false,
      raporty: [],
      tiery,
      dostawy,
      szczebel: 0,
      zyskiKursow: { 0: [] },
      kursStart: { wartosc: K.startingCredits, szczebel: 0, kadlubKr: 0 },
      wydanoNaKadlub: 0,
      kamienie: {},
    };
    this.zadokuj();
  }

  // ---------- Kadłub (drabina) ----------

  private mnoznikKadluba(): number {
    return Math.pow(P.progresja.mnoznikSzczebla, this.stan.szczebel);
  }

  /** Pojemność ładowni (m³) na bieżącym szczeblu: BaseShip × mnoznikSzczebla^N. */
  ladownia(): number {
    return K.ladownia * this.mnoznikKadluba();
  }

  bak(): number {
    return K.bak * this.mnoznikKadluba();
  }

  maxMasa(): number {
    return K.maxMasaLadunku * this.mnoznikKadluba();
  }

  /** Czy stoimy w doku stolicy znanej cywilizacji (tylko tam działa stocznia). */
  wStoczni(idWezla: string = this.stan.pozycja): boolean {
    const w = this.wezel(idWezla);
    if (w.typ !== 'planeta' || !this.cywilizacjaZnana(w.cywilizacja)) return false;
    return this.cywilizacja(w.cywilizacja)!.stolica === idWezla;
  }

  /**
   * Wycena kolejnego szczebla: k × mediana zysku na kurs zmierzona na bieżącym szczeblu (potrzeba
   * co najmniej `minKursowDoWycenySzczebla` kursów o dodatniej medianie). Kurs = loty między kolejnymi dokami ze sprzedażą.
   */
  wycenaSzczebla(): WycenaSzczebla | null {
    if (!this.progresja) return null;
    const nastepny = this.stan.szczebel + 1;
    if (nastepny >= K.drabinaKadlubow.szczebli) return null;
    const m = Math.pow(P.progresja.mnoznikSzczebla, nastepny);
    const zyski = this.stan.zyskiKursow[this.stan.szczebel] ?? [];
    const baza = { nastepny, kursow: zyski.length, ladowniaM3: K.ladownia * m, bakM3: K.bak * m };
    if (zyski.length < P.progresja.minKursowDoWycenySzczebla) {
      return { ...baza, kwotaKr: null, medianaZyskuKr: null, powod: `stocznia wycenia kadłub po ${P.progresja.minKursowDoWycenySzczebla} kursach na obecnym szczeblu (masz ${zyski.length})` };
    }
    const med = mediana(zyski);
    if (!(med > 0)) return { ...baza, kwotaKr: null, medianaZyskuKr: med, powod: 'mediana zysku na kurs nie jest dodatnia' };
    return { ...baza, kwotaKr: zaokr(P.progresja.k * med), medianaZyskuKr: med };
  }

  /** Kupno kolejnego szczebla w stoczni stolicy: ładownia, bak i masa rosną × mnoznikSzczebla; paliwo i ładunek zostają. */
  kupSzczebel(): { szczebel: number; kwotaKr: number } {
    if (!this.progresja) throw new Error('Drabina kadłubów działa tylko w trybie progresji');
    if (!this.wStoczni()) throw new Error('Stocznia jest tylko w doku stolicy');
    const w = this.wycenaSzczebla();
    if (!w) throw new Error('To już najwyższy szczebel');
    if (w.kwotaKr === null) throw new Error(w.powod ?? 'Brak wyceny');
    if (w.kwotaKr > this.stan.kr) throw new Error('Brak gotówki');
    this.stan.kr -= w.kwotaKr;
    this.stan.szczebel = w.nastepny;
    this.stan.zyskiKursow[w.nastepny] ??= [];
    this.stan.wydanoNaKadlub += w.kwotaKr;
    this.stan.kursStart.kadlubKr += w.kwotaKr;
    this.okres.kadlub = { szczebel: w.nastepny, kwotaKr: w.kwotaKr };
    this.kamien(`szczebel:${w.nastepny}`);
    return { szczebel: w.nastepny, kwotaKr: w.kwotaKr };
  }

  private kamien(klucz: string): void {
    if (this.stan.kamienie[klucz] === undefined) this.stan.kamienie[klucz] = this.stan.doba;
  }

  // ---------- Tiery cywilizacji ----------

  tierCywilizacji(idCyw: string): number {
    return this.stan.tiery[idCyw] ?? 1;
  }

  /** Koszyk kolejnego tieru cywilizacji (null na najwyższym tierze albo bez progresji). */
  koszykTieru(idCyw: string) {
    if (!this.progresja) return null;
    const nastepny = this.tierCywilizacji(idCyw) + 1;
    if (nastepny > K.TierCount) return null;
    return P.progresja.koszyki.find((k) => k.tier === nastepny) ?? null;
  }

  /** Dzienny „PKB” portów cywilizacji: konsumpcja (łącznie z uśpioną) × cena bazowa, w WU/dobę. */
  pkbDobowyWU(idCyw: string): number {
    const cyw = this.cywilizacja(idCyw);
    if (!cyw) return 0;
    let suma = 0;
    for (const id of cyw.planety) {
      for (const t of TOWARY_I_PALIWO) {
        const poz = this.stan.rynki[id][t];
        suma += (poz.konsumpcja + poz.konsumpcjaUspiona) * K.towary[t].basePrice;
      }
    }
    return suma;
  }

  /** Postęp awansu: próg = progAwansu × mnożnik tieru × PKB, podzielony między towary koszyka według udziałów. */
  postepAwansu(idCyw: string): PostepAwansu {
    const tier = this.tierCywilizacji(idCyw);
    const koszyk = this.koszykTieru(idCyw);
    const pkbWU = this.pkbDobowyWU(idCyw);
    if (!koszyk) return { tier, nastepny: null, pkbWU, progWU: 0, towary: [], udzial: 1 };
    const progWU = P.progresja.progAwansu * koszyk.mnoznikProgu * pkbWU;
    const dostawy = this.stan.dostawy[idCyw] ?? {};
    const towary = (Object.keys(koszyk.udzialy) as Towar[]).map((towar) => ({
      towar,
      potrzebneWU: progWU * (koszyk.udzialy[towar] ?? 0),
      dostarczoneWU: dostawy[towar] ?? 0,
    }));
    const udzial = Math.min(...towary.map((x) => (x.potrzebneWU > 0 ? x.dostarczoneWU / x.potrzebneWU : 1)));
    return { tier, nastepny: koszyk.tier, pkbWU, progWU, towary, udzial };
  }

  /** Zalicza sprzedaż towaru koszyka na planecie cywilizacji; przy pełnym koszyku awansuje tier. */
  private zaliczDostawe(idCyw: string, towar: Towar, m3: number): void {
    const koszyk = this.koszykTieru(idCyw);
    if (!koszyk || !(koszyk.udzialy[towar]! > 0)) return;
    const d = (this.stan.dostawy[idCyw] ??= {});
    d[towar] = (d[towar] ?? 0) + m3 * K.towary[towar].basePrice;
    const postep = this.postepAwansu(idCyw);
    if (postep.udzial < 1 - EPS) return;
    // Awans: konsumpcja i norma towarów koszyka rosną na wszystkich planetach cywilizacji; produkcja bez zmian.
    const cyw = this.cywilizacja(idCyw)!;
    const m = P.progresja.mnoznikKonsumpcjiAwansu;
    for (const t of Object.keys(koszyk.udzialy) as Towar[]) {
      for (const id of cyw.planety) {
        const poz = this.stan.rynki[id][t];
        poz.konsumpcja *= m;
        poz.konsumpcjaUspiona *= m;
        poz.norma *= m;
      }
      cyw.potrzebyM3NaDobe[t] *= m;
    }
    this.stan.tiery[idCyw] = koszyk.tier;
    this.stan.dostawy[idCyw] = {};
    this.okres.awanse.push({ cywilizacja: idCyw, nazwa: cyw.nazwa, tier: koszyk.tier });
    this.kamien(`tier:${idCyw}:${koszyk.tier}`);
    this.kamien(`cywilizacja:pierwsza:T${koszyk.tier}`);
    const n = this.swiat.cywilizacje.length;
    const naSzczycie = this.swiat.cywilizacje.filter((c) => this.tierCywilizacji(c.id) >= K.TierCount).length;
    if (naSzczycie >= Math.ceil(n / 2)) this.kamien(`cywilizacja:polowa:T${K.TierCount}`);
    if (naSzczycie >= n) this.kamien(`cywilizacja:wszystkie:T${K.TierCount}`);
  }

  // ---------- XP załogi ----------

  /** Dodaje XP wszystkim załogantom (tryb progresji), aktualizuje tier, umiejętność i płacę, zapisuje kamienie. */
  private dodajXP(xp: number): void {
    if (!this.progresja || xp <= 0) return;
    for (const z of this.stan.zaloga) {
      if (z.xp === undefined) continue;
      const przed = tierZalogi(z.xp);
      z.xp += xp;
      aktualizujZaloganta(z);
      const po = tierZalogi(z.xp);
      for (let t = przed + 1; t <= po; t++) this.kamien(`zaloga:tier:${t}`);
    }
    const szczyt = K.TierCount - 1;
    if (this.stan.zaloga.length >= K.miejscaZalogi && this.stan.zaloga.every((z) => z.xp !== undefined && tierZalogi(z.xp) >= szczyt)) this.kamien('zaloga:wszyscy:legenda');
  }

  // ---------- Odczyt świata ----------

  wezel(id: string = this.stan.pozycja): Wezel {
    const w = this.graf.wezly.get(id);
    if (!w) throw new Error(`Nieznany węzeł ${id}`);
    return w;
  }

  cywilizacja(id: string | undefined) {
    return this.swiat.cywilizacje.find((c) => c.id === id);
  }

  cywilizacjaZnana(idCyw: string | undefined): boolean {
    return !!idCyw && !!this.stan.znaneCywilizacje[idCyw];
  }

  /** Czy węzeł ma rynek, który gracz może poznać (planeta znanej cywilizacji). */
  rynekZnany(idWezla: string): boolean {
    const w = this.wezel(idWezla);
    return w.typ === 'planeta' && this.cywilizacjaZnana(w.cywilizacja);
  }

  /** Czy węzeł sprzedaje paliwo (planeta albo plemiona; układ przelotowy nie). */
  maPaliwo(idWezla: string = this.stan.pozycja): boolean {
    return this.wezel(idWezla).typ !== 'przelot';
  }

  /** Odległość w linii prostej od statku (łączność). */
  odlegloscOdStatku(idWezla: string): number {
    return odleglosc(this.wezel(), this.wezel(idWezla));
  }

  wLacznosci(idWezla: string): boolean {
    return idWezla === this.stan.pozycja || this.odlegloscOdStatku(idWezla) <= K.zasiegLacznosci + EPS;
  }

  /**
   * Co gracz wie o rynku planety. Tryb `pelna`: wszystko na żywo. Tryb `zasieg`: na żywo w zasięgu łączności,
   * poza nim ostatni odczyt z odwiedzonej planety (z wiekiem), a nieodwiedzonej planety nie widać wcale.
   */
  informacjaORynku(idWezla: string): InformacjaORynku | null {
    if (!this.rynekZnany(idWezla)) return null;
    if (this.informacja === 'pelna' || this.wLacznosci(idWezla)) return { tryb: 'zywa', rynek: this.stan.rynki[idWezla], wiekDob: 0 };
    const o = this.stan.odczyty[idWezla];
    if (!o) return null;
    return { tryb: 'odczyt', rynek: o.rynek, wiekDob: this.stan.doba - o.doba };
  }

  efekty(zaloga: readonly Zalogant[] = this.stan.zaloga): EfektyZalogi {
    return efektyZalogi(zaloga);
  }

  private kluczPamieci(idWezla: string, towar: Towar): string {
    return `${idWezla}|${towar}`;
  }

  /** Licznik pamięci zakupu pary (planeta, towar) po `skokiWPrzod` kolejnych skokach. */
  licznikPamieci(idWezla: string, towar: Towar, skokiWPrzod = 0): number {
    return Math.max(0, (this.stan.pamiecZakupu[this.kluczPamieci(idWezla, towar)] ?? 0) - skokiWPrzod);
  }

  /**
   * Kara za odsprzedaż w miejscu zakupu (ułamek ceny sprzedaży): wariant A nie ma kary (spread stały),
   * schodek = pełne tradeSpread dopóki licznik > 0, liniowy = tradeSpread × licznik / pamiecZakupuSkokow.
   */
  karaSprzedazy(idWezla: string, towar: Towar, skokiWPrzod = 0): number {
    const konfig = P.wariantySpreadu[this.wariantSpreadu];
    if (konfig.tryb !== 'pamiec') return 0;
    const licznik = this.licznikPamieci(idWezla, towar, skokiWPrzod);
    if (licznik <= 0) return 0;
    return konfig.kara === 'liniowy' ? (K.tradeSpread * licznik) / P.pamiecZakupuSkokow : K.tradeSpread;
  }

  /** Ceny jednostkowe towaru (kr/m³) według tego, co gracz wie o planecie. */
  ceny(idWezla: string, towar: Towar, udzial = this.efekty().udzialHandlowca, skokiWPrzod = 0): Ceny | null {
    const info = this.informacjaORynku(idWezla);
    if (!info) return null;
    const poz = info.rynek[towar];
    const baza = cenaBazowaWU(K.towary[towar].basePrice, poz, this.obciecieNacisku);
    const kara = this.karaSprzedazy(idWezla, towar, skokiWPrzod);
    return {
      kupnoKr: kr(baza * mnoznikKupna(udzial, this.spreadPodstawowy)),
      sprzedazKr: kr(baza * mnoznikSprzedazy(udzial, this.spreadPodstawowy, kara)),
      kara,
      licznikPamieci: this.licznikPamieci(idWezla, towar, skokiWPrzod),
      bazowaKr: kr(baza),
      nacisk: nacisk(poz.zapas / poz.norma, this.obciecieNacisku),
      zapasM3: poz.zapas,
      normaM3: poz.norma,
      zapasDoby: poz.konsumpcja > 0 ? poz.zapas / poz.konsumpcja : Infinity,
      bilansNaDobe: poz.produkcja - poz.konsumpcja,
      informacja: info.tryb,
      wiekDob: info.wiekDob,
    };
  }

  /** Cena jednostkowa paliwa w węźle (kr/m³); null, gdy nie ma paliwa albo brak informacji. */
  cenaPaliwa(idWezla: string = this.stan.pozycja): number | null {
    const w = this.wezel(idWezla);
    if (w.typ === 'przelot') return null;
    if (w.typ === 'tankowanie') return kr(K.towary.Fuel.basePrice);
    if (idWezla === this.stan.pozycja) return kr(cenaBazowaWU(K.towary.Fuel.basePrice, this.stan.rynki[idWezla].Fuel, this.obciecieNacisku));
    const info = this.informacjaORynku(idWezla);
    if (!info) return null;
    return kr(cenaBazowaWU(K.towary.Fuel.basePrice, info.rynek.Fuel, this.obciecieNacisku));
  }

  /** Cena paliwa tutaj; w układzie bez paliwa cena bazowa (do wycen odniesienia). */
  cenaPaliwaTutaj(): number {
    return this.cenaPaliwa() ?? kr(K.towary.Fuel.basePrice);
  }

  // ---------- Wyceny (bez mutacji) ----------

  private wycenaNaRynku(towar: Towar, m3: number, rodzaj: 'kupno' | 'sprzedaz', udzial: number, rynek: Rynek[Towar], kara = 0): Wycena {
    const base = K.towary[towar].basePrice;
    const sp = this.spreadPodstawowy;
    const ob = this.obciecieNacisku;
    const znak = rodzaj === 'kupno' ? -1 : 1;
    const po = { ...rynek, zapas: rynek.zapas + znak * m3 };
    const kwotaWU = rodzaj === 'kupno' ? kwotaKupnaWU(base, rynek, m3, udzial, sp, ob) : kwotaSprzedazyWU(base, rynek, m3, udzial, sp, kara, ob);
    const kwotaBezWU = rodzaj === 'kupno' ? kwotaKupnaWU(base, rynek, m3, 0, sp, ob) : kwotaSprzedazyWU(base, rynek, m3, 0, sp, kara, ob);
    const kwotaBezKaryWU = rodzaj === 'kupno' ? kwotaBezWU : kwotaSprzedazyWU(base, rynek, m3, 0, sp, 0, ob);
    const mn = rodzaj === 'kupno' ? mnoznikKupna(udzial, sp) : mnoznikSprzedazy(udzial, sp, kara);
    const kwotaKr = zaokr(kr(kwotaWU));
    return {
      m3,
      kwotaKr,
      cenaSredniaKr: m3 > 0 ? kwotaKr / m3 : 0,
      cenaJednPrzedKr: kr(cenaBazowaWU(base, rynek, ob) * mn),
      cenaJednPoKr: kr(cenaBazowaWU(base, po, ob) * mn),
      naciskPrzed: nacisk(rynek.zapas / rynek.norma, ob),
      naciskPo: nacisk(po.zapas / po.norma, ob),
      kwotaBezHandlowcaKr: zaokr(kr(kwotaBezWU)),
      kwotaBezKaryKr: zaokr(kr(kwotaBezKaryWU)),
      kara,
    };
  }

  private rynekDoWyceny(idWezla: string): Rynek {
    if (idWezla === this.stan.pozycja) {
      if (!this.rynekZnany(idWezla)) throw new Error('Tu nie ma rynku');
      return this.stan.rynki[idWezla];
    }
    const info = this.informacjaORynku(idWezla);
    if (!info) throw new Error('Brak informacji o tym rynku');
    return info.rynek;
  }

  wycenaKupna(towar: Towar, m3: number, idWezla = this.stan.pozycja, udzial = this.efekty().udzialHandlowca): Wycena {
    return this.wycenaNaRynku(towar, m3, 'kupno', udzial, this.rynekDoWyceny(idWezla)[towar]);
  }

  /** Wycena sprzedaży tutaj albo na innej planecie; `skokiWPrzod` to skoki do wykonania przed sprzedażą (licznik pamięci maleje). */
  wycenaSprzedazy(towar: Towar, m3: number, idWezla = this.stan.pozycja, udzial = this.efekty().udzialHandlowca, skokiWPrzod = 0): Wycena {
    return this.wycenaNaRynku(towar, m3, 'sprzedaz', udzial, this.rynekDoWyceny(idWezla)[towar], this.karaSprzedazy(idWezla, towar, skokiWPrzod));
  }

  /** Wycena sprzedaży na planecie za `doby` dób: odczyt na żywo rzutowany w przód, stary odczyt bez rzutowania. */
  wycenaSprzedazyZa(towar: Towar, m3: number, idWezla: string, doby: number, udzial = this.efekty().udzialHandlowca, skokiWPrzod = 0): Wycena {
    const info = idWezla === this.stan.pozycja ? ({ tryb: 'zywa', rynek: this.rynekDoWyceny(idWezla), wiekDob: 0 } as InformacjaORynku) : this.informacjaORynku(idWezla);
    if (!info) throw new Error('Brak informacji o tym rynku');
    const rynek = info.tryb === 'zywa' ? zapasPo(info.rynek[towar], doby) : info.rynek[towar];
    return this.wycenaNaRynku(towar, m3, 'sprzedaz', udzial, rynek, this.karaSprzedazy(idWezla, towar, skokiWPrzod));
  }

  wycenaPaliwa(m3: number, idWezla = this.stan.pozycja): { m3: number; kwotaKr: number; cenaSredniaKr: number } {
    const w = this.wezel(idWezla);
    if (w.typ === 'przelot') return { m3, kwotaKr: 0, cenaSredniaKr: 0 };
    const kwotaWU = w.typ === 'tankowanie' ? K.towary.Fuel.basePrice * m3 : kwotaPaliwaWU(this.stan.rynki[idWezla].Fuel, m3, this.obciecieNacisku);
    const kwotaKr = zaokr(kr(kwotaWU));
    return { m3, kwotaKr, cenaSredniaKr: m3 > 0 ? kwotaKr / m3 : 0 };
  }

  objetoscZajeta(): number {
    return TOWARY.reduce((s, t) => s + this.stan.ladownia[t].m3, 0);
  }

  masaZajeta(): number {
    return TOWARY.reduce((s, t) => s + this.stan.ladownia[t].m3 * K.towary[t].gestosc, 0);
  }

  /** Największa ilość towaru, jaką da się tu kupić: zapas, objętość, masa i gotówka. */
  maxKupno(towar: Towar, gotowka = this.stan.kr, idWezla = this.stan.pozycja, udzial = this.efekty().udzialHandlowca): number {
    if (!this.rynekZnany(idWezla)) return 0;
    const poz = this.rynekDoWyceny(idWezla)[towar];
    const g = K.towary[towar].gestosc;
    let hi = Math.min(poz.zapas, this.ladownia() - this.objetoscZajeta(), (this.maxMasa() - this.masaZajeta()) / g);
    hi = Math.max(0, hi);
    if (this.wycenaKupna(towar, hi, idWezla, udzial).kwotaKr <= gotowka) return hi;
    let lo = 0;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (this.wycenaKupna(towar, mid, idWezla, udzial).kwotaKr <= gotowka) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  maxPaliwo(gotowka = this.stan.kr): number {
    if (!this.maPaliwo()) return 0;
    let hi = Math.max(0, this.bak() - this.stan.paliwo);
    if (this.wycenaPaliwa(hi).kwotaKr <= gotowka) return hi;
    let lo = 0;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (this.wycenaPaliwa(mid).kwotaKr <= gotowka) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  potrzebnePaliwo(dystansPc: number, zaloga: readonly Zalogant[] = this.stan.zaloga): number {
    return dystansPc * K.kosztPaliwaNaParsek * this.efekty(zaloga).mnoznikPaliwa;
  }

  /** Węzły osiągalne z bieżącej pozycji na obecnym paliwie, najkrótszą ścieżką. */
  zasieg(paliwo = this.stan.paliwo, zaloga: readonly Zalogant[] = this.stan.zaloga): Map<string, Osiagalny> {
    const mnoznik = this.efekty(zaloga).mnoznikPaliwa;
    const maxDystans = paliwo / (K.kosztPaliwaNaParsek * mnoznik) + EPS;
    const d = this.graf.dijkstra(this.stan.pozycja, maxDystans);
    const wynik = new Map<string, Osiagalny>();
    for (const [id, w] of d) {
      const potrzebne = w.dystans * K.kosztPaliwaNaParsek * mnoznik;
      if (potrzebne <= paliwo + EPS) wynik.set(id, { id, dystans: w.dystans, paliwo: potrzebne, sciezka: Graf.sciezkaZ(d, id)! });
    }
    return wynik;
  }

  /** Wartość firmy = kr + ładunek po cenie sprzedaży w bieżącym doku (bez rynku: po koszcie zakupu). */
  wartoscFirmy(): number {
    return this.stan.kr + this.wartoscLadowni();
  }

  wartoscLadowni(): number {
    const tu = this.stan.pozycja;
    let suma = 0;
    for (const t of TOWARY) {
      const poz = this.stan.ladownia[t];
      if (poz.m3 <= 0) continue;
      suma += this.rynekZnany(tu) ? this.wycenaSprzedazy(t, poz.m3).kwotaKr : zaokr(poz.kosztKr);
    }
    return suma;
  }

  celWartosci(): number {
    return K.startingCredits * P.celMnoznikWartosci;
  }

  // ---------- Akcje w doku ----------

  kup(towar: Towar, m3: number): Transakcja {
    const tu = this.stan.pozycja;
    if (!this.rynekZnany(tu)) throw new Error('Tu nie ma rynku');
    if (!(m3 > 0) || !Number.isFinite(m3)) throw new Error('Ilość musi być dodatnia');
    const poz = this.stan.rynki[tu][towar];
    if (m3 > poz.zapas + EPS) throw new Error('Planeta nie ma tyle w zapasie');
    if (this.objetoscZajeta() + m3 > this.ladownia() + EPS) throw new Error('Brak miejsca w ładowni');
    if (this.masaZajeta() + m3 * K.towary[towar].gestosc > this.maxMasa() + EPS) throw new Error('Przekroczona masa ładunku');
    const w = this.wycenaKupna(towar, m3);
    if (w.kwotaKr > this.stan.kr) throw new Error('Brak gotówki');
    this.stan.kr -= w.kwotaKr;
    poz.zapas -= m3;
    const l = this.stan.ladownia[towar];
    l.m3 += m3;
    l.kosztKr += w.kwotaKr;
    // Pochodzenie ładunku (cywilizacja zakupu): dostawa koszyka awansu liczy tylko towar kupiony u innej cywilizacji.
    const cywTu = this.wezel(tu).cywilizacja ?? '';
    l.pochodzenie[cywTu] = (l.pochodzenie[cywTu] ?? 0) + m3;
    // Pamięć zakupu: (towar, planeta, licznik skoków) bez ceny kupna.
    this.stan.pamiecZakupu[this.kluczPamieci(tu, towar)] = P.pamiecZakupuSkokow;
    const t: Transakcja = {
      rodzaj: 'kupno',
      planeta: tu,
      towar,
      m3,
      kwotaKr: w.kwotaKr,
      kwotaBezHandlowcaKr: w.kwotaBezHandlowcaKr,
      kwotaBezKaryKr: w.kwotaBezKaryKr,
      cenaJednPrzedKr: w.cenaJednPrzedKr,
      cenaJednPoKr: w.cenaJednPoKr,
      naciskPrzed: w.naciskPrzed,
      naciskPo: w.naciskPo,
    };
    this.okres.transakcje.push(t);
    return t;
  }

  sprzedaj(towar: Towar, m3: number): Transakcja {
    const tu = this.stan.pozycja;
    if (!this.rynekZnany(tu)) throw new Error('Tu nie ma rynku');
    if (!(m3 > 0) || !Number.isFinite(m3)) throw new Error('Ilość musi być dodatnia');
    const l = this.stan.ladownia[towar];
    if (m3 > l.m3 + EPS) throw new Error('Nie masz tyle w ładowni');
    m3 = Math.min(m3, l.m3);
    // Pierwsza sprzedaż w tym doku zamyka kurs: zysk = wartość przy przylocie tutaj − wartość przy przylocie do poprzedniego doku ze sprzedażą (+ wydatki na kadłub).
    if (!this.okres.transakcje.some((t) => t.rodzaj === 'sprzedaz')) {
      const ks = this.stan.kursStart;
      (this.stan.zyskiKursow[ks.szczebel] ??= []).push(this.okres.wartoscNaStarcie - ks.wartosc + ks.kadlubKr);
      this.stan.kursStart = { wartosc: this.okres.wartoscNaStarcie, szczebel: this.stan.szczebel, kadlubKr: 0 };
    }
    const w = this.wycenaSprzedazy(towar, m3);
    const kosztZakupu = zaokr((l.kosztKr * m3) / l.m3);
    const cywTu = this.wezel(tu).cywilizacja ?? '';
    // Sprzedana ilość schodzi z pochodzenia proporcjonalnie; do koszyka liczy się część kupiona u innych cywilizacji.
    const udzialSprzedany = m3 / l.m3;
    let dostawaM3 = 0;
    for (const c of Object.keys(l.pochodzenie)) {
      const czesc = l.pochodzenie[c] * udzialSprzedany;
      if (c !== cywTu) dostawaM3 += czesc;
      l.pochodzenie[c] -= czesc;
      if (l.pochodzenie[c] < EPS) delete l.pochodzenie[c];
    }
    this.stan.kr += w.kwotaKr;
    this.stan.rynki[tu][towar].zapas += m3;
    l.kosztKr -= kosztZakupu;
    l.m3 -= m3;
    if (l.m3 < EPS) {
      l.m3 = 0;
      l.kosztKr = 0;
      l.pochodzenie = {};
    }
    const t: Transakcja = {
      rodzaj: 'sprzedaz',
      planeta: tu,
      towar,
      m3,
      kwotaKr: w.kwotaKr,
      kwotaBezHandlowcaKr: w.kwotaBezHandlowcaKr,
      kwotaBezKaryKr: w.kwotaBezKaryKr,
      cenaJednPrzedKr: w.cenaJednPrzedKr,
      cenaJednPoKr: w.cenaJednPoKr,
      naciskPrzed: w.naciskPrzed,
      naciskPo: w.naciskPo,
      kosztZakupuKr: kosztZakupu,
    };
    this.okres.transakcje.push(t);
    if (this.progresja && cywTu && dostawaM3 > EPS) this.zaliczDostawe(cywTu, towar, dostawaM3);
    return t;
  }

  tankuj(m3: number): { m3: number; kwotaKr: number } {
    if (!(m3 > 0) || !Number.isFinite(m3)) throw new Error('Ilość musi być dodatnia');
    if (!this.maPaliwo()) throw new Error('W układzie przelotowym nie ma paliwa');
    if (this.stan.paliwo + m3 > this.bak() + EPS) throw new Error('Bak nie pomieści tyle paliwa');
    const w = this.wezel();
    const wyc = this.wycenaPaliwa(m3);
    if (wyc.kwotaKr > this.stan.kr) throw new Error('Brak gotówki');
    this.stan.kr -= wyc.kwotaKr;
    this.stan.paliwo = Math.min(this.bak(), this.stan.paliwo + m3);
    // Paliwo jest zawsze dostępne: przy pustym zapasie planeta sprzedaje po cenie maksymalnej z wzoru.
    if (w.typ === 'planeta') {
      const poz = this.stan.rynki[w.id].Fuel;
      poz.zapas = Math.max(0, poz.zapas - m3);
    }
    this.okres.paliwoKupioneM3 += m3;
    this.okres.paliwoKosztKr += wyc.kwotaKr;
    return { m3, kwotaKr: wyc.kwotaKr };
  }

  zatrudnij(idKandydata: string): Zalogant {
    const i = this.stan.kandydaci.findIndex((k) => k.id === idKandydata);
    if (i < 0) throw new Error('Nie ma takiego kandydata');
    if (this.stan.zaloga.length >= K.miejscaZalogi) throw new Error('Brak wolnych miejsc w załodze');
    const [z] = this.stan.kandydaci.splice(i, 1);
    this.stan.zaloga.push(z);
    return z;
  }

  zwolnij(idZaloganta: string): Zalogant {
    const i = this.stan.zaloga.findIndex((z) => z.id === idZaloganta);
    if (i < 0) throw new Error('Nie ma takiego załoganta');
    const [z] = this.stan.zaloga.splice(i, 1);
    return z;
  }

  // ---------- Lot ----------

  sprawdzTrase(trasa: string[]): { dystans: number; doby: number; paliwo: number; blad?: string } {
    const ef = this.efekty();
    try {
      if (trasa.length < 2) return { dystans: 0, doby: 0, paliwo: 0, blad: 'Wybierz cel na mapie' };
      if (trasa[0] !== this.stan.pozycja) return { dystans: 0, doby: 0, paliwo: 0, blad: 'Trasa musi zaczynać się tutaj' };
      const dystans = this.graf.dlugoscTrasy(trasa);
      const paliwo = this.potrzebnePaliwo(dystans);
      const doby = dystans / ef.predkosc;
      if (paliwo > this.stan.paliwo + EPS) return { dystans, doby, paliwo, blad: 'Za mało paliwa na tę trasę' };
      const place = Math.round(ef.placeNaDobe * doby);
      if (place > this.stan.kr) return { dystans, doby, paliwo, blad: `Za mało gotówki na płace załogi w locie (${place} kr)` };
      if (this.stan.koniec) return { dystans, doby, paliwo, blad: 'Gra zakończona' };
      return { dystans, doby, paliwo };
    } catch (e) {
      return { dystans: 0, doby: 0, paliwo: 0, blad: (e as Error).message };
    }
  }

  lec(trasa: string[]): Raport {
    const s = this.sprawdzTrase(trasa);
    if (s.blad) throw new Error(s.blad);
    const ef = this.efekty();
    const okres = this.okres;
    const stanPrzed = { saldo: okres.saldoNaStarcie, wartosc: okres.wartoscNaStarcie };
    const z = this.stan.pozycja;
    const cel = trasa[trasa.length - 1];
    const cenaOdniesienia = this.cenaPaliwaTutaj();
    this.zapiszOdczyt(z);

    // Paliwo: bez załogi, nawigator, synergia.
    const bezZalogi = s.dystans * K.kosztPaliwaNaParsek;
    const poNawigatorze = bezZalogi * ef.mnoznikNawigatora;
    const zuzyte = poNawigatorze * ef.mnoznikSynergii;
    const oszczNaw = bezZalogi - poNawigatorze;
    const oszczSyn = poNawigatorze - zuzyte;
    this.stan.paliwo = Math.max(0, this.stan.paliwo - zuzyte);

    // Czas i płace.
    const dobyNominalne = s.dystans / K.predkoscNominalna;
    const place = zaokr(ef.placeNaDobe * s.doby);
    const placeNominalne = zaokr(ef.placeNaDobe * dobyNominalne);
    this.stan.kr -= place;
    const dobaStart = this.stan.doba;
    this.stan.doba += s.doby;

    // Świat żyje.
    for (const rynek of Object.values(this.stan.rynki)) {
      for (const t of TOWARY_I_PALIWO) krokRynku(rynek[t], s.doby);
    }
    // Pamięć zakupu: każdy wykonany skok zmniejsza wszystkie liczniki o 1.
    const skoki = trasa.length - 1;
    for (const klucz of Object.keys(this.stan.pamiecZakupu)) {
      const nowy = this.stan.pamiecZakupu[klucz] - skoki;
      if (nowy > 0) this.stan.pamiecZakupu[klucz] = nowy;
      else delete this.stan.pamiecZakupu[klucz];
    }

    // XP załogi za doby lotu (przed przylotem: efekty tego lotu liczyły się przy starej umiejętności).
    this.dodajXP(P.progresja.xpNaDobeLotu * s.doby);

    // Przylot, kontakt, nowi kandydaci.
    this.stan.pozycja = cel;
    this.stan.numerLotu += 1;
    const kontakt = this.zadokuj();
    if (kontakt) this.dodajXP(P.progresja.xpZaKontakt);
    this.stan.koniec = this.stan.doba >= this.limitDob - EPS;

    // Raport: linie sumują się do zmiany salda.
    const sprzedaze = okres.transakcje.filter((t) => t.rodzaj === 'sprzedaz');
    const zakupy = okres.transakcje.filter((t) => t.rodzaj === 'kupno');
    const sprzedazBaza = sprzedaze.reduce((a, t) => a + t.kwotaBezKaryKr, 0);
    const karaOdsprzedazy = sprzedaze.reduce((a, t) => a + (t.kwotaBezKaryKr - t.kwotaBezHandlowcaKr), 0);
    const sprzedazHandlowiec = sprzedaze.reduce((a, t) => a + (t.kwotaKr - t.kwotaBezHandlowcaKr), 0);
    const zakupBaza = zakupy.reduce((a, t) => a + t.kwotaBezHandlowcaKr, 0);
    const zakupHandlowiec = zakupy.reduce((a, t) => a + (t.kwotaBezHandlowcaKr - t.kwotaKr), 0);
    const oszczNawKr = zaokr(oszczNaw * cenaOdniesienia);
    const oszczSynKr = zaokr(oszczSyn * cenaOdniesienia);
    const paliwoKupione = okres.paliwoKosztKr;
    const pilotKr = placeNominalne - place;
    const nazwaZ = this.wezel(z).nazwa;

    const linie: LiniaRaportu[] = [];
    linie.push({ klucz: 'sprzedaz', etykieta: `Sprzedaż towarów w ${nazwaZ} (ceny bez handlowca${karaOdsprzedazy !== 0 ? ' i bez kary' : ''})`, kr: sprzedazBaza });
    if (karaOdsprzedazy !== 0) linie.push({ klucz: 'kara_odsprzedazy', etykieta: 'Kara za odsprzedaż w miejscu zakupu', kr: -karaOdsprzedazy, opis: `pamięć zakupu: ${Math.round(K.tradeSpread * 100)}% ceny, dopóki od zakupu nie minie ${P.pamiecZakupuSkokow} skoków` });
    if (ef.najlepszy.handlowiec || sprzedazHandlowiec !== 0) linie.push({ klucz: 'handlowiec_sprzedaz', etykieta: 'Handlowiec: lepsze ceny sprzedaży', kr: sprzedazHandlowiec, opis: `pozycja w oknie spreadu ${Math.round(ef.udzialHandlowca * 100)}%` });
    linie.push({ klucz: 'zakup', etykieta: `Zakup towarów w ${nazwaZ} (ceny bez handlowca)`, kr: -zakupBaza });
    if (ef.najlepszy.handlowiec || zakupHandlowiec !== 0) linie.push({ klucz: 'handlowiec_zakup', etykieta: 'Handlowiec: niższe ceny zakupu', kr: zakupHandlowiec });
    linie.push({
      klucz: 'paliwo',
      etykieta: `Paliwo: zakup w doku${ef.najlepszy.nawigator || ef.synergia ? ' + zużycie, które załoga zaoszczędziła' : ''}`,
      kr: -(paliwoKupione + oszczNawKr + oszczSynKr),
      opis: `kupiono ${okres.paliwoKupioneM3.toFixed(1)} m³, zużyto w locie ${zuzyte.toFixed(1)} m³ (bez załogi ${bezZalogi.toFixed(1)} m³)`,
    });
    if (ef.najlepszy.nawigator) linie.push({ klucz: 'nawigator', etykieta: `Nawigator: paliwo zaoszczędzone (${oszczNaw.toFixed(1)} m³)`, kr: oszczNawKr, opis: `mnożnik zużycia ${ef.mnoznikNawigatora.toFixed(3)}` });
    if (ef.synergia) linie.push({ klucz: 'synergia', etykieta: `Synergia „trasa zgrana” (${oszczSyn.toFixed(1)} m³)`, kr: oszczSynKr, opis: 'pilot i nawigator z tej samej cywilizacji' });
    linie.push({ klucz: 'place', etykieta: `Płace załogi za ${dobyNominalne.toFixed(1)} doby przy prędkości nominalnej`, kr: -placeNominalne, opis: `${ef.placeNaDobe} kr/dobę` });
    if (ef.najlepszy.pilot) linie.push({ klucz: 'pilot', etykieta: `Pilot: lot ${s.doby < dobyNominalne ? 'krótszy' : 'dłuższy'} o ${Math.abs(dobyNominalne - s.doby).toFixed(1)} doby`, kr: pilotKr, opis: `prędkość ${ef.predkosc.toFixed(2)} pc/dobę` });
    if (okres.kadlub) linie.push({ klucz: 'stocznia', etykieta: `Stocznia: kadłub szczebla ${okres.kadlub.szczebel}`, kr: -okres.kadlub.kwotaKr, opis: `ładownia ${Math.round(this.ladownia())} m³, bak ${Math.round(this.bak())} m³` });
    for (const a of okres.awanse) linie.push({ klucz: 'awans', etykieta: `Awans cywilizacji ${a.nazwa} na tier ${a.tier}`, kr: 0, opis: `dostarczony koszyk tieru ${a.tier}: popyt portów na towary koszyka × ${P.progresja.mnoznikKonsumpcjiAwansu}` });
    if (kontakt) linie.push({ klucz: 'kontakt', etykieta: `Kontakt z cywilizacją ${kontakt.nazwa}`, kr: 0, opis: kontakt.opis });

    const zmianaSalda = linie.reduce((a, l) => a + l.kr, 0);
    if (zmianaSalda !== this.stan.kr - stanPrzed.saldo) {
      throw new Error(`Raport nie sumuje się do zmiany salda: ${zmianaSalda} vs ${this.stan.kr - stanPrzed.saldo}`);
    }

    const wynikHandlowy: WynikHandlowy[] = [];
    for (const t of TOWARY) {
      const moje = sprzedaze.filter((x) => x.towar === t);
      if (moje.length === 0) continue;
      const przychod = moje.reduce((a, x) => a + x.kwotaKr, 0);
      const koszt = moje.reduce((a, x) => a + (x.kosztZakupuKr ?? 0), 0);
      wynikHandlowy.push({ towar: t, m3: moje.reduce((a, x) => a + x.m3, 0), przychodKr: przychod, kosztZakupuKr: koszt, zyskKr: przychod - koszt });
    }

    const raport: Raport = {
      numerLotu: this.stan.numerLotu,
      z,
      do: cel,
      trasa: [...trasa],
      dystansPc: s.dystans,
      doby: s.doby,
      dobyNominalne,
      dobaStart,
      dobaKoniec: this.stan.doba,
      linie,
      zmianaSalda,
      saldoPrzed: stanPrzed.saldo,
      saldoPo: this.stan.kr,
      wartoscPrzed: stanPrzed.wartosc,
      wartoscPo: this.wartoscFirmy(),
      transakcje: [...okres.transakcje],
      wynikHandlowy,
      paliwo: {
        kupionoM3: okres.paliwoKupioneM3,
        kosztZakupuKr: paliwoKupione,
        zuzytoM3: zuzyte,
        bezZalogiM3: bezZalogi,
        oszczednoscNawigatoraM3: oszczNaw,
        oszczednoscSynergiiM3: oszczSyn,
        cenaOdniesieniaKr: cenaOdniesienia,
        wBakuPo: this.stan.paliwo,
      },
      zaloga: {
        placeNaDobe: ef.placeNaDobe,
        predkosc: ef.predkosc,
        mnoznikPaliwa: ef.mnoznikPaliwa,
        udzialHandlowca: ef.udzialHandlowca,
        synergia: ef.synergia,
        sklad: this.stan.zaloga.map((x) => ({ ...x })),
      },
      kontakt,
      awanse: okres.awanse.length ? [...okres.awanse] : undefined,
      kadlub: okres.kadlub ?? undefined,
      koniecGry: this.stan.koniec,
    };
    this.stan.raporty.push(raport);
    return raport;
  }

  // ---------- Pomocnicze ----------

  private nowyOkres(): Okres {
    return { transakcje: [], paliwoKupioneM3: 0, paliwoKosztKr: 0, saldoNaStarcie: this.stan.kr, wartoscNaStarcie: this.wartoscFirmy(), kadlub: null, awanse: [] };
  }

  /** Zapamiętuje odczyt rynku odwiedzonej planety (tylko w trybie `zasieg`). */
  private zapiszOdczyt(idWezla: string): void {
    if (this.informacja !== 'zasieg') return;
    if (!this.rynekZnany(idWezla) || !(this.stan.wizyty[idWezla] > 0)) return;
    this.stan.odczyty[idWezla] = { doba: this.stan.doba, rynek: kopiaRynku(this.stan.rynki[idWezla]) };
  }

  /** Dokowanie: licznik wizyt, kontakt z nieznaną cywilizacją, odczyty w łączności, kandydaci do załogi. */
  private zadokuj(): Raport['kontakt'] | undefined {
    const w = this.wezel();
    this.stan.wizyty[w.id] = (this.stan.wizyty[w.id] ?? 0) + 1;
    let kontakt: Raport['kontakt'];
    if (w.typ === 'planeta' && w.cywilizacja && !this.stan.znaneCywilizacje[w.cywilizacja]) {
      this.stan.znaneCywilizacje[w.cywilizacja] = true;
      const cyw = this.cywilizacja(w.cywilizacja)!;
      for (const id of cyw.planety) {
        for (const t of TOWARY_I_PALIWO) {
          const poz = this.stan.rynki[id][t];
          if (poz.konsumpcjaUspiona > 0) {
            poz.konsumpcja = poz.konsumpcjaUspiona;
            poz.konsumpcjaUspiona = 0;
          }
        }
      }
      kontakt = {
        cywilizacja: cyw.id,
        nazwa: cyw.nazwa,
        opis: `Odsłonięto rynki ${cyw.planety.length} planet (stolica: ${this.wezel(cyw.stolica).nazwa}). Odblokowano ich popyt na ${P.nazwyTowarow.Electronics.toLowerCase()}.`,
      };
      const znanych = this.swiat.cywilizacje.filter((c) => this.stan.znaneCywilizacje[c.id]).length;
      this.kamien(`kontakt:${znanych}`);
      if (znanych >= this.swiat.cywilizacje.length) this.kamien('kontakt:wszystkie');
    }
    if (this.informacja === 'zasieg') {
      for (const inny of this.swiat.wezly) {
        if (inny.typ === 'planeta' && this.stan.wizyty[inny.id] > 0 && this.wLacznosci(inny.id)) this.zapiszOdczyt(inny.id);
      }
    }
    if (w.typ === 'planeta') {
      const rng = this.rng.odgalezienie(`kandydaci:${w.id}:${this.stan.wizyty[w.id]}`);
      this.stan.kandydaci = generujKandydatow(rng, this.swiat.cywilizacje.map((c) => c.id), P.liczbaKandydatow, `${w.id}-${this.stan.wizyty[w.id]}`, this.progresja);
    } else {
      this.stan.kandydaci = [];
    }
    this.okres = this.nowyOkres();
    return kontakt;
  }
}
