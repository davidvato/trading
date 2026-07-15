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
// - Crypto: datos reales de CoinGecko (historial) + Binance WebSocket (tiempo real)
const ASSET_PARAMS = {
    "BTCUSDT": { name: "BTC/USDT", startPrice: 64000, volatility: 320, decimal: 2, binance: true },
    "ETHUSDT": { name: "ETH/USDT", startPrice: 3400, volatility: 22, decimal: 2, binance: true }
};

// Variables globales de la app
let chart;
let candlestickSeries;
let candlesData = [];
let detectedSignals = [];
let simIntervalId = null;
let klineWs = null;      // WebSocket de Binance para ticks en tiempo real
let liveCandle = null;   // Vela actual en progreso (del WebSocket)
let isPaused = false;    // Estado global de pausa (aplica a WS y a ticker simulado)
let currentAsset = "BTCUSDT";
let currentTimeframe = "5"; // Default: 5m
let activeFilter = "all";
let confluenceFilter = "all"; // Filtro por score de confluencia

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE CONFLUENCIA
// ─────────────────────────────────────────────────────────────────────────────
const CONFLUENCE_CONFIG = {
    SR_LOOKBACK: 50,       // Velas hacia atrás para calcular zonas S/R
    SR_TOLERANCE: 0.003,   // 0.3% de margen para considerar zona S/R activa
    VOL_PERIOD: 20,        // Periodos para media de volumen
    VOL_THRESHOLD: 1.4,    // Multiplicador mínimo de volumen relativo
    BOS_LOOKBACK: 10,      // Velas para detectar swings de estructura
    MIN_SCORE_TO_EMIT: 0   // 0 = todas las señales (incluyendo solo patrón de vela)
};

// Mapeo de activos a CoinGecko (historial) y Binance WebSocket (tiempo real)
// CoinGecko: gratis, sin API key, CORS habilitado
const COINGECKO_IDS = {
    "BTCUSDT": "bitcoin",
    "ETHUSDT": "ethereum"
};

// Resolución de CoinGecko en días y minutos por timeframe
const COINGECKO_PARAMS = {
    "5": { days: "1", intervalStr: "minutely" },
    "15": { days: "2", intervalStr: "minutely" },
    "30": { days: "4", intervalStr: "minutely" },
    "60": { days: "30", intervalStr: "hourly" }
};

const TIMEFRAME_LABELS = {
    "5": "5m",
    "15": "15m",
    "30": "30m",
    "60": "1H"
};

const BINANCE_INTERVALS = {
    "5": "5m",
    "15": "15m",
    "30": "30m",
    "60": "1h"
};

// Kraken API — CORS nativo, sin API key, soporta 5m/15m/30m/1H
// Documentación: https://docs.kraken.com/api/docs/rest-api/get-ohlc-data
// Formato de respuesta: [time(unix), open, high, low, close, vwap, volume, count]
const KRAKEN_SYMBOLS = {
    "BTCUSDT": "XBTUSD",
    "ETHUSDT": "ETHUSD"
};

const KRAKEN_INTERVALS = {
    "5": 5,
    "15": 15,
    "30": 30,
    "60": 60
};

// Velas visibles inicialmente en el viewport según temporalidad
const INITIAL_VISIBLE_CANDLES = {
    "5": 48,
    "15": 48,
    "30": 48,
    "60": 24
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
            tickMarkFormatter: (time, tickMarkType) => {
                const d = new Date(time * 1000);
                const hh = d.getHours().toString().padStart(2, '0');
                const mm = d.getMinutes().toString().padStart(2, '0');
                const day = d.getDate();
                const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
                    'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                const mon = months[d.getMonth()];
                const yr = d.getFullYear();
                switch (tickMarkType) {
                    case 0: return `${yr}`;
                    case 1: return `${mon} ${yr}`;
                    case 2: return `${day} ${mon}`;
                    case 3: return `${hh}:${mm}`;
                    default: return `${hh}:${mm}`;
                }
            }
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
    return parseInt(currentTimeframe) * 60;
}

function setInitialVisibleRange() {
    if (!candlesData.length) return;
    const visible = INITIAL_VISIBLE_CANDLES[currentTimeframe] || 48;
    const from = Math.max(0, candlesData.length - visible);
    const to = candlesData.length - 1;
    chart.timeScale().setVisibleLogicalRange({ from, to });
}


// ─────────────────────────────────────────────────────────────────────────────
// CARGA DE DATOS HISTÓRICOS
// 1º Kraken API — CORS nativo, sin API key, exactamente los intervalos que necesitamos
// 2º Simulación de respaldo si Kraken falla
// ─────────────────────────────────────────────────────────────────────────────
async function generateHistoricalData() {
    const params = ASSET_PARAMS[currentAsset];

    disconnectBinanceWebSocket();
    if (simIntervalId) { clearInterval(simIntervalId); simIntervalId = null; }

    if (params.binance) {
        try {
            const candles = await fetchKrakenOHLC();
            if (candles.length > 0) {
                candlesData = candles;
                candlestickSeries.setData(candlesData.map(c => ({
                    time: c.time, open: c.open, high: c.high, low: c.low, close: c.close
                })));
                setInitialVisibleRange();
                scanAllCandles();
                updateUI();
                connectBinanceWebSocket();
                return;
            }
        } catch (err) {
            console.warn("[Kraken] Fallo al obtener datos, usando simulación:", err);
        }
    }

    // ── Fallback: Simulación ──────────────────────────────────────────────
    generateMockData();
    simIntervalId = setInterval(tickSimulate, 3000);
}

