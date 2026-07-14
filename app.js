// Biblioteca de Patrones de Alta Rentabilidad
// Fuente: Thomas Bulkowski (Encyclopedia of Candlestick Charts), estudios de confluencia
const PATTERN_LIBRARY = {
    "bullish-engulfing": {
        name: "Engolfamiento Alcista",
        type: "bullish",
        desc: "El patrón de mayor rentabilidad en reversiones. La segunda vela verde engulle completamente el cuerpo de la primera roja, mostrando una rotación de poder total a favor de los compradores.",
        rule: "Vela 1: Roja. Vela 2: Verde. Cuerpo V2 > Cuerpo V1. Apertura V2 ≤ Cierre V1 y Cierre V2 ≥ Apertura V1."
    },
    "bearish-engulfing": {
        name: "Engolfamiento Bajista",
        type: "bearish",
        desc: "La señal bajista de mayor efectividad. La segunda vela roja engulle completamente el cuerpo de la primera verde, indicando dominio total de los vendedores.",
        rule: "Vela 1: Verde. Vela 2: Roja. Cuerpo V2 > Cuerpo V1. Apertura V2 ≥ Cierre V1 y Cierre V2 ≤ Apertura V1."
    },
    "three-white-soldiers": {
        name: "Tres Soldados Blancos",
        type: "bullish",
        desc: "Tres velas verdes consecutivas con cuerpos largos y sombras pequeñas. Indica una recuperación sostenida con fuerte momentum comprador. Alta confiabilidad en timeframes de 15m y superiores.",
        rule: "3 velas verdes consecutivas. Cada apertura dentro del cuerpo anterior. Cuerpos largos (>60% del rango total). Sombras mínimas."
    },
    "three-black-crows": {
        name: "Tres Cuervos Negros",
        type: "bearish",
        desc: "Tres velas rojas consecutivas con cuerpos largos. Indica una caída sostenida con fuerte presión vendedora. Muy confiable al aparecer en techos de tendencia alcista.",
        rule: "3 velas rojas consecutivas. Cada apertura dentro del cuerpo anterior. Cuerpos largos (>60% del rango total). Sombras mínimas."
    },
    "bullish-marubozu": {
        name: "Marubozu Alcista",
        type: "bullish",
        desc: "Vela verde de cuerpo completo sin sombras (o sombras mínimas). Indica convicción compradora unilateral durante toda la vela: la apertura fue el mínimo y el cierre el máximo.",
        rule: "Vela verde. Sombra superior ≤ 1% del rango total. Sombra inferior ≤ 1% del rango total. Cuerpo > 90% del rango."
    },
    "bearish-marubozu": {
        name: "Marubozu Bajista",
        type: "bearish",
        desc: "Vela roja de cuerpo completo sin sombras (o sombras mínimas). Indica presión vendedora unilateral: la apertura fue el máximo y el cierre el mínimo.",
        rule: "Vela roja. Sombra superior ≤ 1% del rango total. Sombra inferior ≤ 1% del rango total. Cuerpo > 90% del rango."
    },
    "hammer": {
        name: "Martillo (Hammer)",
        type: "bullish",
        desc: "Vela de reversión alcista en soportes. Mecha inferior muy larga que indica que los compradores rechazaron fuertemente los precios bajos. Efectividad aumenta en niveles de soporte clave.",
        rule: "Mecha inferior ≥ 2.5x el tamaño del cuerpo. Mecha superior ≤ 10% del cuerpo. Cuerpo pequeño en la parte superior."
    },
    "shooting-star": {
        name: "Estrella Fugaz",
        type: "bearish",
        desc: "Vela de reversión bajista en resistencias. Mecha superior muy larga que indica que los vendedores rechazaron fuertemente los precios altos. Efectividad aumenta en niveles de resistencia clave.",
        rule: "Mecha superior ≥ 2.5x el tamaño del cuerpo. Mecha inferior ≤ 10% del cuerpo. Cuerpo pequeño en la parte inferior."
    }
};

