import mermaid from "mermaid";
import { useEffect, useId, useState } from "react";

let hasInitializedMermaid = false;

export function MermaidPreview({ chart }: { chart: string }) {
  const renderId = useId().replace(/:/g, "-");
  const [svg, setSvg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function renderChart() {
      if (!chart.trim()) {
        setSvg("");
        setError("暂无流程图数据。");
        return;
      }

      try {
        if (!hasInitializedMermaid) {
          mermaid.initialize({
            startOnLoad: false,
            securityLevel: "strict",
            theme: "neutral",
            fontFamily: "IBM Plex Sans, sans-serif",
          });
          hasInitializedMermaid = true;
        }

        const { svg: rendered } = await mermaid.render(`safety-${renderId}`, chart);
        if (cancelled) {
          return;
        }

        setSvg(rendered);
        setError("");
      } catch {
        if (cancelled) {
          return;
        }

        setSvg("");
        setError("流程图暂时无法渲染，请先查看上面的结构化审查结果。");
      }
    }

    void renderChart();

    return () => {
      cancelled = true;
    };
  }, [chart, renderId]);

  if (error) {
    return (
      <div className="rounded-[22px] border border-dashed border-slate-200 bg-white/75 px-4 py-6 text-sm leading-6 text-slate-500">
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="rounded-[22px] border border-slate-200 bg-white/75 px-4 py-6 text-sm leading-6 text-slate-500">
        正在生成审查流程图…
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[22px] border border-slate-200 bg-slate-950 px-3 py-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] md:px-4">
      <div
        className="mermaid-preview"
        data-size="inline"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
