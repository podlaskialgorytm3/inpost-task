# InPost Smart Finder

Link do aplikacji: https://inpost-task.vercel.app/
Eksplorowac mozna bezposrednio po wejsciu w link - bez logowania i bez konfiguracji.

## O aplikacji

InPost Smart Finder to szybka i przejrzysta wyszukiwarka punktow InPost. Pomaga wybrac najlepszy paczkomat lub punkt odbioru na podstawie lokalizacji, dostepnosci i funkcji. Zamiast przeklikiwac setki wynikow, dostajesz konkret, poukladane dane i jasne decyzje.

## Co znajdziesz w srodku

- Wyszukiwarke punktow z filtrami po kraju, miescie, kodzie, promieniu i funkcjach.
- Sortowanie po dostepnosci, odleglosci albo nazwie.
- Mape z podgladem wynikow oraz linki do Google Maps.
- Eksport listy wynikow do CSV i GeoJSON.
- Szczegoly punktu z adresem, godzinami i statusem.

## Jak to dziala (krotko i na temat)

- Dane pochodza z publicznego API punktow InPost.
- Paginacja i pamiec podreczna dbaja o szybkosc i stabilnosc.
- Filtrowanie i sortowanie odbywa sie po stronie serwera, a interfejs zostaje lekki.

## Start lokalny

Wymagania:

- Node.js 20 LTS
- npm 10+

Instalacja i uruchomienie:

```bash
npm install
npm run dev
```

Otworz: http://localhost:3000

Budowanie produkcyjne lokalnie:

```bash
npm run build
npm start
```

## Przykladowe zapytania do API

```bash
curl "http://localhost:3000/api/points?country=PL&city=Warszawa&limit=10&sortBy=name&sortDir=asc"
```

```bash
curl "http://localhost:3000/api/points?country=PL&lat=52.2297&lon=21.0122&radiusKm=5&sortBy=distance"
```

## Struktura projektu (skrot)

```text
app/          # interfejs i routing
app/api/      # endpointy API
lib/inpost/   # logika pobierania, pamiec podreczna, filtrowanie
tests/        # testy
```
