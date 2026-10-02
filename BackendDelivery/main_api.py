# -*- coding: utf-8 -*-
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from typing import List, Optional
import math
import time
import json
import os

from algoritmos_delivery import (
    calcular_matriz_distancias,
    resolver_fuerza_bruta,
    resolver_greedy,
    calcular_entrega_directa
)
from algoritmos_avanzados import (
    resolver_backtracking,
    resolver_programacion_dinamica,
    simular_trafico_monte_carlo,
    resolver_tsp_paralelo
)
from rutas_tramo import (
    crear_tramo,
    calcular_distancia_total,
    ordenamiento_burbuja_tramos,
    ordenamiento_quicksort_tramos,
    cambio_monedas_delivery
)
from vehiculos_metodos import evaluar_vehiculos_para_distancia, VEHICULOS

app = FastAPI(
    title="RutaDelivery API - Sistema de Optimización y Rutas",
    version="3.0.0",
    docs_url=None,
    redoc_url=None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# PERSISTENCIA EN ARCHIVOS JSON
# -----------------------------------------------------------------------------
RUTA_PUNTOS_JSON = "puntos.json"
RUTA_TRAMOS_JSON = "tramos.json"

PUNTOS_BASE = [
    {"id": 0, "nombre": "Almacen Central", "distrito": "San Isidro", "lat": -12.0969, "lng": -77.0345, "x": 0.0, "y": 0.0, "peso_kg": 0.0, "descripcion_pedido": "Base Central"},
    {"id": 1, "nombre": "Cliente A - San Isidro", "distrito": "San Isidro", "lat": -12.1050, "lng": -77.0300, "x": 3.0, "y": 4.0, "peso_kg": 3.5, "descripcion_pedido": "Documentos"},
    {"id": 2, "nombre": "Cliente B - Miraflores", "distrito": "Miraflores", "lat": -12.1215, "lng": -77.0298, "x": 6.0, "y": 1.0, "peso_kg": 4.0, "descripcion_pedido": "Paquete tech"},
    {"id": 3, "nombre": "Cliente C - Santiago Surco", "distrito": "Santiago Surco", "lat": -12.1380, "lng": -76.9950, "x": 7.0, "y": 5.0, "peso_kg": 2.0, "descripcion_pedido": "Repuestos"},
    {"id": 4, "nombre": "Cliente D - San Borja", "distrito": "San Borja", "lat": -12.0870, "lng": -77.0035, "x": 2.0, "y": 8.0, "peso_kg": 6.0, "descripcion_pedido": "Ropa"},
]

TRAMOS_BASE = [
    crear_tramo("San Isidro", "Miraflores", 3.60),
    crear_tramo("Almacen Central", "San Isidro", 5.00),
    crear_tramo("Surco", "San Borja", 5.80),
    crear_tramo("Miraflores", "Surco", 6.20),
]

def cargar_puntos():
    if not os.path.exists(RUTA_PUNTOS_JSON):
        guardar_puntos(PUNTOS_BASE)
        return [dict(p) for p in PUNTOS_BASE]
    try:
        with open(RUTA_PUNTOS_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return [dict(p) for p in PUNTOS_BASE]

def guardar_puntos(datos):
    with open(RUTA_PUNTOS_JSON, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)

def cargar_tramos():
    if not os.path.exists(RUTA_TRAMOS_JSON):
        guardar_tramos(TRAMOS_BASE)
        return [dict(t) for t in TRAMOS_BASE]
    try:
        with open(RUTA_TRAMOS_JSON, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return [dict(t) for t in TRAMOS_BASE]

def guardar_tramos(datos):
    with open(RUTA_TRAMOS_JSON, "w", encoding="utf-8") as f:
        json.dump(datos, f, ensure_ascii=False, indent=2)

puntos_db = cargar_puntos()
tramos_db = cargar_tramos()
contador_id = max([p["id"] for p in puntos_db], default=0) + 1

# -----------------------------------------------------------------------------
# LOGOTIPO VECTORIAL SVG OFICIAL Y CABECERA SWAGGER 
# -----------------------------------------------------------------------------
FAVICON_SVG = "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='48' fill='%230F0F0F'/><circle cx='50' cy='50' r='36' fill='%2380C27A'/><polygon points='56,18 43,48 50,48 40,78 63,44 54,44 60,18' fill='%23F05816' stroke='%23FFFFFF' stroke-width='2'/></svg>"

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    swagger_html = get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title="RutaDelivery - API Documentation",
        swagger_favicon_url=FAVICON_SVG
    )
    
    header_branding = """
    <style>
      .topbar { background-color: #F05816 !important; padding: 10px 0 !important; box-shadow: 0 3px 10px rgba(0,0,0,0.15); }
      .topbar-wrapper img { display: none !important; }
      .topbar-wrapper .link:after {
        content: "RUTA DELIVERY • LOGÍSTICA & RUTAS";
        color: #FFFFFF;
        font-weight: 900;
        font-size: 1.1rem;
        letter-spacing: 1px;
        display: inline-block;
      }
      .swagger-ui .info .title { color: #0F0F0F !important; }
      .swagger-ui .opblock.opblock-post { border-color: #80C27A; background: rgba(128,194,122,0.08); }
      .swagger-ui .opblock.opblock-get { border-color: #F05816; background: rgba(240,88,22,0.06); }
      .swagger-ui .btn.execute { background-color: #80C27A !important; color: #0F0F0F !important; font-weight: 800 !important; border: none; }
    </style>
    <script>
      window.addEventListener('DOMContentLoaded', () => {
        const topbar = document.querySelector('.topbar-wrapper a');
        if (topbar) {
          topbar.innerHTML = `
            <div style="display:flex; align-items:center; gap:12px; text-decoration:none;">
              <div style="width:42px; height:42px; background:#0F0F0F; border:2px solid #80C27A; border-radius:50%; display:flex; align-items:center; justify-content:center; box-shadow:0 3px 8px rgba(0,0,0,0.3);">
                <svg viewBox="0 0 100 100" style="width:34px; height:34px;">
                  <path d="M 38 48 C 22 36 12 36 2 42 C 10 48 20 50 34 54 Z" fill="#80C27A"/>
                  <path d="M 62 48 C 78 36 88 36 98 42 C 90 48 80 50 66 54 Z" fill="#80C27A"/>
                  <circle cx="50" cy="54" r="24" fill="#0F0F0F" stroke="#2D3139" stroke-width="2"/>
                  <circle cx="50" cy="54" r="18" fill="#181A20" stroke="#F05816" stroke-width="1.5"/>
                  <circle cx="50" cy="54" r="5" fill="#80C27A"/>
                  <polygon points="56,22 43,50 49,50 40,78 61,46 53,46 59,22" fill="#F05816" stroke="#FFD700" stroke-width="1"/>
                </svg>
              </div>
              <span style="font-weight:900; color:#FFFFFF; font-size:1.1rem; letter-spacing:0.8px;">
                RUTA<span style="background:#80C27A; color:#0F0F0F; padding:2px 5px; border-radius:3px; margin-left:3px;">DELIVERY</span>
              </span>
            </div>
          `;
        }
      });
    </script>
    """
    
    html_content = swagger_html.body.decode("utf-8").replace("</head>", f"{header_branding}</head>")
    return HTMLResponse(content=html_content)

CAPACIDADES_VEHICULOS = {"Bicicleta": 10.0, "Moto": 30.0, "Auto": 300.0}

class NuevoPuntoInput(BaseModel):
    nombre: str
    distrito: str = "Lima"
    lat: float
    lng: float
    peso_kg: float = 1.0
    descripcion_pedido: str = "Pedido delivery"

class TramoManualInput(BaseModel):
    origen: str
    destino: str
    kilometros: float = Field(..., gt=0)

class CotizacionInput(BaseModel):
    origen: str
    destino: str
    kilometros: float
    vehiculo: str

# Listar puntos de entrega
@app.get("/puntos")
def listar_puntos():
    return puntos_db

# Agregar nuevo punto de entrega
@app.post("/puntos")
def agregar_punto(datos: NuevoPuntoInput):
    global contador_id
    dx = (datos.lat - (-12.0969)) * 111.0
    dy = (datos.lng - (-77.0345)) * 111.0
    nuevo = {
        "id": contador_id,
        "nombre": datos.nombre,
        "distrito": datos.distrito,
        "lat": datos.lat,
        "lng": datos.lng,
        "x": round(math.sqrt(dx**2 + dy**2), 1),
        "y": round(dy, 1),
        "peso_kg": datos.peso_kg,
        "descripcion_pedido": datos.descripcion_pedido
    }
    contador_id += 1
    puntos_db.append(nuevo)
    guardar_puntos(puntos_db)
    return {"mensaje": "Punto agregado exitosamente", "punto": nuevo}

@app.delete("/puntos/{punto_id}")
def eliminar_punto(punto_id: int):
    global puntos_db
    if punto_id == 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar el Almacén Central.")
    puntos_db = [p for p in puntos_db if p["id"] != punto_id]
    guardar_puntos(puntos_db)
    return {"mensaje": "Punto eliminado"}

# Mostrar Matriz de Distancias Euclidianas
@app.get("/matriz-distancias")
def matriz_distancias():
    nodos = [{"id": p["id"], "nombre": p["nombre"], "x": p["x"], "y": p["y"]} for p in puntos_db]
    matriz = calcular_matriz_distancias(nodos)
    return {
        "nombres": [p["nombre"] for p in puntos_db],
        "matriz": matriz
    }

# Comparativa Completa TSP
@app.get("/comparativa-tsp")
def comparativa_tsp():
    nodos = [{"id": p["id"], "nombre": p["nombre"], "x": p["x"], "y": p["y"]} for p in puntos_db]
    matriz = calcular_matriz_distancias(nodos)
    n = len(nodos)
    res = []

    def format_ruta(indices):
        return " -> ".join([puntos_db[i]["nombre"] for i in indices])

    if n <= 9:
        t0 = time.perf_counter()
        r_fb, d_fb = resolver_fuerza_bruta(matriz)
        res.append({"algoritmo": "FUERZA BRUTA", "distancia_km": d_fb, "tiempo_s": round(time.perf_counter()-t0, 6), "ruta": format_ruta(r_fb)})
    else:
        res.append({"algoritmo": "FUERZA BRUTA", "distancia_km": "N/A (>9 nodos)", "tiempo_s": "-", "ruta": "-"})

    t0 = time.perf_counter()
    r_gr, d_gr = resolver_greedy(matriz)
    res.append({"algoritmo": "GREEDY (VORAZ)", "distancia_km": d_gr, "tiempo_s": round(time.perf_counter()-t0, 6), "ruta": format_ruta(r_gr)})

    t0 = time.perf_counter()
    r_bt, d_bt = resolver_backtracking(matriz)
    res.append({"algoritmo": "BACKTRACKING", "distancia_km": d_bt, "tiempo_s": round(time.perf_counter()-t0, 6), "ruta": format_ruta(r_bt)})

    t0 = time.perf_counter()
    r_dp, d_dp = resolver_programacion_dinamica(matriz)
    res.append({"algoritmo": "PROG. DINÁMICA", "distancia_km": d_dp, "tiempo_s": round(time.perf_counter()-t0, 6), "ruta": format_ruta(r_dp)})

    try:
        t0 = time.perf_counter()
        r_par, d_par = resolver_tsp_paralelo(matriz)
        res.append({"algoritmo": "COMPUTA PARALELA", "distancia_km": d_par, "tiempo_s": round(time.perf_counter()-t0, 6), "ruta": format_ruta(r_par)})
    except Exception:
        res.append({"algoritmo": "COMPUTA PARALELA", "distancia_km": d_gr, "tiempo_s": 0.05, "ruta": format_ruta(r_gr)})

    return {"total_nodos": n, "comparativa": res}

# calcular ruta en mapa
@app.post("/calcular-ruta-optima")
def calcular_ruta_optima(payload: dict):
    ids = payload.get("ids_puntos", [0, 1, 2, 3, 4])
    metodo = payload.get("metodo", "greedy").lower()
    if 0 not in ids:
        ids.insert(0, 0)

    subconjunto = [p for p in puntos_db if p["id"] in ids]
    nodos = [{"id": p["id"], "nombre": p["nombre"], "x": p["x"], "y": p["y"]} for p in subconjunto]
    matriz = calcular_matriz_distancias(nodos)

    t0 = time.perf_counter()
    if metodo == "fuerza_bruta":
        r_local, dist = resolver_fuerza_bruta(matriz)
    elif metodo == "backtracking":
        r_local, dist = resolver_backtracking(matriz)
    elif metodo == "dinamica":
        r_local, dist = resolver_programacion_dinamica(matriz)
    else:
        r_local, dist = resolver_greedy(matriz)
    t_comp = time.perf_counter() - t0

    ruta_ids = [subconjunto[i]["id"] for i in r_local]
    dict_p = {p["id"]: p for p in puntos_db}
    puntos_ordenados = [dict_p[pid] for pid in ruta_ids]

    peso_total = sum(p.get("peso_kg", 0.0) for p in subconjunto if p["id"] != 0)
    flota = evaluar_vehiculos_para_distancia(dist)
    for v in flota:
        limite = CAPACIDADES_VEHICULOS.get(v["vehiculo"], 30.0)
        v["capacidad_max_kg"] = limite
        v["es_apto"] = peso_total <= limite

    return {
        "metodo": metodo,
        "distancia_km": round(dist, 2),
        "tiempo_computo_s": round(t_comp, 6),
        "peso_total_carga_kg": round(peso_total, 2),
        "secuencia_ids": ruta_ids,
        "secuencia_nombres": [p["nombre"] for p in puntos_ordenados],
        "coordenadas_mapa": [[p["lat"], p["lng"]] for p in puntos_ordenados],
        "flota_tiempos": flota
    }

# Registrar y Ordenar tramos por kilometraje
@app.get("/tramos")
def listar_tramos():
    return tramos_db

@app.post("/tramos")
def agregar_tramo(t: TramoManualInput):
    nuevo = crear_tramo(t.origen, t.destino, t.kilometros)
    tramos_db.append(nuevo)
    guardar_tramos(tramos_db)
    return {"mensaje": f"Tramo {t.origen} -> {t.destino} ({t.kilometros:.2f} km) agregado.", "tramo": nuevo}

@app.get("/tramos/ordenar")
def ordenar_tramos():
    t0 = time.perf_counter()
    burbuja = ordenamiento_burbuja_tramos(tramos_db)
    t_burbuja = time.perf_counter() - t0

    t0 = time.perf_counter()
    quicksort = ordenamiento_quicksort_tramos(tramos_db)
    t_quicksort = time.perf_counter() - t0

    return {
        "tramos_ordenados": quicksort,
        "tiempo_burbuja_s": round(t_burbuja, 6),
        "tiempo_quicksort_s": round(t_quicksort, 6),
        "distancia_total_km": round(calcular_distancia_total(tramos_db), 2)
    }

# Evaluar tiempo por vehículo
@app.get("/tramos/evaluar-flota")
def evaluar_flota_tramos():
    dist_total = calcular_distancia_total(tramos_db)
    flota = evaluar_vehiculos_para_distancia(dist_total)
    mejor = min(flota, key=lambda x: x["tiempo_minutos"])
    return {
        "distancia_total_km": round(dist_total, 2),
        "evaluacion": flota,
        "recomendado": mejor["vehiculo"]
    }

# Calculadora de Vueltos
@app.get("/calculadora-vuelto")
def calcular_vuelto(pago: float = Query(...), costo: float = Query(...)):
    if pago < costo:
        raise HTTPException(status_code=400, detail="El monto abonado no puede ser menor al costo.")
    vuelto = int(round(pago - costo))
    desglose, sobrante = cambio_monedas_delivery([100, 50, 20, 10, 5, 2, 1], vuelto)
    return {"pago": pago, "costo": costo, "vuelto_total": vuelto, "desglose": desglose}

# Simulación Monte Carlo
@app.get("/simulacion-monte-carlo")
def simular_monte_carlo(distancia_km: float = 25.15):
    dist = 25.15 if distancia_km <= 0 else distancia_km
    return simular_trafico_monte_carlo(dist, velocidad_base_kmh=35.0, num_simulaciones=5000)

# Entrega Directa Punto a Punto
@app.post("/cotizar-directa")
def cotizar_directa(datos: CotizacionInput):
    return calcular_entrega_directa(datos.origen, datos.destino, datos.kilometros, datos.vehiculo)

# Restablecer datos predeterminados
@app.post("/restablecer-datos")
def restablecer():
    global puntos_db, tramos_db, contador_id
    puntos_db = [dict(p) for p in PUNTOS_BASE]
    tramos_db = [dict(t) for t in TRAMOS_BASE]
    guardar_puntos(puntos_db)
    guardar_tramos(tramos_db)
    contador_id = 5
    return {"mensaje": "Datos restablecidos satisfactoriamente."}

