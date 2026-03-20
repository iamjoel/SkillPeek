import { cn } from "@my-better-t-app/ui/lib/utils";
import { ChevronRight, Shield, Workflow } from "lucide-react";
import { useState } from "react";

import type { FeatureAnalysis, ShowcaseResult } from "@/components/types";

import { buildFlowExamples } from "./skill-flow-examples-data";
import { FlowExamplesSection } from "./skill-flow-examples";
import { SafetyModal, riskLevelLabels } from "./skill-safety-dialog";

export function FeatureTab({ result }: { result: ShowcaseResult }) {
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const examples = buildFlowExamples(result.feature_analysis);

  return (
    <section className="grid gap-4 rounded-[30px] border border-slate-200/75 bg-white/94 px-5 py-4 text-slate-900 shadow-[0_18px_50px_rgba(148,163,184,0.14)] md:px-6 md:py-4">
      <ResultHeader
        skillName={result.skill_name}
        feature={result.feature_analysis}
        riskLevel={result.safety_analysis.risk_level}
        onOpenSafety={() => {
          setShowSafetyModal(true);
        }}
      />

      <div className="grid gap-3 border-t border-slate-200/75 pt-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <Workflow className="size-4 text-sky-600" />
          流程示例
        </div>
        <FlowExamplesSection examples={examples} />
      </div>

      {showSafetyModal ? (
        <SafetyModal
          skillName={result.skill_name}
          safety={result.safety_analysis}
          onClose={() => {
            setShowSafetyModal(false);
          }}
        />
      ) : null}
    </section>
  );
}

function ResultHeader({
  skillName,
  feature,
  riskLevel,
  onOpenSafety,
}: {
  skillName: string;
  feature: FeatureAnalysis;
  riskLevel: ShowcaseResult["safety_analysis"]["risk_level"];
  onOpenSafety: () => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1.5">
          <h2 className="text-[2rem] font-semibold tracking-[-0.045em] md:text-[2.4rem] md:leading-none">
            {skillName}
          </h2>
          <p className="max-w-3xl text-[15px] leading-6 text-slate-600">{feature.summary}</p>
        </div>
        <button
          type="button"
          className={cn(
            "group inline-flex items-center gap-2 rounded-full border pl-3.5 pr-2 py-1.5 text-sm font-medium transition-colors",
            getRiskTone(riskLevel),
          )}
          aria-label={`查看${riskLevelLabels[riskLevel]}详情`}
          onClick={onOpenSafety}
        >
          <Shield className="size-3.5" />
          <span className="text-sm font-semibold">{riskLevelLabels[riskLevel]}</span>
          <ChevronRight className="size-4 opacity-55 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-80" />
        </button>
      </div>
    </div>
  );
}

function getRiskTone(riskLevel: ShowcaseResult["safety_analysis"]["risk_level"]) {
  switch (riskLevel) {
    case "unsafe":
      return "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100";
    case "caution":
      return "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100";
    default:
      return "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100";
  }
}
