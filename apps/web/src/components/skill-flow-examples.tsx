import { cn } from "@my-better-t-app/ui/lib/utils";
import { Expand, X } from "lucide-react";
import { useState } from "react";

import type { FlowExample } from "@/components/types";

import { createExampleFlow } from "./skill-flow-examples-data";
import { FlowCanvas } from "./skill-flow-graph";

export function FlowExamplesSection({ examples }: { examples: FlowExample[] }) {
  const [activeId, setActiveId] = useState(examples[0]?.id ?? "");
  const [showFullscreen, setShowFullscreen] = useState(false);
  const activeExample = examples.find((example) => example.id === activeId) ?? examples[0];

  if (!activeExample) {
    return null;
  }

  const { nodes, edges } = createExampleFlow(activeExample);

  return (
    <div className="grid gap-4 lg:grid-cols-[168px_1fr]">
      <div className="grid gap-2 self-start">
        {examples.map((example) => (
          <button
            key={example.id}
            type="button"
            className={cn(
              "group relative overflow-hidden rounded-2xl border px-4 py-3.5 text-left transition-all duration-200",
              example.id === activeExample.id
                ? "border-sky-200 bg-sky-50/95 text-slate-950 shadow-[0_10px_24px_rgba(14,165,233,0.12)]"
                : "border-transparent bg-slate-50/90 text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900",
            )}
            onClick={() => {
              setActiveId(example.id);
            }}
          >
            <span
              className={cn(
                "absolute inset-y-3 left-0 w-1 rounded-r-full transition-colors",
                example.id === activeExample.id ? "bg-sky-500" : "bg-transparent group-hover:bg-slate-300",
              )}
            />
            <div className="text-sm font-medium">{example.title}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="text-base font-semibold text-slate-900">{activeExample.title}</div>
            <div className="text-sm leading-6 text-slate-600">{activeExample.description}</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_50%_42%,rgba(224,242,254,0.72),transparent_54%),linear-gradient(180deg,rgba(255,255,255,0.68),rgba(248,250,252,0.94))] shadow-[inset_0_0_0_1px_rgba(226,232,240,0.65)]">
          <button
            type="button"
            aria-label="全屏查看流程图"
            className="absolute right-3 top-3 z-10 inline-flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white/92 text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
            onClick={() => {
              setShowFullscreen(true);
            }}
          >
            <Expand className="size-4" />
          </button>
          <FlowCanvas nodes={nodes} edges={edges} heightClassName="h-[22rem]" />
        </div>

        <div className="grid gap-2 border-t border-slate-200/75 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs tracking-[0.16em] text-slate-500">输出结果</div>
            <div className="text-xs font-medium text-slate-400">Result</div>
          </div>
          <div className="grid gap-2 rounded-[20px] bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(241,245,249,0.9))] px-4 py-4 ring-1 ring-inset ring-slate-200/85">
            <div className="text-sm font-semibold text-slate-800">{activeExample.output}</div>
            <pre className="overflow-x-auto text-[12px] leading-6 text-slate-700">
              <code>{activeExample.preview}</code>
            </pre>
          </div>
        </div>
      </div>

      {showFullscreen ? (
        <div
          className="fixed inset-0 z-50 bg-white/72 p-4 backdrop-blur-sm"
          onClick={() => {
            setShowFullscreen(false);
          }}
        >
          <div
            className="relative h-full w-full overflow-hidden rounded-[28px] border border-slate-200 bg-white text-slate-900 shadow-[0_24px_80px_rgba(148,163,184,0.24)]"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              aria-label="关闭全屏"
              className="absolute right-4 top-4 z-10 inline-flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white/92 text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
              onClick={() => {
                setShowFullscreen(false);
              }}
            >
              <X className="size-4" />
            </button>

            <FlowCanvas nodes={nodes} edges={edges} heightClassName="h-full" interactive />
          </div>
        </div>
      ) : null}
    </div>
  );
}
