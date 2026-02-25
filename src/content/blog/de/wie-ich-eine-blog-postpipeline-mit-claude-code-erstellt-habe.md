---
title: "Wie ich mir eine Artikel-Pipeline gebaut habe, die diesen Artikel geschrieben hat"
description: "Ein einziger Befehl verwandelt ein Google Doc in einen fertigen Blog-Artikel mit Bildern, englischer Übersetzung und LinkedIn-Post. Inklusive dem meta-witzigen Teil."
pubDate: 2026-02-25
---

Copy. Paste. Frontmatter tippen. Bild generieren. Bild einbinden. Commit. Push. Wiederholen.

Ich bin Entwickler. Ich automatisiere langweilige Dinge. Irgendwann habe ich gemerkt: das hier ist langweilig.

Also habe ich einen Nachmittag geopfert, um mir das nie wieder antun zu müssen. Das Ergebnis ist eine Pipeline, die aus einem Google Doc einen fertigen Blog-Artikel mit Bildern, englischer Übersetzung und LinkedIn-Post macht. Ich brauche dafür einen Befehl. Einen einzigen. Einen Klick für LinkedIn. Den spare ich mir noch nicht.

![Ein Roboterarm tippt auf einem Laptop, dessen Bildschirm denselben Roboterarm auf einem kleineren Laptop zeigt – eine Rekursion als flache Illustration](/blog/wie-ich-eine-blog-postpipeline-mit-claude-code-erstellt-habe/image-1.png)

---

## Das Problem war nicht das Schreiben

Das Schreiben läuft. Google Docs, Rohtext, fertig. Das Problem war alles danach.

Ich öffne das Dokument, kopiere den Text, füge ihn in eine Markdown-Datei ein, tippe das Frontmatter von Hand, generiere ein Bild irgendwo, binde es ein, committe, pushe. Zwanzig Minuten für nichts. Kein einziger dieser Schritte erfordert Nachdenken. Genau das nervt.

Der ideale Zustand: ich rufe einen Befehl auf, lehne mich zurück, und wenn ich wiederkomme, ist der Artikel auf der Website.

```
/publish-article "Wie ich mir eine Artikel-Pipeline gebaut habe"
```

Fertig. So soll das aussehen.

---

## Was die Pipeline tut

Ich habe sechs Skripte geschrieben und eine Markdown-Datei, die Claude als Checkliste abarbeitet. Kein Framework. Keine Magie. Nur Skripte und Anweisungen.

**`scripts/slugify.js`** — wandelt "OpenClaw auf dem NAS — Eine Odyssee" in `openclaw-auf-dem-nas-eine-odyssee` um. Deutsche Umlaute inklusive. Klingt trivial. Ist es auch. Aber irgendjemand muss es tun.

**`scripts/gdoc-read.js`** — liest Google Docs via OAuth2. Einmalige Browser-Authentifizierung beim ersten Mal, danach läuft es still im Hintergrund. Kein API-Key herumreichen, kein manuelles Exportieren.

**`scripts/imagen-generate.js`** — ruft die Gemini Imagen 4 API auf, bekommt einen Prompt zurück, speichert das PNG lokal. Fertig.

**`scripts/linkedin-auth.js`** — einmaliger OAuth-Flow für LinkedIn. Browser auf, einmal klicken, Token gespeichert. Läuft nie wieder, außer nach 60 Tagen. Dann nochmal klicken.

**`scripts/linkedin-post.js`** — liest eine Markdown-Datei, lädt das Titelbild hoch, postet auf LinkedIn, schreibt `published: true` zurück ins Repo. Wird nicht lokal aufgerufen. Dazu gleich mehr.

Und dann ist da noch `.claude/skills/publish-article/SKILL.md`. Das ist der Dirigent.

---

## Der Dirigent ist keine Zeile Code

Das überrascht viele. Die eigentliche Steuerlogik der Pipeline ist eine Markdown-Datei. Keine Klassen, keine Funktionen, keine Abhängigkeiten. Nur Anweisungen, die Claude als strukturierte Checkliste abarbeitet.

Elf Schritte. Jeder hat ein klares Ein- und Ausgabe-Format. Claude liest den Rohtext, schreibt den Artikel, lässt ihn reviewen, revidiert, übersetzt, generiert Bild-Konzepte, bewertet die Bilder, schreibt den LinkedIn-Post. Alles in Sequenz, alles nachvollziehbar.

Das Interessante: es funktioniert. Nicht weil Claude besonders klug ist. Sondern weil die Aufgaben klein und konkret sind. "Schreibe einen Artikel im Stil dieses Guides" ist schwierig. "Schreibe Satz 3 um, weil er passiv klingt und nicht nach Lars" ist lösbar.

![Ein einzelner Terminal-Befehl in der Mitte, von dem Pfeile zu Icons für Dokument, Artikel, Übersetzung, Bild und Social-Media-Post führen](/blog/wie-ich-eine-blog-postpipeline-mit-claude-code-erstellt-habe/image-2.png)

---

## Die Subagenten-Architektur

Die Pipeline dispatcht mehrere spezialisierte Claude-Instanzen. Keine tut zwei Dinge gleichzeitig.

**Writer** schreibt den deutschen Artikel auf Basis des Rohtexts und des Stil-Guides.

**Style Reviewer** liest den Artikel und zitiert konkret, welche Sätze nicht passen. Nicht "klingt etwas steif" — sondern "Satz 4 in Absatz 2 verwendet Passiv, das ist nicht Lars". Konkreter Befund, keine vagen Eindrücke.

**Writer (Revision)** bekommt den Artikel und die Kritik und überarbeitet gezielt die markierten Stellen.

