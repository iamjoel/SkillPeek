import { cn } from "@my-better-t-app/ui/lib/utils";
import { LockKeyhole, ScrollText, ShieldAlert, ShieldCheck, Sparkles, TriangleAlert, X } from "lucide-react";
import { useEffect, useId } from "react";

import type { ShowcaseRiskLevel, ShowcaseSafetyAnalysis } from "@/components/types";

import { MermaidPreview } from "./skill-mermaid-preview";

export const riskLevelLabels: Record<ShowcaseRiskLevel, string> = {
  safe: "可查看",
  caution: "需复核",
  unsafe: "建议阻断",
};

const safetyDecisionTitles: Record<ShowcaseRiskLevel, string> = {
  safe: "可以继续了解这个 Skill",
  caution: "先复核，再决定是否继续",
  unsafe: "当前不适合继续信任",
};

const safetyDecisionDescriptions: Record<ShowcaseRiskLevel, string> = {
  safe: "从现有材料看，没有出现明确的越权或恶意意图，但这仍是一份基于文档证据的判断，不是最终放行。",
  caution: "关键信息还不够完整，或者能力边界带有不确定性。它更像一个需要你再看一眼的对象，而不是立即采用的对象。",
  unsafe: "当前材料里已经出现了明显的风险线索。对普通用户而言，这类 Skill 不应该被包装成可直接信任的默认选项。",
};

const safetyToneStyles: Record<
  ShowcaseRiskLevel,
  {
    badge: string;
    badgeDot: string;
    surface: string;
    frame: string;
    glow: string;
    line: string;
    emphasis: string;
    chip: string;
    sectionInk: string;
  }
