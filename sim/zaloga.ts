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

export function generujKandydatow(rng: Losowosc, cywilizacje: readonly string[], liczba: number, prefiks: string): Zalogant[] {
  const wynik: Zalogant[] = [];
  const skala = Math.pow(10, P.umiejetnoscMiejscaDziesietne);
  for (let i = 0; i < liczba; i++) {
    const rola = rng.wybierz(ROLE);
    const umiejetnosc = Math.round(rng.zakres(K.skillFloor, K.skillCeiling) * skala) / skala;
    wynik.push({
      id: `${prefiks}-${i}`,
      imie: `${rng.wybierz(P.imiona)} ${rng.wybierz(P.nazwiska)}`,
      rola,
      cywilizacja: rng.wybierz(cywilizacje),
      umiejetnosc,
      placa: K.placa[rola],
    });
  }
  return wynik;
}
