export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const MIN_CONFIDENCE = 70;
    const DIAMOND_CONFIDENCE = 85;

    if (request.method === "POST" && url.pathname === "/webhook") {
      const update = await request.json();
      const msg = update.message;
      if (!msg ||!msg.text) return new Response("ok");

      const chat_id = msg.chat.id;
      const text = msg.text.trim();

      if (text.startsWith("/predict")) {
        const arg = text.split(" ")[1];
        if (arg) {
          const symbol = arg.toUpperCase().endsWith("USDT")? arg.toUpperCase() : arg.toUpperCase()+"USDT";
          const signal = await getSignal(symbol);
          if (signal.confidence >= MIN_CONFIDENCE) {
            await savePrediction(env, symbol, signal, chat_id);
            await sendMessage(env.BOT_TOKEN, chat_id, formatSignal(symbol, signal, "SINGLE LOGGED"));
            if (signal.confidence >= DIAMOND_CONFIDENCE) {
              await sendDiamondAlert(env, symbol, signal, chat_id);
            }
          } else {
            await sendMessage(env.BOT_TOKEN, chat_id,
              `⚠️ ${symbol} Signal: ${signal.direction} ${signal.confidence}%\nBelow ${MIN_CONFIDENCE}% filter. Not logged.`);
          }
        } else {
          await sendMessage(env.BOT_TOKEN, chat_id, "🔍 Scanning top 30 coins... 10-15s");
          const results = await scanTop30();
          const strongSignals = results.filter(r => r.signal.confidence >= MIN_CONFIDENCE);

          if (strongSignals.length === 0) {
            await sendMessage(env.BOT_TOKEN, chat_id,
              `❌ No strong setup ≥${MIN_CONFIDENCE}% right now.\nTry again in 15min.`);
            return new Response("ok");
          }

          const best = strongSignals[0];
          await savePrediction(env, best.symbol, best.signal, chat_id);

          let top10Msg = `🏆 TOP STRONG SETUPS ≥${MIN_CONFIDENCE}%\n`;
          strongSignals.slice(0,10).forEach((r,i) => {
            const diamond = r.signal.confidence >= DIAMOND_CONFIDENCE? "💎 " : "";
            const emoji = i===0? "🥇" : i===1? "🥈" : i===2? "🥉" : `${i+1}.`;
            top10Msg += `${emoji} ${diamond}${r.symbol} → ${r.signal.direction} ${r.signal.confidence}%\n`;
          });
          top10Msg += `\n✅ Auto-logged best: ${best.symbol} ${best.signal.direction} ${best.signal.confidence}%`;
          await sendMessage(env.BOT_TOKEN, chat_id, top10Msg);

          // Diamond alert if best is 85%+
          if (best.signal.confidence >= DIAMOND_CONFIDENCE) {
            await sendDiamondAlert(env, best.symbol, best.signal, chat_id);
          }
        }
      }

      if (text === "/top10") {
        await sendMessage(env.BOT_TOKEN, chat_id, "🔍 Scanning top 30... wait");
        const results = await scanTop30();
        const strong = results.filter(r => r.signal.confidence >= MIN_CONFIDENCE);

        if (strong.length === 0) {
          await sendMessage(env.BOT_TOKEN, chat_id, `No coins ≥${MIN_CONFIDENCE}% confidence`);
          return new Response("ok");
        }

        let msg = `📊 TOP STRONG COINS ≥${MIN_CONFIDENCE}%\n`;
        strong.slice(0,10).forEach((r,i) => {
          const diamond = r.signal.confidence >= DIAMOND_CONFIDENCE? "💎 " : "";
          const emoji = r.signal.direction==="UP"? "🟢" : "🔴";
          msg += `${i+1}. ${diamond}${emoji} ${r.symbol} | ${r.signal.direction} | ${r.signal.confidence}% | $${r.signal.price}\n`;
        });
        await sendMessage(env.BOT_TOKEN, chat_id, msg);
      }

      if (text === "/history") {
        const history = await getHistory(env, chat_id);
        await sendMessage(env.BOT_TOKEN, chat_id, history);
      }

      if (text === "/analytics") {
        const stats = await getAnalytics(env, chat_id);
        await sendMessage(env.BOT_TOKEN, chat_id, stats);
      }

      if (text === "/filter") {
        await sendMessage(env.BOT_TOKEN, chat_id,
          `Current filters:\nLog signals: ≥${MIN_CONFIDENCE}%\nDiamond alert: ≥${DIAMOND_CONFIDENCE}%`);
      }

      if (text === "/start") {
        await sendMessage(env.BOT_TOKEN, chat_id,
          `👋 Bybit Scanner Bot v4\n` +
          `Filters: Log ≥${MIN_CONFIDENCE}% | Diamond ≥${DIAMOND_CONFIDENCE}%\n\n` +
          `/predict - Scan top 30, log best\n` +
          `/top10 - Show strong signals\n` +
          `/history - Last 20 trades\n` +
          `/analytics - Full breakdown\n` +
          `💎 = 85%+ instant alert`);
      }

      return new Response("ok");
    }

    // Cron job every minute - checks TP/SL + scans for diamonds
    if (request.headers.get("cf-cron")) {
      ctx.waitUntil(checkPredictions(env));
      ctx.waitUntil(autoScanDiamonds(env));
      return new Response("checked");
    }

    return new Response(`<!DOCTYPE html><html><body style="background:#0d1117;color:#c9d1d9;font-family:sans-serif;padding:20px">
      <h2>Bybit Scanner Bot v4 ✅</h2>
      <p>Diamond alerts: ≥85% confidence</p>
      </body></html>`, {headers:{"Content-Type":"text/html"}});
  }
}

