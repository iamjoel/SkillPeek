import { cn } from "@my-better-t-app/ui/lib/utils";
import {
  ArrowDownRight,
  LockKeyhole,
  ScrollText,
  ShieldAlert,
  Sparkles,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useId, type ReactNode } from "react";

import type { ShowcaseRiskLevel, ShowcaseSafetyAnalysis } from "@/components/types";

import { MermaidPreview } from "./skill-mermaid-preview";

export const riskLevelLabels: Record<ShowcaseRiskLevel, string> = {
  safe: "可查看",
  caution: "需复核",
  unsafe: "建议阻断",
};

const riskDecisionLabels: Record<ShowcaseRiskLevel, string> = {
  safe: "可以继续了解这个 Skill",
  caution: "先复核，再决定是否继续",
  unsafe: "当前不适合继续信任",
};

const safetyToneStyles: Record<
  ShowcaseRiskLevel,
  {
    badge: string;
    badgeDot: string;
    accent: string;
    accentSoft: string;
    accentMuted: string;
    heroSurface: string;
    surface: string;
    border: string;
    rule: string;
    dangerSurface: string;
    textAccent: string;
    appendixSurface: string;
  }
> = {
  safe: {
    badge: "border-[rgba(96,129,103,0.28)] bg-[rgba(232,241,231,0.84)] text-[rgb(54,82,60)]",
    badgeDot: "bg-[rgb(88,123,96)]",
    accent: "text-[rgb(50,79,56)]",
    accentSoft: "bg-[rgba(236,244,235,0.82)]",
    accentMuted: "text-[rgba(64,92,69,0.72)]",
    heroSurface:
      "bg-[radial-gradient(circle_at_top_right,rgba(132,168,138,0.18),transparent_34%),linear-gradient(180deg,rgba(251,249,244,0.98),rgba(246,249,244,0.98))]",
    surface: "bg-[rgba(252,250,245,0.98)]",
    border: "border-[rgba(96,129,103,0.2)]",
    rule: "border-[rgba(96,129,103,0.16)]",
    dangerSurface: "bg-[rgba(247,243,240,0.88)]",
    textAccent: "text-[rgb(62,91,68)]",
    appendixSurface: "bg-[rgba(247,246,242,0.88)]",
  },
  caution: {
    badge: "border-[rgba(164,119,61,0.28)] bg-[rgba(253,243,221,0.88)] text-[rgb(121,79,28)]",
    badgeDot: "bg-[rgb(181,122,43)]",
    accent: "text-[rgb(116,77,33)]",
    accentSoft: "bg-[rgba(253,245,232,0.88)]",
    accentMuted: "text-[rgba(126,88,42,0.74)]",
    heroSurface:
      "bg-[radial-gradient(circle_at_top_right,rgba(220,164,77,0.18),transparent_34%),linear-gradient(180deg,rgba(255,250,241,0.98),rgba(252,246,236,0.98))]",
    surface: "bg-[rgba(255,251,246,0.98)]",
    border: "border-[rgba(168,121,58,0.2)]",
    rule: "border-[rgba(168,121,58,0.16)]",
    dangerSurface: "bg-[rgba(255,244,236,0.88)]",
    textAccent: "text-[rgb(126,86,39)]",
    appendixSurface: "bg-[rgba(250,246,240,0.9)]",
  },
  unsafe: {
    badge: "border-[rgba(145,80,86,0.28)] bg-[rgba(250,232,230,0.88)] text-[rgb(122,53,62)]",
    badgeDot: "bg-[rgb(150,63,75)]",
    accent: "text-[rgb(117,48,57)]",
    accentSoft: "bg-[rgba(253,240,238,0.9)]",
    accentMuted: "text-[rgba(126,58,67,0.74)]",
    heroSurface:
      "bg-[radial-gradient(circle_at_top_right,rgba(177,89,89,0.18),transparent_34%),linear-gradient(180deg,rgba(255,249,247,0.98),rgba(251,242,239,0.98))]",
    surface: "bg-[rgba(255,251,249,0.98)]",
    border: "border-[rgba(145,80,86,0.2)]",
    rule: "border-[rgba(145,80,86,0.16)]",
    dangerSurface: "bg-[rgba(255,238,236,0.92)]",
    textAccent: "text-[rgb(130,58,67)]",
    appendixSurface: "bg-[rgba(249,242,240,0.92)]",
  },
};

