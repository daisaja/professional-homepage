# Blog Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Zweisprachigen (DE/EN) Blog mit Astro Content Collections zur bestehenden Portfolio-Site hinzufügen.

**Architecture:** Markdown-Dateien in zwei Astro Content Collections (`blog-de`, `blog-en`), dateibasiertes Routing via `src/pages/de/blog/` und `src/pages/en/blog/`, gemeinsames `BlogLayout.astro`. Homepage bleibt unverändert.

**Tech Stack:** Astro v5, Tailwind CSS v4 (`@tailwindcss/vite`), `@tailwindcss/typography` (neu), TypeScript, Zod

**Repo:** `/Users/lars/Projects/privat/professional-homepage/professional-homepage/`

---

### Task 1: Typography-Plugin installieren

**Files:**
- Modify: `package.json`
- Modify: `src/styles/global.css`

**Step 1: Plugin installieren**

```bash
cd /Users/lars/Projects/privat/professional-homepage/professional-homepage
npm install @tailwindcss/typography
```

Expected: `@tailwindcss/typography` erscheint in `package.json` dependencies.

**Step 2: Plugin in global.css registrieren**

Datei `src/styles/global.css` — nach den bestehenden Imports anhängen:

```css
@import "tailwindcss/theme" layer(theme);
@import "tailwindcss/preflight" layer(base);
@import "tailwindcss/utilities" layer(utilities);
@plugin "@tailwindcss/typography";
```

**Step 3: Build prüfen**

```bash
npm run build
```

Expected: Build erfolgreich, keine Fehler.

**Step 4: Commit**

```bash
git add package.json package-lock.json src/styles/global.css
git commit -m "feat: add @tailwindcss/typography plugin"
```

---

### Task 2: Content Collections konfigurieren

**Files:**
- Create: `src/content/config.ts`

**Step 1: Config-Datei erstellen**

```typescript
// src/content/config.ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
});

const blogDe = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/blog/de' }),
  schema: blogSchema,
});

const blogEn = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/blog/en' }),
  schema: blogSchema,
});

export const collections = {
  'blog-de': blogDe,
  'blog-en': blogEn,
};
```

**Step 2: Type-Check**

```bash
npx astro check
```

Expected: Keine TypeScript-Fehler.

**Step 3: Commit**

```bash
git add src/content/config.ts
git commit -m "feat: add blog content collections config"
```

---

### Task 3: Deutschen Artikel anlegen

**Files:**
- Create: `src/content/blog/de/openclaw-synology.md`

**Step 1: Verzeichnis anlegen und Datei erstellen**

```bash
mkdir -p src/content/blog/de
```

Datei `src/content/blog/de/openclaw-synology.md` — vollständiger Inhalt:

````markdown
---
title: "OpenClaw auf Synology: Ein Entwickler betreibt Self-Hosted AI — und überlebt es (knapp)"
description: "Wie ich meinen Synology NAS zum AI-Gateway umgebaut habe, dabei acht Hürden überwunden habe und am Ende triumphierend mit GPT-5.3-Codex dasitze."
pubDate: 2026-02-25
---

Es sollte einfach sein. Es ist nie einfach.

