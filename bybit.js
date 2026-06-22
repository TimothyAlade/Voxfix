// bybit.js
// Handles communication with Bybit public APIs

const BybitAPI = {

BASE_URL: "https://api.bybit.com",

// Fetch all spot pairs
async getSpotTickers() {
    try {

        const response = await fetch(
            `${this.BASE_URL}/v5/market/tickers?category=spot`
        );

        const data = await response.json();

        if (data.retCode !== 0) {
            throw new Error(data.retMsg);
        }

        return data.result.list;

    } catch (error) {
        console.error("Spot API Error:", error);
        return [];
    }
},

// Fetch all futures pairs
async getFuturesTickers() {
    try {

        const response = await fetch(
            `${this.BASE_URL}/v5/market/tickers?category=linear`
        );

        const data = await response.json();

        if (data.retCode !== 0) {
            throw new Error(data.retMsg);
        }

        return data.result.list;

    } catch (error) {
        console.error("Futures API Error:", error);
        return [];
    }
},

// Fetch kline/candlestick data
async getCandles(symbol, market = "linear", interval = "60", limit = 200) {

    try {

        const response = await fetch(
            `${this.BASE_URL}/v5/market/kline?category=${market}&symbol=${symbol}&interval=${interval}&limit=${limit}`
        );

        const data = await response.json();

        if (data.retCode !== 0) {
            throw new Error(data.retMsg);
        }

        return data.result.list.reverse();

    } catch (error) {
        console.error("Kline Error:", error);
        return [];
    }
},

// Open Interest (futures only)
async getOpenInterest(symbol) {

    try {

        const response = await fetch(
            `${this.BASE_URL}/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=5min`
        );

        const data = await response.json();

        if (data.retCode !== 0) {
            throw new Error(data.retMsg);
        }

        return data.result.list[0] || null;

    } catch (error) {
        console.error("Open Interest Error:", error);
        return null;
    }
},

// Funding Rate (futures only)
async getFundingRate(symbol) {

    try {

        const response = await fetch(
            `${this.BASE_URL}/v5/market/funding/history?category=linear&symbol=${symbol}&limit=1`
        );

        const data = await response.json();

        if (data.retCode !== 0) {
            throw new Error(data.retMsg);
        }

        return data.result.list[0] || null;

    } catch (error) {
        console.error("Funding Rate Error:", error);
        return null;
    }
},

// Get strongest coins by volume
async getTopCoins(market = "futures", limit = 20) {

    let coins = [];

    if (market === "spot") {
        coins = await this.getSpotTickers();
    } else {
        coins = await this.getFuturesTickers();
    }

    coins.sort((a, b) =>
        Number(b.turnover24h) - Number(a.turnover24h)
    );

    return coins.slice(0, limit);
}

};

// Example test

async function testBybitConnection() {

console.log("Fetching top futures coins...");

const coins = await BybitAPI.getTopCoins("futures", 10);

console.table(
    coins.map(c => ({
        Symbol: c.symbol,
        Price: c.lastPrice,
        Change24h: c.price24hPcnt
    }))
);

}

// Uncomment to test
// testBybitConnection();