// Obtiene velas OHLCV de Kraken (incluyendo volumen en índice [6])
async function fetchKrakenOHLC() {
    const pair = KRAKEN_SYMBOLS[currentAsset];
    const interval = KRAKEN_INTERVALS[currentTimeframe];
    const url = `https://api.kraken.com/0/public/OHLC?pair=${pair}&interval=${interval}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Kraken HTTP ${res.status}`);
    const json = await res.json();

    if (json.error && json.error.length > 0) {
        throw new Error(`Kraken API error: ${json.error.join(', ')}`);
    }

    const resultKey = Object.keys(json.result).find(k => k !== 'last');
    const raw = json.result[resultKey];

    if (!Array.isArray(raw) || raw.length === 0) {
        throw new Error('Kraken no devolvió velas');
    }

    const params = ASSET_PARAMS[currentAsset];
    return raw.slice(-200).map(d => ({
        time: parseInt(d[0]),
        open: parseFloat(parseFloat(d[1]).toFixed(params.decimal)),
        high: parseFloat(parseFloat(d[2]).toFixed(params.decimal)),
        low: parseFloat(parseFloat(d[3]).toFixed(params.decimal)),
        close: parseFloat(parseFloat(d[4]).toFixed(params.decimal)),
        volume: parseFloat(parseFloat(d[6]).toFixed(4))  // ← volumen real de Kraken
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// BINANCE WEBSOCKET — Tiempo real
// ─────────────────────────────────────────────────────────────────────────────
function connectBinanceWebSocket() {
    if (!ASSET_PARAMS[currentAsset].binance) return;
    if (isPaused) return;

    const symbol = currentAsset.toLowerCase();
    const interval = BINANCE_INTERVALS[currentTimeframe];

    const wsUrl443 = `wss://stream.binance.com:443/ws/${symbol}@kline_${interval}`;
    const wsUrl9443 = `wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`;

    tryConnectWS(wsUrl443, wsUrl9443);
}

function tryConnectWS(primaryUrl, fallbackUrl) {
    console.info(`[WebSocket] Conectando a ${primaryUrl}...`);
    klineWs = new WebSocket(primaryUrl);

    const fallbackTimer = setTimeout(() => {
        if (klineWs && klineWs.readyState !== WebSocket.OPEN) {
            console.warn(`[WebSocket] Timeout en ${primaryUrl}, intentando fallback...`);
            klineWs.close();
            if (fallbackUrl) {
                klineWs = new WebSocket(fallbackUrl);
                attachWsHandlers(klineWs, fallbackUrl, null);
            }
        }
    }, 5000);

    attachWsHandlers(klineWs, primaryUrl, fallbackTimer);
}

function attachWsHandlers(ws, url, fallbackTimer) {
    ws.onopen = () => {
        if (fallbackTimer) clearTimeout(fallbackTimer);
        console.info(`[WebSocket] ✅ Conectado a ${url}`);
    };

    ws.onmessage = (event) => {
        if (isPaused) return;
        const msg = JSON.parse(event.data);
        if (msg.e !== "kline") return;

        const k = msg.k;
        const params = ASSET_PARAMS[currentAsset];
        const candle = {
            time: Math.floor(k.t / 1000),
            open: parseFloat(parseFloat(k.o).toFixed(params.decimal)),
            high: parseFloat(parseFloat(k.h).toFixed(params.decimal)),
            low: parseFloat(parseFloat(k.l).toFixed(params.decimal)),
            close: parseFloat(parseFloat(k.c).toFixed(params.decimal)),
            volume: parseFloat(parseFloat(k.v).toFixed(4))  // ← volumen de Binance
        };

        candlestickSeries.update({
            time: candle.time, open: candle.open,
            high: candle.high, low: candle.low, close: candle.close
        });

        document.getElementById("current-price").textContent = candle.close.toFixed(params.decimal);

        if (k.x) {
            // ── Vela CERRADA ──
            const last = candlesData[candlesData.length - 1];
            if (last && last.time === candle.time) {
                candlesData[candlesData.length - 1] = candle;
            } else {
                candlesData.push(candle);
            }
            liveCandle = null;

            const lastIdx = candlesData.length - 1;
            const result = detectPatternAt(lastIdx);
            if (result) {
                const signal = {
                    id: `${result.id}-${candle.time}`,
                    time: candle.time,
                    patternId: result.id,
                    patternName: result.name,
                    type: result.type,
                    price: candle.close,
                    status: "Pendiente",
                    confluenceScore: result.confluenceScore,
                    confluenceTags: result.confluenceTags
                };
                detectedSignals.unshift(signal);
                scanAllCandles();
                showToast(result);
            }
        } else {
            liveCandle = candle;
        }
    };

    ws.onerror = (err) => {
        console.warn("[WebSocket] Error en conexión Binance:", err);
    };

    ws.onclose = () => {
        console.info("[WebSocket] Conexión cerrada.");
    };
}

function disconnectBinanceWebSocket() {
    if (klineWs) {
        klineWs.close();
        klineWs = null;
        liveCandle = null;
    }
}

function generateMockData() {
    const params = ASSET_PARAMS[currentAsset];
    let price = params.startPrice;
    const count = 120;
    const data = [];
    const timeframeSeconds = getTimeframeSeconds();
    let baseVolume = currentAsset === "BTCUSDT" ? 350 : 4500;

    let time = new Date();
    time.setSeconds(time.getSeconds() - count * timeframeSeconds);

    for (let i = 0; i < count; i++) {
        const change = (Math.random() - 0.49) * params.volatility;
        const open = price;
        const close = price + change;
        const high = Math.max(open, close) + Math.random() * (params.volatility * 0.4);
        const low = Math.min(open, close) - Math.random() * (params.volatility * 0.4);
        // Volumen simulado con variación aleatoria
        const volume = parseFloat((baseVolume * (0.5 + Math.random() * 1.5)).toFixed(4));

        const dateStr = time.getTime() / 1000;

        data.push({
            time: dateStr,
            open: parseFloat(open.toFixed(params.decimal)),
            high: parseFloat(high.toFixed(params.decimal)),
            low: parseFloat(low.toFixed(params.decimal)),
            close: parseFloat(close.toFixed(params.decimal)),
            volume
        });

        price = close;
        time.setSeconds(time.getSeconds() + timeframeSeconds);
    }

    candlesData = data;
    candlestickSeries.setData(candlesData.map(c => ({
        time: c.time, open: c.open, high: c.high, low: c.low, close: c.close
    })));
    setInitialVisibleRange();
    scanAllCandles();
}


// ─────────────────────────────────────────────────────────────────────────────
// ANÁLISIS DE CONFLUENCIA — 3 CAPAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CAPA 1: Estructura de Mercado (BOS / CHoCH)
 * Detecta si la vela en `index` rompe un swing previo (BOS)
 * o si hay un cambio de carácter (CHoCH) en la tendencia local.
 * Retorna: { detected: bool, label: string }
 */
function detectMarketStructure(index) {
    const lookback = CONFLUENCE_CONFIG.BOS_LOOKBACK;
    if (index < lookback + 2) return { detected: false, label: "" };

    const slice = candlesData.slice(index - lookback, index + 1);
    const current = candlesData[index];

    // Obtener swings (máximos y mínimos locales) en la ventana
    let swingHighs = [];
    let swingLows = [];

    for (let i = 1; i < slice.length - 1; i++) {
        const prev = slice[i - 1];
        const curr = slice[i];
        const next = slice[i + 1];
        if (curr.high > prev.high && curr.high > next.high) {
            swingHighs.push(curr.high);
        }
        if (curr.low < prev.low && curr.low < next.low) {
            swingLows.push(curr.low);
        }
    }

    if (swingHighs.length === 0 && swingLows.length === 0) return { detected: false, label: "" };

    // BOS Alcista: precio cierra por encima del último swing high
    if (swingHighs.length > 0) {
        const lastSwingHigh = swingHighs[swingHighs.length - 1];
        if (current.close > lastSwingHigh) {
            return { detected: true, label: "BOS ↑" };
        }
    }

    // BOS Bajista: precio cierra por debajo del último swing low
    if (swingLows.length > 0) {
        const lastSwingLow = swingLows[swingLows.length - 1];
        if (current.close < lastSwingLow) {
            return { detected: true, label: "BOS ↓" };
        }
    }

    // CHoCH: cambio de carácter — tendencia local cambia de dirección
    // Detectar si los últimos 3 swings alternan dirección
    if (swingHighs.length >= 1 && swingLows.length >= 1) {
        const prevHigh = swingHighs[swingHighs.length - 1];
        const prevLow  = swingLows[swingLows.length - 1];
        const isUptrend = current.close > (prevHigh + prevLow) / 2;

        // Si la vela anterior formaba tendencia bajista y ahora cierra arriba: CHoCH alcista
        const prev2 = candlesData[index - 2];
        const prev1 = candlesData[index - 1];
        if (prev2 && prev1) {
            const localTrendDown = prev1.close < prev2.close && prev1.close < prevLow * 1.005;
            const localTrendUp   = prev1.close > prev2.close && prev1.close > prevHigh * 0.995;
            if (localTrendDown && current.close > prev1.close * 1.002) {
                return { detected: true, label: "CHoCH ↑" };
            }
            if (localTrendUp && current.close < prev1.close * 0.998) {
                return { detected: true, label: "CHoCH ↓" };
            }
        }
    }

    return { detected: false, label: "" };
}

/**
 * CAPA 2: Zonas de Soporte / Resistencia
 * Detecta si el precio de la vela actual está cerca de una zona S/R
 * calculada a partir de pivotes de las últimas N velas.
 * Retorna: { detected: bool, label: string }
 */
function findSRZones(index) {
    const lookback = CONFLUENCE_CONFIG.SR_LOOKBACK;
    const tolerance = CONFLUENCE_CONFIG.SR_TOLERANCE;
    if (index < lookback) return { detected: false, label: "" };

    const current = candlesData[index];
    const slice = candlesData.slice(Math.max(0, index - lookback), index);

    // Recopilar todos los pivotes significativos (máximos y mínimos de la ventana)
    const pivots = [];
    for (let i = 1; i < slice.length - 1; i++) {
        const prev = slice[i - 1];
        const curr = slice[i];
        const next = slice[i + 1];
        if (curr.high >= prev.high && curr.high >= next.high) {
            pivots.push(curr.high);
        }
        if (curr.low <= prev.low && curr.low <= next.low) {
            pivots.push(curr.low);
        }
    }

    if (pivots.length === 0) return { detected: false, label: "" };

    // Agrupar pivotes en zonas (clusterización simple por tolerancia)
    const zones = [];
    const sorted = [...pivots].sort((a, b) => a - b);
    let clusterStart = sorted[0];
    let clusterValues = [sorted[0]];

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] <= clusterStart * (1 + tolerance * 2)) {
            clusterValues.push(sorted[i]);
        } else {
            if (clusterValues.length >= 2) {
                zones.push(clusterValues.reduce((a, b) => a + b, 0) / clusterValues.length);
            }
            clusterStart = sorted[i];
            clusterValues = [sorted[i]];
        }
    }
    if (clusterValues.length >= 2) {
        zones.push(clusterValues.reduce((a, b) => a + b, 0) / clusterValues.length);
    }

    // Ver si el precio actual toca alguna zona
    const price = current.close;
    for (const zone of zones) {
        if (Math.abs(price - zone) / zone <= tolerance) {
            const label = price > zone ? "S/R Soporte" : "S/R Resistencia";
            return { detected: true, label };
        }
    }

    return { detected: false, label: "" };
}