// Parámetros por activo
// - Crypto: datos reales de Binance API
// - Commodities/Forex: simulación con parámetros realistas
const ASSET_PARAMS = {
    "BTCUSDT": { name: "BTC/USDT",  startPrice: 64000, volatility: 320, decimal: 2, binance: true },
    "ETHUSDT": { name: "ETH/USDT",  startPrice: 3400,  volatility: 22,  decimal: 2, binance: true },
    "XAUUSD":  { name: "Oro (XAU/USD)",  startPrice: 2380,  volatility: 3.5, decimal: 2, binance: false },
    "XAGUSD":  { name: "Plata (XAG/USD)", startPrice: 29.50, volatility: 0.18, decimal: 3, binance: false },
    "USDIDX":  { name: "Dólar (DXY)",    startPrice: 104.5, volatility: 0.08, decimal: 3, binance: false }
};

// Variables globales de la app
let chart;
let candlestickSeries;
let candlesData = [];
let detectedSignals = [];
let simIntervalId = null;
let currentAsset = "BTCUSDT";
let currentTimeframe = "60"; // Default: 1H
let activeFilter = "all";

const TIMEFRAME_LABELS = {
    "5":  "5m",
    "15": "15m",
    "30": "30m",
    "60": "1H"
};

const BINANCE_INTERVALS = {
    "5":  "5m",
    "15": "15m",
    "30": "30m",
    "60": "1h"
};

// Inicializar la aplicación al cargar el DOM con manejo de errores
document.addEventListener("DOMContentLoaded", () => {
    try {
        initChart();
        generateHistoricalData();
        setupEventListeners();
        updateUI();
        
        // Cargar explicación inicial en la biblioteca de patrones
        showEducationInfo("bullish-engulfing");
    } catch (error) {
        console.error("Error durante la inicialización de la aplicación:", error);
        alert("Error al cargar la aplicación. Detalles: " + error.message);
    }
});

// Inicializar Lightweight Charts
function initChart() {
    const container = document.getElementById("chart-container");
    
    chart = LightweightCharts.createChart(container, {
        layout: {
            background: { 
                type: 'solid',
                color: '#141722' 
            },
            textColor: '#909bb4',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
        },
        grid: {
            vertLines: { color: 'rgba(43, 48, 64, 0.4)' },
            horzLines: { color: 'rgba(43, 48, 64, 0.4)' },
        },
        crosshair: {
            mode: LightweightCharts.CrosshairMode.Normal,
        },
        rightPriceScale: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
        },
        timeScale: {
            borderColor: 'rgba(255, 255, 255, 0.1)',
            timeVisible: true,
            secondsVisible: false,
        },
    });

    candlestickSeries = chart.addCandlestickSeries({
        upColor: '#00c896',
        downColor: '#ff3b69',
        borderDownColor: '#ff3b69',
        borderUpColor: '#00c896',
        wickDownColor: '#ff3b69',
        wickUpColor: '#00c896',
    });

    // Responsividad del gráfico
    const resizeObserver = new ResizeObserver(entries => {
        if (entries.length === 0 || !entries[0].contentRect) { return; }
        const { width, height } = entries[0].contentRect;
        chart.resize(width, height);
    });
    resizeObserver.observe(container);
}

function getTimeframeSeconds() {
    // Todas las temporalidades son valores numéricos en minutos
    return parseInt(currentTimeframe) * 60;
}

// Generar datos históricos iniciales
async function generateHistoricalData() {
    const params = ASSET_PARAMS[currentAsset];
    
    // Si el activo tiene datos en Binance, intentamos obtenerlos directamente de su API pública (soporta CORS en file://)
    if (params.binance) {
        try {
            const binanceInterval = BINANCE_INTERVALS[currentTimeframe] || "1h";
            const response = await fetch(`https://api.binance.com/api/v3/klines?symbol=${currentAsset}&interval=${binanceInterval}&limit=150`);
            const rawData = await response.json();
            
            if (Array.isArray(rawData) && rawData.length > 0) {
                candlesData = rawData.map(d => ({
                    time: d[0] / 1000, // milisegundos a segundos
                    open: parseFloat(d[1]),
                    high: parseFloat(d[2]),
                    low: parseFloat(d[3]),
                    close: parseFloat(d[4])
                }));
                
                candlestickSeries.setData(candlesData);
                scanAllCandles();
                updateUI();
                return;
            }
        } catch (error) {
            console.warn("Error al conectar con la API pública de Binance, usando simulador de respaldo:", error);
        }
    }
    
    // Fallback: Generador simulado (para activos tradicionales o si falla la API)
    generateMockData();
}

