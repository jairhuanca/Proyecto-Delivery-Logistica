const mapApp = new DeliveryMap("map");

let puntosMemoria = [];
let rutaActualIds = [];
let ultimoMetodoUsado = "greedy";
let distanciaRutaActualKm = 25.15;
let chartComparativaTSP = null;

window.modoSeleccionTramo = null;
let coordOrigenTramo = null;
let coordDestinoTramo = null;

window.modoSeleccionDirecta = null;
let coordDirOrigen = null;
let coordDirDestino = null;

const COLORES_METODO = {
  greedy: "#F05816",
  fuerza_bruta: "#80C27A",
  dinamica: "#0F0F0F",
  backtracking: "#d97706",
};

const SUBTITULOS = {
  "tab-clientes": "Gestión de Clientes y Paradas",
  "tab-rutas": "Planificación y Ruteo de Despacho",
  "tab-tramos": "Medición y Ordenamiento Vial",
  "tab-complejidad": "Matriz y Desempeño Algorítmico",
  "tab-simulacion": "Simulación de Tráfico y Cotizador Directo",
  "tab-finanzas": "Desglose Monetario y Parámetros",
};

function mostrarMensaje(texto) {
  const toast = document.getElementById("toast-notificacion");
  if (toast) {
    toast.innerText = texto;
    toast.classList.remove("hidden");
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 3200);
  }
}

function mostrarAviso(titulo, mensaje) {
  const modal = document.getElementById("modal-aviso");
  if (modal) {
    document.getElementById("aviso-titulo").innerText = titulo;
    document.getElementById("aviso-mensaje").innerText = mensaje;
    modal.classList.remove("hidden");
  }
}

window.cerrarModalAviso = function () {
  const modal = document.getElementById("modal-aviso");
  if (modal) modal.classList.add("hidden");
};

function mostrarConfirmacion(titulo, mensaje, onConfirmar) {
  const modal = document.getElementById("modal-confirmacion");
  if (modal) {
    document.getElementById("modal-titulo").innerText = titulo;
    document.getElementById("modal-mensaje").innerText = mensaje;
    modal.classList.remove("hidden");

    const btnConfirmar = document.getElementById("btn-modal-confirmar");
    const btnCancelar = document.getElementById("btn-modal-cancelar");

    const limpiar = () => {
      modal.classList.add("hidden");
      btnConfirmar.onclick = null;
      btnCancelar.onclick = null;
    };

    btnConfirmar.onclick = () => {
      limpiar();
      onConfirmar();
    };
    btnCancelar.onclick = limpiar;
  }
}

// -----------------------------------------------------------------------------
// CONTROL DEL MENÚ
// -----------------------------------------------------------------------------
window.cambiarTab = function (tabId) {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));

  const tabSeleccionada = document.getElementById(tabId);
  if (tabSeleccionada) tabSeleccionada.classList.add("active");

  const btnActivo = Array.from(document.querySelectorAll(".tab-btn")).find(
    (b) =>
      b.getAttribute("onclick") && b.getAttribute("onclick").includes(tabId),
  );
  if (btnActivo) btnActivo.classList.add("active");

  const sub = document.getElementById("tab-subtitulo");
  if (sub && SUBTITULOS[tabId]) sub.innerText = SUBTITULOS[tabId];

  window.limpiarFormularioTramos();
  window.limpiarFormularioPuntos();
  window.limpiarFormularioSimulacion();

  if (typeof mapApp !== "undefined") {
    mapApp.limpiarPunteroUbicacion();
    mapApp.limpiarPinesTramo();
    if (mapApp.routeGroup) {
      mapApp.routeGroup.clearLayers();
    }
  }
};

window.limpiarFormularioSimulacion = function () {
  const inpSimDist = document.getElementById("inp-sim-dist");
  const panelMonte = document.getElementById("panel-montecarlo");
  const inpDirOrig = document.getElementById("inp-dir-origen");
  const inpDirDest = document.getElementById("inp-dir-destino");
  const inpDirKm = document.getElementById("inp-dir-km");
  const panelDir = document.getElementById("panel-directa");

  if (inpSimDist) inpSimDist.value = "";
  if (panelMonte) panelMonte.classList.add("hidden");
  if (inpDirOrig) inpDirOrig.value = "";
  if (inpDirDest) inpDirDest.value = "";
  if (inpDirKm) inpDirKm.value = "";
  if (panelDir) panelDir.classList.add("hidden");

  coordDirOrigen = null;
  coordDirDestino = null;
  window.modoSeleccionDirecta = null;

  const btnA = document.getElementById("btn-pick-dir-origen");
  const btnB = document.getElementById("btn-pick-dir-destino");
  if (btnA) {
    btnA.style.backgroundColor = "";
    btnA.style.color = "";
  }
  if (btnB) {
    btnB.style.backgroundColor = "";
    btnB.style.color = "";
  }
};

