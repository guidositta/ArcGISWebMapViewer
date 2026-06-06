const portalUrl = "https://sit.lta.it/portal";
const webMapItemId = "f58c1be903d24a2bb56953ccc83177da";
const startupLayerTitle = "Comuni LTA";

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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function findLayerByTitle(layers, title) {
  const normalizedTitle = title.toLowerCase();

  for (const layer of layers.toArray()) {
    if (layer.title?.toLowerCase() === normalizedTitle) {
      return layer;
    }

    if (layer.layers) {
      const childLayer = findLayerByTitle(layer.layers, title);

      if (childLayer) {
        return childLayer;
      }
    }
  }

  return null;
}

async function getLayerExtent(layer) {
  await layer.load();

  if (layer.fullExtent) {
    return layer.fullExtent;
  }

  if (typeof layer.queryExtent === "function") {
    const result = await layer.queryExtent();
    return result.extent;
  }

  if (layer.layers) {
    const extents = await Promise.all(
      layer.layers.toArray().map((childLayer) => getLayerExtent(childLayer).catch(() => null))
    );

    return extents.filter(Boolean).reduce((combinedExtent, extent) => {
      return combinedExtent ? combinedExtent.union(extent) : extent.clone();
    }, null);
  }

  return null;
}

async function setInitialTwoDimensionalView(view, webmap) {
  const startupLayer = findLayerByTitle(webmap.layers, startupLayerTitle);

  if (!startupLayer) {
    const camera = view.camera.clone();
    camera.tilt = 0;
    view.camera = camera;
    console.warn(`Layer iniziale non trovato: ${startupLayerTitle}`);
    return;
  }

  const extent = await getLayerExtent(startupLayer);

  await view.goTo({
    target: extent || startupLayer,
    tilt: 0,
    heading: 0
  }, {
    animate: false
  });
}

function installMiddleMouseTiltControl(view) {
  const container = view.container;
  const minTilt = 0;
  const maxTilt = 80;
  const sensitivity = 0.22;
  let isTilting = false;
  let startY = 0;
  let startTilt = 45;
  let previousCursor = "";

  function shouldIgnoreTarget(target) {
    return target instanceof Element && Boolean(target.closest(".esri-ui"));
  }

  function updateTilt(clientY) {
    const camera = view.camera.clone();
    camera.tilt = clamp(startTilt - ((clientY - startY) * sensitivity), minTilt, maxTilt);
    view.camera = camera;
  }

  container.addEventListener("pointerdown", (event) => {
    if (event.button !== 1 || shouldIgnoreTarget(event.target)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    isTilting = true;
    startY = event.clientY;
    startTilt = Number.isFinite(view.camera?.tilt) ? view.camera.tilt : 45;
    previousCursor = container.style.cursor;
    container.style.cursor = "ns-resize";
    container.setPointerCapture?.(event.pointerId);
  }, true);

  document.addEventListener("pointermove", (event) => {
    if (!isTilting) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    updateTilt(event.clientY);
  }, true);

  document.addEventListener("pointerup", (event) => {
    if (!isTilting) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    isTilting = false;
    container.style.cursor = previousCursor;
    container.releasePointerCapture?.(event.pointerId);
  }, true);

  window.addEventListener("blur", () => {
    isTilting = false;
    container.style.cursor = previousCursor;
  });
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
        tilt: 0,
        heading: 0
      },
      padding: {
        top: 8,
        right: 8,
        bottom: 8,
        left: 8
      }
    });

    installMiddleMouseTiltControl(view);

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
    await setInitialTwoDimensionalView(view, webmap);

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