> = {
  safe: {
    badge: "border-[rgba(96,129,103,0.28)] bg-[rgba(232,241,231,0.84)] text-[rgb(54,82,60)]",
    badgeDot: "bg-[rgb(88,123,96)]",
    surface:
      "bg-[linear-gradient(180deg,rgba(251,249,243,0.98),rgba(243,247,239,0.98))]",
    frame: "border-[rgba(96,129,103,0.2)]",
    glow: "bg-[radial-gradient(circle_at_top_right,rgba(121,161,128,0.2),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(233,216,171,0.2),transparent_30%)]",
    line: "border-[rgba(96,129,103,0.24)]",
    emphasis: "text-[rgb(50,79,56)]",
    chip: "border-[rgba(96,129,103,0.28)] bg-[rgba(239,245,236,0.9)] text-[rgb(54,82,60)]",
    sectionInk: "text-[rgb(72,101,77)]",
  },
  caution: {
    badge: "border-[rgba(164,119,61,0.28)] bg-[rgba(253,243,221,0.88)] text-[rgb(121,79,28)]",
    badgeDot: "bg-[rgb(181,122,43)]",
    surface:
      "bg-[linear-gradient(180deg,rgba(255,249,238,0.98),rgba(252,242,226,0.98))]",
    frame: "border-[rgba(168,121,58,0.22)]",
    glow: "bg-[radial-gradient(circle_at_top_right,rgba(220,164,77,0.24),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(190,102,64,0.18),transparent_30%)]",
    line: "border-[rgba(168,121,58,0.25)]",
    emphasis: "text-[rgb(116,77,33)]",
    chip: "border-[rgba(168,121,58,0.28)] bg-[rgba(255,248,236,0.9)] text-[rgb(121,79,28)]",
    sectionInk: "text-[rgb(134,91,40)]",
  },
  unsafe: {
    badge: "border-[rgba(145,80,86,0.28)] bg-[rgba(250,232,230,0.88)] text-[rgb(122,53,62)]",
    badgeDot: "bg-[rgb(150,63,75)]",
    surface:
      "bg-[linear-gradient(180deg,rgba(255,248,245,0.98),rgba(248,235,231,0.98))]",
    frame: "border-[rgba(145,80,86,0.22)]",
    glow: "bg-[radial-gradient(circle_at_top_right,rgba(177,89,89,0.24),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(221,163,91,0.18),transparent_30%)]",
    line: "border-[rgba(145,80,86,0.26)]",
    emphasis: "text-[rgb(117,48,57)]",
    chip: "border-[rgba(145,80,86,0.3)] bg-[rgba(253,241,239,0.92)] text-[rgb(122,53,62)]",
    sectionInk: "text-[rgb(130,58,67)]",
  },
};

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
  const redFlagCount = safety.red_flags.length;
  const blockedCount = safety.blocked_capabilities.length;
  const trustCount = safety.trust_signals.length;
  const scopeCount = safety.permission_scope.length;
  const headline = safety.verdict || safetyDecisionTitles[safety.risk_level];
  const summary = buildPrimarySummary(safety);

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
    <div
      className="fixed inset-0 z-50 bg-[rgba(56,38,25,0.22)] px-3 py-4 backdrop-blur-[7px] motion-safe:animate-in motion-safe:fade-in-0 md:px-6 md:py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative mx-auto flex max-h-[88vh] w-full max-w-[1180px] flex-col overflow-hidden rounded-[34px] border text-slate-900 shadow-[0_40px_120px_rgba(66,42,27,0.26)] motion-safe:animate-in motion-safe:zoom-in-[0.98] motion-safe:slide-in-from-bottom-4 duration-300",
          tone.frame,
          tone.surface,
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={cn("pointer-events-none absolute inset-0 opacity-95", tone.glow)} />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(88,61,39,0.22),transparent)]" />

        <div className="relative flex-1 overflow-y-auto">
          <div className="px-5 pb-4 pt-4 md:px-7 md:pb-5 md:pt-5">
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-2.5 text-[11px] tracking-[0.22em] text-[rgba(89,71,57,0.64)] uppercase">
                <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-semibold", tone.badge)}>
                  <span className={cn("size-1.5 rounded-full", tone.badgeDot)} />
                  {riskLevelLabels[safety.risk_level]}
                </span>
                <span>Skill Safety Brief</span>
                <span className="rounded-full border border-[rgba(101,80,63,0.12)] bg-[rgba(255,255,255,0.66)] px-3 py-1.5 tracking-[0.14em] text-[rgba(89,71,57,0.72)]">
                  {skillName}
                </span>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.16fr)_minmax(17rem,0.84fr)] lg:items-start">
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <div className={cn("text-sm font-semibold tracking-[0.18em] uppercase", tone.sectionInk)}>
                      安全画像
                    </div>
                    <h2
                      id={titleId}
                      className="max-w-4xl text-[clamp(1.85rem,3.7vw,3.05rem)] leading-[0.94] tracking-[-0.055em] text-[rgb(33,26,21)]"
                      style={{ fontFamily: "var(--font-editorial)" }}
                    >
                      {headline}
                    </h2>
                  </div>

                  <p className="max-w-3xl text-[15px] leading-7 text-[rgba(74,58,46,0.82)] md:text-[16px]">
                    {safetyDecisionDescriptions[safety.risk_level]}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <SummaryChip label="判断" value={safetyDecisionTitles[safety.risk_level]} toneClass={tone.chip} />
                    <SummaryChip
                      label="恶意迹象"
                      value={safety.is_malicious_or_unsafe ? "已识别" : "未直接判定"}
                      toneClass={tone.chip}
                    />
                    <SummaryChip label="材料基础" value="基于提交内容研判" toneClass={tone.chip} />
                  </div>
                </div>

                <aside className={cn("grid gap-3 rounded-[26px] border px-4 py-3.5 shadow-[0_20px_60px_rgba(97,66,44,0.1)] md:px-5", tone.line, "bg-[rgba(255,255,255,0.56)]")}>
                  <div className="flex items-center gap-3">
                    <div className={cn("flex size-11 items-center justify-center rounded-2xl border bg-[rgba(255,255,255,0.72)]", tone.line)}>
                      <ShieldCheck className={cn("size-5", tone.emphasis)} />
                    </div>
                    <div className="grid gap-1">
                      <div className="text-[11px] font-semibold tracking-[0.18em] text-[rgba(89,71,57,0.6)] uppercase">
                        立即建议
                      </div>
                      <div className="text-base font-semibold tracking-[-0.03em] text-[rgb(41,31,24)]">
                        {summary}
                      </div>
                    </div>
                  </div>

                  <dl className="grid gap-2.5">
                    <MetricRow label="红旗风险" value={redFlagCount > 0 ? `${redFlagCount} 项` : "未发现明确红旗"} />
                    <MetricRow label="权限范围" value={scopeCount > 0 ? `${scopeCount} 条能力边界` : "边界信息有限"} />
                    <MetricRow label="限制能力" value={blockedCount > 0 ? `${blockedCount} 条建议阻断` : "未补充阻断项"} />
                    <MetricRow label="可信信号" value={trustCount > 0 ? `${trustCount} 条正向证据` : "暂未识别"} />
                  </dl>
                </aside>
              </div>
            </div>
          </div>

          <div className="sticky top-0 z-10 border-y border-[rgba(101,80,63,0.1)] bg-[rgba(255,251,246,0.88)] backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 px-5 py-3 md:px-7">
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold tracking-[0.18em] uppercase", tone.badge)}>
                  <span className={cn("size-1.5 rounded-full", tone.badgeDot)} />
                  {riskLevelLabels[safety.risk_level]}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold tracking-[-0.02em] text-[rgb(41,31,24)]">
                    {summary}
                  </div>
                  <div className="truncate text-xs text-[rgba(89,71,57,0.68)]">
                    {skillName}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[rgba(101,80,63,0.14)] bg-[rgba(255,255,255,0.78)] text-[rgba(72,55,44,0.72)] transition-colors hover:border-[rgba(101,80,63,0.24)] hover:text-[rgb(40,30,24)]"
                onClick={onClose}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          <div className="relative px-5 pb-5 pt-5 md:px-7 md:pb-7 md:pt-6">
            <div className="grid gap-6">
              <section className="grid gap-4 lg:grid-cols-[minmax(0,1.08fr)_minmax(19rem,0.92fr)]">
                <EvidenceSection
                  title="警惕信号"
                  eyebrow="Why it deserves attention"
                  lead="把高优先级的风险和一般性发现分开看，你会更容易判断这份 Skill 是危险、模糊，还是仅仅信息不够。"
                  risks={safety.red_flags}
                  findings={safety.findings}
                  tone={tone}
                />
                <BoundarySection
                  permissions={safety.permission_scope}
                  blocked={safety.blocked_capabilities}
                  tone={tone}
                />
              </section>

              <section className={cn("grid gap-5 rounded-[30px] border px-5 py-5 shadow-[0_18px_56px_rgba(97,66,44,0.08)] md:px-6 md:py-6", tone.line, "bg-[rgba(255,252,248,0.62)]")}>
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(18rem,0.82fr)] md:items-end">
                  <div className="grid gap-2">
                    <div className="text-[11px] font-semibold tracking-[0.2em] text-[rgba(89,71,57,0.62)] uppercase">
                      Trust & Metadata
                    </div>
                    <h3
                      className="text-[clamp(1.45rem,2vw,2rem)] leading-[1] tracking-[-0.04em] text-[rgb(35,28,22)]"
                      style={{ fontFamily: "var(--font-editorial)" }}
                    >
                      可信依据
                    </h3>
                  </div>
                  <p className="max-w-xl text-sm leading-6 text-[rgba(74,58,46,0.74)]">
                    这一层不是在证明它完全安全，而是在帮用户理解：这份判断到底有没有足够的材料支撑。
                  </p>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <SignalSection
                    icon={<Sparkles className="size-4" />}
                    eyebrow="Positive Signals"
                    title="可信信号"
                    items={safety.trust_signals}
                    emptyText="当前材料里还没有明显的可信佐证。"
                    tone={tone}
                  />
                  <SignalSection
                    icon={<ScrollText className="size-4" />}
                    eyebrow="Metadata Read"
                    title="元数据审查"
                    items={safety.metadata_review}
                    emptyText="当前没有可展示的元数据审查结论。"
                    tone={tone}
                  />
                </div>
              </section>

              <section className="grid gap-6 lg:grid-cols-[minmax(16rem,0.78fr)_minmax(0,1.22fr)]">
                <NotesSection notes={safety.notes} tone={tone} />
                <DiagramSection chart={safety.mermaid} />
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryChip({
  label,
  value,
  toneClass,
}: {
  label: string;
  value: string;
  toneClass: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm shadow-[0_12px_30px_rgba(91,66,46,0.06)]", toneClass)}>
      <span className="text-[rgba(76,61,49,0.62)]">{label}</span>
      <span className="font-semibold tracking-[-0.01em]">{value}</span>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[6.2rem_minmax(0,1fr)] gap-3 border-b border-[rgba(101,80,63,0.08)] pb-3 last:border-b-0 last:pb-0">
      <dt className="text-[11px] font-semibold tracking-[0.18em] text-[rgba(89,71,57,0.55)] uppercase">{label}</dt>
      <dd className="text-sm leading-6 text-[rgba(54,40,31,0.84)]">{value}</dd>
    </div>
  );
}

