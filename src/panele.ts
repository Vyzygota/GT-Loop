import { K, P, TOWARY, TOWARY_I_PALIWO, type Gra, type Towar, type Zalogant } from '../sim/index';
import { doby, esc, kr, liczba1, liczba2, m3, nazwaRoli, nazwaTowaru, pc, procent } from './format';
import { kolorCywilizacji } from './mapa';

export function panelTrasy(gra: Gra, trasa: string[]): string {
  const s = gra.sprawdzTrase(trasa);
  const nazwy = trasa.map((id) => `<span class="skok">${esc(gra.wezel(id).nazwa)}</span>`).join(' → ');
  const osiagalneZaWszystko = gra.zasieg(gra.stan.paliwo + gra.maxPaliwo()).size;
  const bankrut = !gra.stan.koniec && osiagalneZaWszystko <= 1 && gra.wartoscLadowni() <= 0;
  const szczegoly =
    trasa.length > 1
      ? `${trasa.length - 1} skok(i), ${pc(s.dystans)}, ${doby(s.doby)}, paliwo ${m3(s.paliwo)} z ${m3(gra.stan.paliwo)} w baku${s.paliwo <= gra.stan.paliwo ? ` (zostanie ${m3(gra.stan.paliwo - s.paliwo)})` : ''}`
      : 'Kliknij planetę na mapie albo wiersz w tablicy cen. Kolejne kliknięcia sąsiadów dokładają skoki.';
  return `<div class="panel trasa-panel">
    <h2>Trasa <span class="szary maly">czas stoi, dopóki nie wystartujesz</span></h2>
    <div class="skoki">${nazwy || '<span class="szary">brak</span>'}</div>
    <div class="maly">${szczegoly}</div>
    ${s.blad && trasa.length > 1 ? `<div class="blad maly">${esc(s.blad)}</div>` : ''}
    ${bankrut ? '<div class="blad"><b>Bankructwo.</b> Nawet po wydaniu całej gotówki na paliwo nie dolecisz do żadnego sąsiada, a ładownia jest pusta. Zacznij nową grę przyciskiem w nagłówku.</div>' : ''}
    <div style="margin-top:6px; display:flex; gap:8px; align-items:center">
      <button class="glowny" data-akcja="lec" ${s.blad ? 'disabled' : ''}>Leć</button>
      <button data-akcja="wyczysc-trase" ${trasa.length <= 1 ? 'disabled' : ''}>Wyczyść trasę</button>
      <span class="szary maly">Prędkość ${liczba2(gra.efekty().predkosc)} pc/dobę, zużycie ×${liczba2(gra.efekty().mnoznikPaliwa)}</span>
    </div>
  </div>`;
}

