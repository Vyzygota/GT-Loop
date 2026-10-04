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
import { efektyZalogi, generujKandydatow } from './zaloga';
import {
  TOWARY,
  TOWARY_I_PALIWO,
  type Ceny,
  type EfektyZalogi,
  type InformacjaORynku,
  type LiniaRaportu,
  type OpcjeGry,
  type Osiagalny,
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
}

interface Okres {
  transakcje: Transakcja[];
  paliwoKupioneM3: number;
  paliwoKosztKr: number;
  saldoNaStarcie: number;
  wartoscNaStarcie: number;
}

function zaokr(x: number): number {
  return Math.round(x);
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
  private okres!: Okres;
  private readonly rng: Losowosc;

  constructor(ziarno: string, opcje: OpcjeGry = {}) {
    this.skala = opcje.skala ?? P.skala;
    this.informacja = opcje.informacja ?? P.informacja;
    this.limitDob = P.skale[this.skala].limitDob;
    this.wariantSpreadu = opcje.spread ?? P.spread;
    const konfig = P.wariantySpreadu[this.wariantSpreadu];
    this.spreadPodstawowy = konfig.tryb === 'staly' ? K.tradeSpread : (konfig.spreadPodstawowy ?? 0);
    this.obciecieNacisku = !konfig.bezObcieciaNacisku;
    const { swiat, rynki } = generujSwiat(ziarno, this.skala);
    this.swiat = swiat;
    this.graf = new Graf(swiat.wezly, swiat.krawedzie);
    this.rng = new Losowosc(ziarno);
    const ladownia = {} as Record<Towar, PozycjaLadowni>;
    for (const t of TOWARY) ladownia[t] = { m3: 0, kosztKr: 0 };
    const znane: Record<string, boolean> = {};
    for (const c of swiat.cywilizacje) znane[c.id] = c.znanaNaStarcie;
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
    };
    this.zadokuj();
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
    let hi = Math.min(poz.zapas, K.ladownia - this.objetoscZajeta(), (K.maxMasaLadunku - this.masaZajeta()) / g);
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
    let hi = Math.max(0, K.bak - this.stan.paliwo);
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
    if (this.objetoscZajeta() + m3 > K.ladownia + EPS) throw new Error('Brak miejsca w ładowni');
    if (this.masaZajeta() + m3 * K.towary[towar].gestosc > K.maxMasaLadunku + EPS) throw new Error('Przekroczona masa ładunku');
    const w = this.wycenaKupna(towar, m3);
    if (w.kwotaKr > this.stan.kr) throw new Error('Brak gotówki');
    this.stan.kr -= w.kwotaKr;
    poz.zapas -= m3;
    const l = this.stan.ladownia[towar];
    l.m3 += m3;
    l.kosztKr += w.kwotaKr;
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
    const w = this.wycenaSprzedazy(towar, m3);
    const kosztZakupu = zaokr((l.kosztKr * m3) / l.m3);
    this.stan.kr += w.kwotaKr;
    this.stan.rynki[tu][towar].zapas += m3;
    l.kosztKr -= kosztZakupu;
    l.m3 -= m3;
    if (l.m3 < EPS) {
      l.m3 = 0;
      l.kosztKr = 0;
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
    return t;
  }

  tankuj(m3: number): { m3: number; kwotaKr: number } {
    if (!(m3 > 0) || !Number.isFinite(m3)) throw new Error('Ilość musi być dodatnia');
    if (!this.maPaliwo()) throw new Error('W układzie przelotowym nie ma paliwa');
    if (this.stan.paliwo + m3 > K.bak + EPS) throw new Error('Bak nie pomieści tyle paliwa');
    const w = this.wezel();
    const wyc = this.wycenaPaliwa(m3);
    if (wyc.kwotaKr > this.stan.kr) throw new Error('Brak gotówki');
    this.stan.kr -= wyc.kwotaKr;
    this.stan.paliwo = Math.min(K.bak, this.stan.paliwo + m3);
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

    // Przylot, kontakt, nowi kandydaci.
    this.stan.pozycja = cel;
    this.stan.numerLotu += 1;
    const kontakt = this.zadokuj();
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
      koniecGry: this.stan.koniec,
    };
    this.stan.raporty.push(raport);
    return raport;
  }

  // ---------- Pomocnicze ----------

  private nowyOkres(): Okres {
    return { transakcje: [], paliwoKupioneM3: 0, paliwoKosztKr: 0, saldoNaStarcie: this.stan.kr, wartoscNaStarcie: this.wartoscFirmy() };
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
    }
    if (this.informacja === 'zasieg') {
      for (const inny of this.swiat.wezly) {
        if (inny.typ === 'planeta' && this.stan.wizyty[inny.id] > 0 && this.wLacznosci(inny.id)) this.zapiszOdczyt(inny.id);
      }
    }
    if (w.typ === 'planeta') {
      const rng = this.rng.odgalezienie(`kandydaci:${w.id}:${this.stan.wizyty[w.id]}`);
      this.stan.kandydaci = generujKandydatow(rng, this.swiat.cywilizacje.map((c) => c.id), P.liczbaKandydatow, `${w.id}-${this.stan.wizyty[w.id]}`);
    } else {
      this.stan.kandydaci = [];
    }
    this.okres = this.nowyOkres();
    return kontakt;
  }
}
