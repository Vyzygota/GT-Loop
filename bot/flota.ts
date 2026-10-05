/**
 * Bot floty (runda 3): czas ciągły, kilka statków, misje kontraktowe, inwestycje w kadłuby i statki.
 * Każdy statek w doku decyduje jak bot z rund 1–2 (zaplanuj/wykonaj na statku aktywnym), ale start nie przewija czasu:
 * świat przewija się do najbliższego przylotu, a przylatujący statek decyduje następny.
 */
import { Gra, K, P, TOWARY, kr, type OpcjeGry, type Towar } from '../sim/index';
import { dojazdyZ, inwestuj, nowyStanBota, wykonaj, zaplanuj, type Dojazd, type HakiRozgrywki, type LotBota, type Plan, type StanBota, type WynikZiarna } from './strategia';

export interface Misja {
  cywilizacja: string;
  tier: number;
  start: number;
}

export interface StanFloty {
  stany: StanBota[];
  misje: (Misja | null)[];
  /** Cywilizacja → statek, który realizuje jej kontrakt. */
  przydzial: Map<string, number>;
  /** Plan, z którym statek wystartował (do miar po przylocie). */
  planyWToku: (Plan | null)[];
}

export function nowyStanFloty(): StanFloty {
  return { stany: [], misje: [], przydzial: new Map(), planyWToku: [] };
}

function stanStatku(f: StanFloty, i: number, marze: StanBota['marzeNaM3']): StanBota {
  while (f.stany.length <= i) {
    const s = nowyStanBota();
    s.marzeNaM3 = marze;
    f.stany.push(s);
    f.misje.push(null);
    f.planyWToku.push(null);
  }
  return f.stany[i];
}

/** Receptura z punktu widzenia statku aktywnego: ile jeszcze nie dotarło do akademii, ile z tego jest na pokładzie, ile trzeba kupić. */
function stanReceptury(gra: Gra, misja: Misja): { pozostalo: Partial<Record<Towar, number>>; naPokladzie: Partial<Record<Towar, number>>; braki: Partial<Record<Towar, number>> } {
  const pozostalo = gra.pozostaloKontraktu(misja.cywilizacja);
  const naPokladzie: Partial<Record<Towar, number>> = {};
  const braki: Partial<Record<Towar, number>> = {};
  for (const t of Object.keys(pozostalo) as Towar[]) {
    const jest = Math.min(pozostalo[t]!, gra.ladunekDoKontraktu(t, misja.cywilizacja));
    if (jest > 1e-9) naPokladzie[t] = jest;
    const brak = pozostalo[t]! - jest;
    if (brak > 1e-9) braki[t] = Math.ceil(brak);
  }
  return { pozostalo, naPokladzie, braki };
}

/** Czy w tym doku wolno kupić towar receptury: towar sąsiada tylko u sąsiada, towar własnego sektora gdziekolwiek. */
function zrodloReceptury(gra: Gra, idCyw: string, towar: Towar, idWezla: string): boolean {
  const kontrakt = gra.rozwoj(idCyw).kontrakt;
  const cyw = gra.wezel(idWezla).cywilizacja;
  if (!kontrakt || !cyw) return false;
  if (kontrakt.odSasiada[towar]) return gra.sasiednieCywilizacje(idCyw).includes(cyw);
  return true;
}

/** Czy planeta jest teraz źródłem towaru receptury kontraktu `idCyw` (ma zapas; rynek deficytowy z zapasem 0 nie jest źródłem). */
function zrodloTowaru(gra: Gra, idCyw: string, towar: Towar, id: string, minZapas: number): boolean {
  const w = gra.wezel(id);
  if (w.typ !== 'planeta' || !gra.rynekZnany(id) || !zrodloReceptury(gra, idCyw, towar, id)) return false;
  const r = gra.stan.rynki[id][towar];
  return r.dostepny !== false && r.zapas >= minZapas;
}

/** Czy kontrakt da się w ogóle zrealizować z tego doku: każdy towar ma znane źródło w zasięgu, naukowiec też. */
function kontraktWykonalny(gra: Gra, idCyw: string, doj: ReturnType<typeof dojazdyZ>): boolean {
  const kontrakt = gra.rozwoj(idCyw).kontrakt;
  if (!kontrakt) return false;
  const wezly = [...doj.keys()];
  for (const t of Object.keys(gra.pozostaloKontraktu(idCyw)) as Towar[]) {
    if (!wezly.some((id) => zrodloTowaru(gra, idCyw, t, id, 1))) return false;
  }
  if (!kontrakt.naukowiecWAkademii && !wezly.some((id) => gra.naukowiecDostepny(idCyw, id))) return false;
  return true;
}