export function panelRynku(gra: Gra, ilosci: Record<string, number>): string {
  const tu = gra.stan.pozycja;
  const w = gra.wezel(tu);
  const cyw = gra.swiat.cywilizacje.find((c) => c.id === w.cywilizacja);
  const naglowek = `<h2>Dok: ${esc(w.nazwa)} <span class="szary maly">${w.typ === 'tankowanie' ? 'punkt tankowania plemion' : `${esc(cyw?.nazwa ?? '')}, ${w.populacjaMln} mln mieszkańców`}</span></h2>`;
  if (!gra.rynekZnany(tu)) {
    return `<div class="panel rynek">${naglowek}<p class="szary">Tu nie ma rynku towarów. Paliwo po cenie bazowej.</p>${wierszPaliwa(gra, ilosci)}</div>`;
  }
  const ef = gra.efekty();
  const wiersze = TOWARY.map((t) => {
    const c = gra.ceny(tu, t)!;
    const l = gra.stan.ladownia[t];
    const il = ilosci[t] ?? 0;
    const maxK = Math.floor(gra.maxKupno(t));
    const wk = il > 0 && il <= maxK ? gra.wycenaKupna(t, il) : null;
    const ws = il > 0 && il <= l.m3 ? gra.wycenaSprzedazy(t, il) : null;
    const zapasDoby = Number.isFinite(c.zapasDoby) ? `${liczba1(c.zapasDoby)} dób` : '∞';
    const bilans = c.bilansNaDobe;
    const wycena =
      il > 0
        ? `<tr class="wycena-wiersz"><td colspan="6" class="lewo wycena">Za ${il} m³ ${nazwaTowaru(t).toLowerCase()}: ${
            wk ? `kupno ${kr(wk.kwotaKr)} (śr. ${kr(wk.cenaSredniaKr)}/m³, cena po transakcji ${kr(wk.cenaJednPoKr)})` : `kupno niemożliwe (maks. ${maxK} m³)`
          } · ${ws ? `sprzedaż ${kr(ws.kwotaKr)} (śr. ${kr(ws.cenaSredniaKr)}/m³, cena po transakcji ${kr(ws.cenaJednPoKr)})` : `sprzedaż niemożliwa (masz ${liczba1(l.m3)} m³)`}</td></tr>`
        : '';
    return `<tr data-towar="${t}">
      <td class="lewo"><b>${nazwaTowaru(t)}</b><div class="szary maly">${liczba1(K.towary[t].gestosc)} t/m³${l.m3 > 0 ? ` · w ładowni ${liczba1(l.m3)} m³ (śr. koszt ${kr(l.kosztKr / l.m3)})` : ''}</div></td>
      <td>${kr(c.kupnoKr)}</td>
      <td>${kr(c.sprzedazKr)}</td>
      <td>${liczba1(c.zapasM3)} m³ (${zapasDoby})<div class="szary maly">${bilans >= 0 ? '+' : ''}${liczba1(bilans)}/dobę · nacisk ${liczba2(c.nacisk)}</div></td>
      <td class="ilosc"><input type="number" min="0" step="1" value="${il || ''}" data-ilosc="${t}" placeholder="m³" /></td>
      <td class="akcje">
        <div><button data-akcja="kup" data-towar="${t}" ${wk ? '' : 'disabled'}>Kup</button><button data-akcja="kup-max" data-towar="${t}" ${maxK > 0 ? '' : 'disabled'} title="Kup maksimum: ${maxK} m³">Max</button></div>
        <div><button data-akcja="sprzedaj" data-towar="${t}" ${ws ? '' : 'disabled'}>Sprzedaj</button><button data-akcja="sprzedaj-wszystko" data-towar="${t}" ${l.m3 > 0 ? '' : 'disabled'}>Wszystko</button></div>
      </td>
    </tr>${wycena}`;
  }).join('');
  return `<div class="panel rynek">${naglowek}
    <table>
      <thead><tr><th>Towar</th><th>Kupno kr/m³</th><th>Sprzedaż kr/m³</th><th>Zapas planety</th><th>Ilość</th><th></th></tr></thead>
      <tbody>${wiersze}</tbody>
    </table>
    <div class="szary maly" style="margin-top:4px">Cena krańcowa: każdy kolejny m³ wyceniany jest przy zapasie po poprzednim. Handlowiec (pozycja ${procent(ef.udzialHandlowca)} okna spreadu) przesuwa obie ceny ku środkowi okna.</div>
    ${wierszPaliwa(gra, ilosci)}
  </div>`;
}

function wierszPaliwa(gra: Gra, ilosci: Record<string, number>): string {
  const il = ilosci.Fuel ?? 0;
  const maxP = gra.maxPaliwo();
  const w = il > 0 && il <= maxP + 1e-9 ? gra.wycenaPaliwa(il) : null;
  const doPelna = gra.wycenaPaliwa(maxP);
  return `<table style="margin-top:8px"><thead><tr><th>Paliwo</th><th>Cena kr/m³</th><th>Bak</th><th>Ilość</th><th></th></tr></thead>
    <tbody><tr>
      <td class="lewo"><b>${nazwaTowaru('Fuel')}</b><div class="szary maly">${liczba1(K.kosztPaliwaNaParsek)} m³/pc</div></td>
      <td>${kr(gra.cenaPaliwaTutaj())}${w ? `<div class="wycena">za ${liczba1(il)}: ${kr(w.kwotaKr)} (śr. ${kr(w.cenaSredniaKr)})</div>` : ''}</td>
      <td>${m3(gra.stan.paliwo)} / ${m3(K.bak)}</td>
      <td class="ilosc"><input type="number" min="0" step="1" value="${il || ''}" data-ilosc="Fuel" placeholder="m³" /></td>
      <td class="akcje"><button data-akcja="tankuj" ${w ? '' : 'disabled'}>Tankuj</button>
        <button data-akcja="tankuj-pelny" ${maxP > 1e-6 ? '' : 'disabled'} title="${kr(doPelna.kwotaKr)}">Do pełna (${m3(maxP)}, ${kr(doPelna.kwotaKr)})</button></td>
    </tr></tbody></table>`;
}

