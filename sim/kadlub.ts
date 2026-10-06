/**
 * Runda 4: drabina kadłubów wyprowadzona z BaseShipa procedurą kanonu (zasada-wyprowadzenie-kadluba), ta sama dla każdego
 * szczebla, nie mnożnik: 1. obrys (decyzja), 2. napęd z czasu skoku (reaktory 271 m³, 2 dysze × 230 tf), 3. kajuty 20 m³/osobę,
 * 4. konstrukcja 10% obrysu, 5. bak ze zbiorników 50 m³, 6. ładownia = reszta w modułach 120 m³.
 * Dla szczebli 1–5 wejściem jest ładownia docelowa, a obrys wyznacza się odwrotnie (najmniejszy, w którym po krokach 2–5
 * zostaje ta ładownia); napęd i bak dobiera się tak, by prędkość i zasięg z pełną ładownią towaru referencyjnego nie były
 * gorsze niż jedynki w tym samym stanie. Masa z gęstości jak w rundzie 3 (reaktor 100 t, moduł 36 t, konstrukcja z jedynki).
 */
import { K, P } from './stale';
import { predkoscPrzyMasie, zasiegNaPaliwie } from './lot';
import type { WariantPaliwa } from './typy';

export type KrokProcedury = 'napęd' | 'kajuty' | 'bak' | '—';

export interface KadlubSzczebla {
  szczebel: number;
  obrysM3: number;
  reaktory: number;
  dysze: number;
  osoby: number;
  kajutyM3: number;
  konstrukcjaM3: number;
  zbiorniki: number;
  bakM3: number;
  moduly: number;
  ladowniaM3: number;
  /** Luz: obrys − (napęd + kajuty + konstrukcja + bak + ładownia). */
  luzM3: number;
  masaSuchaT: number;
  ciagTf: number;
  /** Pierwszy krok procedury (2 napęd, 3 kajuty, 5 bak), który nie mieści się w obrysie skalowanym proporcjonalnie do ładowni. */
  krokWymuszajacy: KrokProcedury;
}

/** Gęstość konstrukcji (t/m³) z jedynki: (421,99 − reaktor − 4 moduły) / 100 m³ konstrukcji. */
export function gestoscKonstrukcjiTNaM3(): number {
  const S = P.runda3.statek;
  const C = K.kadlub;
  return (K.statek.masaJedynkiSuchaT - S.masaReaktoraT - C.modulyJedynki * S.masaModuluLadowniT) / (C.konstrukcjaUlamekObrysu * C.obrysJedynkiM3);
}

/** Krok 6: ładownia = reszta obrysu po napędzie, kajutach, konstrukcji i baku, w pełnych modułach; luz = reszta poniżej modułu. */
export function ladowniaZReszty(obrysM3: number, reaktory: number, osoby: number, zbiorniki: number): { moduly: number; ladowniaM3: number; luzM3: number; konstrukcjaM3: number; kajutyM3: number; bakM3: number } {
  const C = K.kadlub;
  const konstrukcjaM3 = C.konstrukcjaUlamekObrysu * obrysM3;
  const kajutyM3 = C.kajutaNaOsobeM3 * osoby;
  const bakM3 = C.zbiornikM3 * zbiorniki;
  const reszta = obrysM3 - reaktory * K.statek.objetoscReaktoraM3 - kajutyM3 - konstrukcjaM3 - bakM3;
  const moduly = Math.max(0, Math.floor(reszta / C.modulLadowniM3 + 1e-9));
  return { moduly, ladowniaM3: moduly * C.modulLadowniM3, luzM3: reszta - moduly * C.modulLadowniM3, konstrukcjaM3, kajutyM3, bakM3 };
}

/** Obsada jak w rundzie 3: kokpit 1 + 1 na reaktor + 1 na każde (rozpoczęte) 4 moduły ładowni. */
export function obsadaZModulow(reaktory: number, moduly: number): number {
  const o = P.runda3.statek.obsada;
  return o.kokpit + reaktory * o.naReaktor + Math.ceil(moduly / o.naModulyLadowni);
}