type SectionTarget = "evidence" | "boundary" | "trust" | "appendix";

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
  const headline = safety.verdict || riskDecisionLabels[safety.risk_level];
  const summary = buildPrimarySummary(safety);
  const nextStep = buildNextStep(safety);
  const sectionIds = {
    evidence: `${titleId}-evidence`,
    boundary: `${titleId}-boundary`,
    trust: `${titleId}-trust`,
    appendix: `${titleId}-appendix`,
  } satisfies Record<SectionTarget, string>;

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

  const jumpTo = (target: SectionTarget) => {
    document.getElementById(sectionIds[target])?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[rgba(53,38,28,0.26)] px-3 py-4 backdrop-blur-[8px] motion-safe:animate-in motion-safe:fade-in-0 md:px-6 md:py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative mx-auto flex max-h-[88vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[28px] border text-slate-900 shadow-[0_36px_120px_rgba(61,39,26,0.22)] motion-safe:animate-in motion-safe:zoom-in-[0.98] motion-safe:slide-in-from-bottom-4 duration-300",
          tone.border,
          tone.surface,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative flex-1 overflow-y-auto">
          <header className={cn("border-b px-5 pb-7 pt-5 md:px-8 md:pb-8 md:pt-6", tone.rule, tone.heroSurface)}>
            <div className="grid gap-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-2.5 text-[11px] tracking-[0.2em] text-[rgba(89,71,57,0.66)] uppercase">
                  <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-semibold", tone.badge)}>
                    <span className={cn("size-1.5 rounded-full", tone.badgeDot)} />
                    {riskLevelLabels[safety.risk_level]}
                  </span>
                  <span>Skill Safety Brief</span>
                  <span className="rounded-full border border-[rgba(101,80,63,0.12)] bg-[rgba(255,255,255,0.66)] px-3 py-1.5 tracking-[0.14em] text-[rgba(89,71,57,0.72)]">
                    {skillName}
                  </span>
                </div>

                <button
                  type="button"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[rgba(101,80,63,0.14)] bg-[rgba(255,255,255,0.78)] text-[rgba(72,55,44,0.72)] transition-colors hover:border-[rgba(101,80,63,0.24)] hover:text-[rgb(40,30,24)]"
                  onClick={onClose}
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="grid gap-4 md:max-w-[70ch]">
                <div className={cn("text-sm font-semibold tracking-[0.18em] uppercase", tone.accentMuted)}>
                  安全判断
                </div>
                <h2
                  id={titleId}
                  className="text-[clamp(2rem,4vw,3.55rem)] leading-[0.92] tracking-[-0.06em] text-[rgb(34,27,22)]"
                  style={{ fontFamily: "var(--font-editorial)" }}
                >
                  {headline}
                </h2>
                <p className="max-w-[62ch] text-[16px] leading-8 text-[rgba(74,58,46,0.84)]">{summary}</p>
              </div>

              <div className={cn("grid gap-2.5 border-l-2 pl-4 md:max-w-[40rem]", tone.rule)}>
                <div className={cn("text-[11px] font-semibold tracking-[0.18em] uppercase", tone.accentMuted)}>
                  下一步
                </div>
                <div className="flex items-start gap-3">
                  <span className={cn("mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full", tone.accentSoft)}>
                    <ArrowDownRight className={cn("size-4", tone.accent)} />
                  </span>
                  <div className="grid gap-1.5">
                    <div className="text-lg font-semibold tracking-[-0.03em] text-[rgb(42,32,25)]">{nextStep.title}</div>
                    <p className="text-sm leading-6 text-[rgba(74,58,46,0.76)]">{nextStep.description}</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className={cn("sticky top-0 z-10 border-b backdrop-blur-xl", tone.rule, "bg-[rgba(252,248,242,0.88)]")}>
            <div className="flex items-center gap-3 px-4 py-2.5 md:px-8">
              <span className={cn("inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-[0.16em] uppercase", tone.badge)}>
                <span className={cn("size-1.5 rounded-full", tone.badgeDot)} />
                {riskLevelLabels[safety.risk_level]}
              </span>
              <div className="-mx-1 flex min-w-0 flex-1 items-center gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <SectionNavButton label="风险线索" onClick={() => jumpTo("evidence")} />
                <SectionNavButton label="能力边界" onClick={() => jumpTo("boundary")} />
                <SectionNavButton label="可信依据" onClick={() => jumpTo("trust")} />
                <SectionNavButton label="附录" onClick={() => jumpTo("appendix")} />
              </div>
            </div>
          </div>

          <div className="px-5 pb-8 pt-8 md:px-8 md:pb-10 md:pt-10">
            <div className="grid gap-12 md:gap-14">
              <div id={sectionIds.evidence} className="scroll-mt-28">
                <ReportSection
                  eyebrow="Read this first"
                  title={safety.red_flags.length > 0 ? "风险线索" : "主要发现"}
                  lead={buildEvidenceLead(safety)}
                  accent={tone.textAccent}
                >
                  <FactsStrip safety={safety} />
                  <PrimaryEvidenceSection safety={safety} tone={tone} />
                </ReportSection>
              </div>

              <div id={sectionIds.boundary} className="scroll-mt-28">
                <ReportSection
                  eyebrow="Boundary"
                  title="能力边界"
                  lead={buildBoundaryLead(safety)}
                  accent={tone.textAccent}
                >
                  <BoundarySection safety={safety} tone={tone} />
                </ReportSection>
              </div>

              <div id={sectionIds.trust} className="scroll-mt-28">
                <ReportSection
                  eyebrow="Trust"
                  title="可信依据"
                  lead={buildTrustLead(safety)}
                  accent={tone.textAccent}
                >
                  <TrustSection safety={safety} tone={tone} />
                </ReportSection>
              </div>

              <div id={sectionIds.appendix} className="scroll-mt-28">
                <ReportSection
                  eyebrow="Appendix"
                  title="审查附录"
                  lead="把补充说明和模型整理出的审查路径放在最后，需要时再展开查看。"
                  accent={tone.textAccent}
                >
                  <AppendixSection safety={safety} tone={tone} />
                </ReportSection>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetaFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2">
      <span className="text-[rgba(89,71,57,0.58)]">{label}</span>
      <span className="font-medium text-[rgba(47,37,30,0.9)]">{value}</span>
    </div>
  );
}

function SectionNavButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="whitespace-nowrap rounded-full border border-[rgba(101,80,63,0.1)] bg-[rgba(255,255,255,0.56)] px-2.5 py-1 text-[11px] font-medium text-[rgba(72,55,44,0.8)] transition-colors hover:border-[rgba(101,80,63,0.2)] hover:bg-[rgba(255,255,255,0.84)]"
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function ReportSection({
  eyebrow,
  title,
  lead,
  accent,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  accent: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-6 border-t border-[rgba(101,80,63,0.12)] pt-8 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-10 md:pt-10">
      <div className="grid content-start gap-2">
        <div className="hidden text-[11px] font-semibold tracking-[0.2em] text-[rgba(89,71,57,0.56)] uppercase md:block">{eyebrow}</div>
        <h3
          className={cn("text-[clamp(1.55rem,2vw,2.15rem)] leading-[0.96] tracking-[-0.045em]", accent)}
          style={{ fontFamily: "var(--font-editorial)" }}
        >
          {title}
        </h3>
        <p className="max-w-[26ch] text-sm leading-6 text-[rgba(74,58,46,0.72)] md:block hidden">{lead}</p>
      </div>

      <div className="grid gap-6">{children}</div>
    </section>
  );
}

function FactsStrip({ safety }: { safety: ShowcaseSafetyAnalysis }) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 border-b border-[rgba(101,80,63,0.1)] pb-4 text-sm text-[rgba(74,58,46,0.74)]">
      <MetaFact label="恶意迹象" value={safety.is_malicious_or_unsafe ? "已识别" : "未直接判定"} />
      <MetaFact label="风险线索" value={formatCount(safety.red_flags.length + safety.findings.length, "条", "暂无")} />
      <MetaFact label="能力边界" value={formatCount(safety.permission_scope.length + safety.blocked_capabilities.length, "项", "待补充")} />
      <MetaFact label="可信依据" value={formatCount(safety.trust_signals.length + safety.metadata_review.length, "条", "偏少")} />
    </div>
  );
}