async function autoScanDiamonds(env) {
  // Auto scan every minute for 85%+ signals and alert user
  const list = await env.PREDICTIONS.list();
  let chat_ids = [...new Set((await Promise.all(list.keys.map(k => env.PREDICTIONS.get(k.name))))
   .map(d => JSON.parse(d).chat_id))];

  for (let chat_id of chat_ids) {
    const results = await scanTop30();
    const diamonds = results.filter(r => r.signal.confidence >= 85);
    for (let d of diamonds) {
      // Check if we already alerted this symbol in last 30min
      const key = `alert_${d.symbol}_${Math.floor(Date.now()/1800000)}`;
      const sent = await env.PREDICTIONS.get(key);
      if (!sent) {
        await savePrediction(env, d.symbol, d.signal, chat_id);
        await sendDiamondAlert(env, d.symbol, d.signal, chat_id);
        await env.PREDICTIONS.put(key, "1", {expirationTtl: 1800}); // 30min cooldown
      }
    }
  }
}

async function sendDiamondAlert(env, symbol, signal, chat_id) {
  const msg = `🚨💎 DIAMOND SETUP DETECTED 🚨\n` +
              `Symbol: ${symbol}\n` +
              `Signal: ${signal.direction}\n` +
              `Confidence: ${signal.confidence}% 🔥\n` +
              `Entry: $${signal.price}\n` +
              `TP: $${signal.tp} | SL: $${signal.sl}\n` +
              `Timeframe: ${signal.timeframe}min\n` +
              `This is a RARE 85%+ signal.\nLogged & tracking automatically.`;
  await sendMessage(env.BOT_TOKEN, chat_id, msg);
}

async function scanTop30() {
  const res = await fetch("https://api.bybit.com/v5/market/tickers?category=spot");
  const tickers = (await res.json()).result.list
.filter(t => t.symbol.endsWith("USDT") && parseFloat(t.volume24h) > 1000000)
.sort((a,b) => parseFloat(b.volume24h) - parseFloat(a.volume24h))
.slice(0, 30);

  let results = [];
  for (let t of tickers) {
    try {
      const signal = await getSignal(t.symbol);
      results.push({symbol: t.symbol, signal});
    } catch(e) {}
    await new Promise(r => setTimeout(r, 150));
  }
  return results.sort((a,b) => b.signal.confidence - a.signal.confidence);
}

async function getSignal(symbol) {
  const res = await fetch(`https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=15&limit=100`);
  const json = await res.json();
  if (json.retCode!== 0) return {direction:"ERROR", confidence:0, price:0, tp:0, sl:0, timeframe:15};

  const candles = json.result.list.map(c => ({
    close: parseFloat(c[4]),
    volume: parseFloat(c[5])
  })).reverse();

  const closes = candles.map(c=>c.close);
  const volumes = candles.map(c=>c.volume);
  const price = closes[closes.length-1];

  const ema9 = EMA(closes, 9);
  const ema21 = EMA(closes, 21);
  const rsi = RSI(closes, 14);
  const avgVol = volumes.slice(-20).reduce((a,b)=>a+b,0)/20;
  const volSpike = volumes[volumes.length-1] > avgVol*1.5; // 50% spike for diamonds

  let direction = "SIDEWAYS";
  let confidence = 40;

  if (ema9 > ema21 && rsi > 58 && volSpike) {
    direction = "UP";
    confidence = 75 + Math.min(20, (rsi-58)*0.6 + (ema9-ema21)/price*500);
  } else if (ema9 < ema21 && rsi < 42 && volSpike) {
    direction = "DOWN";
    confidence = 75 + Math.min(20, (42-rsi)*0.6 + (ema21-ema9)/price*500);
  }

  return {
    direction,
    confidence: Math.round(Math.min(95, confidence)),
    timeframe: 15,
    price: price.toFixed(4),
    tp: (direction==="UP"? price*1.02 : price*0.98).toFixed(4),
    sl: (direction==="UP"? price*0.98 : price*1.02).toFixed(4)
  };
}

