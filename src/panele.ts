import { K, P, TOWARY, TOWARY_I_PALIWO, nazwaTieruZalogi, tierZalogi, type Gra, type Towar, type Zalogant } from '../sim/index';
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
  const naglowek = `<h2>Dok: ${esc(w.nazwa)} <span class="szary maly">${w.typ === 'tankowanie' ? 'układ plemion (tylko paliwo)' : w.typ === 'przelot' ? 'układ przelotowy' : `${esc(cyw?.nazwa ?? '')}, ${(w.populacjaMln ?? 0).toLocaleString('pl-PL')} mln mieszkańców${w.sektor !== undefined ? `, sektor ${w.sektor + 1}` : ''}`}</span></h2>`;
  if (w.typ === 'przelot') {
    return `<div class="panel rynek">${naglowek}<p class="szary">Układ przelotowy: ani rynku, ani paliwa. Służy tylko do przelotu.</p></div>`;
  }
  if (!gra.rynekZnany(tu)) {
    return `<div class="panel rynek">${naglowek}<p class="szary">Tu nie ma rynku towarów. Paliwo po cenie bazowej.</p>${wierszPaliwa(gra, ilosci)}</div>`;
  }
  const ef = gra.efekty();
  const wiersze = TOWARY.map((t) => {
    const c = gra.ceny(tu, t);
    const l = gra.stan.ladownia[t];
    // Runda 3, bramka G: towar sektora, którego tier cywilizacji jeszcze nie otworzył, nie istnieje na tym rynku.
    if (!c) return `<tr data-towar="${t}"><td class="lewo"><b>${nazwaTowaru(t)}</b><div class="szary maly">${liczba1(K.towary[t].gestosc)} t/m³${l.m3 > 0 ? ` · w ładowni ${liczba1(l.m3)} m³` : ''}</div></td><td colspan="5" class="szary">— (sektor zamknięty na tym tierze: ani kupna, ani sprzedaży)</td></tr>`;
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
      <td>${kr(c.sprzedazKr)}${c.kara > 0 ? `<div class="strata maly" title="Pamięć zakupu: kupiłeś ten towar tutaj; kara zgaśnie po ${c.licznikPamieci} skokach">kara ${Math.round(c.kara * 100)}% (jeszcze ${c.licznikPamieci} sk.)</div>` : ''}</td>
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
    <div class="szary maly" style="margin-top:4px">Cena krańcowa: każdy kolejny m³ wyceniany jest przy zapasie po poprzednim. Handlowiec (pozycja ${procent(ef.udzialHandlowca)} okna spreadu${gra.spreadPodstawowy > 0 ? ` ${Math.round(gra.spreadPodstawowy * 100)}%` : ''}) ${gra.spreadPodstawowy > 0 ? 'przesuwa obie ceny ku środkowi okna' : 'nie ma na co wpływać: spread podstawowy wynosi 0'}.${gra.wariantSpreadu !== 'A' ? ` Wariant ${gra.wariantSpreadu}: odsprzedaż w miejscu zakupu karana ${Math.round(K.tradeSpread * 100)}% przez ${P.pamiecZakupuSkokow} skoków.` : ''}</div>
    ${wierszPaliwa(gra, ilosci)}
    ${stocznia(gra)}
  </div>`;
}

/** Stocznia w doku stolicy (progresja): wycena kolejnego szczebla kadłuba z historii kursów gracza. */
function stocznia(gra: Gra): string {
  if (!gra.progresja || !gra.wStoczni()) return '';
  const w = gra.wycenaSzczebla();
  if (!w) return `<div class="maly" style="margin-top:8px"><b>Stocznia:</b> masz najwyższy szczebel kadłuba (${gra.stan.szczebel}).</div>`;
  const opis = `szczebel ${w.nastepny}: ładownia ${Math.round(w.ladowniaM3)} m³, bak ${Math.round(w.bakM3)} m³ (teraz ${Math.round(gra.ladownia())} / ${Math.round(gra.bak())})`;
  if (w.kwotaKr === null) return `<div class="maly" style="margin-top:8px"><b>Stocznia:</b> ${opis}. Brak wyceny: ${esc(w.powod ?? '')}.</div>`;
  return `<div class="maly" style="margin-top:8px"><b>Stocznia:</b> ${opis} za <b>${kr(w.kwotaKr)}</b> (${P.progresja.k} × mediana Twojego zysku na kurs ${kr(w.medianaZyskuKr ?? 0)} z ${w.kursow} kursów)
    <button data-akcja="kup-szczebel" ${w.kwotaKr <= gra.stan.kr ? '' : 'disabled'} title="Kadłub szczebla ${w.nastepny}">Kup kadłub</button></div>`;
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
      <td>${m3(gra.stan.paliwo)} / ${m3(gra.bak())}</td>
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
    <h2>Ładownia <span class="szary maly">${m3(obj)} / ${m3(gra.ladownia())} · ${liczba1(masa)} t / ${liczba1(gra.maxMasa())} t${gra.progresja ? ` · kadłub szczebla ${gra.stan.szczebel}` : ''}</span></h2>
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
      <td>${liczba2(z.umiejetnosc)}${z.xp !== undefined ? `<div class="szary maly">${nazwaTieruZalogi(tierZalogi(z.xp))} · ${Math.round(z.xp)} XP</div>` : ''}</td>
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
      const sektor = c.sektor !== undefined ? `sektor ${c.sektor + 1} · ` : '';
      const planety = c.planety.length <= 6 ? c.planety.map((id) => esc(gra.wezel(id).nazwa)).join(', ') : `${c.planety.length} planet, stolica ${esc(gra.wezel(c.stolica).nazwa)}`;
      if (!znana) {
        return `<div class="cyw" style="border-color:${kolor}"><b>${esc(c.nazwa)}</b> <span class="szary">— cywilizacja nieznana</span>
          <div class="maly">${sektor}${c.planety.length} planet na mapie. Rynek, otwartość i potrzeby nieznane. Pierwsze lądowanie to kontakt: odsłoni rynki i obudzi popyt.</div></div>`;
      }
      const produkuje = TOWARY_I_PALIWO.filter((t) => c.produkcjaM3NaDobe[t] > c.potrzebyM3NaDobe[t] * P.ui.progBilansu);
      const potrzebuje = TOWARY_I_PALIWO.filter((t) => c.potrzebyM3NaDobe[t] > c.produkcjaM3NaDobe[t] * P.ui.progBilansu);
      const opis = (lista: typeof produkuje) =>
        lista.length ? lista.map((t) => `${nazwaTowaru(t)} (${liczba1(Math.abs(c.produkcjaM3NaDobe[t] - c.potrzebyM3NaDobe[t]))} m³/dobę)`).join(', ') : 'nic znaczącego';
      const otwartosc = c.otwartosc > 0 ? `otwartość handlowa ${liczba2(c.otwartosc)} (sufit wymiany NPC: ${procent(c.otwartosc)} dziennej konsumpcji portu)` : 'bez wymiany NPC';
      const postep = gra.progresja ? gra.postepAwansu(c.id) : null;
      const tier = postep
        ? postep.nastepny
          ? `<div class="maly">Tier <b>${postep.tier}</b> / ${K.TierCount}. Koszyk T${postep.nastepny}: ${postep.towary.map((x) => `${nazwaTowaru(x.towar)} ${procent(Math.min(1, x.dostarczoneWU / x.potrzebneWU))} (${liczba1(x.dostarczoneWU / K.towary[x.towar].basePrice)} / ${liczba1(x.potrzebneWU / K.towary[x.towar].basePrice)} m³)`).join(', ')} · PKB portów ${Math.round(postep.pkbWU).toLocaleString('pl-PL')} WU/dobę</div>`
          : `<div class="maly">Tier <b>${postep.tier}</b> / ${K.TierCount}: najwyższy.</div>`
        : '';
      return `<div class="cyw" style="border-color:${kolor}"><b>${esc(c.nazwa)}</b> <span class="szary">${sektor}${c.populacjaMln.toLocaleString('pl-PL')} mln</span>${tier}
        <div class="maly">${planety}</div>
        <div class="maly">${otwartosc} · samowystarczalność żywnościowa SSR ${liczba2(c.ssr)} (${c.ssr >= 1 ? 'eksporter' : 'importer'} żywności)</div>
        <div class="maly"><span class="zysk">Nadwyżka portów:</span> ${opis(produkuje)}</div>
        <div class="maly"><span class="strata">Brakuje w portach:</span> ${opis(potrzebuje)}</div></div>`;
    })
    .join('');
  return `<div class="panel cywilizacje"><h2>Cywilizacje <span class="szary maly">otwartość, SSR i bilans portów</span></h2>${bloki}</div>`;
}

export function tablicaCen(gra: Gra, pokazWszystkie: boolean): string {
  const tu = gra.stan.pozycja;
  const d = gra.graf.dijkstra(tu);
  const zasieg = gra.zasieg();
  const planety = gra.swiat.wezly
    .filter((w) => w.typ === 'planeta' && (w.id === tu || gra.informacjaORynku(w.id) !== null))
    .map((w) => ({ w, d: d.get(w.id)!, info: gra.informacjaORynku(w.id) }))
    .sort((a, b) => a.d.dystans - b.d.dystans);
  const limit = P.ui.tablicaCenWierszy;
  const widoczne = pokazWszystkie ? planety : planety.slice(0, limit);
  const ukryte = gra.swiat.wezly.filter((w) => w.typ === 'planeta').length - planety.length;
  const wiersze = widoczne
    .map(({ w, d, info }) => {
      const komorki = TOWARY.map((t: Towar) => {
        const c = gra.ceny(w.id, t);
        if (!c) return `<td class="szary">${gra.rynekZnany(w.id) && gra.stan.rynki[w.id][t].dostepny === false ? '—' : '?'}</td>`;
        const moj = gra.stan.ladownia[t].m3 > 0;
        return `<td><span class="${moj ? 'pogrubienie' : ''}">${Math.round(c.sprzedazKr).toLocaleString('pl-PL')}</span><span class="szary"> / ${Math.round(c.kupnoKr).toLocaleString('pl-PL')}</span><div class="szary maly">n ${liczba2(c.nacisk)}</div></td>`;
      }).join('');
      const wZasiegu = zasieg.has(w.id);
      const odczyt = info && info.tryb === 'odczyt' ? `<div class="szary maly">odczyt sprzed ${liczba1(info.wiekDob)} dób</div>` : '';
      const paliwo = gra.cenaPaliwa(w.id);
      return `<tr class="przycisk-wiersz ${info?.tryb === 'odczyt' ? 'odczyt' : ''}" data-cel="${w.id}" title="Kliknij, aby ustawić trasę">
        <td class="lewo"><span class="kropka" style="background:${kolorCywilizacji(gra, w.cywilizacja)}"></span>${esc(w.nazwa)}${w.id === tu ? ' <span class="szary">(tu)</span>' : ''}${odczyt}</td>
        <td>${w.id === tu ? '—' : `${pc(d.dystans)}, ${d.skoki} sk.`}${wZasiegu || w.id === tu ? '' : '<div class="strata maly">poza zasięgiem baku</div>'}</td>
        ${komorki}
        <td>${paliwo === null ? '?' : Math.round(paliwo).toLocaleString('pl-PL')}</td>
      </tr>`;
    })
    .join('');
  const stopka =
    planety.length > limit
      ? `<div style="margin-top:6px"><button data-akcja="przelacz-tablice">${pokazWszystkie ? `Pokaż tylko ${limit} najbliższych` : `Pokaż wszystkie (${planety.length})`}</button></div>`
      : '';
  const uwaga = gra.informacja === 'zasieg' ? ` · tryb <b>zasięg</b>: na żywo w łączności ${K.zasiegLacznosci} pc, poza nią ostatni odczyt z odwiedzonych planet${ukryte > 0 ? `; ${ukryte} planet bez informacji` : ''}` : '';
  return `<div class="panel kolumna-szeroka"><h2>Tablica cen <span class="szary maly">sprzedaż / kupno w kr/m³ przy obecnej załodze · n = nacisk · pogrubione: masz ten towar${uwaga}</span></h2>
    <table><thead><tr><th>Planeta</th><th>Odległość</th>${TOWARY.map((t) => `<th>${nazwaTowaru(t)}</th>`).join('')}<th>Paliwo</th></tr></thead><tbody>${wiersze}</tbody></table>${stopka}
  </div>`;
}
