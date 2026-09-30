const API_BASE = "http://127.0.0.1:8000";

const ApiService = {
  async obtenerPuntos() {
    const res = await fetch(`${API_BASE}/puntos`);
    return await res.json();
  },

  async agregarPunto(punto) {
    const res = await fetch(`${API_BASE}/puntos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(punto),
    });
    return await res.json();
  },

  async eliminarPunto(puntoId) {
    const res = await fetch(`${API_BASE}/puntos/${puntoId}`, {
      method: "DELETE",
    });
    return await res.json();
  },

  async obtenerMatriz() {
    const res = await fetch(`${API_BASE}/matriz-distancias`);
    return await res.json();
  },

  async obtenerComparativa() {
    const res = await fetch(`${API_BASE}/comparativa-tsp`);
    return await res.json();
  },

  async calcularRutaOptima(idsPuntos, metodo = "greedy") {
    const res = await fetch(`${API_BASE}/calcular-ruta-optima`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids_puntos: idsPuntos, metodo: metodo }),
    });
    return await res.json();
  },

  async agregarTramo(origen, destino, kilometros) {
    const res = await fetch(`${API_BASE}/tramos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origen, destino, kilometros }),
    });
    return await res.json();
  },

  async ordenarTramos() {
    const res = await fetch(`${API_BASE}/tramos/ordenar`);
    return await res.json();
  },

  async evaluarFlotaTramos() {
    const res = await fetch(`${API_BASE}/tramos/evaluar-flota`);
    return await res.json();
  },

  async calcularVuelto(pago, costo) {
    const res = await fetch(
      `${API_BASE}/calculadora-vuelto?pago=${pago}&costo=${costo}`,
    );
    return await res.json();
  },

  async simularTrafico(distanciaKm) {
    const res = await fetch(
      `${API_BASE}/simulacion-monte-carlo?distancia_km=${distanciaKm}`,
    );
    return await res.json();
  },

  async cotizarDirecta(origen, destino, kilometros, vehiculo) {
    const res = await fetch(`${API_BASE}/cotizar-directa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origen, destino, kilometros, vehiculo }),
    });
    return await res.json();
  },

  async restablecerDatos() {
    const res = await fetch(`${API_BASE}/restablecer-datos`, {
      method: "POST",
    });
    return await res.json();
  },
};
