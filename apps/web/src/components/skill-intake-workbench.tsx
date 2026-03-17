import "@xyflow/react/dist/style.css";
import { Button } from "@my-better-t-app/ui/components/button";
import { Card, CardContent } from "@my-better-t-app/ui/components/card";
import { Input } from "@my-better-t-app/ui/components/input";
import { cn } from "@my-better-t-app/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import {
  BaseEdge,
  Background,
  BackgroundVariant,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  getSmoothStepPath,
  type EdgeProps,
  type EdgeTypes,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import {
  ChevronRight,
  Expand,
  FolderSearch,
  LoaderCircle,
  Shield,
  Upload,
  Workflow,
  X,
} from "lucide-react";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  DataTransferItemWithEntry,
  ExampleFlowEdge,
  ExampleFlowNode,
  FeatureAnalysis,
  FlowExample,
  ShowcaseResult,
  ShowcaseRiskLevel,
  SkillAnalysisResult,
  UploadedSkillFile,
} from "@/components/types";
import { trpcClient } from "@/utils/trpc";

const ACCEPTED_FILE_PATTERN =
  /\.(md|mdx|txt|json|ya?ml|toml|ini|cfg|conf|ts|tsx|js|jsx|mjs|cjs)$/i;

const MOCK_SKILL_RESULT: ShowcaseResult = {
  skill_name: "Larry",
  feature_analysis: {
    summary: "自动化 TikTok 幻灯片营销，从研究、生成到复盘迭代。",
    failure_modes: ["产品信息不足", "配置缺失", "外部平台返回异常"],
    outputs: ["TikTok 内容计划", "可发布素材", "复盘建议与下一轮方向"],
  },
  safety_analysis: {
    risk_level: "caution",
    verdict: "能力边界清楚，但依赖外部平台和密钥配置，使用前应隔离验证。",
    findings: ["会调用外部营销与图像服务", "需要配置 Postiz 与图像生成密钥"],
    permission_scope: ["读取本地配置", "写入报告文件", "调用外部 API"],
    trust_signals: ["目标清晰", "流程可审查", "输出可复盘"],
  },
};

const riskLevelLabels: Record<ShowcaseRiskLevel, string> = {
  safe: "安全",
  caution: "低风险",
  unsafe: "高风险",
};

function toShowcaseResult(result: SkillAnalysisResult): ShowcaseResult {
  return {
    skill_name: result.skill_name,
    feature_analysis: {
      summary: result.feature_analysis.summary,
      outputs: result.feature_analysis.outputs,
      failure_modes: result.feature_analysis.failure_modes,
    },
    safety_analysis: {
      risk_level: result.safety_analysis.risk_level,
      verdict: result.safety_analysis.verdict,
      findings: result.safety_analysis.findings,
      permission_scope: result.safety_analysis.permission_scope,
      trust_signals: result.safety_analysis.trust_signals,
    },
  };
}

function pickUploadLabel(files: UploadedSkillFile[]) {
  const firstRelativePath = files.find((file) => file.path.includes("/"))?.path;
  if (!firstRelativePath) {
    return files[0]?.path.replace(/\.[^.]+$/, "") || "Uploaded Skill";
  }

  return firstRelativePath.split("/")[0] || "Uploaded Skill";
}

