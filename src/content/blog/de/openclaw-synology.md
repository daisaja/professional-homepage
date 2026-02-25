---
title: "OpenClaw auf Synology: Ein Entwickler betreibt Self-Hosted AI — und überlebt es (knapp)"
description: "Wie ich meinen Synology NAS zum AI-Gateway umgebaut habe, dabei acht Hürden überwunden habe und am Ende triumphierend mit GPT-5.3-Codex dasitze."
pubDate: 2026-02-25
---

*Wie ich meinen Synology NAS zum AI-Gateway umgebaut habe, dabei acht Hürden überwunden habe und am Ende triumphierend mit GPT-5.3-Codex dasitze.*

---

Es sollte einfach sein. Es ist nie einfach.

Ich betreibe seit Jahren eine Synology DiskStation. Ich weiß, wie Docker funktioniert. Ich habe einen API-Key. Also dachte ich: Wie schwer kann es sein, [OpenClaw](https://github.com/openclaw/openclaw) — ein selbst-gehostetes AI-Gateway — auf meinem NAS zu betreiben?

Spoiler: Acht Stunden. Acht Hürden. Eine finale Konfiguration, die ich euch nicht vorenthalten werde.

---

## Was ist OpenClaw überhaupt?

OpenClaw ist ein Self-Hosted AI-Gateway: ein zentraler Endpunkt, über den ihr alle eure AI-Anfragen laufen lassen könnt — egal ob Claude, GPT, oder ein Dutzend andere Provider. Mit Control UI, Telegram-Integration, Agent-Verwaltung. Das Ding ist mächtig. Aber es hat seinen Preis: Es geht davon aus, dass ihr wisst, was ihr tut.

Ich dachte, ich weiß, was ich tue.

---

## Hürde 1: EACCES — Willkommen in der Welt der Docker-Berechtigungen

Das Docker Image `alpine/openclaw:latest` läuft standardmäßig als `node`-User. Synology hat da seine eigene Meinung zu Dateisystem-Berechtigungen. Das Ergebnis: ein knallroter `EACCES`-Fehler beim Start.

Die Lösung ist eigentlich trivial, wenn man sie kennt:

```yaml
services:
  openclaw-gateway:
    image: alpine/openclaw:latest
    user: "0:0"  # root. Ja, ich weiß. Ja, trotzdem.
```

Root im Container. Nicht elegant. Funktioniert. Weiter.

---

## Hürde 2: `/home/node` war gestern

Sobald der Container als root läuft, sucht er seine Config-Dateien in `/root/.openclaw` — nicht, wie man naiv annehmen könnte, in `/home/node/.openclaw`. Das ist eigentlich logisch. Aber nach einer Stunde Debugging ist man nicht mehr in der Stimmung für Logik.

Das Volume-Mapping musste also sein:

```yaml
volumes:
  - /volume1/docker/openclaw/config:/root/.openclaw
```

Klar. Natürlich. Offensichtlich. Im Nachhinein.

---

## Hürde 3: Der Gateway, der nur mit sich selbst reden wollte

OpenClaw bindet sich auf `127.0.0.1:18789`. Loopback. Von außen nicht erreichbar. Das ist aus Sicherheitsgründen vermutlich vernünftig, aber auf einem NAS, das als Server im Heimnetz hängt, ist das ein kleines Problem.

Die Lösung: `network_mode: host`, damit der Container das Netzwerk des Hosts teilt. Und dann ein nginx Reverse Proxy als zweiter Container, der HTTPS terminiert und auf Port 18790 nach außen erreichbar ist.

Selbst-signiertes SSL-Zertifikat erstellt, hochgeladen, nginx konfiguriert:

```yaml
openclaw-proxy:
  image: nginx:alpine
  network_mode: host
  volumes:
    - /volume1/docker/openclaw/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - /volume1/docker/openclaw/ssl:/etc/nginx/ssl:ro
```

Browser-Warnung wegen self-signed cert? Ignorieren. Wir sind Profis.

---

## Hürde 4: CORS — Der stille Killer

nginx leitet weiter. Der Browser ruft die Control UI auf. Und dann... nichts. Der WebSocket-Request scheitert lautlos an CORS.

```json
"gateway": {
  "controlUi": {
    "allowedOrigins": ["https://192.168.178.34:18790"]
  }
}
```

Fünf Minuten. Hätte ich früher dran gedacht, wären es nur fünf Minuten gewesen.

---

## Hürde 5: Device Token Mismatch — Der Endboss

Hier fangen die wirklichen Probleme an. Und hier habe ich angefangen, meinen Lebensweg zu hinterfragen.

Die Control UI lädt. Schön. Der WebSocket verbindet sich. Auch schön. Und dann:

```
1008: device token mismatch
```

Okay. Browser-Cache leeren? Nein. Config-Verzeichnis leeren und neu starten? Nein. Browser LocalStorage löschen? Nein. IndexedDB leeren? Nein.

Ich habe alles geleert, was sich leeren ließ. Der Fehler blieb.

### Die Detektivarbeit beginnt

Nach der fünften Stunde entschied ich, dass raten nicht mehr reicht. Ich brauchte SSH.

Auf der Synology: *Systemsteuerung → Terminal & SNMP → SSH aktivieren*. Klingt einfach. Ist es auch. Warum habe ich das nicht früher gemacht?

```bash
ssh super_ad@192.168.178.34
sudo docker exec -it openclaw-gateway sh
find / -name 'openclaw*' 2>/dev/null
```

Da ist sie: `/app/openclaw.mjs`. Das Binary. Die Quelle aller Wahrheit.

```bash
node /app/openclaw.mjs dashboard --no-open
```

Die URL erscheint. Ich öffne sie direkt — und komme rein. Heureka? Fast.

Ich schaue mir `auth.json` an. Inhalt: `{}`. Leer. Völlig leer. Das ist verdächtig.

### Source-Code-Analyse: Der Kaninchenbau wird tiefer

Ich clone das OpenClaw-Repository und lese den Code. Und da ist es, begraben in der Auth-Logik:

Device-Tokens werden nicht in `auth.json` gespeichert. Sie sind in `device-auth.json`. Eine Datei, die ich nie angelegt hatte — weil das Device-Pairing nie stattgefunden hatte.

Und dann die zweite Erkenntnis, die alles erklärt: Das Gateway hatte **beide** Environment-Variablen gesetzt — `OPENCLAW_GATEWAY_TOKEN` *und* `OPENCLAW_GATEWAY_PASSWORD`. Bei Konflikt: automatischer Password-Modus. Der `#token=` in meiner URL wurde stillschweigend ignoriert.

Ich hatte die ganze Zeit das falsche Auth-System angesprochen.

### Die Lösung — zwei Zeilen JSON

```json
{
  "gateway": {
    "auth": { "mode": "token" },
    "controlUi": {
      "dangerouslyDisableDeviceAuth": true
    }
  }
}
```

`auth.mode: "token"` — erzwingt Token-Modus, kein Password-Fallback mehr.
`dangerouslyDisableDeviceAuth: true` — überspringt das Device-Pairing für Remote-Zugriff.

Container neugestartet. Browser geöffnet. WebSocket verbunden.

Kein `1008`. Kein Fehler. Die Control UI leuchtet auf.

Ich saß da und starrte auf den Bildschirm. Fünf Stunden. Zwei Zeilen JSON.

Das ist Self-Hosted AI.

---

## Hürde 6: Telegram — Timing ist alles

Telegram-Bot eingerichtet, Pairing-Code angefordert. Der Code läuft nach fünf Minuten ab. Ich war nach sechs Minuten fertig mit der Config.

```bash
node /app/openclaw.mjs pairing approve telegram MEIN_CODE
```

Wer SSH hat, braucht keine Angst vor abgelaufenen Codes.

---

## Hürde 7: Kein Provider, keine Party

Erster Agent-Test. Fehler: kein AI-Provider konfiguriert. Standard ist Anthropic — und ich hatte keinen Anthropic-Key in der Config. Aber ich hatte OpenAI.

```json
{
  "agents": {
    "defaults": {
      "model": { "primary": "openai/gpt-4.1" }
    }
  }
}
```

Funktioniert. Gut. Aber ich wollte mehr.

---

## Hürde 8: GPT-5.3-Codex — Das Finale

Der `openai-codex` Provider unterstützt kein API-Key-Auth. Er will OAuth. Der OAuth-Callback läuft auf Port 1455 — lokal auf dem Rechner, der `openclaw.mjs` ausführt. Auf dem NAS.

Das Problem: Mein Browser läuft auf meinem Laptop. Der Callback-Port ist auf dem NAS. Die URL, die der OAuth-Flow erzeugt, zeigt auf `localhost:1455` — also auf den NAS, nicht auf meinen Laptop.

Lösung: SSH-Tunnel.

```bash
# AllowTcpForwarding in /etc/ssh/sshd_config aktiviert (war standardmäßig deaktiviert)
ssh -L 1455:localhost:1455 super_ad@192.168.178.34
```

Dann auf dem NAS:

```bash
node /app/openclaw.mjs agents add main
```

OAuth-Flow startet. URL erscheint. Browser öffnet sie. Redirect auf `localhost:1455` — wird durch den Tunnel auf den NAS geleitet. Auth-Code landet wo er soll.

Redirect-URL kopiert, in den Terminal eingefügt. Provider konfiguriert.

GPT-5.3-Codex läuft. Auf meinem NAS. Via Self-Hosted Gateway.

---

## Die finale Konfiguration

Falls ihr das replizieren wollt — hier ist alles, was ihr braucht:

**docker-compose.yml:**
```yaml
services:
  openclaw-gateway:
    image: alpine/openclaw:latest
    user: "0:0"
    network_mode: host
    volumes:
      - /volume1/docker/openclaw/config:/root/.openclaw
    environment:
      OPENCLAW_GATEWAY_TOKEN: "euer-token"
      OPENAI_API_KEY: "euer-key"
      TELEGRAM_BOT_TOKEN: "euer-bot-token"

  openclaw-proxy:
    image: nginx:alpine
    network_mode: host
    volumes:
      - /volume1/docker/openclaw/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /volume1/docker/openclaw/ssl:/etc/nginx/ssl:ro
```

**Wichtig:** Nicht gleichzeitig `OPENCLAW_GATEWAY_TOKEN` und `OPENCLAW_GATEWAY_PASSWORD` setzen — das löst den Password-Modus aus.

**openclaw.json:**
```json
{
  "agents": {
    "defaults": {
      "model": { "primary": "openai/gpt-5.3-codex" }
    }
  },
  "gateway": {
    "auth": { "mode": "token" },
    "controlUi": {
      "allowedOrigins": ["https://192.168.178.34:18790"],
      "dangerouslyDisableDeviceAuth": true
    },
    "trustedProxies": ["127.0.0.1"]
  }
}
```

Login: `https://192.168.178.34:18790/#token=<euer-gateway-token>`

---

## Fazit: Der Kaninchenbau ist tiefer als ihr denkt

Self-Hosted AI funktioniert. OpenClaw ist mächtig. Die Synology ist ein solides Fundament.

Aber der Weg dorthin ist kein Spaziergang. Es ist ein Parcours aus undokumentierten Verhaltensweisen, subtilen Konfigurations-Konflikten und Momenten, in denen man ernsthaft überlegt, ob man das alles nicht einfach in der Cloud lassen sollte.

Und dann sitzt man da, es ist Mitternacht, und die Control UI lädt. GPT-5.3-Codex antwortet. Alles läuft über die eigene Hardware.

Das Gefühl ist unbezahlbar.

Also: Macht es. Aktiviert SSH von Anfang an. Lest den Source-Code, wenn alles andere versagt. Und vergesst nie: Wenn der Fehler `1008: device token mismatch` heißt, sind es meistens zwei Zeilen JSON.

Viel Erfolg. Ihr werdet sie brauchen.

---

*Läuft bei mir: Synology DS423+, Docker via Container Manager, OpenClaw `alpine/openclaw:latest`.*
