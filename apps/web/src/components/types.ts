import type { Edge, Node } from "@xyflow/react";

import type { trpcClient } from "@/utils/trpc";

export type UploadedSkillFile = {
  path: string;
  content: string;
};

export type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null;
};

export type SkillAnalysisResult = Awaited<ReturnType<typeof trpcClient.analyzeSkill.mutate>>;

export type ShowcaseRiskLevel = SkillAnalysisResult["safety_analysis"]["risk_level"];

export type ShowcaseResult = {
  skill_name: string;
  feature_analysis: {
    summary: string;
    outputs: string[];
    failure_modes: string[];
  };
  safety_analysis: {
    risk_level: ShowcaseRiskLevel;
    verdict: string;
    findings: string[];
    permission_scope: string[];
    trust_signals: string[];
  };
};

export type FeatureAnalysis = ShowcaseResult["feature_analysis"];

export type ExampleFlowNodeData = {
  label: string;
};

export type ExampleFlowEdgeData = {
  labelOffsetX?: number;
  labelOffsetY?: number;
  route?: "loop-back";
  lift?: number;
};

export type FlowExample = {
  id: string;
  title: string;
  description: string;
  output: string;
  preview: string;
  path: string[];
  tone?: "default" | "warning";
};

export type ExampleFlowNode = Node<ExampleFlowNodeData, "step" | "decision">;
export type ExampleFlowEdge = Edge<ExampleFlowEdgeData>;