export default function SkillIntakeWorkbench() {
  const [repoUrl, setRepoUrl] = useState("");
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [inputTab, setInputTab] = useState<"upload" | "repo">("upload");
  const [showMockResult, setShowMockResult] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeSkill = useMutation({
    mutationFn: (input: Parameters<typeof trpcClient.analyzeSkill.mutate>[0]) => {
      return trpcClient.analyzeSkill.mutate(input);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  async function startUploadAnalysis(uploaded: UploadedSkillFile[]) {
    setShowMockResult(false);
    const label = pickUploadLabel(uploaded);

    await analyzeSkill.mutateAsync({
      source: {
        kind: "upload",
        label,
        files: uploaded.map(({ path, content }) => ({
          path,
          content,
        })),
      },
      outputLanguage: "zh",
      requestLanguage: "zh",
    });
  }

  async function normalizeFiles(files: File[]) {
    if (files.length === 0) {
      return;
    }

    const readableFiles = files.filter((file) => ACCEPTED_FILE_PATTERN.test(file.name));

    if (readableFiles.length === 0) {
      toast.error("没有找到可读的文本文件。请上传 `SKILL.md`、README 或相关文档。");
      return;
    }

    setIsReadingFiles(true);

    try {
      const uploaded = await Promise.all(
        readableFiles.slice(0, 48).map(async (file) => {
          const content = await file.text();
          return {
            path: file.webkitRelativePath || file.name,
            content,
          };
        }),
      );

      toast.success(`已读取 ${uploaded.length} 个文件，正在开始分析。`);
      await startUploadAnalysis(uploaded);
    } finally {
      setIsReadingFiles(false);
    }
  }

  async function loadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    await normalizeFiles(Array.from(fileList));
  }

  function readFileEntry(entry: FileSystemFileEntry) {
    return new Promise<File>((resolve, reject) => {
      entry.file(resolve, reject);
    });
  }

  function readDirectoryEntries(directory: FileSystemDirectoryEntry) {
    const reader = directory.createReader();
    const entries: FileSystemEntry[] = [];

    return new Promise<FileSystemEntry[]>((resolve, reject) => {
      const readBatch = () => {
        reader.readEntries(
          (batch) => {
            if (batch.length === 0) {
              resolve(entries);
              return;
            }

            entries.push(...batch);
            readBatch();
          },
          (error) => reject(error),
        );
      };

      readBatch();
    });
  }

  async function flattenEntry(entry: FileSystemEntry, parentPath = ""): Promise<File[]> {
    const currentPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;

    if (entry.isFile) {
      const file = await readFileEntry(entry as FileSystemFileEntry);
      const pathAwareFile = new File([file], file.name, {
        type: file.type,
        lastModified: file.lastModified,
      });

      Object.defineProperty(pathAwareFile, "webkitRelativePath", {
        value: currentPath,
        configurable: true,
      });

      return [pathAwareFile];
    }

    if (entry.isDirectory) {
      const children = await readDirectoryEntries(entry as FileSystemDirectoryEntry);
      const nestedFiles = await Promise.all(
        children.map((child) => flattenEntry(child, currentPath)),
      );

      return nestedFiles.flat();
    }

    return [];
  }

  async function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);

    const items = Array.from(event.dataTransfer.items || []) as DataTransferItemWithEntry[];
    const entries = items
      .map((item) => item.webkitGetAsEntry?.() ?? null)
      .filter((entry): entry is FileSystemEntry => entry !== null);

    if (entries.length > 0) {
      const droppedFiles = await Promise.all(entries.map((entry) => flattenEntry(entry)));
      await normalizeFiles(droppedFiles.flat());

      return;
    }

    await loadFiles(event.dataTransfer.files);
  }

  async function submitRepo() {
    if (!repoUrl.trim()) {
      toast.error("请输入 Skill 仓库地址。");
      return;
    }

    setShowMockResult(false);
    await analyzeSkill.mutateAsync({
      source: {
        kind: "repo",
        repoUrl: repoUrl.trim(),
      },
      outputLanguage: "zh",
      requestLanguage: "zh",
    });
  }

  const result = analyzeSkill.isPending
    ? undefined
    : analyzeSkill.data
      ? toShowcaseResult(analyzeSkill.data)
      : showMockResult
        ? MOCK_SKILL_RESULT
        : undefined;
  const showResultPanel = analyzeSkill.isPending || Boolean(result);

  return (
    <main className="min-h-[calc(100svh-49px)] overflow-y-auto bg-transparent">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 md:px-6 lg:px-8 lg:py-6">
        <section className="px-5 py-0.5 text-slate-950 md:px-6">
          <div className="grid max-w-4xl gap-2">
            <div className="grid gap-0.5">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.055em] text-balance md:text-[4.4rem] md:leading-[0.98]">
                <span className="text-slate-950">Skill</span>
                <span className="bg-gradient-to-r from-sky-500 via-cyan-500 to-violet-500 bg-clip-text text-transparent">
                  Peek
                </span>
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-500 md:text-[15px]">
                了解 Skill 功能边界，评估 Skill 安全风险。
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6">
          {!showResultPanel ? (
            <div className="w-full">
              <Card className="border border-slate-200/80 bg-white/88 text-slate-900 shadow-[0_18px_60px_rgba(148,163,184,0.16)]">
                <CardContent className="grid gap-6 p-6">
                  <div className="inline-flex w-fit rounded-2xl border border-slate-200 bg-slate-50 p-1">
                    <button
                      type="button"
                      className={cn(
                        "px-4 py-2 text-sm transition-colors",
                        inputTab === "upload"
                          ? "rounded-xl bg-sky-500 text-white"
                          : "rounded-xl text-slate-600 hover:bg-white hover:text-slate-900",
                      )}
                      onClick={() => setInputTab("upload")}
                    >
                      上传文件
                    </button>
                    <button
                      type="button"
                      className={cn(
                        "px-4 py-2 text-sm transition-colors",
                        inputTab === "repo"
                          ? "rounded-xl bg-amber-500 text-white"
                          : "rounded-xl text-slate-600 hover:bg-white hover:text-slate-900",
                      )}
                      onClick={() => setInputTab("repo")}
                    >
                      GitHub Repo
                    </button>
                  </div>

                  {inputTab === "upload" ? (
                    <div
                      className={cn(
                        "grid min-h-72 place-items-center border border-dashed p-6 text-center transition-colors",
                        isDragging
                          ? "border-sky-400 bg-sky-50"
                          : "border-sky-300/80 bg-sky-50/70",
                      )}
                      onDragEnter={(event) => {
                        event.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={(event) => {
                        event.preventDefault();
                        if (event.currentTarget === event.target) {
                          setIsDragging(false);
                        }
                      }}
                      onDrop={(event) => {
                        void handleDrop(event);
                      }}
                    >
                      <div className="grid gap-5">
                        <div className="mx-auto inline-flex size-14 items-center justify-center rounded-full border border-sky-200 bg-sky-100">
                          <Upload className="size-6 text-sky-600" />
                        </div>
                        <div className="grid gap-2">
                          <p className="text-2xl font-medium tracking-[-0.03em] text-slate-900">
                            把要分析的 Skill 拖到这里
                          </p>
                        </div>
                        <div className="flex justify-center">
                          <Button
                            type="button"
                            size="lg"
                            className="bg-sky-500 text-white hover:bg-sky-600"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isReadingFiles || analyzeSkill.isPending}
                          >
                            {isReadingFiles || analyzeSkill.isPending ? (
                              <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                              <Upload className="size-4" />
                            )}
                            点击上传
                          </Button>
                        </div>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          void loadFiles(event.target.files);
                          event.target.value = "";
                        }}
                      />
                    </div>
                  ) : (
                    <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <Input
                          id="repo-url"
                          value={repoUrl}
                          onChange={(event) => setRepoUrl(event.target.value)}
                          placeholder="https://github.com/owner/repo"
                          className="h-11 border-slate-200 bg-white text-sm text-slate-900 placeholder:text-slate-400"
                        />
                        <Button
                          type="button"
                          size="lg"
                          className="h-11 bg-amber-500 px-6 text-white hover:bg-amber-600"
                          onClick={() => void submitRepo()}
                          disabled={analyzeSkill.isPending || !repoUrl.trim()}
                        >
                          {analyzeSkill.isPending ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : (
                            <FolderSearch className="size-4" />
                          )}
                          开始分析
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {showResultPanel ? (
            <div className="mx-auto grid w-full max-w-7xl gap-6">
              {!result ? (
                <div className="grid min-h-72 place-items-center rounded-[28px] border border-slate-200 bg-white/88 p-8 text-center shadow-[0_18px_60px_rgba(148,163,184,0.14)]">
                  <div className="grid gap-3">
                    <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-sky-100 text-sky-600">
                      <Workflow className="size-5" />
                    </div>
                    <div className="text-lg font-medium text-slate-900">正在分析</div>
                  </div>
                </div>
              ) : (
                <FeatureTab result={result} />
              )}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function FeatureTab({ result }: { result: ShowcaseResult }) {
  const feature = result.feature_analysis;
  const safety = result.safety_analysis;
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const intro = feature.summary;
  const safetySummary = shortenText(
    safety.verdict || safety.findings[0] || "仅处理内容整理",
    20,
  );
  const safetyPoints = buildSafetyPoints(result);
  const examples = buildFlowExamples(feature);

  return (
    <section className="grid gap-4 rounded-[30px] border border-slate-200/75 bg-white/94 px-5 py-4 text-slate-900 shadow-[0_18px_50px_rgba(148,163,184,0.14)] md:px-6 md:py-4">
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1.5">
            <h2 className="text-[2rem] font-semibold tracking-[-0.045em] md:text-[2.4rem] md:leading-none">
              {result.skill_name}
            </h2>
            <p className="max-w-3xl text-[15px] leading-6 text-slate-600">{intro}</p>
          </div>
          <button
            type="button"
            className={cn(
              "group inline-flex items-center gap-2 rounded-full border pl-3.5 pr-2 py-1.5 text-sm font-medium transition-colors",
              safety.risk_level === "unsafe"
                ? "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                : safety.risk_level === "caution"
                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100",
            )}
            aria-label={`查看${riskLevelLabels[safety.risk_level]}详情`}
            onClick={() => {
              setShowSafetyModal(true);
            }}
          >
            <Shield className="size-3.5" />
            <span className="text-sm font-semibold">{riskLevelLabels[safety.risk_level]}</span>
            <ChevronRight className="size-4 opacity-55 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-80" />
          </button>
        </div>
      </div>

      <div className="grid gap-3 border-t border-slate-200/75 pt-4">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <Workflow className="size-4 text-sky-600" />
          流程示例
        </div>
        <FlowExamplesSection examples={examples} />
      </div>

      {showSafetyModal ? (
        <SafetyModal
          level={riskLevelLabels[safety.risk_level]}
          summary={safetySummary}
          points={safetyPoints}
          onClose={() => {
            setShowSafetyModal(false);
          }}
        />
      ) : null}
    </section>
  );
}

const flowNodeTypes = {
  step: StepFlowNode,
  decision: DecisionFlowNode,
} satisfies NodeTypes;

const flowEdgeTypes = {
  annotated: AnnotatedFlowEdge,
} satisfies EdgeTypes;

function StepFlowNode({ data }: NodeProps<ExampleFlowNode>) {
  return (
    <div className="relative rounded-[12px] border border-slate-200/90 bg-white px-2.5 py-1.5 text-center text-[11px] font-semibold text-slate-700 shadow-[0_10px_24px_rgba(148,163,184,0.18)]">
      <Handle type="target" position={Position.Left} className="!size-2 !border-2 !border-white !bg-slate-400" />
      <Handle type="source" position={Position.Right} className="!size-2 !border-2 !border-white !bg-slate-400" />
      <span className="leading-4">{data.label}</span>
    </div>
  );
}

function DecisionFlowNode({ data }: NodeProps<ExampleFlowNode>) {
  return (
    <div className="relative size-[72px]">
      <Handle type="target" position={Position.Left} className="!size-2 !border-2 !border-white !bg-slate-400" />
      <Handle
        id="branch-top"
        type="source"
        position={Position.Right}
        className="!size-2 !border-2 !border-white !bg-slate-400"
        style={{ top: "18%" }}
      />
      <Handle
        id="branch-mid"
        type="source"
        position={Position.Right}
        className="!size-2 !border-2 !border-white !bg-slate-400"
        style={{ top: "50%" }}
      />
      <Handle
        id="branch-bottom"
        type="source"
        position={Position.Right}
        className="!size-2 !border-2 !border-white !bg-slate-400"
        style={{ top: "82%" }}
      />
      <div className="absolute inset-2 rotate-45 rounded-[12px] border border-slate-200/90 bg-white shadow-[0_10px_24px_rgba(148,163,184,0.18)]" />
      <div className="absolute inset-0 grid place-items-center px-3 text-center text-[11px] font-semibold leading-4 text-slate-700">
        {data.label}
      </div>
    </div>
  );
}

function AnnotatedFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
  label,
  data,
}: EdgeProps<ExampleFlowEdge>) {
  const isLoopBack = data?.route === "loop-back" && targetX < sourceX;
  const lift = data?.lift ?? 64;
  const [edgePath, labelX, labelY] = isLoopBack
    ? (() => {
      const loopTopY = Math.min(sourceY, targetY) - lift;
      const exitX = sourceX + 18;
      const entryX = targetX - 18;
      const path = [
        `M ${sourceX} ${sourceY}`,
        `L ${exitX} ${sourceY}`,
        `L ${exitX} ${loopTopY}`,
        `L ${entryX} ${loopTopY}`,
        `L ${entryX} ${targetY}`,
        `L ${targetX} ${targetY}`,
      ].join(" ");

      return [path, (exitX + entryX) / 2, loopTopY] as const;
    })()
    : getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 18,
    });

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded-full border border-slate-200 bg-white/96 px-2 py-0.5 text-[10px] font-medium leading-none text-slate-700 shadow-[0_6px_18px_rgba(148,163,184,0.18)]"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX + (data?.labelOffsetX ?? 0)}px, ${labelY + (data?.labelOffsetY ?? 0)
                }px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

function FlowExamplesSection({ examples }: { examples: FlowExample[] }) {
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

function FlowCanvas({
  nodes,
  edges,
  heightClassName,
  interactive = false,
}: {
  nodes: ExampleFlowNode[];
  edges: ExampleFlowEdge[];
  heightClassName: string;
  interactive?: boolean;
}) {
  return (
    <div className={cn("w-full", heightClassName)}>
      <ReactFlow<ExampleFlowNode, ExampleFlowEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={flowNodeTypes}
        edgeTypes={flowEdgeTypes}
        fitView
        fitViewOptions={{ padding: interactive ? 0.08 : 0.28 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={interactive}
        zoomOnDoubleClick={interactive}
        zoomOnScroll={interactive}
        zoomOnPinch={interactive}
        minZoom={0.35}
        maxZoom={1.8}
        preventScrolling={!interactive}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1.35}
          color="rgba(100, 116, 139, 0.38)"
        />
        {interactive ? (
          <Controls
            position="bottom-left"
            showInteractive={false}
            className="!rounded-2xl !border !border-slate-200 !bg-white/96 !shadow-[0_12px_30px_rgba(148,163,184,0.2)]"
          />
        ) : null}
      </ReactFlow>
    </div>
  );
}

function SafetyModal({
  level,
  summary,
  points,
  onClose,
}: {
  level: string;
  summary: string;
  points: string[];
  onClose: () => void;
}) {
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
    <div className="fixed inset-0 z-50 bg-white/70 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto grid max-w-lg gap-4 rounded-[28px] border border-slate-200 bg-white px-5 py-5 text-slate-900 shadow-[0_24px_80px_rgba(148,163,184,0.2)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="text-sm font-medium text-slate-900">安全摘要</div>
            <div className="text-sm text-slate-600">{summary}</div>
          </div>
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-600 transition-colors hover:bg-white hover:text-slate-900"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] tracking-[0.18em] text-slate-500">安全等级</div>
          <div className="mt-2 text-sm font-medium text-slate-900">{level}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {points.map((point) => (
            <span
              key={point}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
            >
              {point}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function buildFlowExamples(feature: FeatureAnalysis): FlowExample[] {
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

function createExampleFlow(example: FlowExample): {
  nodes: ExampleFlowNode[];
  edges: ExampleFlowEdge[];
} {
  const highlightedPath = example.path;
  const activeNodeIds = new Set(
    highlightedPath,
  );
  const currentNodeId = null;
  const resultNodeId = null;

  const nodes: ExampleFlowNode[] = getSharedFlowNodes().map((node) => ({
    ...node,
    draggable: false,
    selectable: false,
    style: {
      ...(node.style ?? {}),
      border:
        currentNodeId === node.id
          ? "1px solid rgba(14,165,233,0.75)"
          : resultNodeId === node.id
            ? example.tone === "warning"
              ? "1px solid rgba(245,158,11,0.72)"
              : "1px solid rgba(99,102,241,0.72)"
            : activeNodeIds.has(node.id)
              ? "1px solid rgba(16,185,129,0.62)"
              : "1px solid rgba(203,213,225,0.95)",
      background:
        currentNodeId === node.id
          ? "rgba(224,242,254,0.98)"
          : resultNodeId === node.id
            ? example.tone === "warning"
              ? "rgba(255,247,237,0.98)"
              : "rgba(238,242,255,0.98)"
            : activeNodeIds.has(node.id)
              ? "rgba(236,253,245,0.98)"
              : "rgba(255,255,255,0.98)",
      color: "#334155",
      textAlign: "center",
    },
  }));

  const activeEdges = new Set(
    highlightedPath
      .slice(0, -1)
      .map((nodeId, index, path) => `${nodeId}->${path[index + 1]}`),
  );

  const edges: ExampleFlowEdge[] = getSharedFlowEdges().map((edge) => {
    const edgeKey = `${edge.source}->${edge.target}`;
    const isActive = activeEdges.has(edgeKey);

    return {
      ...edge,
      animated: isActive,
      markerEnd: {
        type: MarkerType.ArrowClosed,
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
    {
      id: "profile",
      type: "step",
      position: { x: 0, y: 112 },
      data: { label: "账号 / 产品" },
    },
    {
      id: "browser",
      type: "decision",
      position: { x: 124, y: 88 },
      data: { label: "允许调研" },
    },
    {
      id: "research",
      type: "step",
      position: { x: 270, y: 20 },
      data: { label: "竞品研究" },
    },
    {
      id: "manual",
      type: "step",
      position: { x: 270, y: 204 },
      data: { label: "手动补充" },
    },
    {
      id: "setup",
      type: "step",
      position: { x: 432, y: 112 },
      data: { label: "图像 / Postiz" },
    },
    {
      id: "revenue",
      type: "decision",
      position: { x: 560, y: 88 },
      data: { label: "接入收入" },
    },
    {
      id: "attribution",
      type: "step",
      position: { x: 706, y: 20 },
      data: { label: "收入归因" },
    },
    {
      id: "views",
      type: "step",
      position: { x: 706, y: 204 },
      data: { label: "仅看曝光" },
    },
    {
      id: "strategy",
      type: "step",
      position: { x: 870, y: 112 },
      data: { label: "生成并排期" },
    },
    {
      id: "report",
      type: "step",
      position: { x: 1014, y: 112 },
      data: { label: "日报复盘" },
    },
    {
      id: "iterate",
      type: "decision",
      position: { x: 1146, y: 88 },
      data: { label: "继续优化" },
    },
    {
      id: "output",
      type: "step",
      position: { x: 1292, y: 112 },
      data: { label: "输出结果" },
    },
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

function buildSafetyPoints(result: ShowcaseResult) {
  const candidates = [
    ...result.safety_analysis.permission_scope,
    ...result.safety_analysis.trust_signals,
    ...result.safety_analysis.findings,
  ];

  const compact = candidates
    .map((item) => shortenText(item.replace(/[，。；：,.]/g, ""), 10))
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index)
    .slice(0, 4);

  return compact.length > 0
    ? compact
    : ["不联网", "不写文件", "整理内容", "输出可查"];
}
