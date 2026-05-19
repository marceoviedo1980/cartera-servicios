const RAW_DATA_URL = "https://raw.githubusercontent.com/marceoviedo1980/cartera-servicios/main/cartera_servicios.json?v=" + Date.now();
const LOCAL_DATA_URL = "cartera_servicios.json";
const RECENT_KEY = "carteraServiciosRecentSearches";
const THEME_KEY = "carteraServiciosTheme";

let servicesData = [];
let lastQuery = "";
let activeFilter = "todos";

const elements = {
  form: document.querySelector("#searchForm"),
  input: document.querySelector("#searchInput"),
  clear: document.querySelector("#clearButton"),
  results: document.querySelector("#results"),
  counter: document.querySelector("#resultCounter"),
  dataStatus: document.querySelector("#dataStatus"),
  filters: [...document.querySelectorAll(".filter-chip")],
  recentBlock: document.querySelector("#recentBlock"),
  recentList: document.querySelector("#recentList"),
  themeToggle: document.querySelector("#themeToggle"),
  themeIcon: document.querySelector("#themeIcon"),
  themeLabel: document.querySelector("#themeLabel")
};

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function setText(node, text) {
  node.textContent = text;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecentSearch(query) {
  const cleanQuery = query.trim();
  if (!cleanQuery) return;

  const next = [cleanQuery, ...getRecentSearches().filter((item) => normalize(item) !== normalize(cleanQuery))].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  renderRecentSearches();
}

function renderRecentSearches() {
  const recent = getRecentSearches();
  elements.recentList.innerHTML = "";
  elements.recentBlock.hidden = recent.length === 0;

  recent.forEach((query) => {
    const button = createElement("button", "recent-chip", query);
    button.type = "button";
    button.addEventListener("click", () => {
      elements.input.value = query;
      performSearch(query);
    });
    elements.recentList.append(button);
  });
}

function getModalities(item) {
  const value = normalize(item["TIPO DE PACIENTE"]);
  const modalities = new Set();
  if (value.includes("ambulatorio")) modalities.add("ambulatorio");
  if (value.includes("internado")) modalities.add("internado");
  return [...modalities];
}

function groupDualDiagnostics(items) {
  const grouped = new Map();

  items.forEach((item) => {
    const code = String(item.CODIGO || "").trim();
    const service = String(item.SERVICIO || "").trim();
    const key = `${normalize(code)}|${normalize(service)}`;
    const modalities = getModalities(item);

    if (!grouped.has(key)) {
      grouped.set(key, {
        codigo: code,
        servicio: service,
        modalidades: new Set()
      });
    }

    const record = grouped.get(key);
    modalities.forEach((modality) => record.modalidades.add(modality));
  });

  return [...grouped.values()].map((item) => ({
    codigo: item.codigo,
    servicio: item.servicio,
    modalidades: [...item.modalidades]
  }));
}

function matchesQuery(item, terms) {
  const haystack = normalize(`${item.codigo} ${item.servicio}`);
  return terms.every((term) => haystack.includes(term));
}

function matchesFilter(item) {
  return activeFilter === "todos" || item.modalidades.includes(activeFilter);
}

function getCardClass(modalities) {
  if (modalities.includes("ambulatorio") && modalities.includes("internado")) return "result-card dual";
  if (modalities.includes("internado")) return "result-card int-only";
  return "result-card amb-only";
}

function getGroupLabel(modalities) {
  if (modalities.includes("ambulatorio") && modalities.includes("internado")) return "Ambulatorio e internado";
  if (modalities.includes("internado")) return "Solo internado";
  return "Solo ambulatorio";
}

function highlight(text, query) {
  const value = String(text || "");
  const firstTerm = normalize(query).split(/\s+/).find(Boolean);
  if (!firstTerm) return document.createTextNode(value);

  const normalizedValue = normalize(value);
  const index = normalizedValue.indexOf(firstTerm);
  if (index < 0) return document.createTextNode(value);

  const fragment = document.createDocumentFragment();
  fragment.append(document.createTextNode(value.slice(0, index)));
  fragment.append(createElement("mark", "", value.slice(index, index + firstTerm.length)));
  fragment.append(document.createTextNode(value.slice(index + firstTerm.length)));
  return fragment;
}

function renderResults(results, query) {
  elements.results.innerHTML = "";

  if (!query) {
    elements.results.append(createElement("div", "empty-state", "Ingrese un termino de busqueda y presione Buscar."));
    setText(elements.counter, "Sin busqueda activa.");
    return;
  }

  if (results.length === 0) {
    elements.results.append(createElement("div", "empty-state", "No se encontraron servicios relacionados. Intente con otros terminos."));
    setText(elements.counter, "0 resultados encontrados.");
    return;
  }

  const buckets = [
    { key: "amb", label: "Solo ambulatorio", items: [] },
    { key: "dual", label: "Ambulatorio e internado", items: [] },
    { key: "int", label: "Solo internado", items: [] }
  ];

  results.forEach((item) => {
    if (item.modalidades.includes("ambulatorio") && item.modalidades.includes("internado")) {
      buckets[1].items.push(item);
    } else if (item.modalidades.includes("internado")) {
      buckets[2].items.push(item);
    } else {
      buckets[0].items.push(item);
    }
  });

  setText(elements.counter, `Se encontraron ${results.length} servicio${results.length === 1 ? "" : "s"}.`);

  buckets.filter((bucket) => bucket.items.length > 0).forEach((bucket) => {
    const divider = createElement("div", "group-divider", `${bucket.label} · ${bucket.items.length}`);
    elements.results.append(divider);

    bucket.items.forEach((item) => {
      const card = createElement("article", getCardClass(item.modalidades));
      card.setAttribute("aria-label", `${item.codigo} ${item.servicio} ${getGroupLabel(item.modalidades)}`);

      const code = createElement("div", "code-badge", item.codigo || "S/C");
      const content = createElement("div", "result-content");
      const title = createElement("p", "service-name");
      title.append(highlight(item.servicio, query));

      const tags = createElement("div", "patient-tags");
      item.modalidades.forEach((modality) => {
        const label = modality === "ambulatorio" ? "AMBULATORIO" : "INTERNADO";
        tags.append(createElement("span", `tag ${modality}`, label));
      });

      content.append(title, tags);
      card.append(code, content);
      elements.results.append(card);
    });
  });
}

function performSearch(query = elements.input.value) {
  const cleanQuery = query.trim();
  lastQuery = cleanQuery;

  if (!servicesData.length) {
    setText(elements.counter, "Los datos aun se estan cargando.");
    return;
  }

  if (!cleanQuery) {
    renderResults([], "");
    return;
  }

  const terms = normalize(cleanQuery).split(/\s+/).filter(Boolean);
  const grouped = groupDualDiagnostics(servicesData);
  const results = grouped.filter((item) => matchesQuery(item, terms) && matchesFilter(item));
  saveRecentSearch(cleanQuery);
  renderResults(results, cleanQuery);
}

async function loadData() {
  try {
    const response = await fetch(RAW_DATA_URL);
    if (!response.ok) throw new Error("No se pudo cargar GitHub RAW");
    servicesData = await response.json();
    window.__servicesData = servicesData;
    setText(elements.dataStatus, "");
    elements.dataStatus.classList.remove("visible");
  } catch (error) {
    console.warn(error);
    try {
      const fallback = await fetch(LOCAL_DATA_URL);
      servicesData = await fallback.json();
      window.__servicesData = servicesData;
      setText(elements.dataStatus, "");
      elements.dataStatus.classList.remove("visible");
    } catch {
      setText(elements.dataStatus, "No se pudieron cargar los datos. Recargue la pagina.");
      elements.dataStatus.classList.add("visible");
    }
  }
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark", isDark);
  elements.themeIcon.textContent = isDark ? "☀️" : "🌙";
  elements.themeLabel.textContent = isDark ? "CLAR" : "OSC";
  localStorage.setItem(THEME_KEY, theme);
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.warn("No se pudo registrar el service worker", error);
    });
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  performSearch();
});

elements.clear.addEventListener("click", () => {
  elements.input.value = "";
  elements.input.focus();
  lastQuery = "";
  renderResults([], "");
});

elements.filters.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    elements.filters.forEach((item) => item.classList.toggle("active", item === button));
    if (lastQuery) performSearch(lastQuery);
  });
});

elements.themeToggle.addEventListener("click", () => {
  applyTheme(document.body.classList.contains("dark") ? "light" : "dark");
});

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
  renderRecentSearches();
  renderResults([], "");
  registerServiceWorker();
  await loadData();
});
