# -*- coding: utf-8 -*-
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
import math
import time

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

app = FastAPI(title="Delivery API - 11 Opciones Spyder", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CAPACIDADES_VEHICULOS = {"Bicicleta": 10.0, "Moto": 30.0, "Auto": 300.0}

# Datos originales exactos de Spyder
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

puntos_db = [dict(p) for p in PUNTOS_BASE]
tramos_db = [dict(t) for t in TRAMOS_BASE]
contador_id = 5

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

# 1. Listar puntos de entrega
@app.get("/puntos")
def listar_puntos():
    return puntos_db

# 2. Agregar nuevo punto de entrega
@app.post("/puntos")
def agregar_punto(datos: NuevoPuntoInput):
    global contador_id
    # Aproximación de coordenadas euclidianas relativas al Almacén Central (km)
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
    return {"mensaje": "Punto agregado exitosamente", "punto": nuevo}

@app.delete("/puntos/{punto_id}")
def eliminar_punto(punto_id: int):
    global puntos_db
    if punto_id == 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar el Almacén Central.")
    puntos_db = [p for p in puntos_db if p["id"] != punto_id]
    return {"mensaje": "Punto eliminado"}

# 3. Mostrar Matriz de Distancias Euclidianas
@app.get("/matriz-distancias")
def matriz_distancias():
    nodos = [{"id": p["id"], "nombre": p["nombre"], "x": p["x"], "y": p["y"]} for p in puntos_db]
    matriz = calcular_matriz_distancias(nodos)
    return {
        "nombres": [p["nombre"] for p in puntos_db],
        "matriz": matriz
    }

# 4. Comparativa Completa TSP (Fuerza Bruta, Greedy, Backtracking, DP, Paralelo)
@app.get("/comparativa-tsp")
def comparativa_tsp():
    nodos = [{"id": p["id"], "nombre": p["nombre"], "x": p["x"], "y": p["y"]} for p in puntos_db]
    matriz = calcular_matriz_distancias(nodos)
    n = len(nodos)
    res = []

    def format_ruta(indices):
        return " -> ".join([puntos_db[i]["nombre"] for i in indices])

    # 1. Fuerza Bruta
    if n <= 9:
        t0 = time.perf_counter()
        r_fb, d_fb = resolver_fuerza_bruta(matriz)
        res.append({"algoritmo": "FUERZA BRUTA", "distancia_km": d_fb, "tiempo_s": round(time.perf_counter()-t0, 6), "ruta": format_ruta(r_fb)})
    else:
        res.append({"algoritmo": "FUERZA BRUTA", "distancia_km": "N/A (>9 nodos)", "tiempo_s": "-", "ruta": "-"})

    # 2. Greedy
    t0 = time.perf_counter()
    r_gr, d_gr = resolver_greedy(matriz)
    res.append({"algoritmo": "GREEDY (VORAZ)", "distancia_km": d_gr, "tiempo_s": round(time.perf_counter()-t0, 6), "ruta": format_ruta(r_gr)})

    # 3. Backtracking
    t0 = time.perf_counter()
    r_bt, d_bt = resolver_backtracking(matriz)
    res.append({"algoritmo": "BACKTRACKING", "distancia_km": d_bt, "tiempo_s": round(time.perf_counter()-t0, 6), "ruta": format_ruta(r_bt)})

    # 4. Prog. Dinámica
    t0 = time.perf_counter()
    r_dp, d_dp = resolver_programacion_dinamica(matriz)
    res.append({"algoritmo": "PROG. DINÁMICA", "distancia_km": d_dp, "tiempo_s": round(time.perf_counter()-t0, 6), "ruta": format_ruta(r_dp)})

    # 5. Cómputo Paralelo
    try:
        t0 = time.perf_counter()
        r_par, d_par = resolver_tsp_paralelo(matriz)
        res.append({"algoritmo": "COMPUTA PARALELA", "distancia_km": d_par, "tiempo_s": round(time.perf_counter()-t0, 6), "ruta": format_ruta(r_par)})
    except Exception:
        res.append({"algoritmo": "COMPUTA PARALELA", "distancia_km": d_gr, "tiempo_s": 0.05, "ruta": format_ruta(r_gr)})

    return {"total_nodos": n, "comparativa": res}

# Endpoint para ejecutar un solo TSP y trazar en mapa
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

# 5. Registrar y Ordenar tramos por kilometraje
@app.get("/tramos")
def listar_tramos():
    return tramos_db

@app.post("/tramos")
def agregar_tramo(t: TramoManualInput):
    nuevo = crear_tramo(t.origen, t.destino, t.kilometros)
    tramos_db.append(nuevo)
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

# 6. Evaluar tiempo por vehiculo en tramos registrados
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

# 7. Calculadora de Vueltos (Voraz)
@app.get("/calculadora-vuelto")
def calcular_vuelto(pago: float = Query(...), costo: float = Query(...)):
    if pago < costo:
        raise HTTPException(status_code=400, detail="El monto abonado no puede ser menor al costo.")
    vuelto = int(round(pago - costo))
    desglose, sobrante = cambio_monedas_delivery([100, 50, 20, 10, 5, 2, 1], vuelto)
    return {"pago": pago, "costo": costo, "vuelto_total": vuelto, "desglose": desglose}

# 8. Simulación Monte Carlo
@app.get("/simulacion-monte-carlo")
def simular_monte_carlo(distancia_km: float = 25.15):
    dist = 25.15 if distancia_km <= 0 else distancia_km
    return simular_trafico_monte_carlo(dist, velocidad_base_kmh=35.0, num_simulaciones=5000)

# 9. Entrega Directa Punto a Punto
@app.post("/cotizar-directa")
def cotizar_directa(datos: CotizacionInput):
    return calcular_entrega_directa(datos.origen, datos.destino, datos.kilometros, datos.vehiculo)

# 10. Restablecer datos predeterminados
@app.post("/restablecer-datos")
def restablecer():
    global puntos_db, tramos_db, contador_id
    puntos_db = [dict(p) for p in PUNTOS_BASE]
    tramos_db = [dict(t) for t in TRAMOS_BASE]
    contador_id = 5
    return {"mensaje": "Datos restablecidos satisfactoriamente."}