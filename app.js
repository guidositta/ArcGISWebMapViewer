const portalUrl = "https://sit.lta.it/portal";
const webMapItemId = "f58c1be903d24a2bb56953ccc83177da";
const uiThemeStorageKey = "arcgis-viewer-ui-theme";
const uiThemes = [
  {
    id: "atlas-illustrato",
    name: "Atlante illustrato",
    description: "Toolbar verticale con pulsanti blu/viola ispirati alla grafica mappa illustrata.",
    badge: "Attuale"
  },
  {
    id: "tema-chiaro",
    name: "Tema Chiaro",
    description: "Sfondo bianco e strumenti nella barra superiore con icone verde scuro da 24px.",
    badge: "Nuovo"
  }
];

const statusBadge = document.querySelector("#statusBadge");
const messagePanel = document.querySelector("#messagePanel");
const uiSelector = document.querySelector("#uiSelector");
const uiThemeOptions = document.querySelector("#uiThemeOptions");
const rememberUiChoice = document.querySelector("#rememberUiChoice");

function applyUiTheme(themeId) {
  const theme = uiThemes.find((candidate) => candidate.id === themeId) || uiThemes[0];
  const toolbar = document.querySelector(".map-toolbar");
  const mapWrap = document.querySelector(".map-wrap");
  const topbarToolbarHost = document.querySelector("#topbarToolbarHost");

  document.body.dataset.uiTheme = theme.id;

  if (toolbar && mapWrap && topbarToolbarHost) {
    if (theme.id === "tema-chiaro") {
      topbarToolbarHost.appendChild(toolbar);
    } else {
      mapWrap.insertBefore(toolbar, document.querySelector("#mapPanel"));
    }
  }

  return theme;
}

function closeUiSelector() {
  uiSelector.hidden = true;
  uiSelector.setAttribute("aria-hidden", "true");
}

function chooseUiTheme(themeId) {
  const theme = applyUiTheme(themeId);

  if (rememberUiChoice.checked) {
    localStorage.setItem(uiThemeStorageKey, theme.id);
  } else {
    localStorage.removeItem(uiThemeStorageKey);
  }

  closeUiSelector();
}

function initUiSelector() {
  const savedTheme = localStorage.getItem(uiThemeStorageKey);
  const selectedTheme = applyUiTheme(savedTheme || uiThemes[0].id);

  rememberUiChoice.checked = Boolean(savedTheme);
  uiThemeOptions.innerHTML = uiThemes.map((theme) => `
    <button class="ui-theme-card ${theme.id === selectedTheme.id ? "is-selected" : ""}" type="button" data-theme-id="${theme.id}">
      <span>${theme.badge}</span>
      <strong>${theme.name}</strong>
      <small>${theme.description}</small>
    </button>
  `).join("");

  uiThemeOptions.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme-id]");

    if (button) {
      chooseUiTheme(button.dataset.themeId);
    }
  });

  uiSelector.hidden = false;
  uiSelector.removeAttribute("aria-hidden");
}

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
    return target instanceof Element && Boolean(target.closest(".esri-ui, .map-toolbar, .map-panel"));
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

function createDimensionToggle(view, button) {
  const twoDimensionalTilt = 0;
  const threeDimensionalTilt = 55;
  const buttonLabel = button.querySelector("text");
  let isThreeDimensional = false;

  async function setDimension(nextIsThreeDimensional, animate = true) {
    isThreeDimensional = nextIsThreeDimensional;
    button.classList.toggle("is-active", isThreeDimensional);
    buttonLabel.textContent = isThreeDimensional ? "2D" : "3D";
    button.title = isThreeDimensional ? "Passa alla vista 2D" : "Passa alla vista 3D";
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(isThreeDimensional));

    await view.goTo({
      tilt: isThreeDimensional ? threeDimensionalTilt : twoDimensionalTilt,
      heading: view.camera.heading
    }, {
      animate,
      duration: animate ? 500 : 0
    });
  }

  button.addEventListener("click", () => {
    setDimension(!isThreeDimensional).catch((error) => console.error(error));
  });

  return {
    element: button,
    setDimension
  };
}

function setActivePanelTool(action) {
  document.querySelectorAll(".map-tool-button").forEach((button) => {
    const isPanelButton = button.dataset.action === "layers" || button.dataset.action === "basemap";
    button.classList.toggle("is-active", isPanelButton && button.dataset.action === action);
  });
}

function installToolbarControls(view, widgets) {
  const home = new widgets.Home({ view });
  const locate = new widgets.Locate({ view });
  const panel = document.querySelector("#mapPanel");
  const panelTitle = document.querySelector("#mapPanelTitle");
  const layersContent = document.querySelector("#layersPanelContent");
  const basemapContent = document.querySelector("#basemapPanelContent");
  const dimensionToggle = createDimensionToggle(view, document.querySelector("#dimensionToggle"));

  new widgets.LayerList({
    view,
    container: layersContent
  });

  new widgets.BasemapGallery({
    view,
    container: basemapContent
  });

  function closePanel() {
    panel.hidden = true;
    setActivePanelTool(null);
  }

  function openPanel(action) {
    const isLayers = action === "layers";
    panel.hidden = false;
    panelTitle.textContent = isLayers ? "Layer" : "Basemap";
    layersContent.hidden = !isLayers;
    basemapContent.hidden = isLayers;
    setActivePanelTool(action);
  }

  document.querySelector("#mapPanelClose").addEventListener("click", closePanel);

  document.querySelector(".map-toolbar").addEventListener("click", (event) => {
    const button = event.target.closest(".map-tool-button");

    if (!button) {
      return;
    }

    const action = button.dataset.action;

    if (action === "home") {
      closePanel();
      home.go().catch((error) => console.error(error));
    } else if (action === "locate") {
      closePanel();
      locate.locate().catch((error) => console.error(error));
    } else if (action === "layers" || action === "basemap") {
      if (!panel.hidden && button.classList.contains("is-active")) {
        closePanel();
      } else {
        openPanel(action);
      }
    }
  });

  return {
    dimensionToggle
  };
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
      "esri/widgets/BasemapGallery"
    ], (esriConfig, WebMap, SceneView, ScaleBar, Home, Locate, LayerList, BasemapGallery) => {
      resolve({ esriConfig, WebMap, SceneView, ScaleBar, Home, Locate, LayerList, BasemapGallery });
    }, reject);
  });
}

async function start() {
  try {
    const { esriConfig, WebMap, SceneView, ScaleBar, Home, Locate, LayerList, BasemapGallery } = await loadArcGISModules();

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
      ui: {
        components: ["attribution"]
      },
      padding: {
        top: 8,
        right: 8,
        bottom: 8,
        left: 8
      }
    });

    installMiddleMouseTiltControl(view);
    const { dimensionToggle } = installToolbarControls(view, {
      Home,
      Locate,
      LayerList,
      BasemapGallery
    });

    view.ui.add(new ScaleBar({ view, unit: "metric" }), "bottom-left");

    await view.when();
    await webmap.load();
    await dimensionToggle.setDimension(false, false);

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

initUiSelector();
start();