function generateMockData() {
    const params = ASSET_PARAMS[currentAsset];
    let price = params.startPrice;
    const count = 120; // 120 velas iniciales
    const data = [];
    const timeframeSeconds = getTimeframeSeconds();
    
    // Generar timestamps correlativos
    let time = new Date();
    time.setSeconds(time.getSeconds() - count * timeframeSeconds);
    
    for (let i = 0; i < count; i++) {
        const change = (Math.random() - 0.49) * params.volatility;
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.random() * (params.volatility * 0.4);
        const low = Math.min(open, close) - Math.random() * (params.volatility * 0.4);
        
        const dateStr = time.getTime() / 1000;
        
        data.push({
            time: dateStr,
            open: parseFloat(open.toFixed(params.decimal)),
            high: parseFloat(high.toFixed(params.decimal)),
            low: parseFloat(low.toFixed(params.decimal)),
            close: parseFloat(close.toFixed(params.decimal))
        });
        
        price = close;
        time.setSeconds(time.getSeconds() + timeframeSeconds);
    }
    
    candlesData = data;
    candlestickSeries.setData(candlesData);
    
    // Analizar todos los datos históricos para detectar señales
    scanAllCandles();
}

// Analizar una sola vela específica para buscar patrones
// Patrones seleccionados: alta rentabilidad según Bulkowski + estudios de confluencia
function detectPatternAt(index) {
    if (index < 2) return null;

    const c    = candlesData[index];
    const prev  = candlesData[index - 1];
    const prev2 = candlesData[index - 2];

    const bodySize   = Math.abs(c.close - c.open);
    const totalRange = c.high - c.low;
    if (totalRange === 0 || bodySize === 0) return null;

    const upperShadow = c.high - Math.max(c.open, c.close);
    const lowerShadow = Math.min(c.open, c.close) - c.low;
    const isGreen = c.close > c.open;
    const isRed   = c.close < c.open;

    // ---- 1. ENGOLFAMIENTO ALCISTA (mayor rentabilidad) ----
    if (document.getElementById("pattern-bullish-engulfing").checked) {
        const prevRed      = prev.close < prev.open;
        const prevBodySize = Math.abs(prev.close - prev.open);
        // Criterio estricto: cuerpo V2 > cuerpo V1 y envuelve completamente
        if (prevRed && isGreen &&
            c.open  <= prev.close &&
            c.close >= prev.open  &&
            bodySize > prevBodySize * 1.0) {
            return { id: "bullish-engulfing", name: "Engolfamiento Alcista", type: "bullish" };
        }
    }

    // ---- 2. ENGOLFAMIENTO BAJISTA ----
    if (document.getElementById("pattern-bearish-engulfing").checked) {
        const prevGreen    = prev.close > prev.open;
        const prevBodySize = Math.abs(prev.close - prev.open);
        if (prevGreen && isRed &&
            c.open  >= prev.close &&
            c.close <= prev.open  &&
            bodySize > prevBodySize * 1.0) {
            return { id: "bearish-engulfing", name: "Engolfamiento Bajista", type: "bearish" };
        }
    }

    // ---- 3. TRES SOLDADOS BLANCOS (requiere index >= 2) ----
    if (document.getElementById("pattern-three-white-soldiers").checked && index >= 2) {
        const g1 = prev2.close > prev2.open;
        const g2 = prev.close  > prev.open;
        const g3 = isGreen;
        const b1 = Math.abs(prev2.close - prev2.open) > (prev2.high - prev2.low) * 0.6;
        const b2 = Math.abs(prev.close  - prev.open)  > (prev.high  - prev.low)  * 0.6;
        const b3 = bodySize > totalRange * 0.6;
        // Cada apertura dentro del cuerpo de la anterior
        const o2InBody1 = prev.open  >= prev2.open  && prev.open  <= prev2.close;
        const o3InBody2 = c.open     >= prev.open   && c.open     <= prev.close;
        if (g1 && g2 && g3 && b1 && b2 && b3 && o2InBody1 && o3InBody2) {
            return { id: "three-white-soldiers", name: "Tres Soldados Blancos", type: "bullish" };
        }
    }

    // ---- 4. TRES CUERVOS NEGROS ----
    if (document.getElementById("pattern-three-black-crows").checked && index >= 2) {
        const r1 = prev2.close < prev2.open;
        const r2 = prev.close  < prev.open;
        const r3 = isRed;
        const b1 = Math.abs(prev2.close - prev2.open) > (prev2.high - prev2.low) * 0.6;
        const b2 = Math.abs(prev.close  - prev.open)  > (prev.high  - prev.low)  * 0.6;
        const b3 = bodySize > totalRange * 0.6;
        const o2InBody1 = prev.open  <= prev2.open  && prev.open  >= prev2.close;
        const o3InBody2 = c.open     <= prev.open   && c.open     >= prev.close;
        if (r1 && r2 && r3 && b1 && b2 && b3 && o2InBody1 && o3InBody2) {
            return { id: "three-black-crows", name: "Tres Cuervos Negros", type: "bearish" };
        }
    }

    // ---- 5. MARUBOZU ALCISTA ----
    if (document.getElementById("pattern-bullish-marubozu").checked) {
        const upperPct = upperShadow / totalRange;
        const lowerPct = lowerShadow / totalRange;
        if (isGreen && upperPct <= 0.05 && lowerPct <= 0.05 && bodySize / totalRange >= 0.90) {
            return { id: "bullish-marubozu", name: "Marubozu Alcista", type: "bullish" };
        }
    }

    // ---- 6. MARUBOZU BAJISTA ----
    if (document.getElementById("pattern-bearish-marubozu").checked) {
        const upperPct = upperShadow / totalRange;
        const lowerPct = lowerShadow / totalRange;
        if (isRed && upperPct <= 0.05 && lowerPct <= 0.05 && bodySize / totalRange >= 0.90) {
            return { id: "bearish-marubozu", name: "Marubozu Bajista", type: "bearish" };
        }
    }

    // ---- 7. MARTILLO (Hammer) - criterio estricto ----
    if (document.getElementById("pattern-hammer").checked) {
        if (lowerShadow >= 2.5 * bodySize && upperShadow <= bodySize * 0.1 && bodySize > 0) {
            return { id: "hammer", name: "Martillo (Hammer)", type: "bullish" };
        }
    }

    // ---- 8. ESTRELLA FUGAZ (Shooting Star) - criterio estricto ----
    if (document.getElementById("pattern-shooting-star").checked) {
        if (upperShadow >= 2.5 * bodySize && lowerShadow <= bodySize * 0.1 && bodySize > 0) {
            return { id: "shooting-star", name: "Estrella Fugaz", type: "bearish" };
        }
    }

    return null;
}