// -----------------------------------------------------------------------------
// CARGA INICIAL
// -----------------------------------------------------------------------------
document.addEventListener("DOMContentLoaded", async () => {
  await cargarPuntosYRenderizar();

  const inpNombre = document.getElementById("inp-nombre");
  if (inpNombre) {
    inpNombre.addEventListener("input", function () {
      this.classList.remove("input-error");
    });
  }
});

async function cargarPuntosYRenderizar() {
  try {
    puntosMemoria = await ApiService.obtenerPuntos();
    mapApp.renderizarPuntos(puntosMemoria);
    renderizarListas(puntosMemoria);
  } catch (err) {
    console.error("Error al cargar puntos iniciales:", err);
  }
}

function renderizarListas(puntos) {
  const cat = document.getElementById("lista-clientes-catalogo");
  if (cat) {
    cat.innerHTML = "";
    puntos.forEach((p) => {
      const esAlmacen = p.id === 0;
      const tieneDistritoEnNombre = p.nombre
        .toLowerCase()
        .includes(p.distrito ? p.distrito.toLowerCase() : "");
      const textoUbicacion =
        p.distrito && !tieneDistritoEnNombre
          ? `${p.nombre} - ${p.distrito}`
          : p.nombre;

      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `
        <div>
          <b>[${p.id}] ${textoUbicacion}</b><br>
          <small>Carga: ${p.peso_kg || 0} kg | X=${p.x || 0} km, Y=${p.y || 0} km</small>
        </div>
        ${!esAlmacen ? `<button class="btn btn-outline" style="padding:4px 8px; font-size:0.72rem; color:#dc2626;" onclick="window.solicitarEliminacionPunto(${p.id})">Eliminar</button>` : '<span style="color:#16a34a; font-weight:700; font-size:0.75rem;">Base</span>'}
      `;
      cat.appendChild(item);
    });
  }

  const chkCont = document.getElementById("contenedor-checkpoints");
  if (chkCont) {
    chkCont.innerHTML = "";
    puntos.forEach((p) => {
      const esAlmacen = p.id === 0;
      const tieneDistritoEnNombre = p.nombre
        .toLowerCase()
        .includes(p.distrito ? p.distrito.toLowerCase() : "");
      const textoVisible =
        p.distrito && !tieneDistritoEnNombre
          ? `${p.nombre} - ${p.distrito}`
          : p.nombre;

      const div = document.createElement("div");
      div.className = "chk-item";
      div.innerHTML = `
        <label style="display:flex; align-items:center; gap:8px; width:100%; cursor:pointer;">
          <input type="checkbox" value="${p.id}" ${esAlmacen ? "checked disabled" : "checked"}>
          <span>${textoVisible} <b>[${p.peso_kg || 0} kg]</b></span>
        </label>
      `;
      chkCont.appendChild(div);
    });
  }
}

function obtenerIdsSeleccionados() {
  const checkboxes = document.querySelectorAll(
    '#contenedor-checkpoints input[type="checkbox"]:checked',
  );
  return Array.from(checkboxes).map((c) => parseInt(c.value));
}

