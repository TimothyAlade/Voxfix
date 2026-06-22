// analysis.js
// Technical analysis engine

const AnalysisEngine = {

// ==========================
// Extract closing prices
// ==========================
getCloses(candles) {
    // Bybit kline format:
    // [timestamp, open, high, low, close, volume, turnover]

    return candles.map(candle => Number(candle[4]));
},

// ==========================
// EMA Calculation
// ==========================
calculateEMA(prices, period) {

    if (prices.length < period) return [];

    const multiplier = 2 / (period + 1);

    let ema = [];

    let sma =
        prices.slice(0, period)
        .reduce((a, b) => a + b, 0) / period;

    ema[period - 1] = sma;

    for (let i = period; i < prices.length; i++) {

        ema[i] =
            (prices[i] - ema[i - 1]) * multiplier +
            ema[i - 1];
    }

    return ema.filter(v => v !== undefined);
},

// ==========================
// RSI Calculation
// ==========================
calculateRSI(prices, period = 14) {

    if (prices.length < period + 1) return 50;

    let gains = [];
    let losses = [];

    for (let i = 1; i < prices.length; i++) {

        let diff = prices[i] - prices[i - 1];

        gains.push(diff > 0 ? diff : 0);
        losses.push(diff < 0 ? Math.abs(diff) : 0);
    }

    let avgGain =
        gains.slice(0, period)
        .reduce((a, b) => a + b, 0) / period;

    let avgLoss =
        losses.slice(0, period)
        .reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) return 100;

    let rs = avgGain / avgLoss;

    let rsi = 100 - (100 / (1 + rs));

    return Number(rsi.toFixed(2));
},

// ==========================
// Determine trend
// ==========================
determineTrend(prices) {

    const ema20 = this.calculateEMA(prices, 20).pop();
    const ema50 = this.calculateEMA(prices, 50).pop();
    const ema200 = this.calculateEMA(prices, 200).pop();

    if (!ema20 || !ema50 || !ema200)
        return "UNKNOWN";

    if (ema20 > ema50 && ema50 > ema200)
        return "STRONG BULLISH";

    if (ema20 < ema50 && ema50 < ema200)
        return "STRONG BEARISH";

    if (ema20 > ema50)
        return "BULLISH";

    if (ema20 < ema50)
        return "BEARISH";

    return "SIDEWAYS";
},

// ==========================
// Generate signal
// ==========================
generateSignal(prices) {

    const currentPrice = prices[prices.length - 1];

    const rsi = this.calculateRSI(prices);

    const ema20 =
        this.calculateEMA(prices, 20).pop();

    const ema50 =
        this.calculateEMA(prices, 50).pop();

    let signal = "HOLD";
    let confidence = 50;

    // LONG / BUY setup

    if (rsi < 35 && ema20 > ema50) {

        signal = "BUY";
        confidence = 80;
    }

    // SHORT / SELL setup

    else if (rsi > 70 && ema20 < ema50) {

        signal = "SELL";
        confidence = 80;
    }

    // Trend continuation

    else if (ema20 > ema50) {

        signal = "LONG";
        confidence = 65;
    }

    else if (ema20 < ema50) {

        signal = "SHORT";
        confidence = 65;
    }

    // Risk Management

    const stopLoss =
        signal === "BUY" || signal === "LONG"
        ? currentPrice * 0.98
        : currentPrice * 1.02;

    const takeProfit =
        signal === "BUY" || signal === "LONG"
        ? currentPrice * 1.04
        : currentPrice * 0.96;

    return {

        signal,

        currentPrice: Number(currentPrice),

        rsi,

        ema20: Number(ema20?.toFixed(2)),

        ema50: Number(ema50?.toFixed(2)),

        trend: this.determineTrend(prices),

        confidence,

        entry: Number(currentPrice.toFixed(2)),

        takeProfit: Number(takeProfit.toFixed(2)),

        stopLoss: Number(stopLoss.toFixed(2))

    };
}

};

// ==========================
// Example Usage
// ==========================

async function analyzeCoin(symbol = "BTCUSDT") {

try {

    const candles =
        await BybitAPI.getCandles(
            symbol,
            "linear",
            "60",
            200
        );

    const closes =
        AnalysisEngine.getCloses(candles);

    const analysis =
        AnalysisEngine.generateSignal(closes);

    console.log(symbol, analysis);

    return analysis;

} catch (error) {

    console.error("Analysis Error:", error);
}

}

