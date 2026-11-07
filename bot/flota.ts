/**
 * Bot floty (runda 3): czas ciągły, kilka statków, misje kontraktowe, inwestycje w kadłuby i statki.
 * Każdy statek w doku decyduje jak bot z rund 1–2 (zaplanuj/wykonaj na statku aktywnym), ale start nie przewija czasu:
 * świat przewija się do najbliższego przylotu, a przylatujący statek decyduje następny.
 */
import { Gra, K, P, TOWARY, kr, type OpcjeGry, type Towar } from '../sim/index';
import { dojazdyZ, inwestuj, limitFloty, nowyStanBota, rezerwaFloty, rezerwacjeFloty, wykonaj, zaplanuj, type HakiRozgrywki, type LotBota, type Plan, type StanBota, type WynikZiarna } from './strategia';

export interface Misja {
  cywilizacja: string;
  tier: number;
  start: number;
}

export interface MisjaDostarczona {
  cywilizacja: string;
  tier: number;
  start: number;
  koniec: number;
  statek: number;
  /** Ładownia statku w chwili dostawy końcowej (m³). */
  ladowniaM3: number;
}

export interface StanFloty {
  stany: StanBota[];
  misje: (Misja | null)[];
  /** Kontrakty dostarczone do końca (awans): do miar czasu kontraktu i udziału ładowni floty. */
  dostarczone: MisjaDostarczona[];
  /** Cywilizacja → statek, który realizuje jej kontrakt. */
  przydzial: Map<string, number>;
  /** Plan, z którym statek wystartował (do miar po przylocie). */
  planyWToku: (Plan | null)[];
}