// -----------------------------------------------------------------------------
// GESTIÓN DE CLIENTES Y PARADAS
// -----------------------------------------------------------------------------
window.agregarClienteManual = async function () {
  const inpNombre = document.getElementById("inp-nombre");
  const nombre = inpNombre.value.trim();
  const distrito =
    document.getElementById("inp-distrito").value.trim() || "Lima";
  const lat = parseFloat(document.getElementById("inp-lat").value);
  const lng = parseFloat(document.getElementById("inp-lng").value);
  const peso = parseFloat(document.getElementById("inp-peso").value);
  const desc = document.getElementById("inp-desc").value.trim();

  if (!nombre) {
    inpNombre.classList.add("input-error");
    inpNombre.focus();
    mostrarAviso(
      "Campo Obligatorio",
      "Por favor, ingrese el nombre del cliente o parada de entrega antes de guardar.",
    );
    return;
  }
  inpNombre.classList.remove("input-error");

  if (isNaN(lat) || isNaN(lng)) {
    mostrarAviso(
      "Ubicación Requerida",
      "Debe hacer clic en el mapa para fijar la ubicación exacta (latitud y longitud).",
    );
    return;
  }

  if (isNaN(peso) || peso <= 0) {
    mostrarAviso(
      "Peso Inválido",
      "Por favor, ingrese un peso de carga válido en kilogramos mayor a 0.",
    );
    return;
  }

  if (!desc) {
    mostrarAviso(
      "Tipo de Carga Requerido",
      "Por favor, seleccione el tipo de carga en la lista desplegable.",
    );
    return;
  }

  try {
    await ApiService.agregarPunto({
      nombre: nombre,
      distrito: distrito,
      lat: lat,
      lng: lng,
      peso_kg: peso,
      descripcion_pedido: desc,
    });

    window.limpiarFormularioPuntos();
    await cargarPuntosYRenderizar();
    mapApp.limpiarPunteroUbicacion();
    mostrarMensaje("Punto de entrega registrado con éxito.");
  } catch (err) {
    mostrarAviso(
      "Error del Servidor",
      "No se pudo registrar el punto: " + err.message,
    );
  }
};

window.solicitarEliminacionPunto = function (id) {
  mostrarConfirmacion(
    "Eliminar Punto",
    "¿Desea quitar este punto del catálogo de operaciones?",
    async () => {
      try {
        await ApiService.eliminarPunto(id);
        await cargarPuntosYRenderizar();
        mapApp.limpiarRuta();
        const panel = document.getElementById("panel-tsp");
        if (panel) panel.classList.add("hidden");
        mostrarMensaje("Punto eliminado correctamente.");
      } catch (err) {
        mostrarMensaje("Error: " + err.message);
      }
    },
  );
};

window.limpiarFormularioPuntos = function () {
  const inpNombre = document.getElementById("inp-nombre");
  const inpDistrito = document.getElementById("inp-distrito");
  const inpLat = document.getElementById("inp-lat");
  const inpLng = document.getElementById("inp-lng");
  const inpPeso = document.getElementById("inp-peso");
  const inpDesc = document.getElementById("inp-desc");

  if (inpNombre) inpNombre.value = "";
  if (inpDistrito) inpDistrito.value = "";
  if (inpLat) inpLat.value = "";
  if (inpLng) inpLng.value = "";
  if (inpPeso) inpPeso.value = "";
  if (inpDesc) inpDesc.selectedIndex = 0;

  if (typeof mapApp !== "undefined" && mapApp.tempMarker) {
    mapApp.map.removeLayer(mapApp.tempMarker);
    mapApp.tempMarker = null;
  }
};

window.seleccionarAlgoritmo = function (metodo) {
  document.querySelectorAll(".btn-algoritmo").forEach((btn) => {
    btn.classList.remove("active");
  });

  const btnSeleccionado = document.getElementById(`btn-algo-${metodo}`);
  if (btnSeleccionado) {
    btnSeleccionado.classList.add("active");
  }

  window.calcularRutaOptima(metodo);
};

// -----------------------------------------------------------------------------
// PLANIFICACIÓN Y TRAZADO TSP
// -----------------------------------------------------------------------------
window.calcularRutaOptima = async function (metodo) {
  ultimoMetodoUsado = metodo;
  const ids = obtenerIdsSeleccionados();

  if (ids.length < 2) {
    mostrarAviso(
      "Destinos Insuficientes",
      "Seleccione al menos un punto de destino además de la base central para generar el recorrido.",
    );
    return;
  }

  try {
    const data = await ApiService.calcularRutaOptima(ids, metodo);
    if (!data || !data.secuencia_ids) {
      throw new Error("Respuesta inválida del cálculo de ruta.");
    }
    rutaActualIds = data.secuencia_ids;
    distanciaRutaActualKm = data.distancia_km;
    mostrarPanelRuta(data);
  } catch (err) {
    mostrarMensaje("Error al procesar ruta: " + err.message);
  }
};

