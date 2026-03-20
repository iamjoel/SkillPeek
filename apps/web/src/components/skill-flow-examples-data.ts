import type {
  ExampleFlowEdge,
  ExampleFlowNode,
  FeatureAnalysis,
  FlowExample,
} from "@/components/types";

export function buildFlowExamples(feature: FeatureAnalysis): FlowExample[] {
  return [
    {
      id: "full-loop",
      title: "完整闭环",
      description: shortenText("调研、归因和日报都接通时，进入持续优化。", 28),
      output: shortenText("生成排期、日报和下一轮 hooks", 24),
      preview: `今日结果
- 排期：07:30 / 16:30 / 21:00
- 日报：已生成
- 下一轮：3 个新 hooks`,
      path: [
        "profile",
        "browser",
        "research",
        "setup",
        "revenue",
        "attribution",
        "strategy",
        "report",
        "iterate",
        "strategy",
        "report",
        "iterate",
        "output",
      ],
    },
    {
      id: "manual-research",
      title: "手动补充",
      description: shortenText("没有浏览器权限时，先用人工信息继续搭建。", 28),
      output: shortenText("输出基础排期与补充清单", 24),
      preview: `当前结果
- 已生成基础排期
- 待补充：竞品账号
- 建议：补做浏览器调研`,
      path: [
        "profile",
        "browser",
        "manual",
        "setup",
        "revenue",
        "views",
        "strategy",
        "report",
        "iterate",
        "output",
      ],
      tone: "warning",
    },
    {
      id: "views-only",
      title: "仅看曝光",
      description: shortenText("未接入 RevenueCat 时，只按播放和互动优化。", 28),
      output: shortenText("输出基于曝光的优化建议", 24),
      preview: `日报结论
- 高播放低转化：检查 CTA
- 低播放高收藏：换开头 hook`,
      path: [
        "profile",
        "browser",
        "research",
        "setup",
        "revenue",
        "views",
        "strategy",
        "report",
        "iterate",
        "output",
      ],
    },
  ];
}

export function createExampleFlow(example: FlowExample): {
  nodes: ExampleFlowNode[];
  edges: ExampleFlowEdge[];
} {
  const activeNodeIds = new Set(example.path);
  const activeEdges = new Set(
    example.path
      .slice(0, -1)
      .map((nodeId, index, path) => `${nodeId}->${path[index + 1]}`),
  );

  const nodes: ExampleFlowNode[] = getSharedFlowNodes().map((node) => ({
    ...node,
    draggable: false,
    selectable: false,
    style: {
      ...(node.style ?? {}),
      border: activeNodeIds.has(node.id)
        ? "1px solid rgba(16,185,129,0.62)"
        : "1px solid rgba(203,213,225,0.95)",
      background: activeNodeIds.has(node.id)
        ? "rgba(236,253,245,0.98)"
        : "rgba(255,255,255,0.98)",
      color: "#334155",
      textAlign: "center",
    },
  }));

  const edges: ExampleFlowEdge[] = getSharedFlowEdges().map((edge) => {
    const edgeKey = `${edge.source}->${edge.target}`;
    const isActive = activeEdges.has(edgeKey);

    return {
      ...edge,
      animated: isActive,
      markerEnd: {
        type: "arrowclosed",
        color: isActive ? "rgba(14,165,233,0.82)" : "rgba(148,163,184,0.62)",
        width: 16,
        height: 16,
      },
      style: {
        ...(edge.style ?? {}),
        stroke: isActive ? "rgba(14,165,233,0.82)" : "rgba(148,163,184,0.62)",
        strokeWidth: isActive ? 2.2 : 1.4,
      },
    };
  });

  return { nodes, edges };
}

function getSharedFlowNodes(): ExampleFlowNode[] {
  return [
    { id: "profile", type: "step", position: { x: 0, y: 112 }, data: { label: "账号 / 产品" } },
    { id: "browser", type: "decision", position: { x: 124, y: 88 }, data: { label: "允许调研" } },
    { id: "research", type: "step", position: { x: 270, y: 20 }, data: { label: "竞品研究" } },
    { id: "manual", type: "step", position: { x: 270, y: 204 }, data: { label: "手动补充" } },
    { id: "setup", type: "step", position: { x: 432, y: 112 }, data: { label: "图像 / Postiz" } },
    { id: "revenue", type: "decision", position: { x: 560, y: 88 }, data: { label: "接入收入" } },
    { id: "attribution", type: "step", position: { x: 706, y: 20 }, data: { label: "收入归因" } },
    { id: "views", type: "step", position: { x: 706, y: 204 }, data: { label: "仅看曝光" } },
    { id: "strategy", type: "step", position: { x: 870, y: 112 }, data: { label: "生成并排期" } },
    { id: "report", type: "step", position: { x: 1014, y: 112 }, data: { label: "日报复盘" } },
    { id: "iterate", type: "decision", position: { x: 1146, y: 88 }, data: { label: "继续优化" } },
    { id: "output", type: "step", position: { x: 1292, y: 112 }, data: { label: "输出结果" } },
  ];
}

function getSharedFlowEdges(): ExampleFlowEdge[] {
  return [
    { id: "profile-browser", source: "profile", target: "browser", type: "smoothstep" },
    {
      id: "browser-research",
      source: "browser",
      sourceHandle: "branch-top",
      target: "research",
      type: "annotated",
      label: "允许",
      data: { labelOffsetX: -8, labelOffsetY: -18 },
    },
    {
      id: "browser-manual",
      source: "browser",
      sourceHandle: "branch-mid",
      target: "manual",
      type: "annotated",
      label: "手动",
      data: { labelOffsetX: -10, labelOffsetY: 18 },
    },
    { id: "research-setup", source: "research", target: "setup", type: "smoothstep" },
    { id: "manual-setup", source: "manual", target: "setup", type: "smoothstep" },
    { id: "setup-revenue", source: "setup", target: "revenue", type: "smoothstep" },
    {
      id: "revenue-attribution",
      source: "revenue",
      sourceHandle: "branch-top",
      target: "attribution",
      type: "annotated",
      label: "已接入",
      data: { labelOffsetX: -6, labelOffsetY: -18 },
    },
    {
      id: "revenue-views",
      source: "revenue",
      sourceHandle: "branch-mid",
      target: "views",
      type: "annotated",
      label: "未接入",
      data: { labelOffsetX: -8, labelOffsetY: 18 },
    },
    { id: "attribution-strategy", source: "attribution", target: "strategy", type: "smoothstep" },
    { id: "views-strategy", source: "views", target: "strategy", type: "smoothstep" },
    { id: "strategy-report", source: "strategy", target: "report", type: "smoothstep" },
    { id: "report-iterate", source: "report", target: "iterate", type: "smoothstep" },
    {
      id: "iterate-strategy",
      source: "iterate",
      sourceHandle: "branch-top",
      target: "strategy",
      type: "annotated",
      label: "继续",
      data: { route: "loop-back", lift: 84, labelOffsetY: -12 },
    },
    {
      id: "iterate-output",
      source: "iterate",
      sourceHandle: "branch-mid",
      target: "output",
      type: "annotated",
      label: "收敛",
      data: { labelOffsetX: -8, labelOffsetY: 18 },
    },
  ];
}

function shortenText(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1)}…`;
}