export function masaSuchaKadlubaT(konstrukcjaM3: number, reaktory: number, moduly: number): number {
  const S = P.runda3.statek;
  return gestoscKonstrukcjiTNaM3() * konstrukcjaM3 + reaktory * S.masaReaktoraT + moduly * S.masaModuluLadowniT;
}

function ciag(reaktory: number): number {
  return reaktory * K.statek.dyszNaReaktor * K.statek.ciagDyszyTf;
}

/** BaseShip krok po kroku (kontrola kanonu: 1 000 / 271 / 40 / 100 / 100 / 480 m³). */
export function jedynka(): KadlubSzczebla {
  const C = K.kadlub;
  const r = ladowniaZReszty(C.obrysJedynkiM3, 1, C.osobyJedynki, C.zbiornikiJedynki);
  return {
    szczebel: 0,
    obrysM3: C.obrysJedynkiM3,
    reaktory: 1,
    dysze: K.statek.dyszNaReaktor,
    osoby: C.osobyJedynki,
    kajutyM3: r.kajutyM3,
    konstrukcjaM3: r.konstrukcjaM3,
    zbiorniki: C.zbiornikiJedynki,
    bakM3: r.bakM3,
    moduly: r.moduly,
    ladowniaM3: r.ladowniaM3,
    luzM3: r.luzM3,
    masaSuchaT: masaSuchaKadlubaT(r.konstrukcjaM3, 1, r.moduly),
    ciagTf: ciag(1),
    krokWymuszajacy: '—',
  };
}

/** Stan referencyjny: pełny bak i pełna ładownia towaru o gęstości referencyjnej. */
function masaReferencyjnaT(masaSuchaT: number, bakM3: number, ladowniaM3: number): number {
  return masaSuchaT + bakM3 * K.towary.Fuel.gestosc + ladowniaM3 * P.runda4.gestoscReferencyjnaTNaM3;
}

function zasiegReferencyjny(masaSuchaT: number, bakM3: number, ladowniaM3: number, ciagTf: number, wariant: WariantPaliwa): number {
  return zasiegNaPaliwie(bakM3, { masaStartT: masaReferencyjnaT(masaSuchaT, bakM3, ladowniaM3), ciagTf, pilot: 1, mnoznikPaliwa: 1, wariant });
}

/**
 * Kadłub szczebla N dla docelowej liczby modułów ładowni: najmniejsze reaktory i zbiorniki, przy których prędkość i zasięg
 * z pełną ładownią referencyjną są ≥ jedynki; obsada z modułów; obrys = najmniejszy (zaokrąglony w górę), w którym to wszystko
 * i ładownia się mieszczą. Iteracja, bo obsada zależy od reaktorów, a masa (więc prędkość i zasięg) od obrysu.
 */
