import { cn } from "@my-better-t-app/ui/lib/utils";
import { useEffect, useId } from "react";
import { X } from "lucide-react";

import type { ShowcaseRiskLevel, ShowcaseSafetyAnalysis } from "@/components/types";

import { MermaidPreview } from "./skill-mermaid-preview";

export const riskLevelLabels: Record<ShowcaseRiskLevel, string> = {
  safe: "可查看",
  caution: "需复核",
  unsafe: "建议阻断",
};

const safetyDecisionTitles: Record<ShowcaseRiskLevel, string> = {
  safe: "可继续查看",
  caution: "建议人工复核",
  unsafe: "建议阻断",
};

const safetyDecisionDescriptions: Record<ShowcaseRiskLevel, string> = {
  safe: "当前材料里没有发现明显恶意或越权迹象，仍建议结合实际权限边界继续确认。",
  caution: "能力边界或证据仍有不确定性，适合在隔离环境或人工复核后再继续使用。",
  unsafe: "当前材料里出现了明显风险信号，不适合按正常流程继续信任或执行。",
};

const safetyToneStyles: Record<
  ShowcaseRiskLevel,
  {
    badge: string;
    hero: string;
    accent: string;
  }
> = {
  safe: {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100",
    hero: "border-emerald-200/80 bg-[linear-gradient(135deg,rgba(236,253,245,0.96),rgba(255,255,255,0.96))]",
    accent: "text-emerald-700",
  },
  caution: {
    badge: "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100",
    hero: "border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,247,237,0.96),rgba(255,255,255,0.96))]",
    accent: "text-amber-700",
  },
  unsafe: {
    badge: "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100",
    hero: "border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,241,242,0.96),rgba(255,255,255,0.96))]",
    accent: "text-rose-700",
  },
};

const safetyCardStyles = {
  danger: "border-rose-200/80 bg-[linear-gradient(180deg,rgba(255,241,242,0.98),rgba(255,255,255,0.98))]",
  warning: "border-amber-200/80 bg-[linear-gradient(180deg,rgba(255,247,237,0.98),rgba(255,255,255,0.98))]",
  success: "border-emerald-200/80 bg-[linear-gradient(180deg,rgba(236,253,245,0.98),rgba(255,255,255,0.98))]",
  neutral: "border-slate-200/90 bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(255,255,255,0.98))]",
} as const;

