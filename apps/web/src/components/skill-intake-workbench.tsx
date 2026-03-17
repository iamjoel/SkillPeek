import "@xyflow/react/dist/style.css";
import { Button } from "@my-better-t-app/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@my-better-t-app/ui/components/card";
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
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import {
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

import { trpcClient } from "@/utils/trpc";

const ACCEPTED_FILE_PATTERN =
  /\.(md|mdx|txt|json|ya?ml|toml|ini|cfg|conf|ts|tsx|js|jsx|mjs|cjs)$/i;

type UploadedSkillFile = {
  path: string;
  content: string;
  size: number;
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null;
};

type SkillAnalysisResult = Awaited<ReturnType<typeof trpcClient.analyzeSkill.mutate>>;
type FeatureAnalysis = SkillAnalysisResult["feature_analysis"];
type ExampleFlowNodeData = { label: string };
type ExampleFlowEdgeData = {
  labelOffsetX?: number;
  labelOffsetY?: number;
  route?: "loop-back";
  lift?: number;
};
type FlowExample = {
  id: string;
  title: string;
  description: string;
  output: string;
  preview: string;
  path: string[];
  resultLabel: string;
  tone?: "default" | "warning";
};
type ExampleFlowNode = Node<ExampleFlowNodeData, "step" | "decision">;
type ExampleFlowEdge = Edge<ExampleFlowEdgeData>;

const MOCK_SKILL_RESULT: SkillAnalysisResult = {
  status: "success",
  skill_name: "Larry",
  source: {
    kind: "upload",
    label: "Larry · ClawHub",
    analyzed_files: ["https://clawhub.ai/OllieWazza/larry"],
    file_count: 1,
    model: "gemini-3-flash-preview",
  },
  language_note: "输出语言默认跟随用户请求所使用的语言。",
  feature_analysis: {
    skill_name: "Larry",
    summary: "自动化 TikTok 幻灯片营销，从研究、生成到复盘迭代。",
    skill_purpose: "将竞品研究、内容生成、发布和效果追踪串成可循环优化的营销流程。",
    trigger_conditions: [
      "用户要为 app 或产品搭建 TikTok 幻灯片营销流程",
      "用户希望自动研究竞品、生成素材并持续复盘优化",
    ],
    non_trigger_conditions: [
      "用户只想做一次性文案润色，不需要整套投放流程",
      "用户不准备连接外部平台或提供营销数据",
    ],
    inputs: ["产品信息", "目标受众", "竞品线索", "可用渠道与账号配置"],
    prechecks: ["确认定位清晰", "检查配置与密钥", "确认可访问外部服务"],
    execution_steps: [
      "研究竞品内容与热点形式",
      "批量生成图像、文案和字幕",
      "发布到 TikTok 与分发平台",
      "回收分析数据并调整下一轮选题",
    ],
    failure_modes: ["产品信息不足", "配置缺失", "外部平台返回异常"],
    outputs: ["TikTok 内容计划", "可发布素材", "复盘建议与下一轮方向"],
    flow_breakdown: {
      trigger: ["接收 TikTok 营销搭建请求", "确认属于自动化营销场景"],
      input_parsing: ["整理产品定位与目标用户", "收集竞品和渠道配置"],
      prechecks: ["验证配置是否完整", "确认外部服务可用"],
      execution: ["研究竞品", "生成素材", "发布内容", "复盘效果并迭代"],
      failure_paths: ["信息缺失时提示补充", "服务异常时切换为保守输出"],
      outputs: ["返回内容计划", "给出可发布结果与下一步建议"],
    },
    assumptions: ["假设用户已经准备好产品信息，并愿意连接营销所需的外部服务。"],
    mermaid: `flowchart TD
    A["接收 TikTok 营销请求"] --> B{"信息与配置是否可用?"}
    B -- "否" --> C["返回不触发说明"]
    B -- "是" --> D["研究竞品与热点"]
    D --> E["生成图像、文案与字幕"]
    E --> F{"发布结果是否达标?"}
    F -- "否" --> G["调整策略并继续迭代"]
    F -- "是" --> H["输出可复用内容流程"]`,
  },
  safety_analysis: {
    risk_level: "caution",
    is_malicious_or_unsafe: false,
    verdict: "能力边界清楚，但依赖外部平台和密钥配置，使用前应隔离验证。",
    findings: ["会调用外部营销与图像服务", "需要配置 Postiz 与图像生成密钥"],
    metadata_review: ["用途明确", "配置需求与元数据存在落差"],
    permission_scope: ["读取本地配置", "写入报告文件", "调用外部 API"],
    red_flags: ["涉及敏感密钥", "会写入本地分析文件"],
    trust_signals: ["目标清晰", "流程可审查", "输出可复盘"],
    blocked_capabilities: [],
    notes: ["适合在沙箱或测试环境中验证后再接入真实账号。"],
    mermaid: `flowchart TD
    A["读取 Skill"] --> B["检查元数据"]
    B --> C["检查权限范围"]
    C --> D["扫描密钥与外部调用"]
    D --> E["输出 caution 结论"]`,
  },
};

const riskLevelLabels: Record<
  SkillAnalysisResult["safety_analysis"]["risk_level"],
  string
> = {
  safe: "安全",
  caution: "低风险",
  unsafe: "高风险",
};

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
            size: file.size,
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
    : analyzeSkill.data ?? (showMockResult ? MOCK_SKILL_RESULT : undefined);
  const showResultPanel = analyzeSkill.isPending || Boolean(result);

  return (
    <main className="min-h-[calc(100svh-49px)] overflow-y-auto bg-transparent">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-6 lg:px-8 lg:py-10">
        <section className="rounded-[28px] border border-slate-200/80 bg-white/88 p-6 text-slate-950 shadow-[0_18px_60px_rgba(148,163,184,0.18)] backdrop-blur-xl md:p-8">
          <div className="grid max-w-4xl gap-5">
            <div className="grid gap-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-balance md:text-6xl">
                SkillPeek
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
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

function FeatureTab({ result }: { result: SkillAnalysisResult }) {
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
    <div className="grid gap-5 text-slate-900">
      <section className="grid gap-4 rounded-[28px] border border-slate-200/80 bg-white/92 px-5 py-5 shadow-[0_18px_50px_rgba(148,163,184,0.16)] md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-2">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] md:text-3xl">
              {result.skill_name}
            </h2>
            <p className="text-sm text-slate-600">{intro}</p>
          </div>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
              safety.risk_level === "unsafe"
                ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                : safety.risk_level === "caution"
                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
            )}
            onClick={() => {
              setShowSafetyModal(true);
            }}
          >
            <Shield className="size-3.5" />
            {riskLevelLabels[safety.risk_level]}
          </button>
        </div>
      </section>

      <section className="grid gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
          <Workflow className="size-4 text-sky-600" />
          流程示例
        </div>
        <FlowExamplesSection examples={examples} />
      </section>

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
    </div>
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
    <div className="relative rounded-[12px] border border-slate-200 bg-white px-2 py-1.5 text-center text-[10px] font-medium text-slate-700 shadow-[0_6px_18px_rgba(148,163,184,0.12)]">
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
      <div className="absolute inset-2 rotate-45 rounded-[12px] border border-slate-200 bg-white shadow-[0_6px_18px_rgba(148,163,184,0.12)]" />
      <div className="absolute inset-0 grid place-items-center px-3 text-center text-[10px] font-medium leading-4 text-slate-700">
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
              transform: `translate(-50%, -50%) translate(${labelX + (data?.labelOffsetX ?? 0)}px, ${
                labelY + (data?.labelOffsetY ?? 0)
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
    <div className="grid gap-4 rounded-[28px] border border-slate-200/80 bg-white/92 p-4 shadow-[0_18px_50px_rgba(148,163,184,0.14)] lg:grid-cols-[168px_1fr]">
      <div className="grid gap-1.5 self-start">
        {examples.map((example) => (
          <button
            key={example.id}
            type="button"
            className={cn(
              "rounded-xl px-3 py-2.5 text-left transition-colors",
              example.id === activeExample.id
                ? "bg-slate-900 text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
            onClick={() => {
              setActiveId(example.id);
            }}
          >
            <div className="text-sm font-medium">{example.title}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="text-base font-medium text-slate-900">{activeExample.title}</div>
            <div className="text-sm text-slate-600">{activeExample.description}</div>
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50/80">
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
          <FlowCanvas nodes={nodes} edges={edges} heightClassName="h-52" />
        </div>

        <div className="grid gap-2 rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-4">
          <div className="text-xs tracking-[0.16em] text-slate-500">输出示例</div>
          <div className="text-sm text-slate-700">{activeExample.output}</div>
          <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs leading-6 text-slate-700">
            <code>{activeExample.preview}</code>
          </pre>
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
  edges: Edge[];
  heightClassName: string;
  interactive?: boolean;
}) {
  return (
    <div className={cn("w-full", heightClassName)}>
      <ReactFlow<ExampleFlowNode, Edge>
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
          size={1}
          color="rgba(148, 163, 184, 0.3)"
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
      resultLabel: "已进入优化循环",
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
      resultLabel: "已切到手动模式",
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
      resultLabel: "已输出曝光建议",
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

function buildSafetyPoints(result: SkillAnalysisResult) {
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