export function panelLadowni(gra: Gra): string {
  const obj = gra.objetoscZajeta();
  const masa = gra.masaZajeta();
  const wartosc = gra.wartoscLadowni();
  return `<div class="panel">
    <h2>Ładownia <span class="szary maly">${m3(obj)} / ${m3(K.ladownia)} · ${liczba1(masa)} t / ${liczba1(K.maxMasaLadunku)} t</span></h2>
    <div class="maly">Wartość ładunku po cenach sprzedaży tutaj: <b>${kr(wartosc)}</b>${gra.rynekZnany(gra.stan.pozycja) ? '' : ' (brak rynku: po koszcie zakupu)'}</div>
  </div>`;
}

function opisEfektu(gra: Gra, z: Zalogant): string {
  const ef = gra.efekty([z]);
  if (z.rola === 'pilot') return `prędkość ${liczba2(ef.predkosc)} pc/dobę`;
  if (z.rola === 'nawigator') return `paliwo ×${liczba2(ef.mnoznikNawigatora)}`;
  return `spread: ${procent(ef.udzialHandlowca)} ku lepszej cenie`;
}

export function panelZalogi(gra: Gra): string {
  const ef = gra.efekty();
  const nazwaCyw = (id: string) => gra.swiat.cywilizacje.find((c) => c.id === id)?.nazwa ?? id;
  const wiersz = (z: Zalogant, akcja: string, etykieta: string, wylaczony: boolean) => `<tr>
      <td class="lewo"><b>${nazwaRoli(z.rola)}</b></td>
      <td class="lewo">${esc(z.imie)}</td>
      <td class="lewo"><span class="kropka" style="background:${kolorCywilizacji(gra, z.cywilizacja)}"></span>${esc(nazwaCyw(z.cywilizacja))}</td>
      <td>${liczba2(z.umiejetnosc)}</td>
      <td>${kr(z.placa)}/dobę</td>
      <td class="lewo szary maly">${opisEfektu(gra, z)}</td>
      <td><button data-akcja="${akcja}" data-id="${z.id}" ${wylaczony ? 'disabled' : ''}>${etykieta}</button></td>
    </tr>`;
  const zaloga = gra.stan.zaloga.map((z) => wiersz(z, 'zwolnij', 'Zwolnij', false)).join('');
  const pelna = gra.stan.zaloga.length >= K.miejscaZalogi;
  const kandydaci = gra.stan.kandydaci.map((z) => wiersz(z, 'zatrudnij', 'Zatrudnij', pelna)).join('');
  const synergiaOpis = ef.synergia
    ? `tak: pilot i nawigator z ${esc(nazwaCyw(ef.najlepszy.pilot!.cywilizacja))} (−${procent(P.synergiaRedukcjaPaliwa)} paliwa)`
    : ef.najlepszy.pilot && ef.najlepszy.nawigator
      ? 'nie: pilot i nawigator z różnych cywilizacji'
      : 'nie: potrzeba pilota i nawigatora z tej samej cywilizacji';
  return `<div class="panel zaloga">
    <h2>Załoga <span class="szary maly">${gra.stan.zaloga.length} / ${K.miejscaZalogi} miejsc · płace ${kr(ef.placeNaDobe)}/dobę</span></h2>
    <div class="efekty">
      <div>${liczba2(ef.predkosc)} pc/dobę<span>prędkość (pilot ×${liczba2(ef.mnoznikPilota)})</span></div>
      <div>×${liczba2(ef.mnoznikPaliwa)}<span>zużycie paliwa (nawigator ×${liczba2(ef.mnoznikNawigatora)}, synergia ×${liczba2(ef.mnoznikSynergii)})</span></div>
      <div>${procent(ef.udzialHandlowca)}<span>handlowiec: pozycja w oknie spreadu</span></div>
      <div>${synergiaOpis}<span>synergia „trasa zgrana”</span></div>
    </div>
    <table><thead><tr><th>Rola</th><th>Imię</th><th>Cywilizacja</th><th>Umiejętność</th><th>Płaca</th><th>Efekt</th><th></th></tr></thead>
      <tbody>${zaloga || '<tr><td colspan="7" class="szary lewo">Brak załogi. W tej samej roli liczy się tylko najlepszy.</td></tr>'}</tbody></table>
    <h2 style="margin-top:10px">Kandydaci w tym doku</h2>
    <table><tbody>${kandydaci || '<tr><td class="szary lewo">Brak kandydatów (punkt tankowania).</td></tr>'}</tbody></table>
  </div>`;
}

