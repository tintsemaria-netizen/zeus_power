import { useEffect, useRef } from "react";
import * as echarts from "echarts";

/** Minimal ECharts wrapper: renders `option`, resizes with the container, disposes on unmount. */
export default function Chart({ option, height = 300 }: { option: echarts.EChartsOption; height?: number }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const chart = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    chart.current = echarts.init(ref.current, "dark", { renderer: "canvas" });
    const onResize = () => chart.current?.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, true);
  }, [option]);

  return <div ref={ref} style={{ height, width: "100%" }} />;
}
