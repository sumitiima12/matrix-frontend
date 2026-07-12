import React from "react";
import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import MiniCandles from "../../components/charts/MiniCandles";
import ProChart from "../../components/charts/ProChart";

/**
 * Tiny sparkline.
 */

export default function Spark({ data, up }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data.slice(-24)} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
        <defs>
          <linearGradient id={up ? "gu" : "gd"} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? "#0FB97D" : "#FF4D67"} stopOpacity={0.35} />
            <stop offset="100%" stopColor={up ? "#0FB97D" : "#FF4D67"} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area type="monotone" dataKey="p" stroke={up ? "#0FB97D" : "#FF4D67"} strokeWidth={2} fill={`url(#${up ? "gu" : "gd"})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/* ===================== CHART INDICATOR MATH (pure) =====================
   Operates on a REAL candle array [{t,o,h,l,c,v}]. Returns arrays aligned to
   the candles (leading nulls where the lookback isn't satisfied). Client-side
   because chart overlays must work on ANY timeframe, while /api/indicators
   only computes daily values.                                              */

/* Shared hook: REAL candles for a symbol+timeframe. Single fetch path for every
   chart in the app. No synthetic fallback — no data means no chart. */

// Overlay registry — adding an indicator is one entry, not new chart code.

// Compact candlestick chart (OHLC) with switchable timeframe, for cards & drawers.
const TF_LIST = ["3m", "5m", "30m", "1h", "4h", "1d"];
/* MiniCandles — REAL candles only. If there is no data, it says so rather than
   drawing an invented price path. */

/* ProChart — full chart for the stock detail page: REAL candles, timeframe
   selector, and stackable indicator overlays (EMA/SMA sets, Bollinger) plus
   MACD and RSI sub-panels. All indicator math runs on the real candles. */