async function savePrediction(env, symbol, signal, chat_id) {
  const id = Date.now().toString();
  await env.PREDICTIONS.put(id, JSON.stringify({
    id, symbol, chat_id,...signal, status: "OPEN", created: Date.now()
  }));
}

async function checkPredictions(env) {
  const list = await env.PREDICTIONS.list();
  const now = Date.now();
  for (let key of list.keys) {
    const data = JSON.parse(await env.PREDICTIONS.get(key.name));
    if (data.status!== "OPEN" || now - data.created < 15*60*1000) continue;

    try {
      const res = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${data.symbol}`);
      const price = parseFloat((await res.json()).result.list[0].lastPrice);

      let status = "LOSS";
      if (data.direction==="UP" && price>=data.tp) status="WIN";
      if (data.direction==="DOWN" && price<=data.tp) status="WIN";

      data.status = status;
      data.closed_price = price.toFixed(4);
      await env.PREDICTIONS.put(key.name, JSON.stringify(data));
    } catch(e) {}
  }
}

async function getHistory(env, chat_id) {
  const list = await env.PREDICTIONS.list();
  let trades = [];
  for (let key of list.keys) {
    const d = JSON.parse(await env.PREDICTIONS.get(key.name));
    if (d.chat_id == chat_id) trades.push(d);
  }
  trades = trades.sort((a,b) => b.created - a.created).slice(0, 20);

  if (trades.length===0) return "No history yet";

  let msg = `📜 LAST 20 PREDICTIONS\n`;
  trades.forEach(t => {
    const diamond = t.confidence >= 85? "💎 " : "";
    const status = t.status==="WIN"? "✅ WIN" : t.status==="LOSS"? "❌ LOSS" : "⏳ OPEN";
    const time = new Date(t.created).toLocaleTimeString();
    msg += `${diamond}${status} | ${t.symbol} | ${t.direction} ${t.confidence}% | ${time}\n`;
  });
  return msg;
}

async function getAnalytics(env, chat_id) {
  const list = await env.PREDICTIONS.list();
  let trades = [];
  for (let key of list.keys) {
    const d = JSON.parse(await env.PREDICTIONS.get(key.name));
    if (d.chat_id == chat_id && d.status!=="OPEN") trades.push(d);
  }

  if (trades.length===0) return "No closed trades yet";

  const wins = trades.filter(t => t.status==="WIN").length;
  const losses = trades.filter(t => t.status==="LOSS").length;
  const total = wins + losses;
  const winrate = (wins/total*100).toFixed(1);

  const diamondTrades = trades.filter(t => t.confidence >= 85);
  const diamondWins = diamondTrades.filter(t => t.status==="WIN").length;
  const diamondWR = diamondTrades.length? (diamondWins/diamondTrades.length*100).toFixed(1) : 0;

  return `📈 ANALYTICS - 70% FILTER\n` +
         `Total Closed: ${total}\n` +
         `Wins: ${wins} | Losses: ${losses}\n` +
         `Winrate: ${winrate}%\n\n` +
         `💎 Diamond 85%+ Trades: ${diamondTrades.length}\n` +
         `Diamond Winrate: ${diamondWR}%\n\n` +
         `Tip: Focus on 💎 signals for best results`;
}

function formatSignal(symbol, s, type) {
  const diamond = s.confidence >= 85? "💎 " : "";
  return `📊 ${diamond}${type} PREDICTION\n` +
         `Symbol: ${symbol}\n` +
         `Signal: ${s.direction}\n` +
         `Confidence: ${s.confidence}%\n` +
         `Entry: $${s.price}\n` +
         `TP: $${s.tp} | SL: $${s.sl}\n` +
         `Timeframe: ${s.timeframe}min\n` +
         `Status: LOGGED & TRACKING ✅`;
}

function EMA(arr, p){const k=2/(p+1); let ema=arr[0]; for(let i=1;i<arr.length;i++) ema=arr[i]*k+ema*(1-k); return ema}
function RSI(arr, p){let g=0,l=0; for(let i=1;i<=p;i++){const d=arr[i]-arr[i-1]; d>0?g+=d:l-=d} return 100-100/(1+g/l)}
async function sendMessage(token, chat_id, text){
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:"POST", headers:{"Content-Type":"application/json"},
    body: JSON.stringify({chat_id, text, parse_mode:"HTML"})
  });
}