export function wyprowadzKadlub(szczebel: number, moduly: number, wariant: WariantPaliwa): KadlubSzczebla {
  const C = K.kadlub;
  const j = jedynka();
  const vJedynki = predkoscPrzyMasie(masaReferencyjnaT(j.masaSuchaT, j.bakM3, j.ladowniaM3), j.ciagTf);
  const zJedynki = zasiegReferencyjny(j.masaSuchaT, j.bakM3, j.ladowniaM3, j.ciagTf, wariant);
  const zaokr = P.runda4.zaokraglenieObrysuM3;
  const ladowniaM3 = moduly * C.modulLadowniM3;
  let reaktory = 1;
  let zbiorniki = C.zbiornikiJedynki;
  for (let i = 0; i < 100000; i++) {
    const osoby = obsadaZModulow(reaktory, moduly);
    const stale = reaktory * K.statek.objetoscReaktoraM3 + C.kajutaNaOsobeM3 * osoby + C.zbiornikM3 * zbiorniki + ladowniaM3;
    const obrysM3 = Math.ceil(stale / (1 - C.konstrukcjaUlamekObrysu) / zaokr) * zaokr;
    const r = ladowniaZReszty(obrysM3, reaktory, osoby, zbiorniki);
    const masaSuchaT = masaSuchaKadlubaT(r.konstrukcjaM3, reaktory, moduly);
    const ciagTf = ciag(reaktory);
    if (predkoscPrzyMasie(masaReferencyjnaT(masaSuchaT, r.bakM3, ladowniaM3), ciagTf) < vJedynki - 1e-12) {
      reaktory++;
      continue;
    }
    if (zasiegReferencyjny(masaSuchaT, r.bakM3, ladowniaM3, ciagTf, wariant) < zJedynki - 1e-9) {
      zbiorniki++;
      continue;
    }
    // Który krok pierwszy nie mieści się w obrysie skalowanym proporcjonalnie do ładowni (jedynka × moduły/4)?
    const proporcjonalny = (C.obrysJedynkiM3 * moduly) / C.modulyJedynki;
    const wolne = proporcjonalny * (1 - C.konstrukcjaUlamekObrysu) - ladowniaM3;
    let krok: KrokProcedury = '—';
    const naped = reaktory * K.statek.objetoscReaktoraM3;
    const kajuty = C.kajutaNaOsobeM3 * osoby;
    const bak = C.zbiornikM3 * zbiorniki;
    if (naped > wolne + 1e-9) krok = 'napęd';
    else if (naped + kajuty > wolne + 1e-9) krok = 'kajuty';
    else if (naped + kajuty + bak > wolne + 1e-9) krok = 'bak';
    return {
      szczebel,
      obrysM3,
      reaktory,
      dysze: reaktory * K.statek.dyszNaReaktor,
      osoby,
      kajutyM3: r.kajutyM3,
      konstrukcjaM3: r.konstrukcjaM3,
      zbiorniki,
      bakM3: r.bakM3,
      moduly: r.moduly,
      ladowniaM3: r.ladowniaM3,
      luzM3: r.luzM3,
      masaSuchaT,
      ciagTf,
      krokWymuszajacy: krok,
    };
  }
  throw new Error('Procedura kadłuba nie zbiega');
}

/** Drabina 6 szczebli: 0 = BaseShip, N ≥ 1 z ładownią 480 m³ × g^N (moduły zaokrąglone w górę). */
export function wyprowadzDrabine(g: number, wariant: WariantPaliwa, szczebli = K.drabinaKadlubow.szczebli): KadlubSzczebla[] {
  const C = K.kadlub;
  const drabina: KadlubSzczebla[] = [jedynka()];
  for (let n = 1; n < szczebli; n++) {
    const moduly = Math.ceil((C.modulyJedynki * Math.pow(g, n)) - 1e-9);
    drabina.push(wyprowadzKadlub(n, moduly, wariant));
  }
  return drabina;
}

/** Drabina rundy 3 (konfiguracje, baki i masy z prototyp.json) w tym samym kształcie — żeby gra miała jedno źródło kadłuba. */
export function drabinaRundy3(): KadlubSzczebla[] {
  const S = P.runda3.statek;
  return S.konfiguracje.map((konf, n) => {
    const moduly = konf.ladownie;
    const osoby = obsadaZModulow(konf.reaktory, moduly);
    const bakM3 = S.bakM3[Math.min(n, S.bakM3.length - 1)];
    const obrysM3 = S.objetoscJedynkiM3 * Math.pow(S.mnoznikKadluba, n);
    const masaSuchaT = (K.statek.masaJedynkiSuchaT - S.masaReaktoraT) * Math.pow(S.mnoznikKadluba, n) + konf.reaktory * S.masaReaktoraT + moduly * S.masaModuluLadowniT;
    return {
      szczebel: n,
      obrysM3,
      reaktory: konf.reaktory,
      dysze: konf.reaktory * K.statek.dyszNaReaktor,
      osoby,
      kajutyM3: 0,
      konstrukcjaM3: 0,
      zbiorniki: bakM3 / K.kadlub.zbiornikM3,
      bakM3,
      moduly,
      ladowniaM3: moduly * S.modulLadowniM3,
      luzM3: obrysM3 - konf.reaktory * K.statek.objetoscReaktoraM3 - moduly * S.modulLadowniM3 - bakM3,
      masaSuchaT,
      ciagTf: ciag(konf.reaktory),
      krokWymuszajacy: '—',
    };
  });
}
