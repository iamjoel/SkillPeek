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
      <div className="rounded-[24px] border border-dashed border-[rgba(115,87,61,0.16)] bg-[rgba(255,252,248,0.82)] px-4 py-6 text-sm leading-6 text-[rgba(94,75,60,0.76)]">
        {error}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="rounded-[24px] border border-[rgba(115,87,61,0.14)] bg-[rgba(255,252,248,0.82)] px-4 py-6 text-sm leading-6 text-[rgba(94,75,60,0.76)]">
        正在生成审查流程图…
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[24px] border border-[rgba(115,87,61,0.14)] bg-[linear-gradient(180deg,rgba(255,253,250,0.94),rgba(248,243,235,0.94))] px-3 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] md:px-4">
      <div
        className="mermaid-preview"
        data-size="inline"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