/**
 * CAPA 3: Volumen Relativo
 * Compara el volumen de la vela actual vs la media de los últimos N periodos.
 * Retorna: { detected: bool, ratio: number, label: string }
 */
function calcRelativeVolume(index) {
    const period = CONFLUENCE_CONFIG.VOL_PERIOD;
    const threshold = CONFLUENCE_CONFIG.VOL_THRESHOLD;

    if (index < period) return { detected: false, ratio: 0, label: "" };

    const current = candlesData[index];
    if (!current.volume || current.volume === 0) return { detected: false, ratio: 0, label: "" };

    const slice = candlesData.slice(index - period, index);
    const volumes = slice.map(c => c.volume || 0).filter(v => v > 0);
    if (volumes.length === 0) return { detected: false, ratio: 0, label: "" };

    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    if (avgVolume === 0) return { detected: false, ratio: 0, label: "" };

    const ratio = current.volume / avgVolume;
    const detected = ratio >= threshold;
    return {
        detected,
        ratio: parseFloat(ratio.toFixed(2)),
        label: detected ? `Vol ×${ratio.toFixed(1)}` : ""
    };
}

/**
 * Calcula el score de confluencia (0-3) y las etiquetas activas.
 * Score 0 = solo patrón de vela
 * Score 1 = patrón + 1 confirmación
 * Score 2 = patrón + 2 confirmaciones
 * Score 3 = patrón + las 3 confirmaciones
 */