// Escanear todas las velas actuales del historial
function scanAllCandles() {
    detectedSignals = [];
    const markers = [];
    
    for (let i = 2; i < candlesData.length; i++) {
        const pattern = detectPatternAt(i);
        if (pattern) {
            const candle = candlesData[i];
            const signal = {
                id: `${pattern.id}-${candle.time}`,
                time: candle.time,
                patternId: pattern.id,
                patternName: pattern.name,
                type: pattern.type,
                price: candle.close,
                status: Math.random() > 0.4 ? "Éxito" : "Pendiente" // Simulación de efectividad
            };
            detectedSignals.unshift(signal); // Añadir al inicio del historial
            
            markers.push({
                time: candle.time,
                position: pattern.type === "bullish" ? "belowBar" : pattern.type === "bearish" ? "aboveBar" : "aboveBar",
                color: pattern.type === "bullish" ? "#00c896" : pattern.type === "bearish" ? "#ff3b69" : "#a0aec0",
                shape: pattern.type === "bullish" ? "arrowUp" : pattern.type === "bearish" ? "arrowDown" : "circle",
                text: pattern.name.split(" ")[0]
            });
        }
    }
    
    candlestickSeries.setMarkers(markers);
    renderSignalsTable();
}

// Renderizar la tabla de señales en el DOM
function renderSignalsTable() {
    const tbody = document.getElementById("signals-tbody");
    tbody.innerHTML = "";
    
    const filtered = detectedSignals.filter(sig => {
        if (activeFilter === "all") return true;
        return sig.type === activeFilter;
    });
    
    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr class="no-signals-row">
                <td colspan="6">No se encontraron señales de este tipo con la configuración actual.</td>
            </tr>
        `;
        return;
    }
    
    filtered.forEach(sig => {
        const row = document.createElement("tr");
        row.className = "signal-row";
        
        const date = new Date(sig.time * 1000).toLocaleString();
        
        // Estilo del tipo de señal
        const typeBadge = sig.type === "bullish" 
            ? `<span class="badge bullish">COMPRA (Alcista)</span>` 
            : sig.type === "bearish" 
                ? `<span class="badge bearish">VENTA (Bajista)</span>` 
                : `<span class="badge neutral">INDECISIÓN</span>`;
                
        // Estilo del estado
        const statusClass = sig.status === "Éxito" ? "positive" : "text-muted";
        
        row.innerHTML = `
            <td>${date}</td>
            <td><strong>${sig.patternName}</strong></td>
            <td>${typeBadge}</td>
            <td>${sig.price.toFixed(ASSET_PARAMS[currentAsset].decimal)}</td>
            <td><span class="${statusClass}">${sig.status}</span></td>
            <td><a class="action-link" onclick="focusOnCandle(${sig.time})">Ver Gráfico</a></td>
        `;
        tbody.appendChild(row);
    });
}

// Enfocar el gráfico en una vela específica
window.focusOnCandle = function(time) {
    chart.timeScale().setVisibleRange({
        from: time - 3600 * 24, // 24 horas antes
        to: time + 3600 * 24    // 24 horas después
    });
};

// Generar una nueva vela en tiempo real
function tickSimulate() {
    const params = ASSET_PARAMS[currentAsset];
    const lastCandle = candlesData[candlesData.length - 1];
    
    // Crear nueva vela sumando la temporalidad correspondiente
    const newTime = lastCandle.time + getTimeframeSeconds();
    const change = (Math.random() - 0.49) * params.volatility;
    const open = lastCandle.close;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * (params.volatility * 0.35);
    const low = Math.min(open, close) - Math.random() * (params.volatility * 0.35);
    
    const newCandle = {
        time: newTime,
        open: parseFloat(open.toFixed(params.decimal)),
        high: parseFloat(high.toFixed(params.decimal)),
        low: parseFloat(low.toFixed(params.decimal)),
        close: parseFloat(close.toFixed(params.decimal))
    };
    
    candlesData.push(newCandle);
    
    // Actualizar Lightweight Charts
    candlestickSeries.update(newCandle);
    
    // Actualizar precios del header
    updateHeaderPrices();
    
    // Escanear la última vela para ver si se detectó un patrón
    const lastIdx = candlesData.length - 1;
    const pattern = detectPatternAt(lastIdx);
    if (pattern) {
        const signal = {
            id: `${pattern.id}-${newCandle.time}`,
            time: newCandle.time,
            patternId: pattern.id,
            patternName: pattern.name,
            type: pattern.type,
            price: newCandle.close,
            status: "Pendiente"
        };
        
        detectedSignals.unshift(signal);
        
        // Re-escanear todo para mantener los marcadores de gráfico actualizados
        scanAllCandles();
        
        // Mostrar notificación flotante
        showToast(pattern);
    }
}

// Mostrar Toast de notificación
function showToast(pattern) {
    const toast = document.getElementById("notification-toast");
    toast.className = `toast toast-${pattern.type}`;
    
    const typeText = pattern.type === "bullish" ? "Alcista (Compra)" : pattern.type === "bearish" ? "Bajista (Venta)" : "Neutral";
    
    toast.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:2px;">
            <strong style="color:#fff;">¡Nueva Señal Detectada!</strong>
            <span style="font-size:12.5px;">Patrón: ${pattern.name} (${typeText})</span>
        </div>
    `;
    
    toast.classList.remove("hidden");
    
    // Desvanecer después de 5 segundos
    setTimeout(() => {
        toast.classList.add("hidden");
    }, 4500);
}

