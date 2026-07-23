import { useEffect, useState } from "react";
import type { EChartsOption } from "echarts";
import Chart from "./Chart";
import type { DashboardData, Wilson } from "./types";

const ACCENT = "#f5b301";
const GREEN = "#3ddc97";
const RED = "#ff5c72";
const BLUE = "#4aa8ff";
const GRID = "#1c2333";
const AXIS = "#5b6472";

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const money = (x: number) => x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? GREEN : tone === "bad" ? RED : "#e5e9f0";
  return (
    <div className="rounded-xl border border-[#1c2333] bg-[#0e1420] p-4">
      <div className="text-[11px] uppercase tracking-wider text-[#7a8494]">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-[#5b6472]">{sub}</div>}
    </div>
  );
}

function FreqRow({ name, w }: { name: string; w: Wilson }) {
  return (
    <div className="flex items-center justify-between border-b border-[#161d2b] py-2 text-sm last:border-0">
      <span className="text-[#c3cad6]">{name}</span>
      <span className="tabular-nums text-[#e5e9f0]">
        {pct(w.p)}{" "}
        <span className="text-[#5b6472]">
          (95% CI {pct(w.low)}–{pct(w.high)}, k={w.k}/n={w.n})
        </span>
      </span>
    </div>
  );
}

function Panel({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-xl border border-[#1c2333] bg-[#0e1420] p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-[#c3cad6]">{title}</h2>
        {note && <span className="text-[11px] text-[#5b6472]">{note}</span>}
      </div>
      {children}
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("dashboard-data.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);

  if (err) return <Centered>Failed to load data: {err}</Centered>;
  if (!data) return <Centered>Loading analytics…</Centered>;

  const e = data.economics;
  const rtpHealthy = e.rtp <= 1;

  const convergenceOption: EChartsOption = {
    backgroundColor: "transparent",
    grid: { left: 48, right: 16, top: 24, bottom: 32 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: data.convergence.map((c) => c.i), axisLine: { lineStyle: { color: AXIS } }, name: "paid spin" },
    yAxis: { type: "value", axisLine: { lineStyle: { color: AXIS } }, splitLine: { lineStyle: { color: GRID } }, axisLabel: { formatter: (v: number) => `${(v * 100).toFixed(0)}%` } },
    series: [
      { name: "cumulative RTP", type: "line", showSymbol: false, smooth: true, data: data.convergence.map((c) => c.rtp), lineStyle: { color: ACCENT, width: 2 }, areaStyle: { color: "rgba(245,179,1,0.08)" } },
      { name: "RTP = 100%", type: "line", showSymbol: false, data: data.convergence.map(() => 1), lineStyle: { color: RED, type: "dashed", width: 1 } },
    ],
  };

  const bankrollOption: EChartsOption = {
    backgroundColor: "transparent",
    grid: { left: 56, right: 16, top: 24, bottom: 32 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: data.convergence.map((c) => c.i), axisLine: { lineStyle: { color: AXIS } }, name: "paid spin" },
    yAxis: { type: "value", axisLine: { lineStyle: { color: AXIS } }, splitLine: { lineStyle: { color: GRID } } },
    series: [{ name: "net (payout − wager)", type: "line", showSymbol: false, smooth: true, data: data.convergence.map((c) => c.net), lineStyle: { color: BLUE, width: 2 }, areaStyle: { color: "rgba(74,168,255,0.08)" } }],
  };

  const histOption: EChartsOption = {
    backgroundColor: "transparent",
    grid: { left: 48, right: 16, top: 16, bottom: 48 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "category", data: data.histogram.labels, axisLine: { lineStyle: { color: AXIS } }, axisLabel: { rotate: 35, color: AXIS } },
    yAxis: { type: "value", axisLine: { lineStyle: { color: AXIS } }, splitLine: { lineStyle: { color: GRID } } },
    series: [{ type: "bar", data: data.histogram.counts, itemStyle: { color: ACCENT } }],
  };

  const actionEntries = Object.entries(data.actionSets).sort((a, b) => b[1] - a[1]);
  const actionOption: EChartsOption = {
    backgroundColor: "transparent",
    grid: { left: 190, right: 24, top: 8, bottom: 24 },
    tooltip: { trigger: "axis" },
    xAxis: { type: "value", axisLine: { lineStyle: { color: AXIS } }, splitLine: { lineStyle: { color: GRID } } },
    yAxis: { type: "category", data: actionEntries.map((x) => x[0]).reverse(), axisLine: { lineStyle: { color: AXIS } }, axisLabel: { color: "#c3cad6", fontSize: 11 } },
    series: [{ type: "bar", data: actionEntries.map((x) => x[1]).reverse(), itemStyle: { color: GREEN } }],
  };

  const h = data.health;

  return (
    <div className="min-h-full">
      <header className="border-b border-[#1c2333] bg-[#0b101a] px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold tracking-tight">
              ⚡ Zeus Power <span className="text-[#7a8494]">— Research Dashboard</span>
            </h1>
            <p className="text-xs text-[#5b6472]">
              {data.meta.zeusRecords} endpoint packets · {data.meta.playExchanges} play exchanges · {data.meta.derivedRounds} derived rounds · source {data.meta.source}
            </p>
          </div>
          <span className="rounded-full border border-[#3a2f10] bg-[#1a1608] px-3 py-1 text-[11px] text-[#f5b301]">
            Import-only analyzer · authorized demo research
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-6 py-6">
        <p className="text-xs text-[#5b6472]">{data.meta.generatedNote}</p>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="Empirical RTP" value={pct(e.rtp)} sub={`n=${e.paidSpins} spins`} tone={rtpHealthy ? "good" : "bad"} />
          <Stat label="Wager" value={money(e.wager)} />
          <Stat label="Payout" value={money(e.payout)} />
          <Stat label="GGR" value={money(e.ggr)} tone={e.ggr >= 0 ? "good" : "bad"} />
          <Stat label="Hit rate" value={pct(data.frequencies.hit.p)} sub={`k=${data.frequencies.hit.k}`} />
          <Stat label="Max win" value={`${e.maxWinXBet.toFixed(1)}×`} sub="× bet" />
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="RTP convergence" note="cumulative payout ÷ wager">
            <Chart option={convergenceOption} height={280} />
          </Panel>
          <Panel title="Bankroll curve" note="cumulative net">
            <Chart option={bankrollOption} height={280} />
          </Panel>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="Win multiplier distribution" note="final return ÷ bet">
            <Chart option={histOption} height={300} />
          </Panel>
          <Panel title="Feature trigger frequencies" note="Wilson 95% CI">
            <div className="mt-1">
              <FreqRow name="Any hit (return > 0)" w={data.frequencies.hit} />
              <FreqRow name="Free-spin trigger" w={data.frequencies.freeSpin} />
              <FreqRow name="Bonus trigger" w={data.frequencies.bonus} />
              <FreqRow name="Zeus Power (fist) feature" w={data.frequencies.fist} />
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2 text-center">
              <MiniStat label="Free-spin rounds" value={data.featureRounds.freeSpins} />
              <MiniStat label="Bonus rounds" value={data.featureRounds.bonus} />
              <MiniStat label="Fist rounds" value={data.featureRounds.fist} />
              <MiniStat label="Anomalies" value={data.featureRounds.anomalies} tone={data.featureRounds.anomalies ? "bad" : "good"} />
            </div>
          </Panel>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <Panel title="Advertised action sets" note="server-driven states">
            <Chart option={actionOption} height={320} />
          </Panel>
          <Panel title="Protocol health">
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Latency p50" value={`${h.latencyMs.p50} ms`} />
              <MiniStat label="Latency p95" value={`${h.latencyMs.p95} ms`} />
              <MiniStat label="Latency p99" value={`${h.latencyMs.p99} ms`} />
              <MiniStat label="Latency max" value={`${h.latencyMs.max} ms`} />
              <MiniStat label="Parse errors" value={h.parseErrors} tone={h.parseErrors ? "bad" : "good"} />
              <MiniStat label="Schema drift" value={h.driftExchanges} tone={h.driftExchanges ? "bad" : "good"} />
              <MiniStat label="Illegal transitions" value={h.illegalTransitions} tone={h.illegalTransitions ? "bad" : "good"} />
              <MiniStat label="Unknown actions" value={h.unknownActions} tone={h.unknownActions ? "bad" : "good"} />
            </div>
            <div className="mt-4">
              <div className="mb-1 text-xs text-[#7a8494]">State transitions (last_action → current)</div>
              <div className="max-h-40 overflow-auto rounded-lg border border-[#161d2b]">
                {Object.entries(data.transitions)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-[#141a26] px-3 py-1 text-xs last:border-0">
                      <span className="text-[#c3cad6]">{k}</span>
                      <span className="tabular-nums text-[#7a8494]">{v}</span>
                    </div>
                  ))}
              </div>
            </div>
          </Panel>
        </section>

        <footer className="pt-2 text-center text-[11px] text-[#3f4756]">
          Zeus Power research tooling · empirical statistics from a captured sample · not theoretical RNG values
        </footer>
      </main>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" }) {
  const color = tone === "good" ? GREEN : tone === "bad" ? RED : "#e5e9f0";
  return (
    <div className="rounded-lg border border-[#161d2b] bg-[#0b111c] p-2">
      <div className="text-[10px] uppercase tracking-wide text-[#5b6472]">{label}</div>
      <div className="text-lg font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full min-h-screen items-center justify-center text-[#7a8494]">{children}</div>;
}