function mostrarPanelRuta(data) {
  const panel = document.getElementById("panel-tsp");
  panel.classList.remove("hidden");

  document.getElementById("badge-metodo").innerText = (
    data.metodo || "ESTRATEGIA"
  ).toUpperCase();
  document.getElementById("tag-distancia").innerText =
    `${data.distancia_km || 0} km`;
  document.getElementById("stat-peso").innerText =
    `${data.peso_total_carga_kg || 0} kg`;
  document.getElementById("stat-tiempo").innerText =
    data.tiempo_computo_s || "0";
  document.getElementById("stat-ruta").innerText = Array.isArray(
    data.secuencia_nombres,
  )
    ? data.secuencia_nombres.join(" -> ")
    : "Sin ruta calculada";

  const listVeh = document.getElementById("lista-vehiculos");
  if (Array.isArray(data.flota_tiempos)) {
    listVeh.innerHTML = data.flota_tiempos
      .map(
        (v) => `
      <li>
        <b>${v.vehiculo}:</b> ${v.tiempo_minutos} min (${v.velocidad_kmh} km/h) 
        - <span class="${v.es_apto ? "vehicle-badge-ok" : "vehicle-badge-no"}">
            ${v.es_apto ? "Apto" : "Excede carga máxima (" + v.capacidad_max_kg + " kg)"}
          </span>
      </li>
    `,
      )
      .join("");
  } else {
    listVeh.innerHTML = "<li>No hay información de flota disponible.</li>";
  }

  if (
    Array.isArray(data.coordenadas_mapa) &&
    Array.isArray(data.secuencia_ids)
  ) {
    mapApp.trazarRuta(
      data.coordenadas_mapa,
      data.secuencia_ids,
      puntosMemoria,
      COLORES_METODO[data.metodo] || "#F05816",
    );
  }
}

window.cancelarPedidoEnRuta = function (puntoId) {
  mostrarConfirmacion(
    "Cancelar Pedido",
    "¿Desea cancelar este pedido y reoptimizar el recorrido de inmediato?",
    async () => {
      const nuevosIds = rutaActualIds.filter((id) => id !== puntoId);
      if (nuevosIds.length <= 1) {
        mostrarMensaje("No restan pedidos pendientes.");
        mapApp.limpiarRuta();
        const panel = document.getElementById("panel-tsp");
        if (panel) panel.classList.add("hidden");
        return;
      }

      try {
        const data = await ApiService.calcularRutaOptima(
          nuevosIds,
          ultimoMetodoUsado,
        );
        rutaActualIds = data.secuencia_ids;
        distanciaRutaActualKm = data.distancia_km;
        mostrarPanelRuta(data);
        await cargarPuntosYRenderizar();
        mostrarMensaje("Ruta reoptimizada sin retrasos.");
      } catch (err) {
        mostrarMensaje("Error: " + err.message);
      }
    },
  );
};

// -----------------------------------------------------------------------------
// MEDICIÓN Y ORDENAMIENTO DE TRAMOS VIALES
// -----------------------------------------------------------------------------
window.activarModoSeleccionTramo = function (tipo) {
  const btnA = document.getElementById("btn-pick-origen");
  const btnB = document.getElementById("btn-pick-destino");

  if (tipo === "origen") {
    window.modoSeleccionTramo = "origen";

    if (btnA) {
      btnA.classList.add("btn-fijar-activo");
      btnA.style.setProperty("background-color", "#F05816", "important");
      btnA.style.setProperty("color", "#FFFFFF", "important");
    }
    if (btnB) {
      btnB.classList.remove("btn-fijar-activo");
      btnB.style.removeProperty("background-color");
      btnB.style.removeProperty("color");
    }
    mostrarMensaje("Haga clic en el mapa para fijar el Origen (A)");
  } else if (tipo === "destino") {
    window.modoSeleccionTramo = "destino";

    if (btnB) {
      btnB.classList.add("btn-fijar-activo");
      btnB.style.setProperty("background-color", "#F05816", "important");
      btnB.style.setProperty("color", "#FFFFFF", "important");
    }
    if (btnA) {
      btnA.classList.remove("btn-fijar-activo");
      btnA.style.removeProperty("background-color");
      btnA.style.removeProperty("color");
    }
    mostrarMensaje("Haga clic en el mapa para fijar el Destino (B)");
  }
};

window.desactivarBotonesFijar = function () {
  const btnA = document.getElementById("btn-pick-origen");
  const btnB = document.getElementById("btn-pick-destino");

  if (btnA) {
    btnA.classList.remove("btn-fijar-activo");
    btnA.style.removeProperty("background-color");
    btnA.style.removeProperty("color");
  }
  if (btnB) {
    btnB.classList.remove("btn-fijar-activo");
    btnB.style.removeProperty("background-color");
    btnB.style.removeProperty("color");
  }
  window.modoSeleccionTramo = null;
};

