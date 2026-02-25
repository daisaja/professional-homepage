---
title: "OpenClaw on Synology: A Developer Runs Self-Hosted AI — and Barely Survives"
description: "How I turned my Synology NAS into an AI gateway, survived eight obstacles, and ended up triumphantly running GPT-5.3-Codex on my own hardware."
pubDate: 2026-02-25
---

*How I turned my Synology NAS into an AI gateway, survived eight obstacles, and ended up triumphantly running GPT-5.3-Codex on my own hardware.*

---

It should be simple. It never is.

I've been running a Synology DiskStation for years. I know how Docker works. I have an API key. So I thought: how hard can it be to run OpenClaw — a self-hosted AI gateway — on my NAS?

Spoiler: Eight hours. Eight obstacles. One final configuration I won't keep from you.

![A NAS server at the center surrounded by eight locked gates as a gauntlet, the final gate cracked open with golden light streaming through](/blog/openclaw-synology/image-2.png)

---

## What is OpenClaw, anyway?

OpenClaw is a self-hosted AI gateway: a central endpoint through which you can route all your AI requests — whether Claude, GPT, or a dozen other providers. With a control UI, Telegram integration, agent management. I was impressed. I was still in the middle of being impressed when the first error hit.

I thought I knew what I was doing.

---

## Obstacle 1: EACCES — Welcome to the World of Docker Permissions

The Docker image `alpine/openclaw:latest` runs as the `node` user by default. Synology has its own opinions about filesystem permissions. The result: a bright red `EACCES` error on startup. No error message pointing anywhere useful. Just a door that won't open.

The solution is actually trivial, if you know it:

```yaml
services:
  openclaw-gateway:
    image: alpine/openclaw:latest
    user: "0:0"  # root. Yes, I know. Yes, anyway.
```

Root in the container. Not elegant. Works. Moving on.

---

## Obstacle 2: `/home/node` is History

Once the container runs as root, it looks for its config files in `/root/.openclaw` — not, as you might naively assume, in `/home/node/.openclaw`. That's actually logical. But after an hour of debugging, you're not in the mood for logic.

The volume mapping had to be:

```yaml
volumes:
  - /volume1/docker/openclaw/config:/root/.openclaw
```

Of course. Naturally. Obvious. In hindsight.

---

## Obstacle 3: The Gateway That Only Wanted to Talk to Itself

OpenClaw binds to `127.0.0.1:18789`. Loopback. Unreachable from outside. That's probably sensible from a security standpoint — but on a NAS sitting on a home network as a server, it's a bit of a problem. I'm on the outside. I want in.

The solution: `network_mode: host`, so the container shares the host's network. And then an nginx reverse proxy as a second container, terminating HTTPS and exposed on port 18790.

Created a self-signed SSL certificate, uploaded it, configured nginx:

```yaml
openclaw-proxy:
  image: nginx:alpine
  network_mode: host
  volumes:
    - /volume1/docker/openclaw/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - /volume1/docker/openclaw/ssl:/etc/nginx/ssl:ro
```

Browser warning about the self-signed cert? Ignore it. We're professionals.

---

## Obstacle 4: CORS — The Silent Killer

nginx forwards the request. The browser loads the control UI. And then... nothing. The WebSocket request fails silently. No 404, no 500. Just: nothing. CORS.

```json
"gateway": {
  "controlUi": {
    "allowedOrigins": ["https://192.168.178.34:18790"]
  }
}
```

Five minutes. If I'd thought of it earlier, it would have been just five minutes.

---

## Obstacle 5: Device Token Mismatch — The Final Boss

This is where the real problems start. And this is where I started questioning my life choices.

The control UI loads. Great. The WebSocket connects. Also great. And then:

```
1008: device token mismatch
```

Okay. Deep breath. Clear the browser cache? No. Wipe the config directory and restart? No. Delete browser LocalStorage? No. Clear IndexedDB? No. Seriously considered throwing the NAS out the window? Yes.

I cleared everything that could be cleared. The error stayed. The error stayed through every attempt, with the same indifference machines have. No new error message. No trace. Just `1008`.

### The Detective Work Begins

