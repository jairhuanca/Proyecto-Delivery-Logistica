class DeliveryMap {
  constructor(elementId, center = [-12.105, -77.015], zoom = 12) {
    this.map = L.map(elementId).setView(center, zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
    }).addTo(this.map);

    this.routeGroup = L.layerGroup().addTo(this.map);
    this.markersGroup = L.layerGroup().addTo(this.map);
    this.tempMarker = null;

    this.markerOrigenTramo = null;
    this.markerDestinoTramo = null;
    this.tramoDirectoLine = null;

    this.puntosGuardados = [];

    this.map.on("click", (e) => {
      if (window.modoSeleccionTramo) {
        window.manejarClicTramo(e.latlng.lat, e.latlng.lng);
      } else if (window.modoSeleccionDirecta) {
        window.manejarClicDirecta(e.latlng.lat, e.latlng.lng);
      } else {
        this.fijarPunteroUbicacion(e.latlng.lat, e.latlng.lng);
      }
    });
  }

  async obtenerNombreLugar(lat, lng) {
    try {
      const urlReverse = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`;
      const resp = await fetch(urlReverse, {
        headers: { "Accept-Language": "es" },
      });
      const data = await resp.json();
      if (data && data.address) {
        return (
          data.address.suburb ||
          data.address.city_district ||
          data.address.neighbourhood ||
          data.address.municipality ||
          data.address.city ||
          "Lima"
        );
      }
    } catch (e) {
      console.warn("Error al detectar zona:", e);
    }
    return "Lima";
  }

  // Icono de ubicación
  _crearIconoChincheta(color = "#dc2626") {
    return L.divIcon({
      className: "pin-ubicacion-container",
      html: `
        <div style="
          width: 32px;
          height: 42px;
          position: relative;
          cursor: grab;
          filter: drop-shadow(0 3px 6px rgba(0,0,0,0.35));
        ">
          <svg viewBox="0 0 24 24" width="32" height="42" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 0C7.58 0 4 3.58 4 8c0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8z" fill="${color}"/>
            <circle cx="12" cy="8" r="3.5" fill="#ffffff"/>
          </svg>
        </div>
      `,
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -40],
    });
  }

  async fijarPunteroUbicacion(lat, lng) {
    const latInput = document.getElementById("inp-lat");
    const lngInput = document.getElementById("inp-lng");
    const distritoInput = document.getElementById("inp-distrito");

    if (latInput && lngInput) {
      latInput.value = lat.toFixed(5);
      lngInput.value = lng.toFixed(5);
    }

    if (distritoInput) {
      distritoInput.placeholder = "Detectando distrito...";
      const lugar = await this.obtenerNombreLugar(lat, lng);
      distritoInput.value = lugar;
      distritoInput.placeholder = "Distrito detectado";
    }

    if (this.tempMarker) {
      this.map.removeLayer(this.tempMarker);
    }

    // icono de ubicación clásico
    this.tempMarker = L.marker([lat, lng], {
      icon: this._crearIconoChincheta("#2563eb"),
      draggable: true,
    }).addTo(this.map);

    this.tempMarker
      .bindPopup(
        "<b>Ubicación Seleccionada</b><br>Arrastre para ajustar la posición",
      )
      .openPopup();

    this.tempMarker.on("dragend", async (ev) => {
      const pos = ev.target.getLatLng();
      await this.fijarPunteroUbicacion(pos.lat, pos.lng);
    });
  }

  limpiarPunteroUbicacion() {
    if (this.tempMarker) {
      this.map.removeLayer(this.tempMarker);
      this.tempMarker = null;
    }
  }

  fijarPinTramo(tipo, lat, lng, nombreLugar) {
    const esOrigen = tipo === "origen";
    const color = esOrigen ? "#16a34a" : "#dc2626";
    const texto = esOrigen ? "Origen" : "Destino";

    const icono = L.divIcon({
      className: "tramo-pin",
      html: `
        <div style="
          background-color: ${color}; color: #ffffff; border: 2px solid #ffffff;
          border-radius: 12px; padding: 4px 10px; font-weight: 700; font-size: 11px;
          box-shadow: 0 3px 6px rgba(0,0,0,0.3); white-space: nowrap; text-align: center;
        ">
          ${texto}: ${nombreLugar}
        </div>
      `,
      iconSize: [120, 26],
      iconAnchor: [60, 13],
    });

    if (esOrigen) {
      if (this.markerOrigenTramo) this.map.removeLayer(this.markerOrigenTramo);
      this.markerOrigenTramo = L.marker([lat, lng], { icon: icono }).addTo(
        this.map,
      );
    } else {
      if (this.markerDestinoTramo)
        this.map.removeLayer(this.markerDestinoTramo);
      this.markerDestinoTramo = L.marker([lat, lng], { icon: icono }).addTo(
        this.map,
      );
    }
  }

  limpiarPinesTramo() {
    if (this.markerOrigenTramo) {
      this.map.removeLayer(this.markerOrigenTramo);
      this.markerOrigenTramo = null;
    }
    if (this.markerDestinoTramo) {
      this.map.removeLayer(this.markerDestinoTramo);
      this.markerDestinoTramo = null;
    }
    if (this.tramoDirectoLine) {
      this.map.removeLayer(this.tramoDirectoLine);
      this.tramoDirectoLine = null;
    }
  }

  _crearPinRuta(texto, colorFondo = "#2563eb") {
    return L.divIcon({
      className: "custom-route-marker",
      html: `
        <div style="
          background-color: ${colorFondo}; color: #ffffff; border: 2px solid #ffffff;
          border-radius: 14px; padding: 3px 10px; font-weight: 700; font-size: 11px;
          box-shadow: 0 3px 6px rgba(0,0,0,0.3); text-align: center; white-space: nowrap;
          cursor: pointer; display: inline-block;
        ">
          ${texto}
        </div>
      `,
      iconSize: [85, 26],
      iconAnchor: [42, 13],
    });
  }

  renderizarPuntos(puntos) {
    this.puntosGuardados = puntos;
    this.markersGroup.clearLayers();
    this.routeGroup.clearLayers();
    this.limpiarPunteroUbicacion();
    this.limpiarPinesTramo();

    puntos.forEach((p) => {
      const esAlmacen = p.id === 0;
      const texto = esAlmacen ? "Almacén Central" : `Punto ${p.id}`;
      const color = esAlmacen ? "#16a34a" : "#2563eb";

      L.marker([p.lat, p.lng], {
        icon: this._crearPinRuta(texto, color),
      }).addTo(this.markersGroup).bindPopup(`
          <div style="font-size:0.82rem; line-height: 1.45;">
            <b>${p.nombre}</b> (${p.distrito})<br>
            Carga: <b>${p.peso_kg || 0} kg</b><br>
            Descripción: ${p.descripcion_pedido || "Sin pedido"}<br>
            ${!esAlmacen ? `<button style="margin-top:8px; background:#dc2626; color:white; border:none; padding:5px 8px; border-radius:4px; font-weight:600; cursor:pointer; width:100%;" onclick="window.cancelarPedidoEnRuta(${p.id})">Cancelar Pedido</button>` : '<span style="color:#16a34a; font-weight:700;">Base Central de Operaciones</span>'}
          </div>
        `);
    });
  }

  async trazarRuta(
    puntosSecuencia,
    secuenciaIds,
    infoPuntos,
    color = "#2563eb",
  ) {
    this.markersGroup.clearLayers();
    this.routeGroup.clearLayers();
    this.limpiarPunteroUbicacion();
    this.limpiarPinesTramo();

    if (!puntosSecuencia || puntosSecuencia.length < 2) return;

    const n = puntosSecuencia.length;

    for (let idx = 0; idx < n; idx++) {
      const coord = puntosSecuencia[idx];
      const idActual = secuenciaIds[idx];
      const pInfo = infoPuntos.find((item) => item.id === idActual) || {
        nombre: `Punto ${idActual}`,
        distrito: "Lima",
        peso_kg: 0,
      };
      const esInicio = idx === 0;
      const esFin = idx === n - 1;

      let etiqueta = esInicio ? "Inicio" : esFin ? "Retorno" : `Parada ${idx}`;
      let colorPin = esInicio ? "#16a34a" : esFin ? "#dc2626" : "#2563eb";

      const marker = L.marker(coord, {
        icon: this._crearPinRuta(etiqueta, colorPin),
        zIndexOffset: esFin ? 1000 : esInicio ? 900 : idx * 10,
      }).addTo(this.markersGroup);

      if (!esInicio && !esFin) {
        marker.bindPopup(`
          <div style="font-size:0.82rem; line-height: 1.45;">
            <b style="color:#2563eb;">Parada ${idx}</b><br>
            <b>${pInfo.nombre}</b> (${pInfo.distrito})<br>
            Carga: <b>${pInfo.peso_kg || 0} kg</b><br>
            <button style="margin-top:8px; background:#dc2626; color:white; border:none; padding:6px 10px; border-radius:4px; font-weight:600; cursor:pointer; width:100%;" onclick="window.cancelarPedidoEnRuta(${idActual})">
              Cancelar Pedido y Recalcular
            </button>
          </div>
        `);
      } else {
        marker.bindPopup(
          `<b>Almacén Central</b><br>${esInicio ? "Punto de Partida" : "Llegada Final"}`,
        );
      }
    }

    let bounds = L.latLngBounds();

    for (let i = 0; i < n - 1; i++) {
      const origen = puntosSecuencia[i];
      const destino = puntosSecuencia[i + 1];
      const urlOSRM = `https://router.project-osrm.org/route/v1/driving/${origen[1]},${origen[0]};${destino[1]},${destino[0]}?overview=full&geometries=geojson`;

      try {
        const resp = await fetch(urlOSRM);
        const data = await resp.json();

        if (data.routes && data.routes.length > 0) {
          const coordsCalle = data.routes[0].geometry.coordinates.map((c) => [
            c[1],
            c[0],
          ]);
          const poly = L.polyline(coordsCalle, {
            color: color,
            weight: 5,
            opacity: 0.88,
            lineJoin: "round",
          }).addTo(this.routeGroup);
          bounds.extend(poly.getBounds());
        } else {
          const directLine = L.polyline([origen, destino], {
            color: color,
            weight: 4,
          }).addTo(this.routeGroup);
          bounds.extend(directLine.getBounds());
        }
      } catch (e) {
        const directLine = L.polyline([origen, destino], {
          color: color,
          weight: 4,
        }).addTo(this.routeGroup);
        bounds.extend(directLine.getBounds());
      }
    }

    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [40, 40] });
    }
  }

  limpiarRuta() {
    this.routeGroup.clearLayers();
    this.limpiarPunteroUbicacion();
    this.limpiarPinesTramo();
    if (this.puntosGuardados.length > 0) {
      this.renderizarPuntos(this.puntosGuardados);
    }
  }
}
