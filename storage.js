// storage.js
// Centralized Local Storage Manager

const StorageManager = {

// ==========================
// Save Data
// ==========================
save(key, data) {

    try {

        localStorage.setItem(
            key,
            JSON.stringify(data)
        );

        return true;

    } catch (error) {

        console.error(
            `Failed to save ${key}:`,
            error
        );

        return false;
    }
},

// ==========================
// Load Data
// ==========================
load(key, defaultValue = null) {

    try {

        const data =
            localStorage.getItem(key);

        return data
            ? JSON.parse(data)
            : defaultValue;

    } catch (error) {

        console.error(
            `Failed to load ${key}:`,
            error
        );

        return defaultValue;
    }
},

// ==========================
// Remove Data
// ==========================
remove(key) {

    try {

        localStorage.removeItem(key);

        return true;

    } catch (error) {

        console.error(
            `Failed to remove ${key}:`,
            error
        );

        return false;
    }
},

// ==========================
// Clear Everything
// ==========================
clearAll() {

    try {

        localStorage.clear();

        console.log(
            "All local storage cleared."
        );

        return true;

    } catch (error) {

        console.error(
            "Failed to clear storage:",
            error
        );

        return false;
    }
},

// ==========================
// Signal History
// ==========================
saveSignals(signals) {

    return this.save(
        "signals_history",
        signals
    );
},

loadSignals() {

    return this.load(
        "signals_history",
        []
    );
},

// ==========================
// Paper Trading
// ==========================
saveTrades(trades) {

    return this.save(
        "paper_trades",
        trades
    );
},

loadTrades() {

    return this.load(
        "paper_trades",
        []
    );
},

saveBalance(balance) {

    return this.save(
        "paper_balance",
        balance
    );
},

loadBalance() {

    return this.load(
        "paper_balance",
        10000
    );
},

// ==========================
// User Settings
// ==========================
saveSettings(settings) {

    return this.save(
        "bot_settings",
        settings
    );
},

loadSettings() {

    return this.load(
        "bot_settings",
        {
            market: "futures",
            riskPercent: 2,
            autoScan: true,
            scanInterval: 5
        }
    );
},

// ==========================
// Equity Curve
// ==========================
saveEquity(history) {

    return this.save(
        "equity_curve",
        history
    );
},

loadEquity() {

    return this.load(
        "equity_curve",
        []
    );
},

// ==========================
// Statistics
// ==========================
saveStats(stats) {

    return this.save(
        "bot_stats",
        stats
    );
},

loadStats() {

    return this.load(
        "bot_stats",
        {
            wins: 0,
            losses: 0,
            totalTrades: 0,
            winRate: 0
        }
    );
},

// ==========================
// Export Backup
// ==========================
exportData() {

    const backup = {

        signals:
            this.loadSignals(),

        trades:
            this.loadTrades(),

        balance:
            this.loadBalance(),

        settings:
            this.loadSettings(),

        equity:
            this.loadEquity(),

        stats:
            this.loadStats(),

        exportedAt:
            new Date().toISOString()
    };

    return JSON.stringify(
        backup,
        null,
        2
    );
},

// ==========================
// Import Backup
// ==========================
importData(jsonData) {

    try {

        const data =
            JSON.parse(jsonData);

        if (data.signals)
            this.saveSignals(
                data.signals
            );

        if (data.trades)
            this.saveTrades(
                data.trades
            );

        if (data.balance)
            this.saveBalance(
                data.balance
            );

        if (data.settings)
            this.saveSettings(
                data.settings
            );

        if (data.equity)
            this.saveEquity(
                data.equity
            );

        if (data.stats)
            this.saveStats(
                data.stats
            );

        console.log(
            "Backup imported successfully."
        );

        return true;

    } catch (error) {

        console.error(
            "Import failed:",
            error
        );

        return false;
    }
}

};