After the fifth hour, I decided that guessing wasn't going to cut it anymore. I needed SSH.

On the Synology: *Control Panel → Terminal & SNMP → Enable SSH*. Sounds simple. It is. Why didn't I do this sooner? No answer I'm willing to say out loud.

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

I clone the OpenClaw repository and read the code. Not because I enjoy it. Because I have no other choice.

And there it is, buried in the auth logic: device tokens are not stored in `auth.json`. They're in `device-auth.json`. A file I had never created — because device pairing had never happened. Of course.

And then the second realization, which explains everything: the gateway had **both** environment variables set — `OPENCLAW_GATEWAY_TOKEN` *and* `OPENCLAW_GATEWAY_PASSWORD`. On conflict: automatic password mode. The `#token=` in my URL was silently ignored.

I had spent five hours talking to the wrong auth system. The system didn't even tell me. It just went quiet and returned `1008`, again and again, with the friendliness of a bouncer who doesn't even explain why you can't come in.

### The Solution — Two Lines of JSON

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
`dangerouslyDisableDeviceAuth: true` — skips device pairing for remote access.

Container restarted. Browser opened. No `1008`. I stared at the screen for a moment to make sure it wasn't messing with me. It wasn't.

Two lines of JSON. Five hours of my life. Somewhere that has to be fair.

![A medieval knight holds a glowing ethernet cable like a sword, standing victorious before a castle built from NAS drives and Docker containers, with defeated debug error scrolls on the ground](/blog/openclaw-synology/image-3.png)

---

## Obstacle 6: Telegram — Timing is Everything

Set up the Telegram bot, requested the pairing code. The code expires after five minutes. I finished the config after six minutes. Of course.

```bash
node /app/openclaw.mjs pairing approve telegram MY_CODE
```

If you have SSH, you don't need to worry about expired codes.

---

## Obstacle 7: No Provider, No Party

First agent test. Error: no AI provider configured. The default is Anthropic — and I had no Anthropic key in the config. But I had OpenAI. That's enough.

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

The problem: my browser runs on my laptop. The callback port is on the NAS. The URL generated by the OAuth flow points to `localhost:1455` — meaning the NAS, not my laptop. I'm sitting in between, watching.

Solution: SSH tunnel.

```bash
# Enabled AllowTcpForwarding in /etc/ssh/sshd_config (was disabled by default)
ssh -L 1455:localhost:1455 super_ad@192.168.178.34
```

Then on the NAS:

```bash
node /app/openclaw.mjs agents add main
```

OAuth flow starts. URL appears. Browser opens it. Redirect to `localhost:1455` — forwarded through the tunnel to the NAS. Auth code lands where it belongs.

Copied the redirect URL, pasted it into the terminal. Provider configured.

GPT-5.3-Codex is running. On my NAS. Via self-hosted gateway.

---

## The Final Configuration

If you want to replicate this — here's everything you need.

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

**Important:** Don't set both `OPENCLAW_GATEWAY_TOKEN` and `OPENCLAW_GATEWAY_PASSWORD` at the same time — that triggers password mode. This note would have saved me five hours. It's here now so it doesn't cost you five hours.

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

## Conclusion: The Rabbit Hole is Deeper Than You Think

Self-hosted AI works. OpenClaw is powerful. The Synology is a solid foundation.

But getting there is no walk in the park. It's an obstacle course of undocumented behaviors, subtle configuration conflicts, and moments where you seriously consider whether you should just leave all of this in the cloud.

And then you're sitting there, it's midnight, and the control UI loads. GPT-5.3-Codex responds. Everything is running on your own hardware.

That feeling is priceless.

![Developer at their desk after the long battle, with a sleeping dragon on the server stack behind them](/blog/openclaw-synology/image-1.png)

So: do it. Enable SSH from the start — not when the pain gets bad enough, but right at the beginning. Read the source code when everything else fails. And never forget: when the error says `1008: device token mismatch`, it's usually two lines of JSON.

You will need SSH. Enable it now.

---

*Running on: Synology DS423+, Docker via Container Manager, OpenClaw `alpine/openclaw:latest`.*
