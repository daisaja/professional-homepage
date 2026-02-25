---
title: "OpenClaw on Synology: A Developer Runs Self-Hosted AI — and Barely Survives"
description: "How I turned my Synology NAS into an AI gateway, survived eight obstacles, and ended up triumphantly running GPT-5.3-Codex on my own hardware."
pubDate: 2026-02-25
---

*How I turned my Synology NAS into an AI gateway, survived eight obstacles, and ended up triumphantly running GPT-5.3-Codex on my own hardware.*

---

It was supposed to be simple. It never is.

I've been running a Synology DiskStation for years. I know how Docker works. I have an API key. So I thought: how hard can it be to run [OpenClaw](https://github.com/openclaw/openclaw) — a self-hosted AI gateway — on my NAS?

Spoiler: Eight hours. Eight obstacles. One final configuration I'm not going to keep to myself.

---

## What is OpenClaw, anyway?

OpenClaw is a self-hosted AI gateway: a central endpoint through which you can route all your AI requests — whether Claude, GPT, or a dozen other providers. It comes with a Control UI, Telegram integration, and agent management. The thing is powerful. But it comes at a price: it assumes you know what you're doing.

I thought I knew what I was doing.

---

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

---

## Obstacle 2: `/home/node` is Yesterday's News

Once the container runs as root, it looks for its config files in `/root/.openclaw` — not, as you might naively assume, in `/home/node/.openclaw`. This is actually logical. But after an hour of debugging, you're not in the mood for logic.

The volume mapping had to be:

```yaml
volumes:
  - /volume1/docker/openclaw/config:/root/.openclaw
```

Of course. Naturally. Obvious. In hindsight.

---

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

---

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

---

## Obstacle 5: Device Token Mismatch — The Final Boss

This is where the real problems start. And where I began questioning my life choices.

The Control UI loads. Nice. The WebSocket connects. Also nice. And then:

```
1008: device token mismatch
```

Okay. Clear browser cache? No. Clear config directory and restart? No. Clear browser LocalStorage? No. Clear IndexedDB? No.

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

---

## Obstacle 6: Telegram — Timing Is Everything

Telegram bot set up, pairing code requested. The code expires after five minutes. I was done with the config after six minutes.

```bash
node /app/openclaw.mjs pairing approve telegram MY_CODE
```

If you have SSH, expired codes are no problem.

---

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

---

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

---

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

---

## Conclusion: The Rabbit Hole Is Deeper Than You Think

Self-hosted AI works. OpenClaw is powerful. The Synology is a solid foundation.

But the path to get there is no walk in the park. It's an obstacle course of undocumented behaviors, subtle configuration conflicts, and moments where you seriously consider whether you should just leave all of this in the cloud.

And then you're sitting there, it's midnight, and the Control UI loads. GPT-5.3-Codex responds. Everything runs on your own hardware.

The feeling is priceless.

So: do it. Enable SSH from the start. Read the source code when everything else fails. And never forget: when the error is `1008: device token mismatch`, it's usually two lines of JSON.

Good luck. You'll need it.

---

*Running on: Synology DS923+, Docker via Container Manager, OpenClaw `alpine/openclaw:latest`.*
