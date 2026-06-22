// app.js
// Main Application Controller

const App = {

scannedSignals: [],

// ==========================
// Initialize App
// ==========================
init() {

    console.log("Bybit Trading Bot Started");

    const scanBtn =
        document.getElementById("scanBtn");

    if (scanBtn) {

        scanBtn.addEventListener(
            "click",
            () => this.scanMarket()
        );
    }

    // Auto-scan every 5 minutes
    setInterval(() => {

        this.scanMarket();

    }, 300000);
},

// ==========================
// Scan market
// ==========================
async scanMarket() {

    try {

        const marketType =
            document.getElementById("marketType")
            ?.value || "futures";

        const scanBtn =
            document.getElementById("scanBtn");

        if (scanBtn) {

            scanBtn.disabled = true;
            scanBtn.textContent = "Scanning...";
        }

        console.log(
            `Scanning ${marketType} market...`
        );

        // Get top 20 volume coins
        const topCoins =
            await BybitAPI.getTopCoins(
                marketType,
                20
            );

        if (!topCoins.length) {

            alert("No market data found.");
            return;
        }

        // Clear old signals
        const container =
            document.getElementById(
                "signalContainer"
            );

        if (container)
            container.innerHTML = "";

        this.scannedSignals = [];

        // Analyze each coin
        for (const coin of topCoins) {

            try {

                const marketCategory =
                    marketType === "spot"
                    ? "spot"
                    : "linear";

                const candles =
                    await BybitAPI.getCandles(
                        coin.symbol,
                        marketCategory,
                        "60",
                        200
                    );

                if (candles.length < 50)
                    continue;

                const closes =
                    AnalysisEngine.getCloses(
                        candles
                    );

                const analysis =
                    AnalysisEngine
                    .generateSignal(closes);

                const signal = {

                    coin: coin.symbol,

                    market: marketType,

                    ...analysis
                };

                this.scannedSignals.push(
                    signal
                );

                // Display signal
                this.renderSignal(signal);

                // Update Analysis Panel
                this.updateAnalysisPanel(
                    signal
                );

                // Open Paper Trade
                if (
                    signal.signal !== "HOLD"
                ) {

                    const alreadyOpen =
                        PaperTrader.trades.some(
                            trade =>
                                trade.coin ===
                                signal.coin &&
                                trade.status ===
                                "OPEN"
                        );

                    if (!alreadyOpen) {

                        PaperTrader.openTrade(
                            signal
                        );
                    }
                }

            } catch (error) {

                console.error(
                    coin.symbol,
                    error
                );
            }
        }

    } catch (error) {

        console.error(
            "Market Scan Error:",
            error
        );

    } finally {

        const scanBtn =
            document.getElementById(
                "scanBtn"
            );

        if (scanBtn) {

            scanBtn.disabled = false;
            scanBtn.textContent =
                "Scan Market";
        }
    }
},

// ==========================
// Render Signal Card
// ==========================
renderSignal(signal) {

    const container =
        document.getElementById(
            "signalContainer"
        );

    if (!container) return;

    const statusClass =
        signal.signal === "BUY" ||
        signal.signal === "LONG"
        ? "win"
        : signal.signal === "SELL" ||
          signal.signal === "SHORT"
        ? "loss"
        : "open";

    const card = document.createElement("div");

    card.className = "signal-card";

    card.innerHTML = `

        <h3>${signal.coin}</h3>

        <p><strong>Signal:</strong>
        ${signal.signal}</p>

        <p><strong>Price:</strong>
        ${signal.currentPrice}</p>

        <p><strong>Entry:</strong>
        ${signal.entry}</p>

        <p><strong>TP:</strong>
        ${signal.takeProfit}</p>

        <p><strong>SL:</strong>
        ${signal.stopLoss}</p>

        <p><strong>RSI:</strong>
        ${signal.rsi}</p>

        <p><strong>Trend:</strong>
        ${signal.trend}</p>

        <p><strong>Confidence:</strong>
        ${signal.confidence}%</p>

        <span class="status ${statusClass}">
            ${signal.signal}
        </span>

    `;

    container.appendChild(card);
},

// ==========================
// Update Analysis Panel
// ==========================
updateAnalysisPanel(signal) {

    const rsi =
        document.getElementById("rsi");

    const macd =
        document.getElementById("macd");

    const emaTrend =
        document.getElementById(
            "emaTrend"
        );

    const volume =
        document.getElementById(
            "volume"
        );

    const funding =
        document.getElementById(
            "fundingRate"
        );

    const openInterest =
        document.getElementById(
            "openInterest"
        );

    if (rsi)
        rsi.textContent = signal.rsi;

    if (macd)
        macd.textContent =
            signal.signal;

    if (emaTrend)
        emaTrend.textContent =
            signal.trend;

    if (volume)
        volume.textContent =
            "High";

    if (funding)
        funding.textContent =
            "--";

    if (openInterest)
        openInterest.textContent =
            "--";
}

};

// ==========================
// Start App
// ==========================

document.addEventListener(
"DOMContentLoaded",
() => {

    App.init();

}

);