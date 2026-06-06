const portalUrl = "https://sit.lta.it/portal";
const webMapItemId = "f58c1be903d24a2bb56953ccc83177da";

const statusBadge = document.querySelector("#statusBadge");
const messagePanel = document.querySelector("#messagePanel");

function setStatus(label, state) {
  statusBadge.textContent = label;
  statusBadge.className = `status-badge ${state ? `is-${state}` : ""}`.trim();
}

function setMessage(title, text, hidden = false) {
  messagePanel.classList.toggle("is-hidden", hidden);
  messagePanel.innerHTML = `<strong>${title}</strong><span>${text}</span>`;
}

function loadArcGISModules() {
  return new Promise((resolve, reject) => {
    if (!window.require) {
      reject(new Error("ArcGIS Maps SDK non disponibile."));
      return;
    }

    window.require([
      "esri/config",
      "esri/WebMap",
      "esri/views/SceneView",
      "esri/widgets/ScaleBar",
      "esri/widgets/Home",
      "esri/widgets/Locate",
      "esri/widgets/LayerList",
      "esri/widgets/BasemapGallery",
      "esri/widgets/Expand"
    ], (esriConfig, WebMap, SceneView, ScaleBar, Home, Locate, LayerList, BasemapGallery, Expand) => {
      resolve({ esriConfig, WebMap, SceneView, ScaleBar, Home, Locate, LayerList, BasemapGallery, Expand });
    }, reject);
  });
}

async function start() {
  try {
    const { esriConfig, WebMap, SceneView, ScaleBar, Home, Locate, LayerList, BasemapGallery, Expand } = await loadArcGISModules();

    esriConfig.portalUrl = portalUrl;

    const webmap = new WebMap({
      portalItem: {
        id: webMapItemId
      }
    });

    const view = new SceneView({
      container: "viewDiv",
      map: webmap,
      viewingMode: "global",
      camera: {
        position: {
          longitude: 12.5,
          latitude: 42.5,
          z: 2200000
        },
        tilt: 45,
        heading: 0
      },
      padding: {
        top: 8,
        right: 8,
        bottom: 8,
        left: 8
      }
    });

    view.ui.add(new Home({ view }), "top-left");
    view.ui.add(new Locate({ view }), "top-left");
    view.ui.add(new ScaleBar({ view, unit: "metric" }), "bottom-left");
    view.ui.add(new Expand({
      view,
      content: new LayerList({ view }),
      expandIcon: "layers",
      group: "top-right"
    }), "top-right");
    view.ui.add(new Expand({
      view,
      content: new BasemapGallery({ view }),
      expandIcon: "basemap",
      group: "top-right"
    }), "top-right");

    await view.when();
    await webmap.load();

    const title = webmap.portalItem?.title || "Web Map";
    document.title = `${title} | 3D Web Map Viewer`;
    document.querySelector("h1").textContent = title;
    setStatus("Pronta", "ready");
    setMessage("Scena 3D caricata", "La mappa e pronta per la consultazione in 3D.", true);
  } catch (error) {
    console.error(error);
    setStatus("Errore", "error");
    setMessage(
      "Impossibile caricare la web map",
      "Verifica che la web map sia pubblica e che il Portal consenta richieste CORS da questo dominio."
    );
  }
}

start();
