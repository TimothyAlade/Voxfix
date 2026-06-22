// papertrade.js
// Virtual paper trading engine

const PaperTrader = {

START_BALANCE: 10000,
RISK_PERCENT: 2,

balance: 10000,
trades: [],

// ======================
// Initialize account
// ======================
init() {

    const savedBalance =
        localStorage.getItem("paper_balance");

    const savedTrades =
        localStorage.getItem("paper_trades");

    this.balance = savedBalance
        ? Number(savedBalance)
        : this.START_BALANCE;

    this.trades = savedTrades
        ? JSON.parse(savedTrades)
        : [];

    this.updateDashboard();
},

// ======================
// Save to Local Storage
// ======================
save() {

    localStorage.setItem(
        "paper_balance",
        this.balance
    );

    localStorage.setItem(
        "paper_trades",
        JSON.stringify(this.trades)
    );
},

// ======================
// Open trade
// ======================
openTrade(data) {

    const trade = {

        id: Date.now(),

        coin: data.coin,

        market: data.market,

        direction: data.signal,

        entry: data.entry,

        takeProfit: data.takeProfit,

        stopLoss: data.stopLoss,

        confidence: data.confidence,

        status: "OPEN",

        openTime: new Date().toLocaleString(),

        closeTime: null,

        profit: 0
    };

    this.trades.push(trade);

    this.save();

    this.updateDashboard();

    return trade;
},

// ======================
// Check open trades
// ======================
async monitorTrades() {

    const openTrades =
        this.trades.filter(
            trade => trade.status === "OPEN"
        );

    for (const trade of openTrades) {

        try {

            const market =
                trade.market === "spot"
                ? "spot"
                : "linear";

            const candles =
                await BybitAPI.getCandles(
                    trade.coin,
                    market,
                    "1",
                    2
                );

            if (!candles.length) continue;

            const currentPrice =
                Number(candles[candles.length - 1][4]);

            this.evaluateTrade(
                trade,
                currentPrice
            );

        } catch (error) {

            console.error(
                "Trade Monitor Error:",
                error
            );
        }
    }
},

// ======================
// Determine win/loss
// ======================
evaluateTrade(trade, price) {

    if (trade.status !== "OPEN") return;

    const longTrade =
        trade.direction === "BUY" ||
        trade.direction === "LONG";

    // LONG WIN

    if (longTrade &&
        price >= trade.takeProfit) {

        this.closeTrade(trade, "WIN");
    }

    // LONG LOSS

    else if (
        longTrade &&
        price <= trade.stopLoss
    ) {

        this.closeTrade(trade, "LOSS");
    }

    // SHORT WIN

    else if (
        !longTrade &&
        price <= trade.takeProfit
    ) {

        this.closeTrade(trade, "WIN");
    }

    // SHORT LOSS

    else if (
        !longTrade &&
        price >= trade.stopLoss
    ) {

        this.closeTrade(trade, "LOSS");
    }
},

// ======================
// Close trade
// ======================
closeTrade(trade, result) {

    trade.status = result;
    trade.closeTime =
        new Date().toLocaleString();

    const riskAmount =
        this.balance *
        (this.RISK_PERCENT / 100);

    if (result === "WIN") {

        trade.profit = riskAmount * 2;

        this.balance += trade.profit;
    }

    else {

        trade.profit = -riskAmount;

        this.balance += trade.profit;
    }

    this.save();

    this.updateDashboard();

    console.log(
        `${trade.coin} ${result}`
    );
},

// ======================
// Stats
// ======================
getStats() {

    const total =
        this.trades.length;

    const wins =
        this.trades.filter(
            t => t.status === "WIN"
        ).length;

    const losses =
        this.trades.filter(
            t => t.status === "LOSS"
        ).length;

    const open =
        this.trades.filter(
            t => t.status === "OPEN"
        ).length;

    const winRate =
        total > 0
        ? ((wins / total) * 100).toFixed(1)
        : 0;

    return {
        total,
        wins,
        losses,
        open,
        winRate
    };
},

// ======================
// Update dashboard
// ======================
updateDashboard() {

    const stats =
        this.getStats();

    const balanceEl =
        document.getElementById("balance");

    const tradesEl =
        document.getElementById("totalTrades");

    const winRateEl =
        document.getElementById("winRate");

    const openEl =
        document.getElementById("openSignals");

    if (balanceEl)
        balanceEl.textContent =
            "$" +
            this.balance.toFixed(2);

    if (tradesEl)
        tradesEl.textContent =
            stats.total;

    if (winRateEl)
        winRateEl.textContent =
            stats.winRate + "%";

    if (openEl)
        openEl.textContent =
            stats.open;

    this.renderHistory();
},

// ======================
// History table
// ======================
renderHistory() {

    const table =
        document.getElementById(
            "historyTable"
        );

    if (!table) return;

    table.innerHTML = "";

    this.trades
        .slice()
        .reverse()
        .forEach(trade => {

            table.innerHTML += `
                <tr>
                    <td>${trade.openTime}</td>
                    <td>${trade.coin}</td>
                    <td>${trade.market}</td>
                    <td>${trade.direction}</td>
                    <td>${trade.entry}</td>
                    <td>${trade.takeProfit}</td>
                    <td>${trade.stopLoss}</td>
                    <td class="${trade.status.toLowerCase()}">
                        ${trade.status}
                    </td>
                </tr>
            `;
        });
},

// ======================
// Reset account
// ======================
reset() {

    this.balance =
        this.START_BALANCE;

    this.trades = [];

    localStorage.removeItem(
        "paper_balance"
    );

    localStorage.removeItem(
        "paper_trades"
    );

    this.updateDashboard();
}

};

// ======================
// Initialize
// ======================

document.addEventListener(
"DOMContentLoaded",
() => {

    PaperTrader.init();

    // Monitor every minute

    setInterval(() => {

        PaperTrader.monitorTrades();

    }, 60000);
}

);