export function SafetyModal({
  skillName,
  safety,
  onClose,
}: {
  skillName: string;
  safety: ShowcaseSafetyAnalysis;
  onClose: () => void;
}) {
  const titleId = useId();
  const tone = safetyToneStyles[safety.risk_level];
  const decisionTitle = safetyDecisionTitles[safety.risk_level];
  const decisionDescription = safetyDecisionDescriptions[safety.risk_level];
  const hasExplicitRisk = safety.red_flags.length > 0 || safety.is_malicious_or_unsafe;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/18 px-3 py-4 backdrop-blur-sm md:px-6 md:py-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mx-auto flex max-h-[88vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-[32px] border border-slate-200/90 bg-white text-slate-900 shadow-[0_30px_120px_rgba(15,23,42,0.18)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 border-b border-slate-200/80 bg-white/96 backdrop-blur">
          <div className="flex items-start justify-between gap-4 px-5 py-5 md:px-6">
            <div className="grid flex-1 gap-4">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.12em] uppercase",
                    tone.badge,
                  )}
                >
                  {riskLevelLabels[safety.risk_level]}
                </span>
                <span className="text-xs font-medium tracking-[0.16em] text-slate-400">
                  Security Review
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
                  {skillName}
                </span>
              </div>

              <div
                className={cn(
                  "grid gap-3 rounded-[24px] border px-4 py-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.35)] md:px-5",
                  tone.hero,
                )}
              >
                <div className="grid gap-1">
                  <div className={cn("text-sm font-semibold tracking-[0.12em] uppercase", tone.accent)}>
                    {decisionTitle}
                  </div>
                  <h3
                    id={titleId}
                    className="max-w-4xl text-2xl font-semibold tracking-[-0.04em] text-slate-950 md:text-[2rem]"
                  >
                    {safety.verdict || decisionDescription}
                  </h3>
                </div>

                <div className="grid gap-2 text-sm leading-6 text-slate-600 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                  <p className="max-w-3xl">
                    {hasExplicitRisk
                      ? "当前审查里出现了需要优先关注的风险证据，建议先理解原因和边界，再决定是否继续使用。"
                      : decisionDescription}
                  </p>
                  <div className="rounded-2xl border border-white/70 bg-white/72 px-4 py-3 text-sm text-slate-700 shadow-[0_14px_40px_rgba(148,163,184,0.16)]">
                    {safety.is_malicious_or_unsafe
                      ? "检测到明显不安全或恶意迹象"
                      : "未直接判定为恶意，但仍需结合权限边界判断"}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900"
              onClick={onClose}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 pb-5 pt-5 md:px-6 md:pb-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)]">
            <div className="grid gap-5">
              <SafetyListSection
                eyebrow="High Priority"
                title="红旗风险"
                items={safety.red_flags}
                emptyText="当前材料里没有识别到明确的高风险红旗。"
                tone="danger"
              />
              <SafetyListSection
                eyebrow="Evidence"
                title="主要发现"
                items={safety.findings}
                emptyText="当前材料里没有补充的一般性风险发现。"
                tone="warning"
              />
              <SafetyListSection
                eyebrow="Notes"
                title="补充说明"
                items={safety.notes}
                emptyText="当前没有额外补充说明。"
                tone="neutral"
              />
            </div>

            <div className="grid gap-5">
              <SafetyTagSection
                eyebrow="Capabilities"
                title="权限范围"
                items={safety.permission_scope}
                emptyText="当前没有识别到需要特别说明的权限范围。"
              />
              <SafetyListSection
                eyebrow="Guardrails"
                title="限制能力"
                items={safety.blocked_capabilities}
                emptyText="当前没有额外标记需阻断的能力。"
                tone="danger"
              />
              <SafetyListSection
                eyebrow="Signals"
                title="可信信号"
                items={safety.trust_signals}
                emptyText="当前没有明显的可信信号。"
                tone="success"
              />
              <SafetyListSection
                eyebrow="Metadata"
                title="元数据审查"
                items={safety.metadata_review}
                emptyText="当前没有可展示的元数据审查结论。"
                tone="neutral"
              />
            </div>
          </div>

          <div className="mt-5">
            <SafetyDiagramSection chart={safety.mermaid} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SafetyListSection({
  eyebrow,
  title,
  items,
  emptyText,
  tone,
}: {
  eyebrow: string;
  title: string;
  items: string[];
  emptyText: string;
  tone: keyof typeof safetyCardStyles;
}) {
  return (
    <section
      className={cn(
        "grid gap-3 rounded-[24px] border px-4 py-4 shadow-[0_18px_40px_rgba(148,163,184,0.12)] md:px-5",
        safetyCardStyles[tone],
      )}
    >
      <div className="grid gap-1">
        <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
          {eyebrow}
        </div>
        <div className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{title}</div>
      </div>

      {items.length > 0 ? (
        <ul className="grid gap-2.5">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-2xl border border-white/75 bg-white/80 px-4 py-3 text-sm leading-6 text-slate-700 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.28)]"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-3 text-sm leading-6 text-slate-500">
          {emptyText}
        </div>
      )}
    </section>
  );
}

function SafetyTagSection({
  eyebrow,
  title,
  items,
  emptyText,
}: {
  eyebrow: string;
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <section
      className={cn(
        "grid gap-3 rounded-[24px] border px-4 py-4 shadow-[0_18px_40px_rgba(148,163,184,0.12)] md:px-5",
        safetyCardStyles.warning,
      )}
    >
      <div className="grid gap-1">
        <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
          {eyebrow}
        </div>
        <div className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{title}</div>
      </div>

      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span
              key={item}
              className="rounded-full border border-amber-200/80 bg-white/86 px-3.5 py-2 text-sm text-slate-700 shadow-[0_10px_28px_rgba(251,146,60,0.08)]"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-3 text-sm leading-6 text-slate-500">
          {emptyText}
        </div>
      )}
    </section>
  );
}

function SafetyDiagramSection({ chart }: { chart: string }) {
  return (
    <section
      className={cn(
        "grid gap-4 rounded-[24px] border px-4 py-4 shadow-[0_18px_40px_rgba(148,163,184,0.12)] md:px-5",
        safetyCardStyles.neutral,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid gap-1">
          <div className="text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
            Review Flow
          </div>
          <div className="text-lg font-semibold tracking-[-0.03em] text-slate-950">审查流程</div>
        </div>
        <div className="text-sm text-slate-500">模型产出的安全判断路径</div>
      </div>

      <MermaidPreview chart={chart} />
    </section>
  );
}