function calcConfluence(index) {
    const bos      = detectMarketStructure(index);
    const sr       = findSRZones(index);
    const vol      = calcRelativeVolume(index);

    const tags = [];
    let score = 0;

    if (bos.detected) { score++; tags.push(bos.label); }
    if (sr.detected)  { score++; tags.push(sr.label); }
    if (vol.detected) { score++; tags.push(vol.label); }

    return { score, tags };
}


// ─────────────────────────────────────────────────────────────────────────────
// DETECCIÓN DE PATRONES DE VELAS
// ─────────────────────────────────────────────────────────────────────────────
function detectPatternAt(index) {
    if (index < 2) return null;

    const c = candlesData[index];
    const prev = candlesData[index - 1];
    const prev2 = candlesData[index - 2];

    const bodySize = Math.abs(c.close - c.open);
    const totalRange = c.high - c.low;
    if (totalRange === 0 || bodySize === 0) return null;

    const upperShadow = c.high - Math.max(c.open, c.close);
    const lowerShadow = Math.min(c.open, c.close) - c.low;
    const isGreen = c.close > c.open;
    const isRed = c.close < c.open;

    let pattern = null;

    // ---- 1. ENGOLFAMIENTO ALCISTA ----
    if (document.getElementById("pattern-bullish-engulfing").checked) {
        const prevRed = prev.close < prev.open;
        const prevBodySize = Math.abs(prev.close - prev.open);
        if (prevRed && isGreen &&
            c.open <= prev.close &&
            c.close >= prev.open &&
            bodySize > prevBodySize * 1.0) {
            pattern = { id: "bullish-engulfing", name: "Engolfamiento Alcista", type: "bullish" };
        }
    }

    // ---- 2. ENGOLFAMIENTO BAJISTA ----
    if (!pattern && document.getElementById("pattern-bearish-engulfing").checked) {
        const prevGreen = prev.close > prev.open;
        const prevBodySize = Math.abs(prev.close - prev.open);
        if (prevGreen && isRed &&
            c.open >= prev.close &&
            c.close <= prev.open &&
            bodySize > prevBodySize * 1.0) {
            pattern = { id: "bearish-engulfing", name: "Engolfamiento Bajista", type: "bearish" };
        }
    }

    // ---- 3. TRES SOLDADOS BLANCOS ----
    if (!pattern && document.getElementById("pattern-three-white-soldiers").checked && index >= 2) {
        const g1 = prev2.close > prev2.open;
        const g2 = prev.close > prev.open;
        const g3 = isGreen;
        const b1 = Math.abs(prev2.close - prev2.open) > (prev2.high - prev2.low) * 0.6;
        const b2 = Math.abs(prev.close - prev.open) > (prev.high - prev.low) * 0.6;
        const b3 = bodySize > totalRange * 0.6;
        const o2InBody1 = prev.open >= prev2.open && prev.open <= prev2.close;
        const o3InBody2 = c.open >= prev.open && c.open <= prev.close;
        if (g1 && g2 && g3 && b1 && b2 && b3 && o2InBody1 && o3InBody2) {
            pattern = { id: "three-white-soldiers", name: "Tres Soldados Blancos", type: "bullish" };
        }
    }

    // ---- 4. TRES CUERVOS NEGROS ----
    if (!pattern && document.getElementById("pattern-three-black-crows").checked && index >= 2) {
        const r1 = prev2.close < prev2.open;
        const r2 = prev.close < prev.open;
        const r3 = isRed;
        const b1 = Math.abs(prev2.close - prev2.open) > (prev2.high - prev2.low) * 0.6;
        const b2 = Math.abs(prev.close - prev.open) > (prev.high - prev.low) * 0.6;
        const b3 = bodySize > totalRange * 0.6;
        const o2InBody1 = prev.open <= prev2.open && prev.open >= prev2.close;
        const o3InBody2 = c.open <= prev.open && c.open >= prev.close;
        if (r1 && r2 && r3 && b1 && b2 && b3 && o2InBody1 && o3InBody2) {
            pattern = { id: "three-black-crows", name: "Tres Cuervos Negros", type: "bearish" };
        }
    }

    // ---- 5. MARUBOZU ALCISTA ----
    if (!pattern && document.getElementById("pattern-bullish-marubozu").checked) {
        const upperPct = upperShadow / totalRange;
        const lowerPct = lowerShadow / totalRange;
        if (isGreen && upperPct <= 0.05 && lowerPct <= 0.05 && bodySize / totalRange >= 0.90) {
            pattern = { id: "bullish-marubozu", name: "Marubozu Alcista", type: "bullish" };
        }
    }

    // ---- 6. MARUBOZU BAJISTA ----
    if (!pattern && document.getElementById("pattern-bearish-marubozu").checked) {
        const upperPct = upperShadow / totalRange;
        const lowerPct = lowerShadow / totalRange;
        if (isRed && upperPct <= 0.05 && lowerPct <= 0.05 && bodySize / totalRange >= 0.90) {
            pattern = { id: "bearish-marubozu", name: "Marubozu Bajista", type: "bearish" };
        }
    }

    // ---- 7. MARTILLO ----
    if (!pattern && document.getElementById("pattern-hammer").checked) {
        if (lowerShadow >= 2.5 * bodySize && upperShadow <= bodySize * 0.1 && bodySize > 0) {
            pattern = { id: "hammer", name: "Martillo (Hammer)", type: "bullish" };
        }
    }

    // ---- 8. ESTRELLA FUGAZ ----
    if (!pattern && document.getElementById("pattern-shooting-star") && document.getElementById("pattern-shooting-star").checked) {
        if (upperShadow >= 2.5 * bodySize && lowerShadow <= bodySize * 0.1 && bodySize > 0) {
            pattern = { id: "shooting-star", name: "Estrella Fugaz", type: "bearish" };
        }
    }

    // ---- 9. ESTRELLA DE LA MAÑANA ----
    const morningStarCheckbox = document.getElementById("pattern-morning-star");
    if (!pattern && morningStarCheckbox && morningStarCheckbox.checked && index >= 2) {
        const r1 = prev2.close < prev2.open;
        const b1 = Math.abs(prev2.close - prev2.open) > (prev2.high - prev2.low) * 0.5;
        const small2 = Math.abs(prev.close - prev.open) < (prev.high - prev.low) * 0.3;
        const g3 = isGreen;
        const b3 = Math.abs(c.close - c.open) > (c.high - c.low) * 0.5;
        const gapDown = prev.open <= prev2.close && prev.close <= prev2.close;
        const midR1 = (prev2.open + prev2.close) / 2;
        const closesAboveMid = c.close > midR1;
        if (r1 && b1 && small2 && g3 && b3 && closesAboveMid && gapDown) {
            pattern = { id: "morning-star", name: "Estrella de la Mañana", type: "bullish" };
        }
    }

    // ---- 10. ESTRELLA DEL ATARDECER ----
    const eveningStarCheckbox = document.getElementById("pattern-evening-star");
    if (!pattern && eveningStarCheckbox && eveningStarCheckbox.checked && index >= 2) {
        const g1 = prev2.close > prev2.open;
        const b1 = Math.abs(prev2.close - prev2.open) > (prev2.high - prev2.low) * 0.5;
        const small2 = Math.abs(prev.close - prev.open) < (prev.high - prev.low) * 0.3;
        const r3 = isRed;
        const b3 = Math.abs(c.close - c.open) > (c.high - c.low) * 0.5;
        const gapUp = prev.open >= prev2.close && prev.close >= prev2.close;
        const midG1 = (prev2.open + prev2.close) / 2;
        const closesBelowMid = c.close < midG1;
        if (g1 && b1 && small2 && r3 && b3 && closesBelowMid && gapUp) {
            pattern = { id: "evening-star", name: "Estrella del Atardecer", type: "bearish" };
        }
    }

    if (!pattern) return null;

    // ── Calcular confluencia para el patrón detectado ──────────────────────
    const confluence = calcConfluence(index);

    // Aplicar filtro de confluencia mínima si está activo
    const minScore = getMinConfluenceScore();
    if (confluence.score < minScore) return null;

    return {
        ...pattern,
        confluenceScore: confluence.score,
        confluenceTags: confluence.tags
    };
}

