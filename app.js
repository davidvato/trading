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
    "BTCUSDT": { name: "BTC/USDT",  startPrice: 64000, volatility: 320, decimal: 2, binance: true },
    "ETHUSDT": { name: "ETH/USDT",  startPrice: 3400,  volatility: 22,  decimal: 2, binance: true }
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
let currentTimeframe = "60"; // Default: 1H
let activeFilter = "all";

// Mapeo de activos a CoinGecko (historial) y Binance WebSocket (tiempo real)
// CoinGecko: gratis, sin API key, CORS habilitado
const COINGECKO_IDS = {
    "BTCUSDT": "bitcoin",
    "ETHUSDT": "ethereum"
};

// Resolución de CoinGecko en días y minutos por timeframe
const COINGECKO_PARAMS = {
    "5":  { days: "1",  intervalStr: "minutely" },
    "15": { days: "2",  intervalStr: "minutely" },
    "30": { days: "4",  intervalStr: "minutely" },
    "60": { days: "30", intervalStr: "hourly"   }
};

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

// Velas visibles inicialmente en el viewport según temporalidad
// Más pocas velas visibles ⇒ el eje muestra marcas de tiempo más granulares
const INITIAL_VISIBLE_CANDLES = {
    "5":  48,  // 4 horas → marca cada 30 min
    "15": 48,  // 12 horas → marca cada hora
    "30": 48,  // 24 horas → marca cada 2 horas
    "60": 24   // 1 día   → marca cada hora
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
            // Formato de etiquetas de tiempo limpio según el tipo de marca
            tickMarkFormatter: (time, tickMarkType) => {
                const d = new Date(time * 1000);
                const hh = d.getHours().toString().padStart(2, '0');
                const mm = d.getMinutes().toString().padStart(2, '0');
                const day = d.getDate();
                const months = ['Ene','Feb','Mar','Abr','May','Jun',
                                'Jul','Ago','Sep','Oct','Nov','Dic'];
                const mon = months[d.getMonth()];
                const yr  = d.getFullYear();
                // TickMarkType: 0=Year 1=Month 2=DayOfMonth 3=Time 4=TimeWithSeconds
                switch (tickMarkType) {
                    case 0: return `${yr}`;                     // Año
                    case 1: return `${mon} ${yr}`;              // Mes
                    case 2: return `${day} ${mon}`;             // Día
                    case 3: return `${hh}:${mm}`;               // Hora:Min
                    default: return `${hh}:${mm}`;             // Fallback
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
    // Todas las temporalidades son valores numéricos en minutos
    return parseInt(currentTimeframe) * 60;
}

// Ajustar el rango visible inicial del eje de tiempo.
// Menos velas visibles → marcas de tiempo más granulares (ej: cada hora en 1H)
function setInitialVisibleRange() {
    if (!candlesData.length) return;
    const visible = INITIAL_VISIBLE_CANDLES[currentTimeframe] || 48;
    const from = Math.max(0, candlesData.length - visible);
    const to   = candlesData.length - 1;
    chart.timeScale().setVisibleLogicalRange({ from, to });
}


// ─────────────────────────────────────────────────────────────────────────────
// CARGA DE DATOS HISTÓRICOS
// - BTC / ETH → CoinGecko API (gratuita, sin API key, CORS habilitado)
// - Oro / Plata / Dólar → Simulación con parámetros realistas
// ─────────────────────────────────────────────────────────────────────────────
async function generateHistoricalData() {
    const params = ASSET_PARAMS[currentAsset];

    // Desconectar WebSocket anterior
    disconnectBinanceWebSocket();
    // Detener ticker simulado
    if (simIntervalId) { clearInterval(simIntervalId); simIntervalId = null; }

    if (params.binance) {
        // ── Intento 1: CoinGecko OHLC (CORS habilitado, sin API key) ───────────
        try {
            const geckoId  = COINGECKO_IDS[currentAsset];
            const { days } = COINGECKO_PARAMS[currentTimeframe];

            // /ohlc devuelve velas preconstruidas [timestamp, open, high, low, close]
            const url = `https://api.coingecko.com/api/v3/coins/${geckoId}/ohlc?vs_currency=usd&days=${days}`;
            const res  = await fetch(url);
            if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`);
            const raw = await res.json();

            if (Array.isArray(raw) && raw.length > 0) {
                // CoinGecko agrupa las velas en intervalos fijos según el número de días:
                // 1-2 días → 30 min | 3-30 días → 4 horas
                // Re-agrupamos según nuestra temporalidad
                const tfSeconds = getTimeframeSeconds();
                const grouped   = groupOHLC(raw, tfSeconds);

                if (grouped.length > 0) {
                    candlesData = grouped;
                    candlestickSeries.setData(candlesData);
                    setInitialVisibleRange(); // ← Ajustar ventana visible
                    scanAllCandles();
                    updateUI();

                    // Conectar WebSocket para actualizaciones en tiempo real
                    connectBinanceWebSocket();
                    return;
                }
            }
        } catch (err) {
            console.warn("CoinGecko falló, intentando Binance REST:", err);
        }

        // ── Intento 2: Binance REST (puede estar bloqueado por CORS en algunos navegadores) ──
        try {
            const interval = BINANCE_INTERVALS[currentTimeframe] || "1h";
            const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${currentAsset}&interval=${interval}&limit=150`);
            if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
            const raw = await res.json();

            if (Array.isArray(raw) && raw.length > 0) {
                candlesData = raw.map(d => ({
                    time:  d[0] / 1000,
                    open:  parseFloat(d[1]),
                    high:  parseFloat(d[2]),
                    low:   parseFloat(d[3]),
                    close: parseFloat(d[4])
                }));
                candlestickSeries.setData(candlesData);
                setInitialVisibleRange(); // ← Ajustar ventana visible
                scanAllCandles();
                updateUI();
                connectBinanceWebSocket();
                return;
            }
        } catch (err) {
            console.warn("Binance REST bloqueado (CORS). Usando simulación de respaldo.", err);
        }
    }

    // ── Fallback / Activos tradicionales: Simulación ─────────────────────────
    generateMockData();
    // Iniciar ticker simulado
    simIntervalId = setInterval(tickSimulate, 3000);
}

// Re-agrupa velas crudas [ms, o, h, l, c] a la temporalidad deseada
function groupOHLC(raw, tfSeconds) {
    const result = [];
    const msWindow = tfSeconds * 1000;

    // Ordenar por timestamp por si acaso
    raw.sort((a, b) => a[0] - b[0]);

    let bucket = null;

    for (const [ts, o, h, l, c] of raw) {
        const bucketStart = Math.floor(ts / msWindow) * msWindow;

        if (!bucket || bucket.tsMs !== bucketStart) {
            if (bucket) result.push(bucket);
            bucket = { tsMs: bucketStart, time: bucketStart / 1000, open: o, high: h, low: l, close: c };
        } else {
            bucket.high  = Math.max(bucket.high, h);
            bucket.low   = Math.min(bucket.low, l);
            bucket.close = c;
        }
    }
    if (bucket) result.push(bucket);

    // Limpiar clave auxiliar
    return result.map(({ time, open, high, low, close }) => ({ time, open, high, low, close }));
}

// ─────────────────────────────────────────────────────────────────────────────
// BINANCE WEBSOCKET — Tiempo real (wss:// no tiene restricciones CORS)
// Puerto 443 primero (más permisivo en firewalls), fallback a 9443
// ─────────────────────────────────────────────────────────────────────────────
function connectBinanceWebSocket() {
    if (!ASSET_PARAMS[currentAsset].binance) return;
    if (isPaused) return; // No conectar si estamos en pausa

    const symbol   = currentAsset.toLowerCase();
    const interval = BINANCE_INTERVALS[currentTimeframe];

    // Puerto 443 es más permisivo (HTTPS port, usualmente abierto en todos los firewalls)
    const wsUrl443  = `wss://stream.binance.com:443/ws/${symbol}@kline_${interval}`;
    const wsUrl9443 = `wss://stream.binance.com:9443/ws/${symbol}@kline_${interval}`;

    tryConnectWS(wsUrl443, wsUrl9443);
}

function tryConnectWS(primaryUrl, fallbackUrl) {
    console.info(`[WebSocket] Conectando a ${primaryUrl}...`);
    klineWs = new WebSocket(primaryUrl);

    // Si no abre en 5 segundos, intentar fallback
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
        if (isPaused) return; // Ignorar mensajes si estamos en pausa
        const msg = JSON.parse(event.data);
        if (msg.e !== "kline") return;

        const k      = msg.k;
        const params = ASSET_PARAMS[currentAsset];
        const candle = {
            time:  Math.floor(k.t / 1000),
            open:  parseFloat(parseFloat(k.o).toFixed(params.decimal)),
            high:  parseFloat(parseFloat(k.h).toFixed(params.decimal)),
            low:   parseFloat(parseFloat(k.l).toFixed(params.decimal)),
            close: parseFloat(parseFloat(k.c).toFixed(params.decimal))
        };

        // Actualizar el gráfico con el tick en vivo
        candlestickSeries.update(candle);

        // Actualizar precio en el header
        const lastForHeader = { ...candle };
        document.getElementById("current-price").textContent = candle.close.toFixed(params.decimal);

        if (k.x) {
            // ── Vela CERRADA: guardar en historial y escanear patrones ──
            const last = candlesData[candlesData.length - 1];
            if (last && last.time === candle.time) {
                candlesData[candlesData.length - 1] = candle;
            } else {
                candlesData.push(candle);
            }
            liveCandle = null;

            const lastIdx = candlesData.length - 1;
            const pattern = detectPatternAt(lastIdx);
            if (pattern) {
                const signal = {
                    id: `${pattern.id}-${candle.time}`,
                    time: candle.time,
                    patternId: pattern.id,
                    patternName: pattern.name,
                    type: pattern.type,
                    price: candle.close,
                    status: "Pendiente"
                };
                detectedSignals.unshift(signal);
                scanAllCandles();
                showToast(pattern);
            }
        } else {
            liveCandle = candle; // Vela aún en progreso
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
    setInitialVisibleRange(); // ← Ajustar ventana visible
    
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
    

    // Botón de iniciar/detener actualizaciones en tiempo real
    const simBtn   = document.getElementById("btn-toggle-sim");
    const playIcon = simBtn.querySelector(".icon-play");
    const pauseIcon= simBtn.querySelector(".icon-pause");
    const simText  = document.getElementById("sim-btn-text");

    // Mostrar icono de pausa al inicio (está corriendo)
    playIcon.classList.add("hidden");
    pauseIcon.classList.remove("hidden");
    simText.textContent = "Pausar";

    simBtn.addEventListener("click", () => {
        isPaused = !isPaused;

        if (isPaused) {
            // ── PAUSAR ──
            // Cerrar WebSocket si está activo
            if (klineWs) {
                klineWs.close();
                klineWs = null;
            }
            // Detener ticker simulado si está activo
            if (simIntervalId) {
                clearInterval(simIntervalId);
                simIntervalId = null;
            }
            playIcon.classList.remove("hidden");
            pauseIcon.classList.add("hidden");
            simText.textContent = "Reanudar";
        } else {
            // ── REANUDAR ──
            if (ASSET_PARAMS[currentAsset].binance) {
                connectBinanceWebSocket(); // Reconectar WS
            } else {
                simIntervalId = setInterval(tickSimulate, 3000);
            }
            playIcon.classList.add("hidden");
            pauseIcon.classList.remove("hidden");
            simText.textContent = "Pausar";
        }
    });

    function startSimulation() {
        // Solo para activos NO-Binance (commodities simulados)
        if (!ASSET_PARAMS[currentAsset].binance) {
            if (simIntervalId) clearInterval(simIntervalId);
            simIntervalId = setInterval(tickSimulate, 3000);
        }
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