export function panelCywilizacji(gra: Gra): string {
  const bloki = gra.swiat.cywilizacje
    .map((c) => {
      const znana = gra.stan.znaneCywilizacje[c.id];
      const kolor = kolorCywilizacji(gra, c.id);
      const planety = c.planety.map((id) => esc(gra.wezel(id).nazwa)).join(', ');
      if (!znana) {
        return `<div class="cyw" style="border-color:${kolor}"><b>${esc(c.nazwa)}</b> <span class="szary">— cywilizacja nieznana</span>
          <div class="maly">Planety: ${planety}. Rynek ukryty. Pierwsze lądowanie to kontakt: odsłoni rynek i obudzi popyt.</div></div>`;
      }
      const produkuje = TOWARY_I_PALIWO.filter((t) => c.produkcjaM3NaDobe[t] > c.potrzebyM3NaDobe[t] * P.ui.progBilansu);
      const potrzebuje = TOWARY_I_PALIWO.filter((t) => c.potrzebyM3NaDobe[t] > c.produkcjaM3NaDobe[t] * P.ui.progBilansu);
      const opis = (lista: typeof produkuje) =>
        lista.length ? lista.map((t) => `${nazwaTowaru(t)} (${liczba1(Math.abs(c.produkcjaM3NaDobe[t] - c.potrzebyM3NaDobe[t]))} m³/dobę)`).join(', ') : 'nic znaczącego';
      return `<div class="cyw" style="border-color:${kolor}"><b>${esc(c.nazwa)}</b> <span class="szary">${c.populacjaMln} mln</span>
        <div class="maly">Planety: ${planety}</div>
        <div class="maly"><span class="zysk">Nadwyżka:</span> ${opis(produkuje)}</div>
        <div class="maly"><span class="strata">Brakuje:</span> ${opis(potrzebuje)}</div></div>`;
    })
    .join('');
  return `<div class="panel cywilizacje"><h2>Cywilizacje <span class="szary maly">bilans produkcji i potrzeb</span></h2>${bloki}</div>`;
}

export function tablicaCen(gra: Gra): string {
  const tu = gra.stan.pozycja;
  const d = gra.graf.dijkstra(tu);
  const zasieg = gra.zasieg();
  const planety = gra.swiat.wezly
    .filter((w) => w.typ === 'planeta')
    .map((w) => ({ w, d: d.get(w.id)! }))
    .sort((a, b) => a.d.dystans - b.d.dystans);
  const wiersze = planety
    .map(({ w, d }) => {
      const znany = gra.rynekZnany(w.id);
      const komorki = TOWARY.map((t: Towar) => {
        if (!znany) return '<td class="szary">?</td>';
        const c = gra.ceny(w.id, t)!;
        const moj = gra.stan.ladownia[t].m3 > 0;
        return `<td><span class="${moj ? 'pogrubienie' : ''}">${Math.round(c.sprzedazKr).toLocaleString('pl-PL')}</span><span class="szary"> / ${Math.round(c.kupnoKr).toLocaleString('pl-PL')}</span><div class="szary maly">n ${liczba2(c.nacisk)}</div></td>`;
      }).join('');
      const wZasiegu = zasieg.has(w.id);
      return `<tr class="przycisk-wiersz" data-cel="${w.id}" title="Kliknij, aby ustawić trasę">
        <td class="lewo"><span class="kropka" style="background:${kolorCywilizacji(gra, w.cywilizacja)}"></span>${esc(w.nazwa)}${w.id === tu ? ' <span class="szary">(tu)</span>' : ''}</td>
        <td>${w.id === tu ? '—' : `${pc(d.dystans)}, ${d.skoki} sk.`}${wZasiegu || w.id === tu ? '' : '<div class="strata maly">poza zasięgiem</div>'}</td>
        ${komorki}
        <td>${gra.cenaPaliwa(w.id) === null ? '?' : Math.round(gra.cenaPaliwa(w.id)!).toLocaleString('pl-PL')}</td>
      </tr>`;
    })
    .join('');
  return `<div class="panel kolumna-szeroka"><h2>Tablica cen znanych planet <span class="szary maly">sprzedaż / kupno w kr/m³ przy obecnej załodze · n = nacisk · pogrubione: masz ten towar</span></h2>
    <table><thead><tr><th>Planeta</th><th>Odległość</th>${TOWARY.map((t) => `<th>${nazwaTowaru(t)}</th>`).join('')}<th>Paliwo</th></tr></thead><tbody>${wiersze}</tbody></table>
  </div>`;
}