window.manejarClicTramo = async function (lat, lng) {
  const tipo = window.modoSeleccionTramo;
  const lugar = await mapApp.obtenerNombreLugar(lat, lng);

  if (typeof mapApp !== "undefined") {
    mapApp.limpiarPunteroUbicacion();
  }

  if (tipo === "origen") {
    document.getElementById("inp-tramo-origen").value = lugar;
    coordOrigenTramo = [lat, lng];
    mapApp.fijarPinTramo("origen", lat, lng, lugar);
  } else if (tipo === "destino") {
    document.getElementById("inp-tramo-destino").value = lugar;
    coordDestinoTramo = [lat, lng];
    mapApp.fijarPinTramo("destino", lat, lng, lugar);
  }

  window.desactivarBotonesFijar();

  if (coordOrigenTramo && coordDestinoTramo) {
    window.calcularDistanciaVial(
      coordOrigenTramo,
      coordDestinoTramo,
      "inp-tramo-km",
    );
  }
};

window.calcularDistanciaVial = async function (coordA, coordB, inputTargetId) {
  const inpKm = document.getElementById(inputTargetId);
  inpKm.placeholder = "Calculando...";

  const urlOSRM = `https://router.project-osrm.org/route/v1/driving/${coordA[1]},${coordA[0]};${coordB[1]},${coordB[0]}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(urlOSRM);
    const data = await res.json();

    if (data.routes && data.routes.length > 0) {
      const ruta = data.routes[0];
      const km = (ruta.distance / 1000).toFixed(2);
      inpKm.value = km;

      if (mapApp.tramoDirectoLine)
        mapApp.map.removeLayer(mapApp.tramoDirectoLine);
      const coordsCalle = ruta.geometry.coordinates.map((c) => [c[1], c[0]]);
      mapApp.tramoDirectoLine = L.polyline(coordsCalle, {
        color: "#F05816",
        weight: 5,
        dashArray: "6, 8",
      }).addTo(mapApp.map);
      mapApp.map.fitBounds(mapApp.tramoDirectoLine.getBounds(), {
        padding: [40, 40],
      });
    }
  } catch (err) {
    console.warn("Fallo de red OSRM:", err);
  }
};

window.autocalcularKmTramo = async function () {
  const origen = document.getElementById("inp-tramo-origen").value.trim();
  const destino = document.getElementById("inp-tramo-destino").value.trim();

  if (!origen || !destino) {
    mostrarAviso(
      "Campos Requeridos",
      "Por favor, ingrese el punto de origen y el destino para medir el tramo.",
    );
    return;
  }

  const inpKm = document.getElementById("inp-tramo-km");
  inpKm.placeholder = "Calculando...";

  try {
    const getCoord = async (lugar) => {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(lugar + ", Lima, Peru")}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data || data.length === 0)
        throw new Error(`No se ubicó la zona: ${lugar}`);
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    };

    const cOrigen = await getCoord(origen);
    const cDestino = await getCoord(destino);

    coordOrigenTramo = cOrigen;
    coordDestinoTramo = cDestino;
    mapApp.fijarPinTramo("origen", cOrigen[0], cOrigen[1], origen);
    mapApp.fijarPinTramo("destino", cDestino[0], cDestino[1], destino);

    await window.calcularDistanciaVial(cOrigen, cDestino, "inp-tramo-km");
  } catch (err) {
    mostrarMensaje(err.message);
    inpKm.placeholder = "Distancia manual";
  }
};

window.guardarTramo = async function () {
  const origen = document.getElementById("inp-tramo-origen").value.trim();
  const destino = document.getElementById("inp-tramo-destino").value.trim();
  const km = parseFloat(document.getElementById("inp-tramo-km").value);

  if (!origen || !destino || isNaN(km) || km <= 0) {
    mostrarAviso(
      "Datos de Tramo Incompletos",
      "Por favor, ingrese el origen, destino y una distancia calculada mayor a 0 km.",
    );
    return;
  }

  try {
    const res = await ApiService.agregarTramo(origen, destino, km);
    mostrarMensaje(res.mensaje);
    window.limpiarFormularioTramos();
    window.ordenarTramos();
  } catch (err) {
    mostrarMensaje("Error: " + err.message);
  }
};

window.limpiarFormularioTramos = function () {
  const inpOrig = document.getElementById("inp-tramo-origen");
  const inpDest = document.getElementById("inp-tramo-destino");
  const inpKm = document.getElementById("inp-tramo-km");

  if (inpOrig) inpOrig.value = "";
  if (inpDest) inpDest.value = "";
  if (inpKm) inpKm.value = "";

  coordOrigenTramo = null;
  coordDestinoTramo = null;
  window.desactivarBotonesFijar();

  if (typeof mapApp !== "undefined") {
    mapApp.limpiarPinesTramo();
  }
};

window.ordenarTramos = async function () {
  const panel = document.getElementById("panel-tramos-ordenados");
  panel.classList.remove("hidden");

  try {
    const data = await ApiService.ordenarTramos();
    if (!data || !Array.isArray(data.tramos_ordenados)) {
      throw new Error("No hay tramos registrados para ordenar.");
    }
    let lista = `<p><b>Tramos Ordenados por Kilometraje (QuickSort):</b></p><ul style="padding-left:16px;">`;
    data.tramos_ordenados.forEach((t) => {
      lista += `<li>${t.origen} -> ${t.destino}: <b>${t.kilometros.toFixed(2)} km</b></li>`;
    });
    lista += `</ul><p class="stat-text mt-2"><b>Tiempo Burbuja:</b> ${data.tiempo_burbuja_s} s | <b>Tiempo QuickSort:</b> ${data.tiempo_quicksort_s} s</p>`;
    panel.innerHTML = lista;
  } catch (err) {
    panel.innerHTML = `<span style="color:#dc2626;">${err.message}</span>`;
  }
};

window.evaluarFlotaTramos = async function () {
  const panel = document.getElementById("panel-flota-tramos");
  panel.classList.remove("hidden");

  try {
    const data = await ApiService.evaluarFlotaTramos();
    if (!data || !Array.isArray(data.evaluacion)) {
      throw new Error("No hay información de flota para evaluar.");
    }
    let lista = `<p><b>Distancia Total Acumulada:</b> ${data.distancia_total_km} km</p><ul style="padding-left:16px;">`;
    data.evaluacion.forEach((v) => {
      lista += `<li>${v.vehiculo} (${v.velocidad_kmh} km/h): <b>${v.tiempo_minutos} min</b></li>`;
    });
    lista += `</ul><p class="stat-text mt-2"><b>Vehículo Recomendado:</b> ${data.recomendado}</p>`;
    panel.innerHTML = lista;
  } catch (err) {
    panel.innerHTML = `<span style="color:#dc2626;">${err.message}</span>`;
  }
};

// -----------------------------------------------------------------------------
// MATRIZ Y COMPARATIVA TSP
// -----------------------------------------------------------------------------
window.verMatrizEuclidiana = async function () {
  const panel = document.getElementById("panel-matriz");
  panel.classList.remove("hidden");

  try {
    const data = await ApiService.obtenerMatriz();
    if (!data || !Array.isArray(data.matriz) || !Array.isArray(data.nombres)) {
      throw new Error("No se pudo estructurar la matriz euclidiana.");
    }
    let html = `<table style="width:100%; border-collapse:collapse; font-size:0.75rem; text-align:center;">`;
    html +=
      `<tr><th>Nodo</th>` +
      data.nombres.map((n, i) => `<th>[${i}]</th>`).join("") +
      `</tr>`;

    data.matriz.forEach((fila, i) => {
      html +=
        `<tr><td><b>[${i}]</b></td>` +
        fila
          .map(
            (v) =>
              `<td style="border:1px solid #e2e8f0; padding:4px;">${v.toFixed(2)}</td>`,
          )
          .join("") +
        `</tr>`;
    });
    html += `</table>`;
    panel.innerHTML = html;
  } catch (err) {
    panel.innerHTML = `<span style="color:#dc2626;">${err.message}</span>`;
  }
};

window.verComparativaGlobal = async function () {
  const panel = document.getElementById("panel-complejidad");
  const detalle = document.getElementById("detalle-rutas-tsp");
  panel.classList.remove("hidden");
  detalle.innerHTML = "Procesando comparativa algorítmica...";

  try {
    const data = await ApiService.obtenerComparativa();
    if (!data || !Array.isArray(data.comparativa)) {
      throw new Error(
        "No se obtuvieron resultados de la comparativa algorítmica.",
      );
    }

    const labels = data.comparativa.map((c) => c.algoritmo);
    const distancias = data.comparativa.map((c) =>
      typeof c.distancia_km === "number"
        ? c.distancia_km
        : parseFloat(c.distancia_km),
    );

    const ctx = document
      .getElementById("chart-tsp-comparativa")
      .getContext("2d");
    if (chartComparativaTSP) {
      chartComparativaTSP.destroy();
    }

    chartComparativaTSP = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Distancia Recorrida (km)",
            data: distancias,
            backgroundColor: "#F05816",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: "Distancia Obtenida por Algoritmo (km)",
          },
        },
        scales: {
          y: {
            min: 20,
            title: { display: true, text: "Kilómetros" },
          },
        },
      },
    });

    let html = `<ul style="padding-left:14px; font-size:0.75rem; margin-top:8px;">`;
    data.comparativa.forEach((c) => {
      html += `<li style="margin-bottom:6px;">
        <b>${c.algoritmo}:</b> ${c.distancia_km} km | Tiempo: ${(c.tiempo_s * 1000).toFixed(3)} ms<br>
        <small style="color:#64748b;">${c.ruta}</small>
      </li>`;
    });
    html += `</ul>`;
    detalle.innerHTML = html;
  } catch (err) {
    detalle.innerHTML = `<span style="color:#dc2626;">Error: ${err.message}</span>`;
  }
};

// -----------------------------------------------------------------------------
// SIMULACIÓN Y COTIZADOR DIRECTO
// -----------------------------------------------------------------------------
window.simularTrafico = async function () {
  const inpDist = document.getElementById("inp-sim-dist");
  const panel = document.getElementById("panel-montecarlo");
  const dist = parseFloat(inpDist ? inpDist.value : "");

  if (isNaN(dist) || dist <= 0) {
    mostrarAviso(
      "Campo Requerido",
      "Por favor, ingrese una distancia en kilómetros válida y mayor a 0 para simular el tráfico.",
    );
    if (inpDist) inpDist.focus();
    return;
  }

  panel.classList.remove("hidden");
  panel.innerHTML = "Ejecutando 5,000 escenarios probabilísticos...";

  try {
    const data = await ApiService.simularTrafico(dist);
    panel.innerHTML = `
      <b>Resultados para ${dist.toFixed(2)} km:</b><br>
      - Tiempo Promedio Esperado: <b>${data.tiempo_promedio_min} min</b><br>
      - Escenario Fluido (Mejor Caso): <b>${data.tiempo_mejor_caso_min} min</b><br>
      - Congestión Severa (Peor Caso): <b>${data.tiempo_peor_caso_min} min</b>
    `;
  } catch (err) {
    panel.innerHTML = `<span style="color:#dc2626;">Error: ${err.message}</span>`;
  }
};

window.activarModoSeleccionDirecta = function (tipo) {
  window.modoSeleccionDirecta = tipo;
  const btnA = document.getElementById("btn-pick-dir-origen");
  const btnB = document.getElementById("btn-pick-dir-destino");

  if (tipo === "origen") {
    btnA.style.backgroundColor = "#F05816";
    btnA.style.color = "#ffffff";
    btnB.style.backgroundColor = "";
    btnB.style.color = "";
    mostrarMensaje("Haga clic en el mapa para fijar el Origen (A)");
  } else {
    btnB.style.backgroundColor = "#F05816";
    btnB.style.color = "#ffffff";
    btnA.style.backgroundColor = "";
    btnA.style.color = "";
    mostrarMensaje("Haga clic en el mapa para fijar el Destino (B)");
  }
};

window.manejarClicDirecta = async function (lat, lng) {
  const tipo = window.modoSeleccionDirecta;
  const lugar = await mapApp.obtenerNombreLugar(lat, lng);

  if (tipo === "origen") {
    document.getElementById("inp-dir-origen").value = lugar;
    coordDirOrigen = [lat, lng];
    mapApp.fijarPinTramo("origen", lat, lng, lugar);
  } else if (tipo === "destino") {
    document.getElementById("inp-dir-destino").value = lugar;
    coordDirDestino = [lat, lng];
    mapApp.fijarPinTramo("destino", lat, lng, lugar);
  }

  document.getElementById("btn-pick-dir-origen").style.backgroundColor = "";
  document.getElementById("btn-pick-dir-origen").style.color = "";
  document.getElementById("btn-pick-dir-destino").style.backgroundColor = "";
  document.getElementById("btn-pick-dir-destino").style.color = "";
  window.modoSeleccionDirecta = null;

  if (coordDirOrigen && coordDirDestino) {
    window.calcularDistanciaVial(coordDirOrigen, coordDirDestino, "inp-dir-km");
  }
};

window.cotizarDirecta = async function () {
  const inpOrigen = document.getElementById("inp-dir-origen");
  const inpDestino = document.getElementById("inp-dir-destino");
  const inpKm = document.getElementById("inp-dir-km");
  const vehiculo = document.getElementById("sel-dir-vehiculo").value;
  const panel = document.getElementById("panel-directa");

  const origen = inpOrigen ? inpOrigen.value.trim() : "";
  const destino = inpDestino ? inpDestino.value.trim() : "";
  const km = parseFloat(inpKm ? inpKm.value : "");

  if (!origen) {
    mostrarAviso(
      "Origen Requerido",
      "Por favor, ingrese el punto de partida o márquelo en el mapa con 'Fijar A'.",
    );
    if (inpOrigen) inpOrigen.focus();
    return;
  }

  if (!destino) {
    mostrarAviso(
      "Destino Requerido",
      "Por favor, ingrese el punto de llegada o márquelo en el mapa con 'Fijar B'.",
    );
    if (inpDestino) inpDestino.focus();
    return;
  }

  if (isNaN(km) || km <= 0) {
    mostrarAviso(
      "Distancia Requerida",
      "Debe ingresar una distancia válida mayor a 0 km (o seleccionar ambos puntos en el mapa).",
    );
    if (inpKm) inpKm.focus();
    return;
  }

  panel.classList.remove("hidden");

  try {
    const data = await ApiService.cotizarDirecta(origen, destino, km, vehiculo);
    const tiempoMin =
      data.tiempo_estimado_minutos ??
      data.tiempo_minutos ??
      data.tiempo_estimado ??
      ((km / (data.velocidad_kmh || 40)) * 60).toFixed(1);
    const velKmh =
      data.velocidad_kmh ??
      (vehiculo === "Bicicleta" ? 15 : vehiculo === "Auto" ? 30 : 40);

    panel.innerHTML = `
      <b>Resumen de Cotización:</b><br>
      - Tramo: ${data.origen || origen} -> ${data.destino || destino}<br>
      - Distancia: ${(data.kilometros || km).toFixed(2)} km<br>
      - Transporte: ${data.vehiculo || vehiculo} (${velKmh} km/h)<br>
      - Tiempo Estimado: <b>${tiempoMin} minutos</b>
    `;
  } catch (err) {
    panel.innerHTML = `<span style="color:#dc2626;">Error: ${err.message}</span>`;
  }
};

// -----------------------------------------------------------------------------
// FINANZAS Y RESTABLECIMIENTO
// -----------------------------------------------------------------------------
window.calcularCambio = async function () {
  const inpP = document.getElementById("inp-pago");
  const inpC = document.getElementById("inp-costo");
  const panel = document.getElementById("panel-vuelto-calc");

  const p = parseFloat(inpP ? inpP.value : "");
  const c = parseFloat(inpC ? inpC.value : "");

  if (isNaN(p) || isNaN(c)) {
    mostrarAviso(
      "Campos Incompletos",
      "Por favor, ingrese tanto el monto abonado como el costo del pedido antes de continuar.",
    );
    return;
  }

  if (p < c) {
    mostrarAviso(
      "Monto Insuficiente",
      "El monto abonado no puede ser menor al costo total del pedido.",
    );
    return;
  }

  panel.classList.remove("hidden");

  try {
    const data = await ApiService.calcularVuelto(p, c);
    if (!data || !Array.isArray(data.desglose)) {
      throw new Error(
        data?.detail || "No se pudo calcular el desglose de monedas.",
      );
    }
    const desg = data.desglose
      .map(
        (m) => `Denominación: S/. ${m.denominacion} | Cantidad: ${m.cantidad}`,
      )
      .join("<br>");
    panel.innerHTML = `<b>Vuelto a Entregar: S/. ${data.vuelto_total}</b><br><small>${desg}</small>`;
  } catch (err) {
    panel.innerHTML = `<span style="color:#dc2626;">Error: ${err.message}</span>`;
  }
};

window.solicitarRestablecimiento = function () {
  mostrarConfirmacion(
    "Restablecer Datos",
    "¿Está seguro de restablecer todos los puntos y tramos iniciales?",
    async () => {
      await ApiService.restablecerDatos();
      await cargarPuntosYRenderizar();
      mapApp.limpiarRuta();
      mapApp.limpiarPinesTramo();
      const panel = document.getElementById("panel-tsp");
      if (panel) panel.classList.add("hidden");
      mostrarMensaje("Datos restablecidos a los valores iniciales.");
    },
  );
};