// Example:
// analyzeCoin("BTCUSDT");

}
// =====================================
// EXTRA INDICATORS
// =====================================

// Simple Moving Average
calculateSMA(values, period) {

if (values.length < period) return 0;

const slice = values.slice(-period);

return slice.reduce((a, b) => a + b, 0) / period;

},

// Average Volume
calculateAverageVolume(candles, period = 20) {

const volumes = candles.map(c => Number(c[5]));

return this.calculateSMA(volumes, period);

},

// ATR (Average True Range)
calculateATR(candles, period = 14) {

if (candles.length < period + 1) return 0;

let trs = [];

for (let i = 1; i < candles.length; i++) {

    const high = Number(candles[i][2]);
    const low = Number(candles[i][3]);
    const prevClose = Number(candles[i - 1][4]);

    const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
    );

    trs.push(tr);
}

const recentTR =
    trs.slice(-period);

return recentTR.reduce((a, b) => a + b, 0) / period;

},

// MACD
calculateMACD(prices) {

const ema12 =
    this.calculateEMA(prices, 12);

const ema26 =
    this.calculateEMA(prices, 26);

const min =
    Math.min(ema12.length, ema26.length);

const macdLine = [];

for (let i = 0; i < min; i++) {

    macdLine.push(
        ema12[ema12.length - min + i] -
        ema26[ema26.length - min + i]
    );
}

const signalLine =
    this.calculateEMA(macdLine, 9);

return {
    macd: macdLine.at(-1) || 0,
    signal: signalLine.at(-1) || 0
};

},

// =====================================
// ADVANCED SIGNAL ENGINE
// =====================================

generateAdvancedSignal(candles) {

const prices =
    this.getCloses(candles);

const currentPrice =
    prices.at(-1);

const rsi =
    this.calculateRSI(prices);

const ema20 =
    this.calculateEMA(prices, 20).at(-1);

const ema50 =
    this.calculateEMA(prices, 50).at(-1);

const ema200 =
    this.calculateEMA(prices, 200).at(-1);

const trend =
    this.determineTrend(prices);

const macdData =
    this.calculateMACD(prices);

const atr =
    this.calculateATR(candles);

const avgVolume =
    this.calculateAverageVolume(candles);

const currentVolume =
    Number(candles.at(-1)[5]);

let score = 0;
let reasons = [];

// =================================
// TREND SCORE
// =================================

if (ema20 > ema50 && ema50 > ema200) {

    score += 25;
    reasons.push("Bullish EMA alignment");
}

if (ema20 < ema50 && ema50 < ema200) {

    score += 25;
    reasons.push("Bearish EMA alignment");
}

// =================================
// RSI
// =================================

if (rsi < 35) {

    score += 15;
    reasons.push("RSI oversold");
}

if (rsi > 65) {

    score += 15;
    reasons.push("RSI overbought");
}

// =================================
// MACD
// =================================

if (macdData.macd > macdData.signal) {

    score += 20;
    reasons.push("Bullish MACD");
}

if (macdData.macd < macdData.signal) {

    score += 20;
    reasons.push("Bearish MACD");
}

// =================================
// VOLUME
// =================================

if (currentVolume > avgVolume) {

    score += 20;
    reasons.push("High volume confirmation");
}

// =================================
// SIGNAL LOGIC
// =================================

let signal = "HOLD";

if (
    score >= 70 &&
    trend.includes("BULL")
) {

    signal = "LONG";
}

else if (
    score >= 70 &&
    trend.includes("BEAR")
) {

    signal = "SHORT";
}

// ATR Dynamic Risk

const stopLoss =
    signal === "LONG"
    ? currentPrice - (atr * 1.5)
    : currentPrice + (atr * 1.5);

const takeProfit =
    signal === "LONG"
    ? currentPrice + (atr * 3)
    : currentPrice - (atr * 3);

return {

    signal,

    confidence: Math.min(score, 100),

    currentPrice:
        Number(currentPrice.toFixed(2)),

    entry:
        Number(currentPrice.toFixed(2)),

    takeProfit:
        Number(takeProfit.toFixed(2)),

    stopLoss:
        Number(stopLoss.toFixed(2)),

    rsi,

    trend,

    atr: Number(atr.toFixed(2)),

    macd:
        Number(macdData.macd.toFixed(4)),

    volume:
        currentVolume,

    reasons
};

}