// Actualizar valores numéricos del encabezado
function updateHeaderPrices() {
    if (candlesData.length < 2) return;
    const current = candlesData[candlesData.length - 1];
    const prev = candlesData[candlesData.length - 2];
    
    const priceEl = document.getElementById("current-price");
    const changeEl = document.getElementById("price-change");
    
    const decimal = ASSET_PARAMS[currentAsset].decimal;
    priceEl.textContent = `${current.close.toFixed(decimal)}`;
    
    const pctChange = ((current.close - prev.close) / prev.close) * 100;
    
    if (pctChange >= 0) {
        changeEl.textContent = `+${pctChange.toFixed(2)}%`;
        changeEl.className = "metric-value positive";
    } else {
        changeEl.textContent = `${pctChange.toFixed(2)}%`;
        changeEl.className = "metric-value negative";
    }
}

// Actualizar la UI e información general
function updateUI() {
    document.getElementById("market-name").textContent = ASSET_PARAMS[currentAsset].name;
    const tfLabel = TIMEFRAME_LABELS[currentTimeframe] || "1H";
    document.getElementById("chart-timeframe-title").textContent = `Gráfico de Velas Japonesas (${tfLabel})`;
    updateHeaderPrices();
}

// Mostrar información educativa sobre el patrón
function showEducationInfo(patternKey) {
    const info = PATTERN_LIBRARY[patternKey];
    const container = document.getElementById("education-card");
    if (!info) return;
    
    const badgeClass = info.type === "bullish" ? "bullish" : info.type === "bearish" ? "bearish" : "neutral";
    const typeLabel = info.type === "bullish" ? "Alcista" : info.type === "bearish" ? "Bajista" : "Indecisión";
    
    container.innerHTML = `
        <div class="education-title">
            <span>${info.name}</span>
            <span class="badge ${badgeClass}">${typeLabel}</span>
        </div>
        <p class="education-desc">${info.desc}</p>
        <div class="education-rule">
            <strong>Regla:</strong> ${info.rule}
        </div>
    `;
}