function PrimaryEvidenceSection({
  safety,
  tone,
}: {
  safety: ShowcaseSafetyAnalysis;
  tone: (typeof safetyToneStyles)[ShowcaseRiskLevel];
}) {
  return (
    <div className="grid gap-7">
      <Subsection
        icon={ShieldAlert}
        title="红旗风险"
        tone={tone}
        emphasis
        emptyText="这一轮没有识别出明确的高危红旗，判断更多来自边界清晰度和材料完整性。"
      >
        {safety.red_flags.length > 0 ? (
          <ol className="grid gap-3">
            {safety.red_flags.map((item, index) => (
              <li
                key={item}
                className={cn(
                  "grid grid-cols-[2rem_minmax(0,1fr)] gap-4 border-b pb-4 last:border-b-0 last:pb-0",
                  tone.rule,
                )}
              >
                <div className={cn("flex size-8 items-center justify-center rounded-full text-sm font-semibold", tone.accentSoft, tone.accent)}>
                  {index + 1}
                </div>
                <div className="pt-0.5 text-[15px] leading-7 text-[rgba(55,38,31,0.88)]">{item}</div>
              </li>
            ))}
          </ol>
        ) : null}
      </Subsection>

      <Subsection
        icon={TriangleAlert}
        title="主要发现"
        tone={tone}
        emptyText="当前没有额外的一般性风险发现。"
      >
        {safety.findings.length > 0 ? (
          <ul className="grid gap-3">
            {safety.findings.map((item) => (
              <li key={item} className="border-l border-[rgba(145,111,67,0.28)] pl-4 text-[15px] leading-7 text-[rgba(74,58,46,0.82)]">
                {item}
              </li>
            ))}
          </ul>
        ) : null}
      </Subsection>
    </div>
  );
}