Ich betreibe seit Jahren eine Synology DiskStation. Ich weiß, wie Docker funktioniert. Ich habe einen API-Key. Also dachte ich: Wie schwer kann es sein, [OpenClaw](https://github.com/openclaw/openclaw) — ein selbst-gehostetes AI-Gateway — auf meinem NAS zu betreiben?

Spoiler: Acht Stunden. Acht Hürden. Eine finale Konfiguration, die ich euch nicht vorenthalten werde.

## Was ist OpenClaw überhaupt?

OpenClaw ist ein Self-Hosted AI-Gateway: ein zentraler Endpunkt, über den ihr alle eure AI-Anfragen laufen lassen könnt — egal ob Claude, GPT, oder ein Dutzend andere Provider. Mit Control UI, Telegram-Integration, Agent-Verwaltung. Das Ding ist mächtig. Aber es hat seinen Preis: Es geht davon aus, dass ihr wisst, was ihr tut.

Ich dachte, ich weiß, was ich tue.

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

## Hürde 2: `/home/node` war gestern

Sobald der Container als root läuft, sucht er seine Config-Dateien in `/root/.openclaw` — nicht, wie man naiv annehmen könnte, in `/home/node/.openclaw`. Das ist eigentlich logisch. Aber nach einer Stunde Debugging ist man nicht mehr in der Stimmung für Logik.

Das Volume-Mapping musste also sein:

```yaml
volumes:
  - /volume1/docker/openclaw/config:/root/.openclaw
```

Klar. Natürlich. Offensichtlich. Im Nachhinein.

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

## Hürde 6: Telegram — Timing ist alles

Telegram-Bot eingerichtet, Pairing-Code angefordert. Der Code läuft nach fünf Minuten ab. Ich war nach sechs Minuten fertig mit der Config.

```bash
node /app/openclaw.mjs pairing approve telegram MEIN_CODE
```

Wer SSH hat, braucht keine Angst vor abgelaufenen Codes.

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

## Fazit: Der Kaninchenbau ist tiefer als ihr denkt

Self-Hosted AI funktioniert. OpenClaw ist mächtig. Die Synology ist ein solides Fundament.

Aber der Weg dorthin ist kein Spaziergang. Es ist ein Parcours aus undokumentierten Verhaltensweisen, subtilen Konfigurations-Konflikten und Momenten, in denen man ernsthaft überlegt, ob man das alles nicht einfach in der Cloud lassen sollte.

Und dann sitzt man da, es ist Mitternacht, und die Control UI lädt. GPT-5.3-Codex antwortet. Alles läuft über die eigene Hardware.

Das Gefühl ist unbezahlbar.

Also: Macht es. Aktiviert SSH von Anfang an. Lest den Source-Code, wenn alles andere versagt. Und vergesst nie: Wenn der Fehler `1008: device token mismatch` heißt, sind es meistens zwei Zeilen JSON.

Viel Erfolg. Ihr werdet sie brauchen.

---

*Läuft bei mir: Synology DS923+, Docker via Container Manager, OpenClaw `alpine/openclaw:latest`.*
````

**Step 2: Build prüfen**

```bash
npm run build
```

Expected: Build erfolgreich. Keine Fehler bezüglich der Collection.

**Step 3: Commit**

```bash
git add src/content/blog/de/openclaw-synology.md
git commit -m "content: add german openclaw article"
```

---

### Task 4: Englischen Artikel anlegen

**Files:**
- Create: `src/content/blog/en/openclaw-synology.md`

**Step 1: Verzeichnis anlegen und Datei erstellen**

```bash
mkdir -p src/content/blog/en
```

Datei `src/content/blog/en/openclaw-synology.md` — vollständiger Inhalt:

````markdown
---
title: "OpenClaw on Synology: A Developer Runs Self-Hosted AI — and Barely Survives"
description: "How I turned my Synology NAS into an AI gateway, survived eight obstacles, and ended up triumphantly running GPT-5.3-Codex on my own hardware."
pubDate: 2026-02-25
---

It was supposed to be simple. It never is.

I've been running a Synology DiskStation for years. I know how Docker works. I have an API key. So I thought: how hard can it be to run [OpenClaw](https://github.com/openclaw/openclaw) — a self-hosted AI gateway — on my NAS?

Spoiler: Eight hours. Eight obstacles. One final configuration I'm not going to keep to myself.

## What is OpenClaw, anyway?

OpenClaw is a self-hosted AI gateway: a central endpoint through which you can route all your AI requests — whether Claude, GPT, or a dozen other providers. It comes with a Control UI, Telegram integration, and agent management. The thing is powerful. But it comes at a price: it assumes you know what you're doing.

I thought I knew what I was doing.

## Obstacle 1: EACCES — Welcome to the World of Docker Permissions

The `alpine/openclaw:latest` Docker image runs as the `node` user by default. Synology has its own opinions about filesystem permissions. The result: a bright red `EACCES` error on startup.

The fix is trivial once you know it:

```yaml
services:
  openclaw-gateway:
    image: alpine/openclaw:latest
    user: "0:0"  # root. Yes, I know. Yes, anyway.
```

Root in the container. Not elegant. Works. Moving on.

## Obstacle 2: `/home/node` is Yesterday's News

Once the container runs as root, it looks for its config files in `/root/.openclaw` — not, as you might naively assume, in `/home/node/.openclaw`. This is actually logical. But after an hour of debugging, you're not in the mood for logic.

The volume mapping had to be:

```yaml
volumes:
  - /volume1/docker/openclaw/config:/root/.openclaw
```

Of course. Naturally. Obvious. In hindsight.

## Obstacle 3: The Gateway That Only Talked to Itself

OpenClaw binds to `127.0.0.1:18789`. Loopback. Not reachable from outside. This is probably sensible from a security standpoint, but on a NAS sitting as a server in your home network, it's a small problem.

The solution: `network_mode: host`, so the container shares the host's network. Then an nginx reverse proxy as a second container, terminating HTTPS and exposing port 18790 to the outside.

Created a self-signed SSL certificate, uploaded it, configured nginx:

```yaml
openclaw-proxy:
  image: nginx:alpine
  network_mode: host
  volumes:
    - /volume1/docker/openclaw/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - /volume1/docker/openclaw/ssl:/etc/nginx/ssl:ro
```

Browser warning about self-signed cert? Ignore it. We're professionals.

## Obstacle 4: CORS — The Silent Killer

nginx proxies. The browser loads the Control UI. And then... nothing. The WebSocket request fails silently due to CORS.

```json
"gateway": {
  "controlUi": {
    "allowedOrigins": ["https://192.168.178.34:18790"]
  }
}
```

Five minutes. Had I thought of this earlier, it would have been just five minutes.

## Obstacle 5: Device Token Mismatch — The Final Boss

This is where the real problems start. And where I began questioning my life choices.

The Control UI loads. Nice. The WebSocket connects. Also nice. And then:

```
1008: device token mismatch
```

Okay. Clear browser cache? No. Clear config directory and restart? No. Delete browser LocalStorage? No. Clear IndexedDB? No.

I emptied everything that could be emptied. The error remained.

### The Detective Work Begins

After the fifth hour, I decided that guessing wasn't working anymore. I needed SSH.

On the Synology: *Control Panel → Terminal & SNMP → Enable SSH*. Sounds simple. It is. Why didn't I do this sooner?

```bash
ssh super_ad@192.168.178.34
sudo docker exec -it openclaw-gateway sh
find / -name 'openclaw*' 2>/dev/null
```

There it is: `/app/openclaw.mjs`. The binary. The source of all truth.

```bash
node /app/openclaw.mjs dashboard --no-open
```

The URL appears. I open it directly — and get in. Eureka? Almost.

I look at `auth.json`. Contents: `{}`. Empty. Completely empty. That's suspicious.

### Source Code Analysis: The Rabbit Hole Goes Deeper

I clone the OpenClaw repository and read the code. And there it is, buried in the auth logic:

Device tokens aren't stored in `auth.json`. They're in `device-auth.json`. A file I had never created — because device pairing had never happened.

Then the second revelation that explains everything: the gateway had **both** environment variables set — `OPENCLAW_GATEWAY_TOKEN` *and* `OPENCLAW_GATEWAY_PASSWORD`. When in conflict: automatic password mode. The `#token=` in my URL was silently ignored.

I had been talking to the wrong auth system the entire time.

### The Fix — Two Lines of JSON

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

`auth.mode: "token"` — forces token mode, no more password fallback.
`dangerouslyDisableDeviceAuth: true` — skips device pairing for remote Control UI access.

Container restarted. Browser opened. WebSocket connected.

No `1008`. No error. The Control UI lights up.

I sat there staring at the screen. Five hours. Two lines of JSON.

That's self-hosted AI.

## Obstacle 6: Telegram — Timing Is Everything

Telegram bot set up, pairing code requested. The code expires after five minutes. I was done with the config after six minutes.

```bash
node /app/openclaw.mjs pairing approve telegram MY_CODE
```

If you have SSH, expired codes are no problem.

## Obstacle 7: No Provider, No Party

First agent test. Error: no AI provider configured. Default is Anthropic — and I had no Anthropic key in the config. But I had OpenAI.

```json
{
  "agents": {
    "defaults": {
      "model": { "primary": "openai/gpt-4.1" }
    }
  }
}
```

Works. Good. But I wanted more.

## Obstacle 8: GPT-5.3-Codex — The Finale

The `openai-codex` provider doesn't support API key auth. It wants OAuth. The OAuth callback runs on port 1455 — locally on the machine running `openclaw.mjs`. On the NAS.

The problem: my browser runs on my laptop. The callback port is on the NAS. The URL the OAuth flow generates points to `localhost:1455` — meaning the NAS, not my laptop.

Solution: SSH tunnel.

```bash
# AllowTcpForwarding enabled in /etc/ssh/sshd_config (disabled by default on Synology)
ssh -L 1455:localhost:1455 super_ad@192.168.178.34
```

Then on the NAS:

```bash
node /app/openclaw.mjs agents add main
```

OAuth flow starts. URL appears. Browser opens it. Redirect to `localhost:1455` — tunneled through SSH to the NAS. Auth code lands where it should.

Redirect URL copied, pasted into terminal. Provider configured.

GPT-5.3-Codex running. On my NAS. Via self-hosted gateway.

## The Final Configuration

If you want to replicate this — here's everything you need:

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
      OPENCLAW_GATEWAY_TOKEN: "your-token"
      OPENAI_API_KEY: "your-key"
      TELEGRAM_BOT_TOKEN: "your-bot-token"

  openclaw-proxy:
    image: nginx:alpine
    network_mode: host
    volumes:
      - /volume1/docker/openclaw/nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - /volume1/docker/openclaw/ssl:/etc/nginx/ssl:ro
```

**Important:** Don't set both `OPENCLAW_GATEWAY_TOKEN` and `OPENCLAW_GATEWAY_PASSWORD` — that triggers password mode.

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

Login: `https://192.168.178.34:18790/#token=<your-gateway-token>`

## Conclusion: The Rabbit Hole Is Deeper Than You Think

Self-hosted AI works. OpenClaw is powerful. The Synology is a solid foundation.

But the path to get there is no walk in the park. It's an obstacle course of undocumented behaviors, subtle configuration conflicts, and moments where you seriously consider whether you should just leave all of this in the cloud.

And then you're sitting there, it's midnight, and the Control UI loads. GPT-5.3-Codex responds. Everything runs on your own hardware.

The feeling is priceless.

So: do it. Enable SSH from the start. Read the source code when everything else fails. And never forget: when the error is `1008: device token mismatch`, it's usually two lines of JSON.

Good luck. You'll need it.

---

*Running on: Synology DS923+, Docker via Container Manager, OpenClaw `alpine/openclaw:latest`.*
````

**Step 2: Build prüfen**

```bash
npm run build
```

Expected: Build erfolgreich.

**Step 3: Commit**

```bash
git add src/content/blog/en/openclaw-synology.md
git commit -m "content: add english openclaw article"
```

---

### Task 5: BlogLayout.astro erstellen

**Files:**
- Create: `src/layouts/BlogLayout.astro`

**Step 1: Layout-Datei erstellen**

```astro
---
// src/layouts/BlogLayout.astro
interface Props {
  title: string;
  description: string;
  lang: 'de' | 'en';
  slug?: string; // undefined = Listing-Seite
}

const { title, description, lang, slug } = Astro.props;

const otherLang = lang === 'de' ? 'en' : 'de';
const otherLangUrl = slug
  ? `/${otherLang}/blog/${slug}`
  : `/${otherLang}/blog/`;
const listingUrl = `/${lang}/blog/`;
---

<!DOCTYPE html>
<html lang={lang}>
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width" />
    <meta name="description" content={description} />
    <title>{title} — Lars Gentsch</title>
    <link rel="stylesheet" href="/src/styles/global.css" />
  </head>
  <body class="bg-gray-50 text-gray-900">
    <nav class="bg-white shadow-sm fixed w-full top-0 z-50">
      <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between items-center h-16">
          <a href="/" class="text-xl font-bold text-gray-900 hover:text-gray-700 transition">
            Lars Gentsch
          </a>
          <div class="flex items-center gap-6">
            {slug && (
              <a href={listingUrl} class="text-gray-600 hover:text-gray-900 transition text-sm">
                ← Blog
              </a>
            )}
            <div class="flex gap-2 text-sm font-medium">
              <a
                href={`/de/blog/${slug ?? ''}`}
                class={`px-2 py-1 rounded transition ${lang === 'de' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                DE
              </a>
              <a
                href={`/en/blog/${slug ?? ''}`}
                class={`px-2 py-1 rounded transition ${lang === 'en' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
              >
                EN
              </a>
            </div>
          </div>
        </div>
      </div>
    </nav>

    <main class="pt-24 pb-20 px-4">
      <div class="max-w-3xl mx-auto">
        <slot />
      </div>
    </main>

    <footer class="bg-gray-900 text-white py-8 px-4">
      <div class="max-w-5xl mx-auto text-center">
        <p class="text-gray-400">
          © {new Date().getFullYear()} Lars Gentsch. All rights reserved.
        </p>
      </div>
    </footer>
  </body>
</html>
```

**Hinweis zu global.css:** Astro-Layouts importieren CSS über Frontmatter-Import, nicht über `<link>`. Den `<link>`-Tag durch einen Import ersetzen:

```astro
---
import '../styles/global.css';
// ... rest of frontmatter
---
```

Die finale Frontmatter-Sektion sieht so aus:

```astro
---
import '../styles/global.css';

interface Props {
  title: string;
  description: string;
  lang: 'de' | 'en';
  slug?: string;
}

const { title, description, lang, slug } = Astro.props;

const otherLang = lang === 'de' ? 'en' : 'de';
const listingUrl = `/${lang}/blog/`;
---
```

**Step 2: Build prüfen**

```bash
npm run build
```

Expected: Build erfolgreich.

**Step 3: Commit**

```bash
git add src/layouts/BlogLayout.astro
git commit -m "feat: add BlogLayout with language switcher"
```

---

### Task 6: Deutsche Blog-Seiten erstellen

**Files:**
- Create: `src/pages/de/blog/index.astro`
- Create: `src/pages/de/blog/[slug].astro`

**Step 1: Listing-Seite erstellen**

```astro
---
// src/pages/de/blog/index.astro
import { getCollection } from 'astro:content';
import BlogLayout from '../../../layouts/BlogLayout.astro';

const posts = await getCollection('blog-de');
posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
---

<BlogLayout title="Blog" description="Artikel über Software-Engineering, Management und Technik." lang="de">
  <h1 class="text-4xl font-bold text-gray-900 mb-12">Blog</h1>
  <div class="space-y-8">
    {posts.map(post => (
      <article class="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition">
        <time class="text-sm text-gray-500" datetime={post.data.pubDate.toISOString()}>
          {post.data.pubDate.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}
        </time>
        <h2 class="text-xl font-semibold text-gray-900 mt-2 mb-3">
          <a href={`/de/blog/${post.id}`} class="hover:text-gray-600 transition">
            {post.data.title}
          </a>
        </h2>
        <p class="text-gray-600">{post.data.description}</p>
        <a href={`/de/blog/${post.id}`} class="inline-block mt-4 text-gray-700 hover:text-gray-900 underline text-sm">
          Weiterlesen →
        </a>
      </article>
    ))}
  </div>
</BlogLayout>
```

**Step 2: Artikel-Seite erstellen**

```astro
---
// src/pages/de/blog/[slug].astro
import { getCollection } from 'astro:content';
import BlogLayout from '../../../layouts/BlogLayout.astro';

export async function getStaticPaths() {
  const posts = await getCollection('blog-de');
  return posts.map(post => ({
    params: { slug: post.id },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await post.render();
---

<BlogLayout
  title={post.data.title}
  description={post.data.description}
  lang="de"
  slug={post.id}
>
  <header class="mb-12">
    <time class="text-sm text-gray-500" datetime={post.data.pubDate.toISOString()}>
      {post.data.pubDate.toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' })}
    </time>
    <h1 class="text-4xl font-bold text-gray-900 mt-2">{post.data.title}</h1>
    <p class="text-xl text-gray-600 mt-4">{post.data.description}</p>
  </header>
  <div class="prose prose-gray max-w-none">
    <Content />
  </div>
</BlogLayout>
```

**Step 3: Build prüfen**

```bash
npm run build
```

Expected: Build erfolgreich. In `dist/de/blog/` liegen `index.html` und `openclaw-synology/index.html`.

**Step 4: Commit**

```bash
git add src/pages/de/blog/
git commit -m "feat: add german blog pages (listing + article)"
```

---

### Task 7: Englische Blog-Seiten erstellen

**Files:**
- Create: `src/pages/en/blog/index.astro`
- Create: `src/pages/en/blog/[slug].astro`

**Step 1: Listing-Seite erstellen**

```astro
---
// src/pages/en/blog/index.astro
import { getCollection } from 'astro:content';
import BlogLayout from '../../../layouts/BlogLayout.astro';

const posts = await getCollection('blog-en');
posts.sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());
---

<BlogLayout title="Blog" description="Articles about software engineering, management and technology." lang="en">
  <h1 class="text-4xl font-bold text-gray-900 mb-12">Blog</h1>
  <div class="space-y-8">
    {posts.map(post => (
      <article class="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition">
        <time class="text-sm text-gray-500" datetime={post.data.pubDate.toISOString()}>
          {post.data.pubDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </time>
        <h2 class="text-xl font-semibold text-gray-900 mt-2 mb-3">
          <a href={`/en/blog/${post.id}`} class="hover:text-gray-600 transition">
            {post.data.title}
          </a>
        </h2>
        <p class="text-gray-600">{post.data.description}</p>
        <a href={`/en/blog/${post.id}`} class="inline-block mt-4 text-gray-700 hover:text-gray-900 underline text-sm">
          Read more →
        </a>
      </article>
    ))}
  </div>
</BlogLayout>
```

**Step 2: Artikel-Seite erstellen**

```astro
---
// src/pages/en/blog/[slug].astro
import { getCollection } from 'astro:content';
import BlogLayout from '../../../layouts/BlogLayout.astro';

export async function getStaticPaths() {
  const posts = await getCollection('blog-en');
  return posts.map(post => ({
    params: { slug: post.id },
    props: { post },
  }));
}

const { post } = Astro.props;
const { Content } = await post.render();
---

<BlogLayout
  title={post.data.title}
  description={post.data.description}
  lang="en"
  slug={post.id}
>
  <header class="mb-12">
    <time class="text-sm text-gray-500" datetime={post.data.pubDate.toISOString()}>
      {post.data.pubDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    </time>
    <h1 class="text-4xl font-bold text-gray-900 mt-2">{post.data.title}</h1>
    <p class="text-xl text-gray-600 mt-4">{post.data.description}</p>
  </header>
  <div class="prose prose-gray max-w-none">
    <Content />
  </div>
</BlogLayout>
```

**Step 3: Build prüfen**

```bash
npm run build
```

Expected: Build erfolgreich. In `dist/en/blog/` liegen `index.html` und `openclaw-synology/index.html`.

**Step 4: Commit**

```bash
git add src/pages/en/blog/
git commit -m "feat: add english blog pages (listing + article)"
```

---

### Task 8: Navigation in index.astro aktualisieren

**Files:**
- Modify: `src/pages/index.astro:20-25`

**Step 1: "Blog"-Link in die Navigation einfügen**

In `src/pages/index.astro`, die bestehende Nav-Zeile:

```html
<a href="#reading" class="text-gray-700 hover:text-gray-900 transition">Reading</a>
<a href="#contact" class="text-gray-700 hover:text-gray-900 transition">Contact</a>
```

Ersetzen durch:

```html
<a href="#reading" class="text-gray-700 hover:text-gray-900 transition">Reading</a>
<a href="/de/blog/" class="text-gray-700 hover:text-gray-900 transition">Blog</a>
<a href="#contact" class="text-gray-700 hover:text-gray-900 transition">Contact</a>
```

**Step 2: Finalen Build prüfen**

```bash
npm run build
```

Expected: Build erfolgreich, keine Fehler.

**Step 3: Preview lokal starten und manuell prüfen**

```bash
npm run preview
```

Prüfen:
- [ ] Homepage lädt, "Blog" ist in der Navigation sichtbar
- [ ] `/de/blog/` zeigt Artikel-Listing
- [ ] `/de/blog/openclaw-synology` zeigt den deutschen Artikel mit Syntax-Highlighting
- [ ] `/en/blog/` zeigt englisches Listing
- [ ] `/en/blog/openclaw-synology` zeigt den englischen Artikel
- [ ] Sprachumschalter DE/EN wechselt zwischen den Versionen
- [ ] "Lars Gentsch"-Logo links oben verlinkt zur Homepage

**Step 4: Finaler Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: add Blog nav link to homepage"
```

---

### Task 9: Push und Deploy

**Step 1: Auf GitHub pushen**

```bash
git push
```

**Step 2: GitHub Actions / Deployment prüfen**

Das bestehende CI/CD-Setup (GitHub Actions → FTP zu Strato) deployt automatisch.
Repository-Actions unter https://github.com/daisaja/professional-homepage/actions beobachten.

Expected: Deploy-Workflow läuft durch, Site ist unter `https://lars-gentsch.de/de/blog/` erreichbar.