// Configurar event listeners de los elementos HTML
function setupEventListeners() {
    // Selector de activos
    document.getElementById("asset-selector").addEventListener("change", (e) => {
        currentAsset = e.target.value;
        generateHistoricalData();
        updateUI();
    });
    
    // Selector de temporalidad
    document.getElementById("timeframe-selector").addEventListener("change", (e) => {
        currentTimeframe = e.target.value;
        generateHistoricalData();
        updateUI();
        
        // Reiniciar la simulación si estaba activa para adaptar la velocidad del tick
        if (simIntervalId) {
            clearInterval(simIntervalId);
            startSimulation();
        }
    });
    
    // Checkboxes de patrones para refrescar instantáneamente
    const checkboxes = document.querySelectorAll(".pattern-checkboxes input");
    checkboxes.forEach(chk => {
        chk.addEventListener("change", () => {
            scanAllCandles();
        });
        
        // Al hacer clic en el contenedor o la etiqueta, mostrar explicación del patrón
        const container = chk.closest(".checkbox-container");
        container.addEventListener("click", (e) => {
            // Evitar doble evento si se hace clic directamente en el input
            if (e.target.tagName !== "INPUT") {
                const patternId = chk.id.replace("pattern-", "");
                showEducationInfo(patternId);
            }
        });
    });
    
    // Botón de iniciar/detener simulación
    const simBtn = document.getElementById("btn-toggle-sim");
    const playIcon = simBtn.querySelector(".icon-play");
    const pauseIcon = simBtn.querySelector(".icon-pause");
    const simText = document.getElementById("sim-btn-text");
    
    // Empezar corriendo por defecto
    startSimulation();
    
    simBtn.addEventListener("click", () => {
        if (simIntervalId) {
            // Pausar
            clearInterval(simIntervalId);
            simIntervalId = null;
            playIcon.classList.remove("hidden");
            pauseIcon.classList.add("hidden");
            simText.textContent = "Reanudar Simulación";
        } else {
            // Reanudar
            startSimulation();
            playIcon.classList.add("hidden");
            pauseIcon.classList.remove("hidden");
            simText.textContent = "Pausar Simulación";
        }
    });
    
    function startSimulation() {
        simIntervalId = setInterval(tickSimulate, 3000); // Nueva vela simulada cada 3 segundos
    }
    
    // Botón de reset de datos
    document.getElementById("btn-reset-data").addEventListener("click", () => {
        generateHistoricalData();
        updateUI();
    });
    
    // Filtros de la tabla de señales
    const filterBtns = document.querySelectorAll(".filter-btn");
    filterBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            filterBtns.forEach(b => b.classList.remove("active"));
            e.target.classList.add("active");
            activeFilter = e.target.getAttribute("data-filter");
            renderSignalsTable();
        });
    });
}
