import { K, P } from './stale';
import type { Losowosc } from './losowosc';
import { ROLE, type EfektyZalogi, type Rola, type Zalogant } from './typy';

function pozycjaUmiejetnosci(u: number): number {
  return (u - K.skillFloor) / (K.skillCeiling - K.skillFloor);
}

/** Efekty załogi: w jednej roli liczy się tylko najlepszy (efekty nie sumują się ponad pułap). */
export function efektyZalogi(zaloga: readonly Zalogant[]): EfektyZalogi {
  const najlepszy: Partial<Record<Rola, Zalogant>> = {};
  for (const z of zaloga) {
    const dotychczas = najlepszy[z.rola];
    if (!dotychczas || z.umiejetnosc > dotychczas.umiejetnosc) najlepszy[z.rola] = z;
  }
  const pilot = najlepszy.pilot;
  const nawigator = najlepszy.nawigator;
  const handlowiec = najlepszy.handlowiec;

  const mnoznikPilota = pilot ? pilot.umiejetnosc : 1;
  const mnoznikNawigatora = nawigator ? 1 - P.nawigatorMaxRedukcjaPaliwa * pozycjaUmiejetnosci(nawigator.umiejetnosc) : 1;
  const synergia = !!(pilot && nawigator && pilot.cywilizacja === nawigator.cywilizacja);
  const mnoznikSynergii = synergia ? 1 - P.synergiaRedukcjaPaliwa : 1;
  const udzialHandlowca = handlowiec ? P.handlowiecMaxUdzialPolspreadu * pozycjaUmiejetnosci(handlowiec.umiejetnosc) : 0;

  return {
    predkosc: K.predkoscNominalna * mnoznikPilota,
    mnoznikPilota,
    mnoznikNawigatora,
    mnoznikSynergii,
    mnoznikPaliwa: mnoznikNawigatora * mnoznikSynergii,
    udzialHandlowca,
    synergia,
    placeNaDobe: zaloga.reduce((s, z) => s + z.placa, 0),
    najlepszy,
  };
}

// ---------- Progresja: XP, tiery, umiejętność i płaca z tieru ----------

/** Tier załogi (0…TierCount−1) z XP według progów kanonu. */
export function tierZalogi(xp: number): number {
  const progi = K.tierZalogi.progiXP;
  let tier = 0;
  for (let i = 0; i < progi.length && i < K.TierCount; i++) if (xp >= progi[i]) tier = i;
  return tier;
}

export function nazwaTieruZalogi(tier: number): string {
  return P.progresja.nazwyTierowZalogi[tier] ?? `T${tier}`;
}

/** Umiejętność z tieru i talentu: pasmo skillFloor…skillCeiling podzielone na TierCount równych tierów, talent ∈ [0,1] to pozycja w paśmie tieru. */
export function umiejetnoscZTieru(tier: number, talent: number): number {
  const skala = Math.pow(10, P.umiejetnoscMiejscaDziesietne);
  const u = K.skillFloor + ((K.skillCeiling - K.skillFloor) * (tier + talent)) / K.TierCount;
  return Math.round(u * skala) / skala;
}

/** Płaca z widełek kanonu dla tieru; talent ustawia pozycję w widełkach. */
export function placaZTieru(tier: number, talent: number): number {
  const [lo, hi] = K.tierZalogi.placaKrNaDobe[Math.min(tier, K.tierZalogi.placaKrNaDobe.length - 1)];
  return Math.round(lo + (hi - lo) * talent);
}

/** Po zmianie XP: tier, umiejętność i płaca załoganta (tylko załogant z XP, czyli w trybie progresji). */
export function aktualizujZaloganta(z: Zalogant): void {
  if (z.xp === undefined) return;
  const tier = tierZalogi(z.xp);
  z.umiejetnosc = umiejetnoscZTieru(tier, z.talent ?? 0);
  z.placa = placaZTieru(tier, z.talent ?? 0);
}

/**
 * Kandydaci do załogi. Bez progresji: umiejętność losowa z [skillFloor, skillCeiling], płaca kanonu per rola.
 * Z progresją: XP startowe (prototyp), talent losowy, umiejętność i płaca z tieru i talentu.
 */
export function generujKandydatow(rng: Losowosc, cywilizacje: readonly string[], liczba: number, prefiks: string, progresja = false): Zalogant[] {
  const wynik: Zalogant[] = [];
  const skala = Math.pow(10, P.umiejetnoscMiejscaDziesietne);
  for (let i = 0; i < liczba; i++) {
    // Kolejność losowań jak przed progresją (rola, los umiejętności, imię, cywilizacja), żeby kandydaci bez progresji byli ci sami.
    const rola = rng.wybierz(ROLE);
    const los = rng.los();
    const imie = `${rng.wybierz(P.imiona)} ${rng.wybierz(P.nazwiska)}`;
    const cywilizacja = rng.wybierz(cywilizacje);
    if (progresja) {
      const talent = Math.round(los * skala) / skala;
      const z: Zalogant = { id: `${prefiks}-${i}`, imie, rola, cywilizacja, umiejetnosc: 0, placa: 0, xp: P.progresja.xpStartoweKandydata, talent };
      aktualizujZaloganta(z);
      wynik.push(z);
    } else {
      const umiejetnosc = Math.round((K.skillFloor + (K.skillCeiling - K.skillFloor) * los) * skala) / skala;
      wynik.push({ id: `${prefiks}-${i}`, imie, rola, cywilizacja, umiejetnosc, placa: K.placa[rola] });
    }
  }
  return wynik;
}