**Translator** übersetzt den fertigen deutschen Artikel ins Englische. Kein Stil-Review mehr — das deutsche Original ist bereits abgenommen.

**Image Ideator** bekommt den Artikel und entwickelt Bild-Konzepte. Keine Bilder, nur Konzepte. Ideen zuerst, Ausführung danach.

**Image Critic** bekommt das generierte Bild und bewertet es von 1 bis 10. Unter 7: verbesserter Prompt, nächste Iteration. Über 7: akzeptiert. Maximal drei Versuche.

**LinkedIn-Texter** bekommt den fertigen englischen Artikel und schreibt einen Post: Hook, drei Sätze, Link, Hashtags. Maximal 1300 Zeichen, weil LinkedIn danach abbricht und das kein Mensch liest.

Jeder Agent macht genau eine Sache. Das ist der Grund, warum es funktioniert.

---

## Der LinkedIn-Schritt ist bewusst anders

Hier muss ich kurz innehalten, weil dieser Teil anders läuft als der Rest.

Der eigentliche Post auf LinkedIn passiert nicht lokal. Er läuft als GitHub Action, die ich manuell triggere. Ich gehe auf GitHub, klicke auf "Run workflow", gebe den Slug ein, klicke auf "Run". Fertig.

Das ist Absicht. Kein Befehl soll jemals versehentlich etwas in sozialen Medien veröffentlichen. Die Pipeline legt die Datei bereit. Den Finger auf den Abzug lege ich selbst.

```yaml
on:
  workflow_dispatch:
    inputs:
      slug:
        description: 'Article slug'
        required: true
```

Ich weiß, das ist ein Klick mehr. Das ist der Punkt.

---

## Das technische Setup für alle, die's nachbauen wollen

Es gibt ein paar Stolpersteine. Ich spare mir den freundlichen Ton:

**Google Docs:**

1. Google Cloud Console → neues Projekt → OAuth2 Desktop App → `credentials.json` herunterladen
2. `npm install googleapis`
3. `node scripts/gdoc-read.js` einmal ausführen → Browser-Auth → `token.json` wird gespeichert
4. Nie wieder anfassen

**Bilder:**

1. Gemini API Key von [aistudio.google.com](https://aistudio.google.com) holen
2. In `.env` als `GEMINI_API_KEY` eintragen
3. Vor der Pipeline: `export $(grep -v "^#" .env | xargs)`
4. Billing im Google Cloud Projekt aktivieren — Imagen 4 ist nicht kostenlos. Das habe ich nach dem ersten Fehler gelernt.

**LinkedIn:**

1. LinkedIn Developer Portal → App erstellen → Produkt "Share on LinkedIn" anfragen (dauert manchmal einen Tag)
2. Client ID + Secret in `scripts/linkedin-credentials.json`
3. `node scripts/linkedin-auth.js` einmal ausführen → Token landet in `linkedin-token.json`
4. Token als GitHub Secret `LINKEDIN_ACCESS_TOKEN` speichern
5. LinkedIn Person URN als `LINKEDIN_PERSON_URN` dazu

Das war's. Nachmittag. Einmal.

---

## Der meta-witzige Teil

Dieser Artikel wurde mit genau der Pipeline geschrieben, die er beschreibt.

Ich habe den Rohtext in Google Docs getippt. Dann `/publish-article` aufgerufen. Ein Writer-Subagent hat den Artikel geschrieben. Ein Style Reviewer hat ihn gelesen und konkrete Stellen markiert. Der Writer hat überarbeitet. Ein Translator hat die englische Version gebaut. Ein Image Ideator hat Konzepte entwickelt, ein Image Critic hat bewertet, Imagen 4 hat das Bild generiert.

Und dann hat ein LinkedIn-Texter-Subagent einen Hook geschrieben, der jetzt irgendwo in meinem Netzwerk gelesen wird. Jemand liest gerade einen Text über einen Artikel über eine Pipeline, die diesen Artikel geschrieben hat, und das LinkedIn-Post dazu. Ich habe den Rohtext geschrieben. Den Rest hat die Pipeline erledigt. Das ist genug.

![Ein Fließband innerhalb eines Computerchips – ein Google Doc kommt rein, ein fertiger Blogartikel mit Bild kommt raus, kleine Roboter-Agenten erledigen jeden Schritt](/blog/wie-ich-eine-blog-postpipeline-mit-claude-code-erstellt-habe/image-3.png)

---

## Was ich nicht weiß

Ob das Zeit spart, weiß ich ehrlich gesagt nicht. Der Aufbau hat einen Nachmittag gedauert. Die erste Pipeline-Version hatte Bugs. Der Image Critic war zu streng. Der Style Reviewer war zu nachsichtig. Drei Iterationen, bis es passte.

Aber: der nächste Artikel kostet mich einen Befehl. Rohtext schreiben, `/publish-article` aufrufen, Kaffee holen. Wenn ich zurückkomme, ist die Markdown-Datei fertig, das Bild liegt im Repo, der LinkedIn-Entwurf wartet auf meinen Klick.

Das rechnet sich. Nicht in Minuten. In Nerven.

---

## Fazit

Ich habe ein System gebaut, das Artikel schreibt. Diesen Artikel. Das ist entweder sehr clever oder ein bisschen schizophren. Wahrscheinlich beides.

Was ich dabei gelernt habe: Die interessante Herausforderung war nicht der Code. Die Skripte sind trivial. Die interessante Herausforderung war die Architektur der Anweisungen. Wie klein muss eine Aufgabe sein, damit ein Sprachmodell sie zuverlässig erledigt? Kleiner als ich dachte. Viel kleiner.

Ein Agent, eine Aufgabe. Das ist das Prinzip. Der Rest ist Klempnerarbeit.
