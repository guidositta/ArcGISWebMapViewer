# ArcGIS 3D Web Map Viewer

Semplice viewer statico 3D basato su ArcGIS Maps SDK for JavaScript.

## Configurazione

- Portal: `https://sit.lta.it/portal`
- Web Map item ID: `f58c1be903d24a2bb56953ccc83177da`

## Requisiti Portal

La web map deve essere pubblica e il Portal deve permettere richieste CORS dal dominio dove viene pubblicata questa app.

Per GitHub Pages, aggiungere tra le Allow Origins:

```text
https://guidositta.github.io
```

## File

- `index.html`
- `styles.css`
- `app.js`

## Temi UI

Le interfacce disponibili sono registrate in `app.js` nella costante `uiThemes`.
Il tema attuale si chiama `Atlante illustrato` e usa l'id `atlas-illustrato`.

Per aggiungere una nuova UI, aggiungere un oggetto in `uiThemes` e gli stili CSS
associati al valore `body[data-ui-theme="nuovo-id"]`.