/** Najdłuższy odcinek (pc) drogi statku aktywnego do celu po grafie tankowania; Infinity, gdy cel poza grafem. */
function najdluzszyOdcinek(gra: Gra, doj: Map<string, Dojazd>, cel: string): number {
  const d = doj.get(cel);
  if (!d) return Infinity;
  let max = 0;
  let a = gra.stan.pozycja;
  for (const b of d.odcinki) {
    if (b === a) continue;
    max = Math.max(max, gra.graf.dijkstra(a).get(b)?.dystans ?? Infinity);
    a = b;
  }
  return max;
}

/**
 * Ile ton ładunku statek aktywny może jeszcze wziąć, żeby na pełnym baku przelecieć odcinek `legPc` z zapasem rezerwaZasieguMisji
 * (wariant R: masa skraca zasięg; wariant D: zasięg nie zależy od masy, więc limit jest praktycznie nieskończony).
 */
function maxMasaNaOdcinek(gra: Gra, legPc: number): number {
  if (!Number.isFinite(legPc)) return 0;
  const potrzeba = legPc * (1 + P.bot.rezerwaZasieguMisji);
  const zasieg = (masa: number) => gra.zasiegNaPaliwie(gra.bak(), gra.stan.zaloga, masa);
  if (zasieg(0) < potrzeba) return 0;
  let lo = 0;
  let hi = 100000;
  if (zasieg(hi) >= potrzeba) return hi;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (zasieg(mid) >= potrzeba) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Najbliższy węzeł spełniający warunek, po grafie tankowania statku aktywnego. */
function najblizszy(gra: Gra, warunek: (id: string) => boolean, doj = dojazdyZ(gra, gra.stan.pozycja, gra.stan.zaloga)): string | null {
  let naj: { id: string; d: number } | null = null;
  for (const [id, d] of doj) if (warunek(id) && (!naj || d.dystans < naj.d)) naj = { id, d: d.dystans };
  return naj?.id ?? null;
}

/**
 * Misja kontraktowa statku aktywnego: przydział (najbliższy wykonalny otwarty kontrakt w zasięgu, nieprzydzielony, z budżetem),
 * działania w doku (zakup receptury, naukowiec, dostawa częściowa lub końcowa w akademii) i cel następnego etapu.
 */
function misjaWDoku(gra: Gra, f: StanFloty, i: number, stanBota: StanBota): { celMisji: string | null; zarezerwowaneM3: number; zarezerwowaneTowary: Partial<Record<Towar, number>>; akcje: string[] } {
  const akcje: string[] = [];
  let misja = f.misje[i];
  const zakoncz = (powod: string) => {
    if (!misja) return;
    f.przydzial.delete(misja.cywilizacja);
    f.misje[i] = null;
    misja = null;
    if (gra.statek().naukowiec) gra.wysadzNaukowca();
    akcje.push(powod);
  };
  // Porzucenie: kontrakt zniknął (awans zrobiony) albo misja trwa za długo.
  if (misja) {
    const kontrakt = gra.rozwoj(misja.cywilizacja).kontrakt;
    if (!kontrakt || kontrakt.tier !== misja.tier || gra.stan.doba - misja.start > P.bot.maxDobyMisji) zakoncz('misja-koniec');
  }
  // Przydział nowej misji w doku ze znanym rynkiem.
  if (!misja && gra.rynekZnany(gra.stan.pozycja) && stanBota.cel === null) {
    const doj = dojazdyZ(gra, gra.stan.pozycja, gra.stan.zaloga);
    let naj: { cyw: string; tier: number; d: number } | null = null;
    for (const c of gra.swiat.cywilizacje) {
      const r = gra.rozwoj(c.id);
      if (!r.kontrakt || !gra.cywilizacjaZnana(c.id) || f.przydzial.has(c.id)) continue;
      const d = doj.get(c.stolica);
      if (!d || d.dystans > P.bot.maxDystansKontraktuPc) continue;
      const pozostalo = gra.pozostaloKontraktu(c.id);
      const kosztReceptury = (Object.keys(pozostalo) as Towar[]).reduce((s, t) => s + pozostalo[t]! * kr(K.towary[t].basePrice), 0);
      // Droga misji: po recepturę (najdalsze z najbliższych źródeł brakujących towarów, liczone stąd) i do akademii.
      let objazd = 0;
      for (const t of Object.keys(pozostalo) as Towar[]) {
        if (gra.ladunekDoKontraktu(t, c.id) >= pozostalo[t]!) continue;
        let najZrodlo = Infinity;
        for (const [id, dd] of doj) if (dd.dystans < najZrodlo && zrodloTowaru(gra, c.id, t, id, 1)) najZrodlo = dd.dystans;
        objazd = Math.max(objazd, najZrodlo);
      }
      if (!Number.isFinite(objazd)) continue;
      const droga = objazd + d.dystans;
      // Czas drogi liczony z masą receptury jednego kursu (minerały ×3 t/m³ spowalniają w obu wariantach).
      const masaReceptury = (Object.keys(pozostalo) as Towar[]).reduce((s, t) => s + Math.min(pozostalo[t]!, gra.ladownia()) * K.towary[t].gestosc, 0);
      const l = gra.obliczLot(droga, gra.stan.zaloga, gra.bak(), Math.min(masaReceptury, gra.ladownia() * 3) - gra.masaZajeta());
      if (l.doby > P.bot.maxDobyDrogiMisji) continue;
      const koszt = kosztReceptury + l.paliwo * kr(K.towary.Fuel.basePrice);
      if (gra.stan.kr < P.bot.mnoznikGotowkiNaKontrakt * koszt) continue;
      if (naj && droga >= naj.d) continue;
      if (!kontraktWykonalny(gra, c.id, doj)) continue;
      naj = { cyw: c.id, tier: r.kontrakt.tier, d: droga };
    }
    if (naj) {
      misja = { cywilizacja: naj.cyw, tier: naj.tier, start: gra.stan.doba };
      f.misje[i] = misja;
      f.przydzial.set(naj.cyw, i);
      akcje.push(`misja-start:${naj.cyw}:T${naj.tier}`);
      // Statek na misji rusza lekki: ładunek handlowy sprzedaje tutaj (masa skraca zasięg i spowalnia; kasa floty na tym nie cierpi).
      for (const t of TOWARY) {
        const jest = gra.stan.ladownia[t].m3;
        if (jest > 1e-9 && gra.stan.rynki[gra.stan.pozycja][t].dostepny !== false) gra.sprzedaj(t, jest);
      }
    }
  }
  if (!misja) return { celMisji: null, zarezerwowaneM3: 0, zarezerwowaneTowary: {}, akcje };
  const cyw = gra.cywilizacja(misja.cywilizacja)!;
  const tu = gra.stan.pozycja;
  const cywTu = gra.wezel(tu).cywilizacja;
  // 1. Zakup brakującej receptury tutaj (towar sąsiada tylko u sąsiada), ale tylko tyle, ile statek uniesie na najdłuższym
  //    odcinku drogi do akademii (w wariancie R minerały w pełnej ładowni skracają zasięg poniżej odcinka grafu).
  if (gra.rynekZnany(tu) && cywTu) {
    const dojTu = dojazdyZ(gra, tu, gra.stan.zaloga);
    let masaWolna = maxMasaNaOdcinek(gra, najdluzszyOdcinek(gra, dojTu, cyw.stolica));
    for (const [t, brak] of Object.entries(stanReceptury(gra, misja).braki) as [Towar, number][]) {
      if (!zrodloReceptury(gra, misja.cywilizacja, t, tu)) continue;
      const ile = Math.min(brak, Math.floor(gra.maxKupno(t)), Math.floor(masaWolna / K.towary[t].gestosc));
      if (ile > 0) {
        gra.kup(t, ile);
        masaWolna -= ile * K.towary[t].gestosc;
        akcje.push(`misja-zakup:${t}:${ile}`);
      }
    }
  }
  // 2. Naukowiec, jeśli tu dostępny i jeszcze potrzebny (w razie potrzeby sprzedaj tutaj coś, co nie jest recepturą).
  const kontrakt = gra.rozwoj(misja.cywilizacja).kontrakt!;
  if (!gra.statek().naukowiec && !kontrakt.naukowiecWAkademii && gra.naukowiecDostepny(misja.cywilizacja)) {
    const potrzeba = P.runda3.statek.naukowiecM3;
    if (gra.rynekZnany(tu)) {
      const { naPokladzie } = stanReceptury(gra, misja);
      for (const t of TOWARY) {
        const wolne = gra.ladownia() - gra.objetoscZajeta();
        if (wolne >= potrzeba) break;
        const zbedne = Math.max(0, gra.stan.ladownia[t].m3 - (naPokladzie[t] ?? 0));
        if (zbedne > 0 && gra.stan.rynki[tu][t].dostepny !== false) gra.sprzedaj(t, Math.min(zbedne, potrzeba - wolne));
      }
    }
    if (gra.ladownia() - gra.objetoscZajeta() >= potrzeba - 1e-9) {
      gra.zabierzNaukowca(misja.cywilizacja);
      akcje.push('misja-naukowiec');
    }
  }
  // 3. Dostawa w akademii: wszystko, co z pokładu pasuje do receptury, plus naukowiec; ostatnia dostawa zamyka kontrakt.
  const dd = gra.kontraktDoDostarczenia();
  if (dd && dd.cywilizacja === misja.cywilizacja && (Object.keys(dd.dostarczalne).length > 0 || dd.naukowiecNaPokladzie)) {
    const w = gra.dostarczKontrakt();
    akcje.push(`${w.zamkniety ? 'misja-dostawa' : 'misja-dostawa-czesc'}:${w.cywilizacja}:T${w.tier}`);
    if (w.zamkniety) {
      f.przydzial.delete(misja.cywilizacja);
      f.misje[i] = null;
      return { celMisji: null, zarezerwowaneM3: 0, zarezerwowaneTowary: {}, akcje };
    }
  }
  // 4. Cel następnego etapu: dokupić (jest miejsce i źródło), inaczej zawieźć to, co jest, do akademii; naukowiec po drodze lub osobno.
  const { naPokladzie, braki } = stanReceptury(gra, misja);
  const brakujace = Object.keys(braki) as Towar[];
  const wolne = gra.ladownia() - gra.objetoscZajeta();
  const naukowiecPotrzebny = !gra.statek().naukowiec && !kontrakt.naukowiecWAkademii;
  const cosNaPoklad = Object.keys(naPokladzie).length > 0 || !!gra.statek().naukowiec;
  const doj = dojazdyZ(gra, gra.stan.pozycja, gra.stan.zaloga);
  let celMisji: string | null = null;
  if (brakujace.length && (wolne >= 1 || !cosNaPoklad)) {
    // Najbliższe źródło któregokolwiek brakującego towaru; wolimy zapas pokrywający to, co zmieścimy, ale wystarczy produkcja.
    let naj: { id: string; d: number } | null = null;
    for (const t of brakujace) {
      const potrzeba = Math.max(1, Math.min(braki[t]!, Math.floor(wolne)));
      for (const [id, d] of doj) {
        if (!zrodloTowaru(gra, misja.cywilizacja, t, id, 1)) continue;
        const kara = gra.stan.rynki[id][t].zapas >= potrzeba ? 1 : 2;
        const koszt = d.dystans * kara;
        if (!naj || koszt < naj.d) naj = { id, d: koszt };
      }
    }
    celMisji = naj?.id ?? null;
    if (celMisji === null && cosNaPoklad) celMisji = cyw.stolica;
  } else if (cosNaPoklad) {
    celMisji = cyw.stolica;
  } else if (naukowiecPotrzebny) {
    celMisji = najblizszy(gra, (id) => gra.naukowiecDostepny(misja!.cywilizacja, id), doj);
  } else {
    celMisji = cyw.stolica;
  }
  if (celMisji === null) {
    // Nie ma skąd wziąć receptury ani naukowca: porzuć misję.
    zakoncz('misja-porzucona');
    return { celMisji: null, zarezerwowaneM3: 0, zarezerwowaneTowary: {}, akcje };
  }
  // Cel etapu poza grafem tankowania przy obecnej masie: odciąż statek (sprzedaj tu ładunek spoza receptury); gdy to nie pomaga, porzuć.
  if (celMisji !== tu && !doj.has(celMisji)) {
    if (gra.rynekZnany(tu)) {
      for (const t of TOWARY) {
        const zbedne = gra.stan.ladownia[t].m3 - (naPokladzie[t] ?? 0);
        if (zbedne > 1e-9 && gra.stan.rynki[tu][t].dostepny !== false) gra.sprzedaj(t, zbedne);
      }
      akcje.push('misja-odciazenie');
    }
    if (!dojazdyZ(gra, tu, gra.stan.zaloga).has(celMisji)) {
      zakoncz('misja-porzucona');
      return { celMisji: null, zarezerwowaneM3: 0, zarezerwowaneTowary: {}, akcje };
    }
  }
  // Rezerwa ładowni dla planisty handlu: miejsce na zakup receptury (gdy lecimy po nią) i na naukowca.
  const poRecepture = celMisji !== cyw.stolica && brakujace.length > 0;
  const zarezerwowane = (poRecepture ? Object.values(braki).reduce((s, x) => s + x, 0) : 0) + (naukowiecPotrzebny ? P.runda3.statek.naukowiecM3 : 0);
  return { celMisji: celMisji === tu ? null : celMisji, zarezerwowaneM3: Math.min(zarezerwowane, gra.ladownia()), zarezerwowaneTowary: naPokladzie, akcje };
}

export interface KrokStatku {
  statek: number;
  plan: Plan | null;
  wystartowal: boolean;
  akcje: string[];
}

/** Jeden statek w doku: inwestycje, misja, plan, start (bez przewijania czasu). */
export function krokStatku(gra: Gra, f: StanFloty, i: number, marze: StanBota['marzeNaM3']): KrokStatku {
  gra.wybierzStatek(i);
  const stanBota = stanStatku(f, i, marze);
  const akcje: string[] = [];
  for (const a of inwestuj(gra, stanBota)) akcje.push(a.typ === 'kup-szczebel' ? `kadlub:${a.szczebel}` : a.typ === 'kup-statek' ? `statek:${a.id}` : a.typ);
  const m = misjaWDoku(gra, f, i, stanBota);
  akcje.push(...m.akcje);
  stanBota.celMisji = m.celMisji;
  // Podział floty: cele, do których lecą już inne statki (i ich zobowiązania), są dla tego statku gorsze (kara przy remisie).
  // Ekspedycje: jedna naraz w całej flocie, z rytmem liczonym od ostatniej ekspedycji któregokolwiek statku.
  const wykluczone = new Set<string>();
  let ekspedycjaTrwa = false;
  for (const s of gra.stan.statki) {
    if (s.id === i) continue;
    if (s.wLocie) wykluczone.add(s.wLocie.trasa[s.wLocie.trasa.length - 1]);
    const inny = f.stany[s.id];
    if (inny?.cel) wykluczone.add(inny.cel);
    if (inny?.cel && !gra.rynekZnany(inny.cel)) ekspedycjaTrwa = true;
    if (inny) stanBota.ostatniaEkspedycja = Math.max(stanBota.ostatniaEkspedycja, inny.ostatniaEkspedycja);
  }
  let decyzja = zaplanuj(gra, stanBota, undefined, { wykluczoneCele: wykluczone, objetoscZarezerwowanaM3: m.zarezerwowaneM3, zarezerwowaneTowary: m.zarezerwowaneTowary, bezEkspedycji: ekspedycjaTrwa });
  // Etap misji, który spaliłby więcej niż maxStrataMisjiUlamek wartości firmy, kończy misję: bot wraca do handlu.
  if (stanBota.celMisji && decyzja.plan && decyzja.plan.cel === stanBota.celMisji && decyzja.plan.zyskNetto < -P.bot.maxStrataMisjiUlamek * gra.wartoscFirmy()) {
    const misja = f.misje[i];
    if (misja) {
      f.przydzial.delete(misja.cywilizacja);
      f.misje[i] = null;
      if (gra.statek().naukowiec) gra.wysadzNaukowca();
      akcje.push('misja-za-droga');
    }
    stanBota.celMisji = null;
    decyzja = zaplanuj(gra, stanBota, undefined, { wykluczoneCele: wykluczone, bezEkspedycji: ekspedycjaTrwa });
  }
  if (!decyzja.plan) return { statek: i, plan: null, wystartowal: false, akcje };
  const { utknal } = wykonaj(gra, decyzja, true);
  const wystartowal = gra.statek(i).wLocie !== null;
  f.planyWToku[i] = decyzja.plan;
  // Własne marże (kr/m³) ze sprzedaży w tym doku: wspólne dla floty.
  return { statek: i, plan: decyzja.plan, wystartowal: wystartowal && !utknal, akcje };
}

export interface WynikFloty extends WynikZiarna {
  statkow: number;
  misjeDostarczone: number;
  misjeRozpoczete: number;
  dobyCzekania: number;
}

/** Rozgrywka floty na jednym ziarnie (runda 3). */
export interface HakiFloty extends HakiRozgrywki {
  naKrok?: (gra: Gra, krok: KrokStatku) => void;
}

export function zagrajFlote(ziarno: string, opcje: OpcjeGry = {}, haki: HakiFloty = {}): WynikFloty {
  const gra = new Gra(ziarno, { ...opcje, runda3: true });
  const f = nowyStanFloty();
  const marze: StanBota['marzeNaM3'] = {};
  const loty: LotBota[] = [];
  const marzeNaM3 = {} as Record<Towar, number[]>;
  for (const t of TOWARY) marzeNaM3[t] = [];
  const cenyPaliwa: number[] = [];
  let pierwszy: number | null = null;
  let kontaktDoba: number | null = null;
  let utknal = false;
  let dobyCzekania = 0;
  let czekanieZRzedu = 0;
  let misjeDostarczone = 0;
  let misjeRozpoczete = 0;
  haki.naStarcie?.(gra);
  while (!gra.stan.koniec) {
    let ktosWystartowal = false;
    for (const i of gra.statkiWDoku()) {
      const krok = krokStatku(gra, f, i, marze);
      haki.naKrok?.(gra, krok);
      for (const a of krok.akcje) {
        if (a.startsWith('misja-dostawa:')) misjeDostarczone++;
        if (a.startsWith('misja-start')) misjeRozpoczete++;
      }
      if (krok.wystartowal) ktosWystartowal = true;
    }
    if (gra.nastepnyPrzylotDoba() === null) {
      if (ktosWystartowal) continue;
      // Nikt nie leci i nikt nie ma planu: czas płynie, flota czeka (po maxDobyCzekaniaFloty z rzędu liczy się jako utknięcie,
      // ale czas płynie dalej do końca horyzontu — stan świata po 1 200 dobach jest zawsze zdefiniowany).
      gra.czekaj(P.bot.dobyCzekaniaFloty);
      dobyCzekania += P.bot.dobyCzekaniaFloty;
      czekanieZRzedu += P.bot.dobyCzekaniaFloty;
      if (czekanieZRzedu > P.bot.maxDobyCzekaniaFloty) utknal = true;
      continue;
    }
    const raport = gra.nastepnyPrzylot()!;
    czekanieZRzedu = 0;
    const id = raport.statek ?? 0;
    const plan = f.planyWToku[id];
    f.planyWToku[id] = null;
    for (const w of raport.wynikHandlowy) if (w.m3 > 0) {
      marzeNaM3[w.towar].push(w.zyskKr / w.m3);
      (marze[w.towar] ??= []).push(w.zyskKr / w.m3);
    }
    if (raport.paliwo.kupionoM3 > 0) cenyPaliwa.push(raport.paliwo.kosztZakupuKr / raport.paliwo.kupionoM3);
    const najdrozszy = plan ? [...plan.zakupy].sort((a, b) => b.kosztKr - a.kosztKr)[0] : undefined;
    loty.push({
      z: raport.z,
      do: raport.do,
      cywZ: gra.wezel(raport.z).cywilizacja,
      cywDo: gra.wezel(raport.do).cywilizacja,
      dystans: raport.dystansPc,
      doby: raport.doby,
      skoki: raport.trasa.length - 1,
      zyskWartosci: raport.wartoscPo - raport.wartoscPrzed,
      towary: plan?.zakupy.map((z) => z.towar) ?? [],
      towar: najdrozszy?.towar,
      eksploracja: plan?.eksploracja ?? false,
      paliwoKr: raport.paliwo.kosztZakupuKr,
      placeKr: Math.round(raport.zaloga.placeNaDobe * raport.doby),
    });
    if (pierwszy === null && raport.wartoscPo > raport.wartoscPrzed) pierwszy = raport.numerLotu;
    if (raport.kontakt && kontaktDoba === null) kontaktDoba = raport.dobaKoniec;
    haki.poLocie?.(gra, raport);
  }
  haki.naKoniec?.(gra);
  const wartosc = gra.wartoscFirmy();
  return {
    ziarno,
    wartoscKoncowa: wartosc,
    zysk: wartosc > K.startingCredits,
    loty,
    trasy: [],
    pierwszyZyskownyLot: pierwszy,
    kontaktDoba,
    utknal,
    marzeNaM3,
    cenyPaliwa,
    plany: [],
    ekspedycje: f.stany.flatMap((s) => s.ekspedycje),
    statkow: gra.stan.statki.length,
    misjeDostarczone,
    misjeRozpoczete,
    dobyCzekania,
  };
}
