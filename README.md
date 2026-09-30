# Torownik

Lekki, samodzielny edytor planów torów agility. Aplikacja działa w przeglądarce i nie wymaga instalacji zależności ani procesu build.

## Uruchamianie

Opublikuj repozytorium jako stronę statyczną, np. przez GitHub Pages. Lokalny podgląd uruchom przez serwer statyczny — przeglądarki blokują moduły JavaScript otwierane bezpośrednio z `file://`.

## Struktura

- `index.html` — punkty montażowe interfejsu i podłączenie zasobów.
- `src/styles.css` — układ, responsywność i styl aplikacji.
- `src/app.js` — stan edytora, narzędzia, zapis lokalny i eksport.
- `src/obstacle-icons.js` — rysowanie ikon przeszkód na planszy.

Zmiany w projekcie są zapisywane w pamięci lokalnej przeglądarki. Projekt można też eksportować i importować jako JSON, a planszę pobrać jako PNG.

