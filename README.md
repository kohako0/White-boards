# Freiraum — deine lokalen Whiteboards

Ein kreativer Ort für Gedanken, Skizzen und Bilder. Mit **Freiraum** erstellst du Whiteboards im Browser und speicherst sie direkt auf deinem Computer — ohne Konto, Cloud oder externe Abhängigkeiten.

## Funktionen

- **Mehrere Whiteboards:** erstellen, benennen, suchen, sortieren und wieder öffnen.
- **Automatische Speicherung:** Änderungen werden als lokale JSON-Dateien gesichert; der Speicherstatus ist im Editor sichtbar.
- **Zeichnen:** Freihandstift mit verschiedenen Farben und Strichstärken sowie ein Radierer für ganze Objekte.
- **Text und Notizen:** frei platzierbare Texte und farbige Notizzettel, per Doppelklick bearbeitbar.
- **Formen:** Rechtecke, Ellipsen und Pfeile, optional mit ausgefüllten Flächen.
- **Bilder:** PNG, JPEG, WebP und GIF per Dateiauswahl, Drag-and-drop oder Zwischenablage importieren.
- **Objektbearbeitung:** auswählen, verschieben, duplizieren, nach vorne bringen und löschen; Bilder, Formen und Notizzettel skalieren.
- **Navigation:** große Arbeitsfläche mit Zoom und Verschieben per Hand-Werkzeug.
- **Rückgängig und Wiederholen:** Bearbeitungsschritte im geöffneten Board zurücknehmen oder wiederherstellen.
- **Export und Import:** Boards als PNG exportieren oder als bearbeitbare JSON-Datei sichern und wieder importieren.

## Schnellstart

### Voraussetzungen

- Node.js ab Version **18**
- Ein moderner Browser

Lade das Repository als ZIP herunter und entpacke es oder klone es mit Git. Öffne anschließend ein Terminal im Projektordner:

```sh
npm start
```

Öffne danach die App im Browser:

**[http://127.0.0.1:4317](http://127.0.0.1:4317)**

Es ist kein `npm install` und kein Build-Schritt erforderlich. Nach dem Herunterladen des Projekts funktioniert die App offline.

### Windows: Start per Doppelklick

Klicke auf **`Start.cmd`**. Der Starter öffnet die App im Standardbrowser und startet den lokalen Server bei Bedarf im Hintergrund. Läuft bereits eine Freiraum-Instanz auf Port `4317`, wird sie wiederverwendet.

Der Hintergrundserver bleibt nach dem Schließen des Browsers aktiv. Ein Windows-Neustart beendet ihn. Beim Start über `npm start` kannst du den Server im Terminal mit **Strg + C** beenden.

## Bedienung

1. Klicke in der Übersicht auf **Neues Whiteboard** und vergib oben einen Namen.
2. Wähle ein Werkzeug in der oberen Leiste. Klicke für Text oder Notizzettel auf die Arbeitsfläche; ziehe für Zeichnungen und Formen mit gedrückter Maustaste.
3. Passe Farben, Strichstärke und Textgröße im Stilbereich an.
4. Importiere Bilder über das Bildsymbol, ziehe sie auf die Fläche oder füge sie aus der Zwischenablage ein.
5. Wähle Objekte mit dem Auswahlwerkzeug aus, um sie zu verschieben oder zu bearbeiten. Über die Eckpunkte lassen sich Bilder, Formen und Notizzettel skalieren.
6. Warte vor dem Schließen auf **Gespeichert** oder klicke auf **Speichern**.

Bilder behalten beim Skalieren ihr Seitenverhältnis. Halte **Umschalt** gedrückt, um Breite und Höhe unabhängig zu verändern. Der Radierer entfernt jeweils ein vollständiges Objekt.

### Tastenkürzel

Die Kürzel für Werkzeuge gelten außerhalb von Eingabefeldern.

| Taste | Aktion |
| --- | --- |
| `V` | Auswahlwerkzeug |
| `H` | Hand-Werkzeug |
| `P` | Stift |
| `E` | Objekt-Radierer |
| `T` | Text |
| `N` | Notizzettel |
| `R` | Rechteck |
| `O` | Ellipse |
| `A` | Pfeil |
| `Leertaste` + Ziehen | Arbeitsfläche verschieben |
| Mausrad | Am Mauszeiger zoomen |
| Doppelklick | Text oder Notizzettel bearbeiten |
| `Strg + Z` | Rückgängig |
| `Strg + Y` oder `Strg + Umschalt + Z` | Wiederholen |
| `Strg + D` | Ausgewähltes Objekt duplizieren |
| `Entf` oder `Rücktaste` | Ausgewähltes Objekt löschen |
| Pfeiltasten | Ausgewähltes Objekt bewegen |
| `Umschalt` + Pfeiltasten | Ausgewähltes Objekt in größeren Schritten bewegen |
| `Strg + S` | Sofort speichern |
| `Strg + V` | Bild aus der Zwischenablage einfügen |
| `Esc` | Auswahl aufheben |

Auf macOS kann für die Kombinationen mit `Strg` auch `Cmd` verwendet werden. Der Doppelklick-Starter ist für Windows vorgesehen; auf anderen Systemen erfolgt der Start über `npm start`.

## Speicherung und Backups

Die App legt im Projektordner automatisch einen Unterordner `boards/` an. Jedes Whiteboard wird darin als eigene JSON-Datei gespeichert. Importierte Bilder sind direkt in dieser Datei eingebettet.

- Änderungen werden nach einer kurzen Pause von etwa **0,7 Sekunden** gespeichert.
- Die Daten bleiben beim Neuladen des Browsers erhalten und sind unabhängig vom Browser-Cache.
- Sichere den Ordner `boards/` oder exportiere einzelne Boards als JSON.
- Ein JSON-Export kann über die Import-Schaltfläche in der Übersicht als neues Board geöffnet werden.
- Ein PNG-Export enthält das sichtbare Ergebnis als Bild; zum Weiterbearbeiten und Sichern aller Objekte dient das JSON-Format.
- Das Löschen eines Boards in der Übersicht entfernt seine Datei nach Bestätigung dauerhaft.

`boards/` ist in `.gitignore` eingetragen, damit persönliche Whiteboards bei normalen Git-Vorgängen nicht mit veröffentlicht werden.

## Technischer Aufbau

Freiraum verwendet **HTML, CSS und Vanilla JavaScript** für die Oberfläche, **SVG** für die Zeichenfläche und die integrierten Module von **Node.js** für den lokalen HTTP-Server und die Dateispeicherung. Es gibt keine externen Laufzeitabhängigkeiten.

```text
.
├── public/
│   ├── index.html        # Oberfläche und Dialoge
│   ├── style.css         # Layout und responsive Darstellung
│   ├── app.js            # Zeichenwerkzeuge, Editor und Exporte
│   └── favicon.svg
├── test/
│   └── server.test.js    # Automatisierte Server- und Speichertests
├── boards/               # Persönliche Board-Dateien; automatisch angelegt
├── server.js             # Lokaler HTTP-Server und Board-API
├── launch.js             # Windows-Starter mit Browseröffnung
├── Start.cmd             # Start per Doppelklick unter Windows
├── package.json
├── .gitignore
└── README.md
```

Der Server lauscht ausschließlich auf `127.0.0.1`. Die App ist für die lokale Nutzung durch eine Person ausgelegt. Eine Anmeldung, Cloud-Synchronisierung und gemeinsame Bearbeitung in Echtzeit sind nicht enthalten. Für den Betrieb wird der Node.js-Server benötigt; reines statisches Hosting, etwa über GitHub Pages, stellt die Speicher-API nicht bereit.

### Konfiguration

Beim direkten Start des Servers werden diese Umgebungsvariablen unterstützt:

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `PORT` | `4317` | Port des lokalen HTTP-Servers |
| `WHITEBOARD_DATA_DIR` | `boards/` im Projektordner | Speicherverzeichnis für Board-Dateien |

Beispiel in PowerShell:

```powershell
$env:PORT = '4320'
$env:WHITEBOARD_DATA_DIR = 'D:\MeineWhiteboards'
npm start
```

In diesem Beispiel ist die App unter `http://127.0.0.1:4320` erreichbar. `Start.cmd` und `launch.js` verwenden die feste Standardadresse mit Port `4317`; für einen eigenen Port starte die App direkt mit `npm start`.

### Tests

```sh
npm test
```

Die Tests prüfen das Erstellen, Speichern, Laden, Überschreiben und Löschen von Boards, die Validierung fehlerhafter Inhalte, die Zugriffskontrolle für fremde Web-Ursprünge sowie die Auslieferung der App-Dateien. Testdaten werden getrennt von persönlichen Boards angelegt.

## Grenzen

| Bereich | Grenze / Verhalten |
| --- | --- |
| Bildimport | Maximal 20 MB pro Bild |
| Große Bilder | Werden auf maximal 2200 Pixel Kantenlänge reduziert |
| Animierte GIFs | Werden als statisches Bild übernommen |
| Board-Datei / Speicheranfrage | Maximal 50 MB einschließlich eingebetteter Bilder |
| Elemente pro Board | Maximal 10.000 |
| PNG-Export | Maximal 6000 Pixel Kantenlänge |
| Rückgängig-Verlauf | Gilt innerhalb der geöffneten Bearbeitungssitzung |

## Häufige Fragen

**Die App startet nicht.**  
Prüfe mit `node --version`, ob Node.js installiert und im Terminal erreichbar ist. Starte anschließend `npm start` im Projektordner, um mögliche Fehlermeldungen zu sehen. Der gewählte Port muss frei sein.

**Es wird „Nicht gespeichert“ angezeigt.**  
Prüfe, ob der lokale Server läuft und das Speicherverzeichnis beschreibbar ist. Klicke erneut auf **Speichern** und schließe die App erst, wenn **Gespeichert** angezeigt wird.

**Kann ich meine Boards auf einen anderen Computer übertragen?**  
Ja. Kopiere den Ordner `boards/` in die dortige Freiraum-Installation oder exportiere die gewünschten Boards als JSON und importiere sie auf dem anderen Computer.