/** Lee el filtro de confluencia mínima del UI */
function getMinConfluenceScore() {
    const el = document.getElementById("confluence-filter-select");
    if (!el) return 0;
    return parseInt(el.value) || 0;
}


// ─────────────────────────────────────────────────────────────────────────────
// ESCANEO COMPLETO DEL HISTORIAL
// ─────────────────────────────────────────────────────────────────────────────
function scanAllCandles() {
    detectedSignals = [];
    const markers = [];

    for (let i = 2; i < candlesData.length; i++) {
        const result = detectPatternAt(i);
        if (result) {
            const candle = candlesData[i];
            const signal = {
                id: `${result.id}-${candle.time}`,
                time: candle.time,
                patternId: result.id,
                patternName: result.name,
                type: result.type,
                price: candle.close,
                status: Math.random() > 0.4 ? "Éxito" : "Pendiente",
                confluenceScore: result.confluenceScore,
                confluenceTags: result.confluenceTags
            };
            detectedSignals.unshift(signal);

            // Color del marcador más brillante según score de confluencia
            const baseGreen = result.confluenceScore >= 2 ? "#00ffa3" : "#00c896";
            const baseRed   = result.confluenceScore >= 2 ? "#ff1744" : "#ff3b69";

            markers.push({
                time: candle.time,
                position: result.type === "bullish" ? "belowBar" : "aboveBar",
                color: result.type === "bullish" ? baseGreen : baseRed,
                shape: result.type === "bullish" ? "arrowUp" : "arrowDown",
                text: result.confluenceScore >= 2
                    ? `★ ${result.name.split(" ")[0]}`
                    : result.name.split(" ")[0]
            });
        }
    }

    candlestickSeries.setMarkers(markers);
    renderSignalsTable();
    updateConfluenceStats();
}


