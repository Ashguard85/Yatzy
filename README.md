# Yatzy Duell – ZIP-Versionen in Git, Deployment aus Portainer

Dieses Repository speichert jede Veröffentlichung doppelt:

- als unverändertes ZIP unter `uploads/`
- entpackt unter `versions/X.Y.Z/`

Die höchste vorhandene Versionsnummer wird zusätzlich nach `current/` kopiert. Der Portainer-Stack baut Frontend und Backend direkt aus `current/frontend` und `current/backend`.

## Repository-Struktur nach dem ersten Workflow-Lauf

```text
.github/workflows/unpack-release.yml
scripts/unpack_releases.py
uploads/yatzy-duell-2.3.4.zip
versions/2.3.4/
current/
latest.json
```

## Neue Version veröffentlichen

1. Ein Release-ZIP mit dem Namen `yatzy-duell-X.Y.Z.zip` nach `uploads/` hochladen.
2. Den Commit speichern.
3. Unter **Actions → Yatzy-Release entpacken** auf einen grünen Lauf warten.
4. In Portainer den Stack über **Editor → Update the stack** neu bereitstellen.

Bereits veröffentlichte Versionsordner werden nicht überschrieben. Eine geänderte Veröffentlichung benötigt daher eine neue Versionsnummer.

## Erwarteter Inhalt jedes Release-ZIPs

```text
VERSION
frontend/Dockerfile
frontend/index.html
frontend/nginx.conf
frontend/service-worker.js
backend/Dockerfile
backend/server.js
```

Das ZIP darf diese Dateien direkt an der Wurzel oder innerhalb genau eines gemeinsamen Hauptordners enthalten.

## Rollback

Im Portainer-Stack die Umgebungsvariable setzen:

```text
YATZY_RELEASE_PATH=versions/2.3.4
```

Für die jeweils neueste Version:

```text
YATZY_RELEASE_PATH=current
```

## Hinweis zum Repository

Für den direkten Docker-Build über eine HTTPS-Git-URL sollte das Repository öffentlich sein. Zugangsdaten gehören nicht in die Build-URL.