function EvidenceSection({
  title,
  eyebrow,
  lead,
  risks,
  findings,
  tone,
}: {
  title: string;
  eyebrow: string;
  lead: string;
  risks: string[];
  findings: string[];
  tone: (typeof safetyToneStyles)[ShowcaseRiskLevel];
}) {
  return (
    <section className={cn("grid gap-5 rounded-[30px] border px-5 py-5 shadow-[0_18px_56px_rgba(97,66,44,0.1)] md:px-6 md:py-6", tone.line, "bg-[rgba(255,252,248,0.7)]")}>
      <div className="grid gap-2">
        <div className="text-[11px] font-semibold tracking-[0.2em] text-[rgba(89,71,57,0.62)] uppercase">{eyebrow}</div>
        <h3
          className="text-[clamp(1.55rem,2vw,2.1rem)] leading-[0.98] tracking-[-0.045em] text-[rgb(35,28,22)]"
          style={{ fontFamily: "var(--font-editorial)" }}
        >
          {title}
        </h3>
        <p className="max-w-2xl text-sm leading-6 text-[rgba(74,58,46,0.74)]">{lead}</p>
      </div>

      <div className="grid gap-5">
        <div className="grid gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[rgb(97,52,50)]">
            <ShieldAlert className="size-4" />
            红旗风险
          </div>
          {risks.length > 0 ? (
            <ol className="grid gap-2.5">
              {risks.map((item, index) => (
                <li
                  key={item}
                  className="grid grid-cols-[2.2rem_minmax(0,1fr)] gap-3 rounded-[24px] border border-[rgba(155,90,91,0.18)] bg-[linear-gradient(180deg,rgba(255,244,242,0.94),rgba(255,250,248,0.82))] px-4 py-4 shadow-[0_16px_40px_rgba(151,84,87,0.08)]"
                >
                  <div className="flex size-9 items-center justify-center rounded-full bg-[rgba(151,84,87,0.1)] text-sm font-semibold text-[rgb(120,52,61)]">
                    {index + 1}
                  </div>
                  <div className="pt-1 text-[15px] leading-7 text-[rgba(70,42,38,0.88)]">{item}</div>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyCopy text="这一轮没有识别出明确的高危红旗，风险判断更多来自边界清晰度和材料完整性。" />
          )}
        </div>

        <div className="grid gap-3 border-t border-[rgba(101,80,63,0.1)] pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[rgb(97,77,50)]">
            <TriangleAlert className="size-4" />
            主要发现
          </div>
          {findings.length > 0 ? (
            <ul className="grid gap-3">
              {findings.map((item) => (
                <li key={item} className="border-l border-[rgba(145,111,67,0.32)] pl-4 text-[15px] leading-7 text-[rgba(74,58,46,0.82)]">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyCopy text="当前没有额外的一般性风险发现。" />
          )}
        </div>
      </div>
    </section>
  );
}

function BoundarySection({
  permissions,
  blocked,
  tone,
}: {
  permissions: string[];
  blocked: string[];
  tone: (typeof safetyToneStyles)[ShowcaseRiskLevel];
}) {
  return (
    <section className={cn("grid gap-5 rounded-[30px] border px-5 py-5 shadow-[0_18px_56px_rgba(97,66,44,0.08)] md:px-6 md:py-6", tone.line, "bg-[rgba(255,255,255,0.5)]")}>
      <div className="grid gap-2">
        <div className="text-[11px] font-semibold tracking-[0.2em] text-[rgba(89,71,57,0.62)] uppercase">Boundary Read</div>
        <h3
          className="text-[clamp(1.4rem,1.8vw,1.9rem)] leading-[1] tracking-[-0.04em] text-[rgb(35,28,22)]"
          style={{ fontFamily: "var(--font-editorial)" }}
        >
          能力边界
        </h3>
        <p className="text-sm leading-6 text-[rgba(74,58,46,0.74)]">
          这里回答的是它打算碰什么，以及哪些能力即使存在，也不应该被默认为安全。
        </p>
      </div>

      <div className="grid gap-5">
        <div className="grid gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[rgb(92,66,35)]">
            <LockKeyhole className="size-4" />
            权限范围
          </div>
          {permissions.length > 0 ? (
            <div className="flex flex-wrap gap-2.5">
              {permissions.map((item) => (
                <span
                  key={item}
                  className={cn("inline-flex max-w-full items-center rounded-full border px-3.5 py-2 text-sm leading-6 shadow-[0_10px_24px_rgba(118,87,58,0.06)]", tone.chip)}
                >
                  {item}
                </span>
              ))}
            </div>
          ) : (
            <EmptyCopy text="当前材料没有把权限边界写得足够清楚。" />
          )}
        </div>

        <div className="grid gap-3 border-t border-[rgba(101,80,63,0.1)] pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[rgb(109,55,48)]">
            <ShieldAlert className="size-4" />
            限制能力
          </div>
          {blocked.length > 0 ? (
            <ul className="grid gap-2.5">
              {blocked.map((item) => (
                <li
                  key={item}
                  className="rounded-[20px] border border-[rgba(145,80,86,0.16)] bg-[rgba(255,246,244,0.72)] px-4 py-3 text-sm leading-6 text-[rgba(73,45,41,0.84)]"
                >
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyCopy text="当前没有额外列出需要单独阻断的能力。" />
          )}
        </div>
      </div>
    </section>
  );
}

function SignalSection({
  icon,
  eyebrow,
  title,
  items,
  emptyText,
  tone,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  items: string[];
  emptyText: string;
  tone: (typeof safetyToneStyles)[ShowcaseRiskLevel];
}) {
  return (
    <section className={cn("grid gap-3 rounded-[24px] border px-4 py-4 md:px-5 md:py-5", tone.line, "bg-[rgba(255,255,255,0.46)]")}>
      <div className="grid gap-1.5">
        <div className="text-[11px] font-semibold tracking-[0.18em] text-[rgba(89,71,57,0.58)] uppercase">{eyebrow}</div>
        <div className="flex items-center gap-2 text-base font-semibold tracking-[-0.03em] text-[rgb(39,30,24)]">
          <span className={cn("inline-flex size-8 items-center justify-center rounded-full border bg-[rgba(255,255,255,0.72)]", tone.line)}>
            {icon}
          </span>
          {title}
        </div>
      </div>

      {items.length > 0 ? (
        <ul className="grid gap-2.5">
          {items.map((item) => (
            <li key={item} className="rounded-[20px] bg-[rgba(255,251,247,0.82)] px-4 py-3 text-sm leading-6 text-[rgba(74,58,46,0.82)]">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyCopy text={emptyText} />
      )}
    </section>
  );
}

function NotesSection({
  notes,
  tone,
}: {
  notes: string[];
  tone: (typeof safetyToneStyles)[ShowcaseRiskLevel];
}) {
  return (
    <section className={cn("grid gap-4 rounded-[30px] border px-5 py-5 shadow-[0_18px_56px_rgba(97,66,44,0.08)] md:px-6 md:py-6", tone.line, "bg-[rgba(255,253,249,0.78)]")}>
      <div className="grid gap-2">
        <div className="text-[11px] font-semibold tracking-[0.2em] text-[rgba(89,71,57,0.62)] uppercase">Reading Notes</div>
        <h3
          className="text-[clamp(1.4rem,1.8vw,1.9rem)] leading-[1] tracking-[-0.04em] text-[rgb(35,28,22)]"
          style={{ fontFamily: "var(--font-editorial)" }}
        >
          审查附注
        </h3>
      </div>

      {notes.length > 0 ? (
        <ul className="grid gap-3">
          {notes.map((item) => (
            <li
              key={item}
              className="rounded-[22px] border border-[rgba(101,80,63,0.1)] bg-[rgba(255,255,255,0.54)] px-4 py-4 text-sm leading-7 text-[rgba(74,58,46,0.82)]"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid gap-3 rounded-[24px] border border-dashed border-[rgba(101,80,63,0.18)] px-4 py-5 text-sm leading-7 text-[rgba(74,58,46,0.74)]">
          <div className="flex items-center gap-2 font-semibold text-[rgb(68,52,40)]">
            <ScrollText className="size-4" />
            没有额外补充说明
          </div>
          <p>当前结论已经主要体现在上面的风险、边界和可信依据里。</p>
        </div>
      )}
    </section>
  );
}

function DiagramSection({ chart }: { chart: string }) {
  return (
    <section className="grid gap-4 rounded-[30px] border border-[rgba(101,80,63,0.14)] bg-[rgba(32,27,24,0.92)] px-5 py-5 text-[rgba(245,237,227,0.92)] shadow-[0_24px_70px_rgba(43,25,13,0.22)] md:px-6 md:py-6">
      <div className="grid gap-2">
        <div className="text-[11px] font-semibold tracking-[0.2em] text-[rgba(244,222,192,0.58)] uppercase">Review Path</div>
        <div className="flex flex-wrap items-center gap-3">
          <h3
            className="text-[clamp(1.4rem,1.8vw,2rem)] leading-[1] tracking-[-0.04em] text-[rgb(252,244,236)]"
            style={{ fontFamily: "var(--font-editorial)" }}
          >
            审查路径
          </h3>
          <span className="rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] px-3 py-1.5 text-xs tracking-[0.14em] text-[rgba(244,222,192,0.72)] uppercase">
            Model-generated flow
          </span>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[rgba(226,214,199,0.72)]">
          这不是源码审计图，而是模型根据提交材料梳理出的判断路径。适合帮助用户理解结论是如何一步步形成的。
        </p>
      </div>

      <MermaidPreview chart={chart} />
    </section>
  );
}

function EmptyCopy({ text }: { text: string }) {
  return (
    <div className="rounded-[22px] border border-dashed border-[rgba(101,80,63,0.18)] bg-[rgba(255,255,255,0.44)] px-4 py-4 text-sm leading-7 text-[rgba(74,58,46,0.72)]">
      {text}
    </div>
  );
}

function buildPrimarySummary(safety: ShowcaseSafetyAnalysis) {
  if (safety.risk_level === "unsafe") {
    return "建议先暂停信任与执行";
  }

  if (safety.risk_level === "caution") {
    return "适合人工复核后再继续";
  }

  if (safety.red_flags.length > 0) {
    return "可继续阅读，但先理解红旗原因";
  }

  if (safety.permission_scope.length === 0) {
    return "结论偏正向，但边界仍需补充";
  }

  return "可以继续了解，记得核对权限边界";
}