// ─────────────────────────────────────────────────────────────────────────────
// TABLA DE SEÑALES
// ─────────────────────────────────────────────────────────────────────────────
function renderSignalsTable() {
    const tbody = document.getElementById("signals-tbody");
    tbody.innerHTML = "";

    let filtered = detectedSignals.filter(sig => {
        if (activeFilter === "all") return true;
        return sig.type === activeFilter;
    });

    // Filtro adicional por score de confluencia desde sidebar
    const minScore = getMinConfluenceScore();
    filtered = filtered.filter(sig => sig.confluenceScore >= minScore);

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr class="no-signals-row">
                <td colspan="7">No se encontraron señales con la configuración actual.</td>
            </tr>
        `;
        return;
    }

    filtered.forEach(sig => {
        const row = document.createElement("tr");
        row.className = "signal-row";

        const date = new Date(sig.time * 1000).toLocaleString();

        const typeBadge = sig.type === "bullish"
            ? `<span class="badge bullish">COMPRA (Alcista)</span>`
            : sig.type === "bearish"
                ? `<span class="badge bearish">VENTA (Bajista)</span>`
                : `<span class="badge neutral">INDECISIÓN</span>`;

        const statusClass = sig.status === "Éxito" ? "positive" : "text-muted";

        // Badge de confluencia
        const score = sig.confluenceScore || 0;
        const confClass = score >= 3 ? "high" : score >= 2 ? "high" : score >= 1 ? "medium" : "low";
        const confLabel = score >= 3 ? "🔥 Alta" : score >= 2 ? "⚡ Alta" : score >= 1 ? "⚠️ Media" : "● Baja";
        const confBadge = `<span class="badge conf-${confClass}">${confLabel}</span>`;

        // Tags de confluencia activos
        const tagsHtml = (sig.confluenceTags || []).map(tag =>
            `<span class="conf-tag">${tag}</span>`
        ).join("");

        row.innerHTML = `
            <td>${date}</td>
            <td><strong>${sig.patternName}</strong></td>
            <td>${typeBadge}</td>
            <td>${sig.price.toFixed(ASSET_PARAMS[currentAsset].decimal)}</td>
            <td>${confBadge}<div class="conf-tags-row">${tagsHtml}</div></td>
            <td><span class="${statusClass}">${sig.status}</span></td>
            <td><a class="action-link" onclick="focusOnCandle(${sig.time})">Ver Gráfico</a></td>
        `;
        tbody.appendChild(row);
    });
}

/** Actualizar estadísticas de confluencia en el sidebar */
function updateConfluenceStats() {
    const total = detectedSignals.length;
    const high   = detectedSignals.filter(s => s.confluenceScore >= 2).length;
    const medium = detectedSignals.filter(s => s.confluenceScore === 1).length;
    const low    = detectedSignals.filter(s => s.confluenceScore === 0).length;

    const elTotal  = document.getElementById("stat-total");
    const elHigh   = document.getElementById("stat-high");
    const elMedium = document.getElementById("stat-medium");
    const elLow    = document.getElementById("stat-low");

    if (elTotal)  elTotal.textContent  = total;
    if (elHigh)   elHigh.textContent   = high;
    if (elMedium) elMedium.textContent = medium;
    if (elLow)    elLow.textContent    = low;
}

// Enfocar el gráfico en una vela específica
window.focusOnCandle = function (time) {
    chart.timeScale().setVisibleRange({
        from: time - 3600 * 24,
        to: time + 3600 * 24
    });
};

// Generar una nueva vela en tiempo real (simulación)
function tickSimulate() {
    const params = ASSET_PARAMS[currentAsset];
    const lastCandle = candlesData[candlesData.length - 1];
    const baseVolume = currentAsset === "BTCUSDT" ? 350 : 4500;

    const newTime = lastCandle.time + getTimeframeSeconds();
    const change = (Math.random() - 0.49) * params.volatility;
    const open = lastCandle.close;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * (params.volatility * 0.35);
    const low = Math.min(open, close) - Math.random() * (params.volatility * 0.35);
    const volume = parseFloat((baseVolume * (0.5 + Math.random() * 1.5)).toFixed(4));

    const newCandle = {
        time: newTime,
        open: parseFloat(open.toFixed(params.decimal)),
        high: parseFloat(high.toFixed(params.decimal)),
        low: parseFloat(low.toFixed(params.decimal)),
        close: parseFloat(close.toFixed(params.decimal)),
        volume
    };

    candlesData.push(newCandle);
    candlestickSeries.update({
        time: newCandle.time, open: newCandle.open,
        high: newCandle.high, low: newCandle.low, close: newCandle.close
    });

    updateHeaderPrices();

    const lastIdx = candlesData.length - 1;
    const result = detectPatternAt(lastIdx);
    if (result) {
        const signal = {
            id: `${result.id}-${newCandle.time}`,
            time: newCandle.time,
            patternId: result.id,
            patternName: result.name,
            type: result.type,
            price: newCandle.close,
            status: "Pendiente",
            confluenceScore: result.confluenceScore,
            confluenceTags: result.confluenceTags
        };

        detectedSignals.unshift(signal);
        scanAllCandles();
        showToast(result);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SISTEMA DE AUDIO — Web Audio API (sin archivos externos)
// ─────────────────────────────────────────────────────────────────────────────
let audioCtx = null;

/** Obtiene o crea el AudioContext de forma lazy (requiere gesto del usuario) */
function getAudioCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Reanudar si fue suspendido por política del navegador
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
}

/**
 * Reproduce un sonido de alerta sintetizado.
 * - Bullish  : tono ascendente (do → mi), verde
 * - Bearish  : tono descendente (mi → do), rojo
 * - Alta confluencia: doble pulso más brillante
 * @param {"bullish"|"bearish"|"neutral"} type
 * @param {number} confluenceScore  0-3
 */
function playAlertSound(type, confluenceScore = 0) {
    // Respeta preferencia de silencio del usuario
    const muteBtn = document.getElementById("btn-mute-sound");
    if (muteBtn && muteBtn.dataset.muted === "true") return;

    try {
        const ctx = getAudioCtx();
        const now = ctx.currentTime;
        const isHigh = confluenceScore >= 2;

        // Definir secuencia de notas según tipo de señal
        // Cada nota: [frecuencia Hz, inicio relativo s, duración s, volumen 0-1]
        let notes;
        if (type === "bullish") {
            notes = isHigh
                ? [[523, 0.00, 0.12, 0.35], [659, 0.10, 0.12, 0.35], [784, 0.20, 0.18, 0.40],   // Do-Mi-Sol
                   [523, 0.45, 0.10, 0.25], [784, 0.52, 0.18, 0.35]]                              // doble pulso
                : [[523, 0.00, 0.12, 0.30], [659, 0.12, 0.18, 0.35]];                             // Do-Mi
        } else if (type === "bearish") {
            notes = isHigh
                ? [[784, 0.00, 0.12, 0.35], [659, 0.10, 0.12, 0.35], [523, 0.20, 0.18, 0.40],   // Sol-Mi-Do
                   [784, 0.45, 0.10, 0.25], [523, 0.52, 0.18, 0.35]]                              // doble pulso
                : [[659, 0.00, 0.12, 0.28], [523, 0.12, 0.18, 0.32]];                             // Mi-Do
        } else {
            notes = [[587, 0.00, 0.15, 0.25]]; // Nota única neutra (Re)
        }

        notes.forEach(([freq, startOffset, duration, gain]) => {
            const osc  = ctx.createOscillator();
            const gainNode = ctx.createGain();

            // Forma de onda: sine para suavidad, triangle para alta confluencia
            osc.type = isHigh ? "triangle" : "sine";
            osc.frequency.setValueAtTime(freq, now + startOffset);

            // Envelope: attack rápido, decay suave
            gainNode.gain.setValueAtTime(0, now + startOffset);
            gainNode.gain.linearRampToValueAtTime(gain, now + startOffset + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);

            osc.connect(gainNode);
            gainNode.connect(ctx.destination);

            osc.start(now + startOffset);
            osc.stop(now + startOffset + duration + 0.05);
        });

    } catch (err) {
        console.warn("[Audio] No se pudo reproducir el sonido de alerta:", err);
    }
}

// Mostrar Toast de notificación
function showToast(pattern) {
    const toast = document.getElementById("notification-toast");
    toast.className = `toast toast-${pattern.type}`;

    const typeText = pattern.type === "bullish" ? "Alcista (Compra)" : pattern.type === "bearish" ? "Bajista (Venta)" : "Neutral";
    const score = pattern.confluenceScore || 0;
    const confLabel = score >= 2 ? "🔥 Alta Confluencia" : score >= 1 ? "⚠️ Media Confluencia" : "● Baja Confluencia";
    const tagsText = (pattern.confluenceTags || []).join(" · ");

    toast.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:4px;">
            <strong style="color:#fff;">¡Nueva Señal Detectada!</strong>
            <span style="font-size:12.5px;">Patrón: ${pattern.name} (${typeText})</span>
            <span style="font-size:11px; color:#aaa;">${confLabel}${tagsText ? " · " + tagsText : ""}</span>
        </div>
    `;

    toast.classList.remove("hidden");
    setTimeout(() => { toast.classList.add("hidden"); }, 4500);

    // ── Reproducir sonido de alerta ──────────────────────────────────────────
    playAlertSound(pattern.type, score);
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
        detectedSignals = [];
        generateHistoricalData();
        updateUI();
    });

    // Selector de temporalidad
    document.getElementById("timeframe-selector").addEventListener("change", (e) => {
        currentTimeframe = e.target.value;
        detectedSignals = [];
        generateHistoricalData();
        updateUI();
    });

    // Checkboxes de patrones para refrescar instantáneamente
    const checkboxes = document.querySelectorAll(".pattern-checkboxes input");
    checkboxes.forEach(chk => {
        chk.addEventListener("change", () => {
            scanAllCandles();
        });

        const container = chk.closest(".checkbox-container");
        container.addEventListener("click", (e) => {
            if (e.target.tagName !== "INPUT") {
                const patternId = chk.id.replace("pattern-", "");
                showEducationInfo(patternId);
            }
        });
    });

    // Filtro de confluencia mínima
    const confSelect = document.getElementById("confluence-filter-select");
    if (confSelect) {
        confSelect.addEventListener("change", () => {
            scanAllCandles();
        });
    }

    // Botón de iniciar/detener actualizaciones en tiempo real
    const simBtn = document.getElementById("btn-toggle-sim");
    const playIcon = simBtn.querySelector(".icon-play");
    const pauseIcon = simBtn.querySelector(".icon-pause");
    const simText = document.getElementById("sim-btn-text");

    playIcon.classList.add("hidden");
    pauseIcon.classList.remove("hidden");
    simText.textContent = "Pausar";

    simBtn.addEventListener("click", () => {
        isPaused = !isPaused;

        if (isPaused) {
            if (klineWs) { klineWs.close(); klineWs = null; }
            if (simIntervalId) { clearInterval(simIntervalId); simIntervalId = null; }
            playIcon.classList.remove("hidden");
            pauseIcon.classList.add("hidden");
            simText.textContent = "Reanudar";
        } else {
            if (ASSET_PARAMS[currentAsset].binance) {
                connectBinanceWebSocket();
            } else {
                simIntervalId = setInterval(tickSimulate, 3000);
            }
            playIcon.classList.add("hidden");
            pauseIcon.classList.remove("hidden");
            simText.textContent = "Pausar";
        }
    });

    // Botón de reset de datos
    document.getElementById("btn-reset-data").addEventListener("click", () => {
        generateHistoricalData();
        updateUI();
    });

    // Botón de silencio de alertas
    const muteBtn = document.getElementById("btn-mute-sound");
    if (muteBtn) {
        muteBtn.addEventListener("click", () => {
            const isMuted = muteBtn.dataset.muted === "true";
            const newMuted = !isMuted;
            muteBtn.dataset.muted = String(newMuted);

            const iconOn  = muteBtn.querySelector(".icon-sound-on");
            const iconOff = muteBtn.querySelector(".icon-sound-off");

            if (newMuted) {
                iconOn.classList.add("hidden");
                iconOff.classList.remove("hidden");
                muteBtn.classList.add("btn-sound--muted");
                muteBtn.title = "Activar alertas de sonido";
            } else {
                iconOff.classList.add("hidden");
                iconOn.classList.remove("hidden");
                muteBtn.classList.remove("btn-sound--muted");
                muteBtn.title = "Silenciar alertas de sonido";
                // Reproducir un tono de confirmación al reactivar
                playAlertSound("bullish", 0);
            }
        });

        // Inicializar AudioContext en el primer clic de cualquier parte (política del navegador)
        document.addEventListener("click", () => { getAudioCtx(); }, { once: true });
    }

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

    // Auto-recarga para evitar la desconexión del WebSocket
    setInterval(() => {
        console.log("Auto-refrescando para mantener datos actualizados...");
        window.location.reload();
    }, 2 * 60 * 1000);
}
