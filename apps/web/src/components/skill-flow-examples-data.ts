import type {
  ExampleFlowEdge,
  ExampleFlowNode,
  FeatureAnalysis,
  FlowExample,
} from "@/components/types";

function shortenText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}

export function buildFlowExamples(feature: FeatureAnalysis): FlowExample[] {
  return feature.ui_examples
    .map((example, index) => ({
      id: example.id || `scenario-${index + 1}`,
      title: shortenText(example.title, 18),
      description: shortenText(example.description, 28),
      output: shortenText(example.output, 24),
      preview: example.preview,
      steps: example.steps.slice(0, 8),
      tone: example.tone,
    }))
    .filter((example) => example.steps.length >= 3);
}

export function createExampleFlow(example: FlowExample): {
  nodes: ExampleFlowNode[];
  edges: ExampleFlowEdge[];
} {
  const accent =
    example.tone === "warning"
      ? {
          stroke: "rgba(217,119,6,0.78)",
          border: "1px solid rgba(245,158,11,0.52)",
          background: "rgba(255,251,235,0.98)",
        }
      : {
          stroke: "rgba(14,165,233,0.82)",
          border: "1px solid rgba(56,189,248,0.48)",
          background: "rgba(240,249,255,0.98)",
        };

  const nodes: ExampleFlowNode[] = example.steps.map((step, index) => {
    const isDecision = step.kind === "decision";

    return {
      id: `${example.id}-${index}`,
      type: isDecision ? "decision" : "step",
      position: {
        x: index * 184,
        y: isDecision ? 88 : 112,
      },
      data: {
        label: step.label,
      },
      draggable: false,
      selectable: false,
      style: {
        border: accent.border,
        background: accent.background,
        color: "#334155",
        textAlign: "center",
      },
    };
  });

  const edges: ExampleFlowEdge[] = example.steps.slice(0, -1).map((_, index) => ({
    id: `${example.id}-edge-${index}`,
    source: `${example.id}-${index}`,
    target: `${example.id}-${index + 1}`,
    type: "smoothstep",
    animated: true,
    markerEnd: {
      type: "arrowclosed",
      color: accent.stroke,
      width: 16,
      height: 16,
    },
    style: {
      stroke: accent.stroke,
      strokeWidth: 2.1,
    },
  }));

  return { nodes, edges };
}