export function nowyStanFloty(): StanFloty {
  return { stany: [], misje: [], dostarczone: [], przydzial: new Map(), planyWToku: [] };
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
  // Przydział nowej misji w doku ze znanym rynkiem; naraz co najwyżej połowa floty na misjach (reszta handluje i zarabia na paliwo).
  const misjiTeraz = f.misje.filter((m) => m !== null).length;
  if (!misja && gra.rynekZnany(gra.stan.pozycja) && stanBota.cel === null && misjiTeraz < Math.max(1, Math.floor(gra.stan.statki.length / 2))) {
    const doj = dojazdyZ(gra, gra.stan.pozycja, gra.stan.zaloga);
    let naj: { cyw: string; tier: number; d: number } | null = null;
    for (const c of gra.swiat.cywilizacje) {
      const r = gra.rozwoj(c.id);
      if (!r.kontrakt || !gra.cywilizacjaZnana(c.id) || f.przydzial.has(c.id)) continue;
      const d = doj.get(c.stolica);
      if (!d || d.dystans > P.bot.maxDystansKontraktuPc) continue;
      const pozostalo = gra.pozostaloKontraktu(c.id);
      const kosztReceptury = (Object.keys(pozostalo) as Towar[]).reduce((s, t) => s + pozostalo[t]! * kr(K.towary[t].basePrice), 0);
      // Droga misji: stąd do najbliższego źródła każdego brakującego towaru i ze źródła do akademii (najdłuższa z tych dróg);
      // bez tej drugiej nogi 2 m³ rozpuszczalników z Corrath (500 pc od akademii) liczyło się jak zakup po sąsiedzku.
      let droga = d.dystans;
      let wykonalna = true;
      for (const t of Object.keys(pozostalo) as Towar[]) {
        if (gra.ladunekDoKontraktu(t, c.id) >= pozostalo[t]!) continue;
        let najZrodlo: { id: string; d: number } | null = null;
        for (const [id, dd] of doj) if ((!najZrodlo || dd.dystans < najZrodlo.d) && zrodloTowaru(gra, c.id, t, id, 1)) najZrodlo = { id, d: dd.dystans };
        if (!najZrodlo) {
          wykonalna = false;
          break;
        }
        const zeZrodla = dojazdyZ(gra, najZrodlo.id, gra.stan.zaloga, -gra.masaZajeta()).get(c.stolica)?.dystans ?? Infinity;
        droga = Math.max(droga, najZrodlo.d + zeZrodla);
      }
      if (!wykonalna || !Number.isFinite(droga)) continue;
      // Czas drogi liczony z masą receptury jednego kursu (minerały ×3 t/m³ spowalniają w obu wariantach).
      const masaReceptury = (Object.keys(pozostalo) as Towar[]).reduce((s, t) => s + Math.min(pozostalo[t]!, gra.ladownia()) * K.towary[t].gestosc, 0);
      const l = gra.obliczLot(droga, gra.stan.zaloga, gra.bak(), Math.min(masaReceptury, gra.ladownia() * 3) - gra.masaZajeta());
      if (l.doby > limitFloty(P.bot.maxDobyDrogiMisji, gra.stan.statki.length)) continue;
      const koszt = kosztReceptury + l.paliwo * kr(K.towary.Fuel.basePrice);
      if (gra.stan.kr < P.bot.mnoznikGotowkiNaKontrakt * koszt || koszt > P.bot.maxUdzialKosztuMisji * gra.wartoscFirmy()) continue;
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
      // Towar, którego tu nie da się sprzedać (bramka G: minerały przy cywilizacji T1), zostaje na pokładzie; ciężki statek
      // nie dojedzie po recepturę ani do akademii (w rundzie 4 do 23 tys. t minerałów = kilka pc zasięgu) — misję odkłada.
      if (gra.masaZajeta() > P.bot.maxMasaStartuMisjiUlamek * gra.masaSuchaT()) {
        f.przydzial.delete(naj.cyw);
        f.misje[i] = null;
        misja = null;
        akcje.push('misja-odlozona');
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
    const brakiTu = Object.entries(stanReceptury(gra, misja).braki) as [Towar, number][];
    const masaBrakow = brakiTu.reduce((s, [t, brak]) => s + brak * K.towary[t].gestosc, 0);
    // Ładunek handlowy na pokładzie zjada zasięg potrzebny na recepturę: sprzedaj go tutaj, zanim kupisz recepturę.
    if (brakiTu.some(([t]) => zrodloReceptury(gra, misja!.cywilizacja, t, tu))) {
      const { naPokladzie } = stanReceptury(gra, misja);
      let sprzedano = false;
      for (const t of TOWARY) {
        const zbedne = gra.stan.ladownia[t].m3 - (naPokladzie[t] ?? 0);
        if (zbedne > 1e-9 && gra.stan.rynki[tu][t].dostepny !== false) {
          gra.sprzedaj(t, zbedne);
          sprzedano = true;
        }
      }
      if (sprzedano) akcje.push('misja-odciazenie');
    }
    // Ile masy receptury statek może wziąć, żeby akademia została w grafie tankowania (graf liczony z tą masą na pokładzie):
    // cała, połowa, ćwierć… — zamiast zapasu 15% ponad najdłuższy odcinek, który przy odcinkach równych zasięgowi dawał zero.
    let masaWolna = 0;
    for (const ulamek of [1, 0.5, 0.25, 0.125]) {
      if (dojazdyZ(gra, tu, gra.stan.zaloga, masaBrakow * ulamek).has(cyw.stolica)) {
        masaWolna = masaBrakow * ulamek;
        break;
      }
    }
    if (masaBrakow <= 1e-9) masaWolna = Infinity;
    for (const [t, brak] of brakiTu) {
      if (!zrodloReceptury(gra, misja.cywilizacja, t, tu)) continue;
      const cena = gra.ceny(tu, t)?.kupnoKr ?? Infinity;
      // Receptura ma pierwszeństwo przed rezerwacjami handlowymi innych statków (zostaje tylko rezerwa na ich paliwo).
      const naKase = Math.max(0, Math.floor((gra.stan.kr - rezerwaFloty(gra, true)) / cena));
      const ile = Math.min(brak, Math.floor(gra.maxKupno(t)), Math.floor(masaWolna / K.towary[t].gestosc), naKase);
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
      f.dostarczone.push({ cywilizacja: misja.cywilizacja, tier: misja.tier, start: misja.start, koniec: gra.stan.doba, statek: i, ladowniaM3: gra.ladownia() });
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
  // Rezerwa ładowni dla planisty handlu: miejsce na zakup receptury (gdy lecimy po nią) i na naukowca; we flocie (≥ 2 statki)
  // statek na misji nie bierze ładunku handlowego wcale — ciężki ładunek skracał zasięg poniżej odcinków drogi do akademii
  // i misje gasły po 800 dobach bez jednego zakupu receptury (samotny statek handluje po drodze, bo inaczej firma stoi).
  const poRecepture = celMisji !== cyw.stolica && brakujace.length > 0;
  const zarezerwowane = gra.stan.statki.length >= 2 ? gra.ladownia() : (poRecepture ? Object.values(braki).reduce((s, x) => s + x, 0) : 0) + (naukowiecPotrzebny ? P.runda3.statek.naukowiecM3 : 0);
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
  // Wyprawa do stoczni (kadłub albo nowy statek) poza grafem tankowania przy obecnej masie: odciąż statek tutaj i planuj raz jeszcze
  // (statek szczebla 1 z minerałami w ładowni ma 22 pc zasięgu i inaczej wahadłuje w kółko, choć stać go na drugi statek).
  const tu = gra.stan.pozycja;
  if (stanBota.doStoczni && stanBota.doStoczni !== tu && decyzja.plan?.cel !== stanBota.doStoczni && gra.rynekZnany(tu) && !dojazdyZ(gra, tu, gra.stan.zaloga).has(stanBota.doStoczni) && dojazdyZ(gra, tu, gra.stan.zaloga, -gra.masaZajeta()).has(stanBota.doStoczni)) {
    for (const t of TOWARY) {
      const zbedne = gra.stan.ladownia[t].m3 - (m.zarezerwowaneTowary[t] ?? 0);
      if (zbedne > 1e-9 && gra.stan.rynki[tu][t].dostepny !== false) gra.sprzedaj(t, zbedne);
    }
    akcje.push('odciazenie-stocznia');
    decyzja = zaplanuj(gra, stanBota, undefined, { wykluczoneCele: wykluczone, objetoscZarezerwowanaM3: m.zarezerwowaneM3, zarezerwowaneTowary: m.zarezerwowaneTowary, bezEkspedycji: ekspedycjaTrwa });
  }
  // Etap misji, który spaliłby więcej niż maxStrataMisjiUlamek wartości firmy, kończy misję: bot wraca do handlu.
  // Plan liczy wartość ładowni jako koszt, a receptury nie sprzedaje, więc jej wartość (po koszcie zakupu) wraca do oceny etapu.
  let wartoscReceptury = 0;
  for (const t of TOWARY) {
    const l = gra.stan.ladownia[t];
    const m3 = Math.min(l.m3, m.zarezerwowaneTowary[t] ?? 0);
    if (m3 > 0 && l.m3 > 0) wartoscReceptury += (l.kosztKr * m3) / l.m3;
  }
  if (stanBota.celMisji && decyzja.plan && decyzja.plan.cel === stanBota.celMisji && decyzja.plan.zyskNetto + wartoscReceptury < (-P.bot.maxStrataMisjiUlamek * gra.wartoscFirmy()) / gra.stan.statki.length) {
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
  if (!decyzja.plan) {
    // Bez planu: sprzedaj tutaj ładunek spoza receptury (gotówka dla floty) i czekaj w doku.
    if (gra.rynekZnany(gra.stan.pozycja)) {
      for (const t of TOWARY) {
        const zbedne = gra.stan.ladownia[t].m3 - (m.zarezerwowaneTowary[t] ?? 0);
        if (zbedne > 1e-9 && gra.stan.rynki[gra.stan.pozycja][t].dostepny !== false) gra.sprzedaj(t, zbedne);
      }
    }
    rezerwacjeFloty.kwoty[i] = 0;
    return { statek: i, plan: null, wystartowal: false, akcje };
  }
  const { utknal } = wykonaj(gra, decyzja, true);
  const wystartowal = gra.statek(i).wLocie !== null;
  f.planyWToku[i] = decyzja.plan;
  // Rezerwacja gotówki na zakupy w celu (drugi krok) na czas lotu; gaśnie przy przylocie.
  rezerwacjeFloty.kwoty[i] = wystartowal ? (decyzja.rezerwaKr ?? 0) : 0;
  // Własne marże (kr/m³) ze sprzedaży w tym doku: wspólne dla floty.
  return { statek: i, plan: decyzja.plan, wystartowal: wystartowal && !utknal, akcje };
}

export interface WynikFloty extends WynikZiarna {
  statkow: number;
  misjeDostarczone: number;
  misjeRozpoczete: number;
  dobyCzekania: number;
  /** Kontrakty dostarczone do końca (start i koniec misji, statek, jego ładownia). */
  misje: MisjaDostarczona[];
}

/** Rozgrywka floty na jednym ziarnie (runda 3). */
export interface HakiFloty extends HakiRozgrywki {
  naKrok?: (gra: Gra, krok: KrokStatku) => void;
}

export function zagrajFlote(ziarno: string, opcje: OpcjeGry = {}, haki: HakiFloty = {}): WynikFloty {
  const gra = new Gra(ziarno, { ...opcje, runda3: true });
  const f = nowyStanFloty();
  rezerwacjeFloty.kwoty = [];
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
    rezerwacjeFloty.kwoty[id] = 0;
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
    misje: f.dostarczone,
  };
}