function BoundarySection({
  safety,
  tone,
}: {
  safety: ShowcaseSafetyAnalysis;
  tone: (typeof safetyToneStyles)[ShowcaseRiskLevel];
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-10">
      <Subsection
        icon={LockKeyhole}
        title="权限范围"
        tone={tone}
        emptyText="当前材料没有把权限边界写得足够清楚。"
      >
        {safety.permission_scope.length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {safety.permission_scope.map((item) => (
              <span
                key={item}
                className={cn("inline-flex max-w-full items-center rounded-full border px-3.5 py-2 text-sm leading-6", tone.badge)}
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </Subsection>

      <Subsection
        icon={ShieldAlert}
        title="限制能力"
        tone={tone}
        emphasis
        emptyText="当前没有额外列出需要单独阻断的能力。"
      >
        {safety.blocked_capabilities.length > 0 ? (
          <ul className="grid gap-3">
            {safety.blocked_capabilities.map((item) => (
              <li key={item} className={cn("rounded-[18px] px-4 py-3 text-sm leading-6 text-[rgba(73,45,41,0.84)]", tone.dangerSurface)}>
                {item}
              </li>
            ))}
          </ul>
        ) : null}
      </Subsection>
    </div>
  );
}

function TrustSection({
  safety,
  tone,
}: {
  safety: ShowcaseSafetyAnalysis;
  tone: (typeof safetyToneStyles)[ShowcaseRiskLevel];
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-10">
      <Subsection
        icon={Sparkles}
        title="可信信号"
        tone={tone}
        subtle
        emptyText="当前材料里还没有明显的可信佐证。"
      >
        {safety.trust_signals.length > 0 ? (
          <ul className="grid gap-3">
            {safety.trust_signals.map((item) => (
              <li key={item} className="border-b border-[rgba(101,80,63,0.1)] pb-3 text-sm leading-6 text-[rgba(74,58,46,0.8)] last:border-b-0 last:pb-0">
                {item}
              </li>
            ))}
          </ul>
        ) : null}
      </Subsection>

      <Subsection
        icon={ScrollText}
        title="元数据审查"
        tone={tone}
        subtle
        emptyText="当前没有可展示的元数据审查结论。"
      >
        {safety.metadata_review.length > 0 ? (
          <ul className="grid gap-3">
            {safety.metadata_review.map((item) => (
              <li key={item} className="border-b border-[rgba(101,80,63,0.1)] pb-3 text-sm leading-6 text-[rgba(74,58,46,0.8)] last:border-b-0 last:pb-0">
                {item}
              </li>
            ))}
          </ul>
        ) : null}
      </Subsection>
    </div>
  );
}

function Subsection({
  icon: Icon,
  title,
  tone,
  children,
  emptyText,
  emphasis = false,
  subtle = false,
}: {
  icon: LucideIcon;
  title: string;
  tone: (typeof safetyToneStyles)[ShowcaseRiskLevel];
  children: ReactNode;
  emptyText: string;
  emphasis?: boolean;
  subtle?: boolean;
}) {
  return (
    <section className={cn("grid gap-4", subtle ? "" : "max-w-[46rem]")}>
      <div className="flex items-center gap-3">
        <span className={cn("inline-flex size-9 items-center justify-center rounded-full", emphasis ? tone.accentSoft : "bg-[rgba(255,255,255,0.6)]")}>
          <Icon className={cn("size-4", tone.accent)} />
        </span>
        <div className="text-base font-semibold tracking-[-0.03em] text-[rgb(41,31,24)]">{title}</div>
      </div>

      {children ? children : <EmptyBlock text={emptyText} tone={tone} />}
    </section>
  );
}

function AppendixSection({
  safety,
  tone,
}: {
  safety: ShowcaseSafetyAnalysis;
  tone: (typeof safetyToneStyles)[ShowcaseRiskLevel];
}) {
  return (
    <div className="grid gap-3">
      <details className={cn("group rounded-[18px] border px-4 py-3.5 md:px-5", tone.rule, tone.appendixSurface)}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div className="grid gap-1">
            <div className="text-base font-semibold tracking-[-0.03em] text-[rgb(41,31,24)]">审查附注</div>
            <div className="text-sm leading-6 text-[rgba(74,58,46,0.72)]">
              {safety.notes.length > 0 ? formatCount(safety.notes.length, "条补充说明", "暂无补充说明") : "暂无补充说明"}
            </div>
          </div>
          <ArrowDownRight className="size-4 text-[rgba(72,55,44,0.72)] transition-transform duration-200 group-open:rotate-90" />
        </summary>

        <div className="mt-3">
          {safety.notes.length > 0 ? (
            <ul className="grid gap-3">
              {safety.notes.map((item) => (
                <li key={item} className="border-b border-[rgba(101,80,63,0.1)] pb-3 text-sm leading-7 text-[rgba(74,58,46,0.82)] last:border-b-0 last:pb-0">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyBlock text="当前结论已经主要体现在上面的风险、边界和可信依据里。" tone={tone} />
          )}
        </div>
      </details>

      <details className="group rounded-[18px] border border-[rgba(101,80,63,0.14)] bg-[rgba(31,27,25,0.96)] px-4 py-3.5 text-[rgba(245,237,227,0.92)] md:px-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
          <div className="grid gap-1">
            <div className="text-base font-semibold tracking-[-0.03em] text-[rgb(252,244,236)]">审查路径</div>
            <div className="text-sm leading-6 text-[rgba(226,214,199,0.72)]">查看模型如何根据材料形成这份判断。</div>
          </div>
          <ArrowDownRight className="size-4 text-[rgba(244,222,192,0.72)] transition-transform duration-200 group-open:rotate-90" />
        </summary>

        <div className="mt-3 grid gap-4">
          <p className="max-w-2xl text-sm leading-6 text-[rgba(226,214,199,0.72)]">
            这不是源码审计图，而是模型根据提交材料梳理出的判断路径。适合帮助用户理解结论是如何一步步形成的。
          </p>
          {safety.mermaid ? (
            <div className="max-w-3xl">
              <MermaidPreview chart={safety.mermaid} />
            </div>
          ) : (
            <EmptyBlock text="当前没有可展示的审查路径。" tone={tone} dark />
          )}
        </div>
      </details>
    </div>
  );
}

function EmptyBlock({
  text,
  tone,
  dark = false,
}: {
  text: string;
  tone: (typeof safetyToneStyles)[ShowcaseRiskLevel];
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[18px] border border-dashed px-4 py-4 text-sm leading-7",
        dark
          ? "border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.04)] text-[rgba(226,214,199,0.72)]"
          : cn(tone.rule, "bg-[rgba(255,255,255,0.5)] text-[rgba(74,58,46,0.72)]"),
      )}
    >
      {text}
    </div>
  );
}

function formatCount(count: number, suffix: string, emptyText: string) {
  return count > 0 ? `${count} ${suffix}` : emptyText;
}

function buildPrimarySummary(safety: ShowcaseSafetyAnalysis) {
  if (safety.verdict) {
    return safety.verdict;
  }

  if (safety.risk_level === "unsafe") {
    return "当前材料里已经出现明显风险线索，不适合把它当作可直接信任的默认选项。";
  }

  if (safety.risk_level === "caution") {
    return "这份 Skill 还需要你再看一眼，尤其是权限边界和材料完整性。";
  }

  return "从现有材料看没有出现明确越权或恶意意图，但这仍然是一份基于文档证据的判断。";
}

function buildNextStep(safety: ShowcaseSafetyAnalysis) {
  if (safety.red_flags.length > 0) {
    return {
      title: `先看 ${safety.red_flags.length} 条红旗风险`,
      description: "这些是最直接影响判断的线索，先确认它们是否足以让你暂停信任。",
    };
  }

  if (safety.blocked_capabilities.length > 0 || safety.permission_scope.length === 0) {
    return {
      title: "先确认能力边界",
      description: "如果它会碰的范围写得不清楚，正向结论就不值得过早相信。",
    };
  }

  if (safety.trust_signals.length > 0 || safety.metadata_review.length > 0) {
    return {
      title: "再核对可信依据",
      description: "把正向信号和材料审查结果过一遍，再决定是否继续采用。",
    };
  }

  return {
    title: "先浏览主要发现",
    description: "这份结论主要依赖一般性发现，适合快速扫一遍再决定下一步。",
  };
}

function buildEvidenceLead(safety: ShowcaseSafetyAnalysis) {
  if (safety.red_flags.length > 0) {
    return "最影响判断的内容放在这里。先看这些风险线索，再决定是否继续往下读。";
  }

  if (safety.findings.length > 0) {
    return "当前没有高危红旗，判断主要来自这些一般性发现和材料里的不确定性。";
  }

  return "当前没有突出风险发现，这份判断更多依赖边界和可信依据两部分。";
}

function buildBoundaryLead(safety: ShowcaseSafetyAnalysis) {
  if (safety.permission_scope.length === 0) {
    return "这份 Skill 最需要补的一层，就是它到底会碰什么。边界不清，其他正向信号都会变轻。";
  }

  if (safety.blocked_capabilities.length > 0) {
    return "它的能力范围已经部分可见，但其中仍有一些能力不适合被默认视为安全。";
  }

  return "这里回答的是它打算碰什么，以及这些能力边界是否足够让人放心。";
}

function buildTrustLead(safety: ShowcaseSafetyAnalysis) {
  if (safety.trust_signals.length === 0 && safety.metadata_review.length === 0) {
    return "当前缺少强有力的正向证据，所以这一层更像在提醒你为什么不能过早乐观。";
  }

  return "这部分不是在证明它完全安全，而是在帮你判断：这份结论到底有没有足够的材料支撑。";
}
