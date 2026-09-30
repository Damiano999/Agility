# Agility map

Lekki, samodzielny edytor planów torów agility. Aplikacja działa w przeglądarce i nie wymaga instalacji zależności ani procesu build.

## Uruchamianie

Opublikuj repozytorium jako stronę statyczną, np. przez GitHub Pages. Lokalny podgląd uruchom przez serwer statyczny — przeglądarki blokują moduły JavaScript otwierane bezpośrednio z `file://`.

## Struktura

- `index.html` — punkty montażowe interfejsu i podłączenie zasobów.
- `src/styles.css` — układ, responsywność i styl aplikacji.
- `src/app.js` — stan edytora, narzędzia, zapis lokalny i eksport.
- `src/obstacle-icons.js` — rzut z góry, obrysy w skali i pomiary odległości.
- `src/scene-3d.js` — przestrzenne modele przeszkód i interaktywny widok WebGL.
- `assets/obstacles/` — ilustracje przeszkód.

Edytor oferuje rzut 2D z góry i prawdziwy widok 3D z bryłami przeszkód. W widoku 3D można obracać kamerę przeciąganiem pustego miejsca planszy, przybliżać kółkiem myszy i przesuwać przeszkody. Wymiary są liczone w metrach i dopasowane do rozmiaru planszy. Plan pokazuje przeszkody w nominalnych rozmiarach regulaminowych tam, gdzie FCI podaje wymiary (np. kładka ok. 10,5 m, 12 tyczek slalomu w odstępach 60 cm i tunel o średnicy 60 cm); inne konstrukcje są schematyczne i mogą różnić się zależnie od klasy lub lokalnych zasad.

Kolejność trasy wynika z unikalnych numerów przeszkód; aplikacja blokuje duplikaty, a wczytane starsze projekty automatycznie naprawia. Ich ruch, obrót i kolejność przebudowują wygładzoną linię. Narzędzie trasy pozwala zmieniać łuki. Tunel otwarty ma regulowaną długość 3–6 m i krzywiznę od prostego do łuku, zgodnie z [wytycznymi FCI](https://www.fci.be/medias/FCI-AGI-DIR-OBS-17043.pdf). Przycisk „Pokaż odległości” dodaje pomiary między kolejnymi przeszkodami.

Błędy importu, zapisu, eksportu, brakujących ikon i nieobsługiwanego WebGL są zgłaszane komunikatem w aplikacji. Silnik 3D Three.js jest ładowany z przypiętej wersji jsDelivr po wybraniu widoku 3D; ten widok wymaga połączenia z internetem i obsługi WebGL. W razie błędu edytor wraca do 2D i pokazuje komunikat.

Zmiany w projekcie są zapisywane w pamięci lokalnej przeglądarki. Projekt można eksportować i importować jako JSON, a planszę pobrać jako PNG.

