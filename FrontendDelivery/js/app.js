const mapApp = new DeliveryMap("map");

let puntosMemoria = [];
let rutaActualIds = [];
let ultimoMetodoUsado = "greedy";
let distanciaRutaActualKm = 25.15;
let chartComparativaTSP = null;

// Modos de selección de tramos (Pestaña Tramos)
window.modoSeleccionTramo = null;
let coordOrigenTramo = null;
let coordDestinoTramo = null;

// Modos de selección directa (Pestaña Simulación)
window.modoSeleccionDirecta = null;
let coordDirOrigen = null;
let coordDirDestino = null;

const COLORES_METODO = {
  greedy: "#2563eb",
  fuerza_bruta: "#16a34a",
  dinamica: "#7c3aed",
  backtracking: "#ea580c",
};

const SUBTITULOS = {
  "tab-clientes": "Gestión de Clientes y Paradas",
  "tab-rutas": "Planificación y Ruteo de Despacho",
  "tab-tramos": "Medición y Ordenamiento Vial",
  "tab-complejidad": "Matriz y Desempeño Algorítmico",
  "tab-simulacion": "Simulación de Tráfico y Cotizador Directo",
  "tab-finanzas": "Desglose Monetario y Parámetros",
};

// -----------------------------------------------------------------------------
// SISTEMA DE NOTIFICACIONES Y MODALES PERSONALIZADOS
// -----------------------------------------------------------------------------
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
// CONTROL DE PESTAÑAS DEL MENÚ
// -----------------------------------------------------------------------------
window.cambiarTab = function (tabId) {
  document
    .querySelectorAll(".tab-btn")
    .forEach((btn) => btn.classList.remove("active"));
  document
    .querySelectorAll(".tab-content")
    .forEach((content) => content.classList.remove("active"));

  const btnActivo = event
    ? event.currentTarget
    : document.querySelector(`.tab-btn[onclick*="${tabId}"]`);
  if (btnActivo) btnActivo.classList.add("active");

  const contenedor = document.getElementById(tabId);
  if (contenedor) contenedor.classList.add("active");

  const subtitulo = document.getElementById("tab-subtitulo");
  if (subtitulo) subtitulo.innerText = SUBTITULOS[tabId] || "Panel de Control";
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
  // Pestaña 1: Catálogo General de Puntos
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

  // Pestaña 2: Checkpoints para Despacho Dinámico
  const chkCont = document.getElementById("contenedor-checkpoints");
  if (chkCont) {
    chkCont.innerHTML = "";
    puntos.forEach((p) => {
      const esAlmacen = p.id === 0;
      // Valida si el nombre ya contiene el distrito para no duplicar texto
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
  const peso = parseFloat(document.getElementById("inp-peso").value) || 1.0;
  const desc =
    document.getElementById("inp-desc").value.trim() || "Paquete regular";

  if (!nombre) {
    inpNombre.classList.add("input-error");
    inpNombre.focus();
    mostrarAviso(
      "Campo Obligatorio Requerido",
      "Por favor, ingrese el nombre del cliente o de la parada de entrega antes de guardar.",
    );
    return;
  }
  inpNombre.classList.remove("input-error");

  if (isNaN(lat) || isNaN(lng)) {
    mostrarAviso(
      "Ubicación No Seleccionada",
      "Debe hacer clic en el mapa para fijar las coordenadas de entrega (latitud y longitud).",
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

    inpNombre.value = "";
    document.getElementById("inp-distrito").value = "";
    document.getElementById("inp-lat").value = "";
    document.getElementById("inp-lng").value = "";
    document.getElementById("inp-peso").value = "2.5";

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

// -----------------------------------------------------------------------------
// PLANIFICACIÓN Y TRAZADO TSP
// -----------------------------------------------------------------------------
window.calcularRutaOptima = async function (metodo) {
  ultimoMetodoUsado = metodo;
  const ids = obtenerIdsSeleccionados();

  if (ids.length < 2) {
    mostrarMensaje("Seleccione al menos un punto de destino.");
    return;
  }

  try {
    const data = await ApiService.calcularRutaOptima(ids, metodo);
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

  document.getElementById("badge-metodo").innerText = data.metodo.toUpperCase();
  document.getElementById("tag-distancia").innerText =
    `${data.distancia_km} km`;
  document.getElementById("stat-peso").innerText =
    `${data.peso_total_carga_kg} kg`;
  document.getElementById("stat-tiempo").innerText = data.tiempo_computo_s;
  document.getElementById("stat-ruta").innerText =
    data.secuencia_nombres.join(" -> ");

  const listVeh = document.getElementById("lista-vehiculos");
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

  mapApp.trazarRuta(
    data.coordenadas_mapa,
    data.secuencia_ids,
    puntosMemoria,
    COLORES_METODO[data.metodo],
  );
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
  window.modoSeleccionTramo = tipo;
  const btnA = document.getElementById("btn-pick-origen");
  const btnB = document.getElementById("btn-pick-destino");

  if (tipo === "origen") {
    btnA.style.backgroundColor = "#16a34a";
    btnA.style.color = "#ffffff";
    btnB.style.backgroundColor = "";
    btnB.style.color = "";
  } else {
    btnB.style.backgroundColor = "#dc2626";
    btnB.style.color = "#ffffff";
    btnA.style.backgroundColor = "";
    btnA.style.color = "";
  }
};

window.manejarClicTramo = async function (lat, lng) {
  const tipo = window.modoSeleccionTramo;
  const lugar = await mapApp.obtenerNombreLugar(lat, lng);

  if (tipo === "origen") {
    document.getElementById("inp-tramo-origen").value = lugar;
    coordOrigenTramo = [lat, lng];
    mapApp.fijarPinTramo("origen", lat, lng, lugar);
  } else if (tipo === "destino") {
    document.getElementById("inp-tramo-destino").value = lugar;
    coordDestinoTramo = [lat, lng];
    mapApp.fijarPinTramo("destino", lat, lng, lugar);
  }

  document.getElementById("btn-pick-origen").style.backgroundColor = "";
  document.getElementById("btn-pick-origen").style.color = "";
  document.getElementById("btn-pick-destino").style.backgroundColor = "";
  document.getElementById("btn-pick-destino").style.color = "";
  window.modoSeleccionTramo = null;

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
        color: "#0284c7",
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
    mostrarMensaje("Ingrese el punto de origen y de destino.");
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

  if (!origen || !destino || isNaN(km)) {
    mostrarMensaje("Complete origen, destino y distancia.");
    return;
  }

  try {
    const res = await ApiService.agregarTramo(origen, destino, km);
    mostrarMensaje(res.mensaje);
    document.getElementById("inp-tramo-origen").value = "";
    document.getElementById("inp-tramo-destino").value = "";
    document.getElementById("inp-tramo-km").value = "";
    mapApp.limpiarPinesTramo();
    window.ordenarTramos();
  } catch (err) {
    mostrarMensaje("Error: " + err.message);
  }
};

window.ordenarTramos = async function () {
  const panel = document.getElementById("panel-tramos-ordenados");
  panel.classList.remove("hidden");

  const data = await ApiService.ordenarTramos();
  let lista = `<p><b>Tramos Ordenados por Kilometraje (QuickSort):</b></p><ul style="padding-left:16px;">`;
  data.tramos_ordenados.forEach((t) => {
    lista += `<li>${t.origen} -> ${t.destino}: <b>${t.kilometros.toFixed(2)} km</b></li>`;
  });
  lista += `</ul><p class="stat-text mt-2"><b>Tiempo Burbuja:</b> ${data.tiempo_burbuja_s} s | <b>Tiempo QuickSort:</b> ${data.tiempo_quicksort_s} s</p>`;
  panel.innerHTML = lista;
};

window.evaluarFlotaTramos = async function () {
  const panel = document.getElementById("panel-flota-tramos");
  panel.classList.remove("hidden");

  const data = await ApiService.evaluarFlotaTramos();
  let lista = `<p><b>Distancia Total Acumulada:</b> ${data.distancia_total_km} km</p><ul style="padding-left:16px;">`;
  data.evaluacion.forEach((v) => {
    lista += `<li>${v.vehiculo} (${v.velocidad_kmh} km/h): <b>${v.tiempo_minutos} min</b></li>`;
  });
  lista += `</ul><p class="stat-text mt-2"><b>Vehículo Recomendado:</b> ${data.recomendado}</p>`;
  panel.innerHTML = lista;
};

// -----------------------------------------------------------------------------
// MATRIZ Y COMPARATIVA TSP (GRÁFICO CHART.JS)
// -----------------------------------------------------------------------------
window.verMatrizEuclidiana = async function () {
  const panel = document.getElementById("panel-matriz");
  panel.classList.remove("hidden");

  const data = await ApiService.obtenerMatriz();
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
};

window.verComparativaGlobal = async function () {
  const panel = document.getElementById("panel-complejidad");
  const detalle = document.getElementById("detalle-rutas-tsp");
  panel.classList.remove("hidden");
  detalle.innerHTML = "Procesando comparativa algorítmica...";

  const data = await ApiService.obtenerComparativa();

  const labels = data.comparativa.map((c) => c.algoritmo);
  const distancias = data.comparativa.map((c) =>
    typeof c.distancia_km === "number"
      ? c.distancia_km
      : parseFloat(c.distancia_km),
  );

  const ctx = document.getElementById("chart-tsp-comparativa").getContext("2d");
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
          backgroundColor: "#2563eb",
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
  data.comparativa.forEach((c, idx) => {
    html += `<li style="margin-bottom:6px;">
      <b>${c.algoritmo}:</b> ${c.distancia_km} km | Tiempo: ${(c.tiempo_s * 1000).toFixed(3)} ms<br>
      <small style="color:#64748b;">${c.ruta}</small>
    </li>`;
  });
  html += `</ul>`;
  detalle.innerHTML = html;
};

// -----------------------------------------------------------------------------
// SIMULACIÓN Y COTIZADOR DIRECTO
// -----------------------------------------------------------------------------
window.simularTrafico = async function () {
  const panel = document.getElementById("panel-montecarlo");
  panel.classList.remove("hidden");
  panel.innerHTML = "Ejecutando 5,000 escenarios probabilísticos...";

  let dist = parseFloat(document.getElementById("inp-sim-dist").value);
  if (isNaN(dist) || dist <= 0) dist = distanciaRutaActualKm;

  const data = await ApiService.simularTrafico(dist);
  panel.innerHTML = `
    <b>Resultados para ${dist} km:</b><br>
    - Tiempo Promedio Esperado: <b>${data.tiempo_promedio_min} min</b><br>
    - Escenario Fluido (Mejor Caso): <b>${data.tiempo_mejor_caso_min} min</b><br>
    - Congestión Severa (Peor Caso): <b>${data.tiempo_peor_caso_min} min</b>
  `;
};

window.activarModoSeleccionDirecta = function (tipo) {
  window.modoSeleccionDirecta = tipo;
  const btnA = document.getElementById("btn-pick-dir-origen");
  const btnB = document.getElementById("btn-pick-dir-destino");

  if (tipo === "origen") {
    btnA.style.backgroundColor = "#16a34a";
    btnA.style.color = "#ffffff";
    btnB.style.backgroundColor = "";
    btnB.style.color = "";
  } else {
    btnB.style.backgroundColor = "#dc2626";
    btnB.style.color = "#ffffff";
    btnA.style.backgroundColor = "";
    btnA.style.color = "";
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
  const origen =
    document.getElementById("inp-dir-origen").value.trim() || "Santa Anita";
  const destino =
    document.getElementById("inp-dir-destino").value.trim() || "San Luis";
  const km = parseFloat(document.getElementById("inp-dir-km").value) || 20;
  const vehiculo = document.getElementById("sel-dir-vehiculo").value;
  const panel = document.getElementById("panel-directa");
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
  const p = document.getElementById("inp-pago").value;
  const c = document.getElementById("inp-costo").value;
  const panel = document.getElementById("panel-vuelto-calc");
  panel.classList.remove("hidden");

  try {
    const data = await ApiService.calcularVuelto(p, c);
    let desg = data.desglose
      .map(
        (m) => `Denominación: S/. ${m.denominacion} | Cantidad: ${m.cantidad}`,
      )
      .join("<br>");
    panel.innerHTML = `<b>Vuelto a Entregar: S/. ${data.vuelto_total}</b><br><small>${desg}</small>`;
  } catch (err) {
    panel.innerHTML = `<span style="color:#dc2626;">${err.message}</span>`;
  }
};

window.solicitarRestablecimiento = function () {
  mostrarConfirmacion(
    "Restablecer  Datos",
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
