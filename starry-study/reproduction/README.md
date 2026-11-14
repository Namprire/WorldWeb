# Starry Nightrider – lokale Reproduktion

Diese Version führt **den tatsächlich ausgelieferten öffentlichen Spielclient** mit seinen Originalgrafiken und Sprachclips lokal aus. Sie ersetzt den stark vereinfachten Nachbau als visuelle Referenz. Der Nutzer hat die entsprechende Erlaubnis zur Wiederverwendung in diesem Chat ausdrücklich bestätigt.

## Starten

Node.js 22.12+ und ein Browser mit WebGL 2 werden benötigt.

```sh
cd /Users/nampham/Documents/ChatGPT/Junction/starry-study/reproduction
npm ci
npm run dev
```

Öffnen: [http://127.0.0.1:5178](http://127.0.0.1:5178/). Mit **Step into the painting** beginnt das Spiel. Der alte Prototyp darf nicht gleichzeitig denselben Port belegen.

Die Originalsteuerung bleibt erhalten: W zum Treten, A/D zum Lenken, S zum Bremsen, Space zum Springen, dreimal Space zum Fliegen, F zum Gehen, E für Tricks, T für Theatermodus, M für Ton, Escape zurück zur Galerie. Ziehen im Bild bewegt die Kamera; das Mausrad verändert den Abstand.

## Was original ist

- Drei unveränderte JavaScript-Bundles, einschließlich Three.js r187, Shadern, prozeduraler Geometrie, Physik, Kamera, Figurenanimation, Spielregeln und Audio-Synthese.
- Das originale Stylesheet und die originale DOM-Struktur mit kleinen Anpassungen für den lokalen Start.
- Die fünf Hauptgrafiken, zwei kleineren Bildvarianten, das Vorschaubild und 108 Sprachclips.
- Insgesamt **120 originale Dateien, 8.734.793 Bytes**. Herkunft und SHA-256 stehen in [asset-manifest.json](asset-manifest.json).

Die sichtbare Spielgrafik wird vom ursprünglichen Renderer erzeugt. Das ist keine Behauptung, das ursprüngliche GitHub-Repository oder dessen TypeScript-Quelldateien wiederhergestellt zu haben. Es handelt sich um die lokale Ausführung des ausgelieferten Produktionsclients.

## Lokale Anpassungen

[src/main.ts](src/main.ts) ist eine neue TypeScript-Startschicht. Sie wird vor dem Spiel geladen:

1. Der öffentliche WebSocket-Dienst wird nicht verbunden; die Welt läuft als Einzelspieler.
2. Presence liefert lokal einen Spieler. Es werden keine echten Online-Spieler vorgetäuscht.
3. Die Bestenliste speichert ausschließlich in `localStorage` dieses Browsers. Sie ist nicht die öffentliche Bestenliste. Der Dialog weist darauf hin.
4. Telemetrie und Beacon-Aufrufe werden verworfen. Eine Content Security Policy begrenzt Verbindungen, Bilder und Audio auf den lokalen Ursprung.
5. Der optionale Gesprächsserver ist nicht verfügbar. Die im Client vorhandenen normalen NPC-Sprachclips funktionieren lokal.

Die Original-Bundles werden dafür **nicht verändert**. Der Adapter ist kein rekonstruierter Server und enthält keine Zugangsdaten. Er ist ausschließlich für lokalen Betrieb gedacht; die lokalen Scores haben keine Online-Validierung.

## Prüfen

```sh
npm run build
npm run preview
```

In einem zweiten Terminal:

```sh
cd /Users/nampham/Documents/ChatGPT/Junction/starry-study
npm ci
node scripts/verify-reproduction.mjs
```

Der Test verwendet eine isolierte Chrome-Sitzung, prüft Galerie, Übergang, Sammeln, Gehen, Fahrrad, Flug, Theater, lokale Score-Speicherung, kleine Bildvarianten und Datei-Hashes. Außerdem prüft er, dass keine externen HTTP-Anfragen oder echten WebSocket-Verbindungen stattfinden. Er verwendet normale Spieltasten und verändert keine öffentliche Bestenliste. Ergebnisse und Screenshots liegen unter `../evidence/reproduction/`.

Die Bildwirkung entspricht dem ausgelieferten Client wesentlich genauer als der unabhängige Prototyp. Einzelne Screenshots sind durch Animationszeit, Position, Auflösung und Grafikhardware nicht zwingend pixelidentisch. Online-Mehrspieler und ursprüngliche Serverdienste sind ausdrücklich nicht enthalten.

Keine Veröffentlichung wurde vorgenommen. Die Wiederverwendungsbestätigung des Nutzers ist im Manifest dokumentiert; daraus wird keine allgemeine Lizenz für Dritte abgeleitet.
