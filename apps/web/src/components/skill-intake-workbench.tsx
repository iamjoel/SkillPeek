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
  Background,
  BackgroundVariant,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import {
  FolderSearch,
  LoaderCircle,
  Play,
  RotateCcw,
  Shield,
  Upload,
  Workflow,
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

const MOCK_SKILL_RESULT: SkillAnalysisResult = {
  status: "success",
  skill_name: "infographic-syntax-creator",
  source: {
    kind: "upload",
    label: "infographic-syntax-creator",
    analyzed_files: ["infographic-syntax-creator/SKILL.md"],
    file_count: 1,
    model: "gemini-3-flash-preview",
  },
  language_note: "输出语言默认跟随用户请求所使用的语言。",
  feature_analysis: {
    skill_name: "infographic-syntax-creator",
    summary: "把用户提供的内容整理成 Infographic DSL，并输出可直接使用的结构化语法。",
    skill_purpose: "将原始内容转换为符合 infographic 模板约束的 DSL 输出。",
    trigger_conditions: [
      "用户要求把文本转成 infographic 语法",
      "用户需要根据内容匹配模板并生成 DSL",
    ],
    non_trigger_conditions: [
      "用户只是在讨论设计方向，没有要求生成 DSL",
      "用户只想看原始文本摘要，不需要结构化语法输出",
    ],
    inputs: ["用户原始内容", "模板偏好或展示目标", "输出语言要求"],
    prechecks: ["确认输入内容完整", "确认适合 infographic 场景", "匹配模板约束"],
    execution_steps: [
      "解析内容中的主题、层级和关键数据",
      "匹配合适的 infographic 模板",
      "将内容映射为结构化 DSL 字段",
      "整理为可直接输出的 plain 代码块",
    ],
    failure_modes: ["输入信息不足", "模板与内容结构不匹配", "关键字段缺失需要回退补全"],
    outputs: ["Infographic DSL 代码块", "结构化模板字段", "必要的回退说明"],
    flow_breakdown: {
      trigger: ["接收 infographic 语法生成请求", "确认属于 DSL 生成场景"],
      input_parsing: ["解析标题、描述、条目和层级关系", "提取关键数据与版式意图"],
      prechecks: ["验证输入是否完整", "检查模板和内容是否匹配"],
      execution: ["构建 data 块", "应用模板配置", "输出 plain 代码块"],
      failure_paths: ["缺失输入时回退补全", "模板冲突时降级到兜底结构"],
      outputs: ["返回可直接使用的 DSL", "附带必要说明"],
    },
    assumptions: ["假设用户提供的内容已经足够支撑一个 infographic 模板输出。"],
    mermaid: `flowchart TD
    A["接收 infographic 请求"] --> B{"是否适合 DSL 生成?"}
    B -- "否" --> C["返回不触发说明"]
    B -- "是" --> D["解析标题、描述与层级"]
    D --> E{"输入是否完整?"}
    E -- "否" --> F["提示补充或自动兜底"]
    E -- "是" --> G["匹配模板并验证结构"]
    G --> H{"预检查是否通过?"}
    H -- "否" --> I["回退到安全模板"]
    H -- "是" --> J["生成 data 块与主题配置"]
    J --> K["输出 plain DSL 代码块"]`,
  },
  safety_analysis: {
    risk_level: "safe",
    is_malicious_or_unsafe: false,
    verdict: "该 Skill 主要用于文本结构化转换，不涉及高风险能力。",
    findings: ["范围集中在内容转换和格式化输出", "没有请求额外系统权限或敏感数据"],
    metadata_review: ["Skill 目的清晰", "输入输出边界明确"],
    permission_scope: ["读取用户提供的文本内容", "输出 DSL 代码块"],
    red_flags: [],
    trust_signals: ["功能单一", "行为可预测", "输出结构明确"],
    blocked_capabilities: [],
    notes: ["适合作为安全的内容生成类 Skill 示例。"],
    mermaid: `flowchart TD
    A["读取 Skill"] --> B["检查元数据"]
    B --> C["检查权限范围"]
    C --> D["扫描红旗内容"]
    D --> E["输出 safe 结论"]`,
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
    <main className="min-h-[calc(100svh-49px)] overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.22),_transparent_34%),radial-gradient(circle_at_78%_12%,_rgba(249,115,22,0.16),_transparent_24%),linear-gradient(180deg,_rgba(2,6,23,0.98),_rgba(2,8,23,1))]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-6 lg:px-8 lg:py-10">
        <section className="rounded-[28px] border border-white/10 bg-white/6 p-6 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_28px_120px_rgba(15,23,42,0.55)] backdrop-blur-xl md:p-8">
          <div className="grid max-w-4xl gap-5">
            <div className="grid gap-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-balance md:text-6xl">
                SkillPeek
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                了解 Skill 功能边界，评估 Skill 安全风险。
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6">
          {!showResultPanel ? (
            <div className="w-full">
              <Card className="border border-white/10 bg-slate-950/88 text-slate-100 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                <CardContent className="grid gap-6 p-6">
                  <div className="inline-flex w-fit border border-white/10 bg-black/20 p-1">
                    <button
                      type="button"
                      className={cn(
                        "px-4 py-2 text-sm transition-colors",
                        inputTab === "upload"
                          ? "bg-sky-500 text-slate-950"
                          : "text-slate-300 hover:bg-white/6 hover:text-white",
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
                          ? "bg-orange-400 text-slate-950"
                          : "text-slate-300 hover:bg-white/6 hover:text-white",
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
                          ? "border-sky-300 bg-sky-400/12"
                          : "border-sky-400/30 bg-sky-500/6",
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
                        <div className="mx-auto inline-flex size-14 items-center justify-center rounded-full border border-sky-400/20 bg-sky-400/10">
                          <Upload className="size-6 text-sky-300" />
                        </div>
                        <div className="grid gap-2">
                          <p className="text-2xl font-medium tracking-[-0.03em] text-white">
                            把要分析的 Skill 拖到这里
                          </p>
                        </div>
                        <div className="flex justify-center">
                          <Button
                            type="button"
                            size="lg"
                            className="bg-sky-500 text-slate-950 hover:bg-sky-400"
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
                    <div className="grid gap-4 border border-white/8 bg-white/3 p-5">
                      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <Input
                          id="repo-url"
                          value={repoUrl}
                          onChange={(event) => setRepoUrl(event.target.value)}
                          placeholder="https://github.com/owner/repo"
                          className="h-11 border-white/10 bg-white/4 text-sm text-slate-50 placeholder:text-slate-500"
                        />
                        <Button
                          type="button"
                          size="lg"
                          className="h-11 bg-orange-500 px-6 text-slate-950 hover:bg-orange-400"
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
            <div className="mx-auto grid w-full max-w-5xl gap-6">
              {!result ? (
                <div className="grid min-h-72 place-items-center rounded-[28px] border border-white/8 bg-slate-950/70 p-8 text-center">
                  <div className="grid gap-3">
                    <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full bg-sky-400/10 text-sky-200">
                      <Workflow className="size-5" />
                    </div>
                    <div className="text-lg font-medium text-white">正在分析</div>
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
    <div className="grid gap-5 text-white">
      <section className="grid gap-4 rounded-[28px] bg-slate-950/78 px-5 py-5 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-2">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] md:text-3xl">
              {result.skill_name}
            </h2>
            <p className="text-sm text-slate-300">{intro}</p>
          </div>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors",
              safety.risk_level === "unsafe"
                ? "border-rose-300/25 bg-rose-400/10 text-rose-100 hover:bg-rose-400/16"
                : safety.risk_level === "caution"
                  ? "border-amber-300/25 bg-amber-400/10 text-amber-100 hover:bg-amber-400/16"
                  : "border-emerald-300/25 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/16",
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
        <div className="flex items-center gap-2 text-sm font-medium text-slate-100">
          <Workflow className="size-4 text-cyan-300" />
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

function StepFlowNode({ data }: NodeProps<ExampleFlowNode>) {
  return (
    <div className="relative rounded-[12px] border border-white/10 bg-slate-950/90 px-2 py-1.5 text-center text-[10px] font-medium text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <Handle type="target" position={Position.Left} className="!size-2 !border-2 !border-white !bg-slate-950" />
      <Handle type="source" position={Position.Right} className="!size-2 !border-2 !border-white !bg-slate-950" />
      <span className="leading-4">{data.label}</span>
    </div>
  );
}

function DecisionFlowNode({ data }: NodeProps<ExampleFlowNode>) {
  return (
    <div className="relative size-[72px]">
      <Handle type="target" position={Position.Left} className="!size-2 !border-2 !border-white !bg-slate-950" />
      <Handle
        id="branch-top"
        type="source"
        position={Position.Right}
        className="!size-2 !border-2 !border-white !bg-slate-950"
        style={{ top: "18%" }}
      />
      <Handle
        id="branch-mid"
        type="source"
        position={Position.Right}
        className="!size-2 !border-2 !border-white !bg-slate-950"
        style={{ top: "50%" }}
      />
      <Handle
        id="branch-bottom"
        type="source"
        position={Position.Right}
        className="!size-2 !border-2 !border-white !bg-slate-950"
        style={{ top: "82%" }}
      />
      <div className="absolute inset-2 rotate-45 rounded-[12px] border border-white/12 bg-slate-950/94 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]" />
      <div className="absolute inset-0 grid place-items-center px-3 text-center text-[10px] font-medium leading-4 text-slate-100">
        {data.label}
      </div>
    </div>
  );
}

function FlowExamplesSection({ examples }: { examples: FlowExample[] }) {
  const [activeId, setActiveId] = useState(examples[0]?.id ?? "");
  const [runIndex, setRunIndex] = useState(-1);
  const [runState, setRunState] = useState<"idle" | "running" | "done">("idle");
  const [showFullscreen, setShowFullscreen] = useState(false);
  const activeExample = examples.find((example) => example.id === activeId) ?? examples[0];

  useEffect(() => {
    if (!activeExample || runState !== "running") {
      return;
    }

    if (runIndex >= activeExample.path.length) {
      setRunState("done");
      return;
    }

    const timer = window.setTimeout(() => {
      setRunIndex((current) => current + 1);
    }, 720);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeExample, runIndex, runState]);

  if (!activeExample) {
    return null;
  }

  const { nodes, edges } = createExampleFlow(activeExample, runIndex, runState);
  const currentStep =
    runState === "running" && runIndex >= 0
      ? getSharedFlowNodeLabel(activeExample.path[runIndex])
      : undefined;

  const runLabel =
    runState === "running"
      ? `运行中：${currentStep ?? "处理中"}`
      : runState === "done"
        ? activeExample.resultLabel
        : "待运行";

  return (
    <div className="grid gap-4 rounded-[28px] bg-slate-950/72 p-4 lg:grid-cols-[168px_1fr]">
      <div className="grid gap-1.5 self-start">
        {examples.map((example) => (
          <button
            key={example.id}
            type="button"
            className={cn(
              "rounded-xl px-3 py-2.5 text-left transition-colors",
              example.id === activeExample.id
                ? "bg-white/10 text-white"
                : "bg-white/4 text-slate-300 hover:bg-white/8 hover:text-white",
            )}
            onClick={() => {
              setActiveId(example.id);
              setRunIndex(-1);
              setRunState("idle");
            }}
          >
            <div className="text-sm font-medium">{example.title}</div>
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="text-base font-medium text-white">{activeExample.title}</div>
            <div className="text-sm text-slate-300">{activeExample.description}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              onClick={() => {
                setShowFullscreen(true);
              }}
            >
              全屏
            </button>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
              {runLabel}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-100 transition-colors hover:bg-white/10 disabled:opacity-50"
              disabled={runState === "running"}
              onClick={() => {
                setRunIndex(0);
                setRunState("running");
              }}
            >
              {runState === "done" ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
              {runState === "done" ? "重跑" : "运行"}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-[20px] bg-white/4">
          <FlowCanvas nodes={nodes} edges={edges} heightClassName="h-52" />
        </div>

        <div className="grid gap-2 rounded-[20px] bg-white/4 px-4 py-4">
          <div className="text-xs tracking-[0.16em] text-slate-500">输出示例</div>
          <div className="text-sm text-slate-200">{activeExample.output}</div>
          <pre className="overflow-x-auto rounded-2xl bg-slate-950/80 px-4 py-3 text-xs leading-6 text-cyan-100">
            <code>{activeExample.preview}</code>
          </pre>
        </div>
      </div>

      {showFullscreen ? (
        <div
          className="fixed inset-0 z-50 bg-slate-950/84 px-4 py-6 backdrop-blur-sm"
          onClick={() => {
            setShowFullscreen(false);
          }}
        >
          <div
            className="mx-auto grid h-full max-w-6xl gap-4 rounded-[28px] bg-slate-950 p-4 text-white shadow-[0_24px_80px_rgba(2,6,23,0.45)] md:p-5"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="grid gap-1">
                <div className="text-base font-medium text-white">{activeExample.title}</div>
                <div className="text-sm text-slate-300">{activeExample.description}</div>
              </div>
              <button
                type="button"
                className="rounded-full bg-white/6 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setShowFullscreen(false);
                }}
              >
                关闭
              </button>
            </div>

            <div className="overflow-hidden rounded-[24px] bg-white/4">
              <FlowCanvas nodes={nodes} edges={edges} heightClassName="h-[72vh]" />
            </div>
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
}: {
  nodes: ExampleFlowNode[];
  edges: Edge[];
  heightClassName: string;
}) {
  return (
    <div className={cn("w-full", heightClassName)}>
      <ReactFlow<ExampleFlowNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={flowNodeTypes}
        fitView
        fitViewOptions={{ padding: 0.28 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnDoubleClick={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="rgba(148, 163, 184, 0.2)"
        />
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
    <div className="fixed inset-0 z-50 bg-slate-950/72 px-4 py-6 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-auto grid max-w-lg gap-4 rounded-[28px] bg-slate-950 px-5 py-5 text-white shadow-[0_24px_80px_rgba(2,6,23,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="grid gap-1">
            <div className="text-sm font-medium text-slate-100">安全摘要</div>
            <div className="text-sm text-slate-300">{summary}</div>
          </div>
          <button
            type="button"
            className="rounded-full bg-white/6 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            onClick={onClose}
          >
            关闭
          </button>
        </div>

        <div className="rounded-2xl bg-white/4 px-4 py-3">
          <div className="text-[11px] tracking-[0.18em] text-slate-500">安全等级</div>
          <div className="mt-2 text-sm font-medium text-white">{level}</div>
        </div>

        <div className="flex flex-wrap gap-2">
          {points.map((point) => (
            <span
              key={point}
              className="rounded-full border border-white/8 bg-white/4 px-3 py-1.5 text-sm text-slate-200"
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
      id: "direct-hit",
      title: "多条目整理",
      description: shortenText("逐条遍历内容，完成后统一生成。", 28),
      output: shortenText(feature.outputs[0] ?? "Infographic DSL 代码块", 24),
      preview: `infographic compare
items:
  - title: "核心信息"
  - title: "逐条整理后输出"`,
      path: ["input", "check", "iterate", "loop", "iterate", "loop", "generate", "output"],
      resultLabel: "已生成结果",
    },
    {
      id: "missing-input",
      title: "信息不足",
      description: shortenText("输入缺失时，返回补充提示。", 28),
      output: shortenText(feature.failure_modes[0] ?? "补充信息提示", 24),
      preview: `缺少必要输入：
- 标题
- 条目内容`,
      path: ["input", "check", "missing", "output"],
      resultLabel: "已返回提示",
      tone: "warning",
    },
    {
      id: "structure-fallback",
      title: "结构回退",
      description: shortenText("结构异常时，走兜底并继续输出。", 28),
      output: shortenText(feature.outputs.at(-1) ?? "可用结果或说明", 24),
      preview: `已切换兜底结构：
items:
  - label: "保守输出"`,
      path: ["input", "check", "fallback", "iterate", "loop", "generate", "output"],
      resultLabel: "已调整输出",
    },
  ];
}

function createExampleFlow(
  example: FlowExample,
  runIndex = -1,
  runState: "idle" | "running" | "done" = "idle",
): {
  nodes: ExampleFlowNode[];
  edges: Edge[];
} {
  const highlightedPath =
    runState === "running" ? example.path.slice(0, Math.max(runIndex, 0) + 1) : example.path;
  const activeNodeIds = new Set(
    highlightedPath,
  );
  const currentNodeId =
    runState === "running" && runIndex >= 0 ? example.path[Math.min(runIndex, example.path.length - 1)] : null;
  const resultNodeId = runState === "done" ? example.path[example.path.length - 1] : null;

  const nodes: ExampleFlowNode[] = getSharedFlowNodes().map((node) => ({
    ...node,
    draggable: false,
    selectable: false,
    style: {
      ...(node.style ?? {}),
      border:
        currentNodeId === node.id
          ? "1px solid rgba(103,232,249,0.7)"
          : resultNodeId === node.id
            ? example.tone === "warning"
              ? "1px solid rgba(251,191,36,0.7)"
              : "1px solid rgba(167,139,250,0.7)"
            : activeNodeIds.has(node.id)
              ? "1px solid rgba(52,211,153,0.55)"
              : "1px solid rgba(255,255,255,0.08)",
      background:
        currentNodeId === node.id
          ? "rgba(8,145,178,0.18)"
          : resultNodeId === node.id
            ? example.tone === "warning"
              ? "rgba(180,83,9,0.18)"
              : "rgba(109,40,217,0.18)"
            : activeNodeIds.has(node.id)
              ? "rgba(5,150,105,0.12)"
              : "rgba(15,23,42,0.92)",
      color: "#e2e8f0",
      textAlign: "center",
    },
  }));

  const activeEdges = new Set(
    highlightedPath
      .slice(0, -1)
      .map((nodeId, index, path) => `${nodeId}->${path[index + 1]}`),
  );

  const edges: Edge[] = getSharedFlowEdges().map((edge) => {
    const edgeKey = `${edge.source}->${edge.target}`;
    const isActive = activeEdges.has(edgeKey);

    return {
      ...edge,
      animated: isActive,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: isActive ? "rgba(103,232,249,0.8)" : "rgba(148,163,184,0.35)",
        width: 16,
        height: 16,
      },
      style: {
        ...(edge.style ?? {}),
        stroke: isActive ? "rgba(103,232,249,0.8)" : "rgba(148,163,184,0.35)",
        strokeWidth: isActive ? 2.2 : 1.4,
      },
    };
  });

  return { nodes, edges };
}

function getSharedFlowNodeLabel(nodeId: string) {
  return (
    getSharedFlowNodes().find((node) => node.id === nodeId)?.data.label ?? "处理中"
  );
}

function getSharedFlowNodes(): ExampleFlowNode[] {
  return [
    {
      id: "input",
      type: "step",
      position: { x: 0, y: 104 },
      data: { label: "输入内容" },
    },
    {
      id: "check",
      type: "decision",
      position: { x: 108, y: 84 },
      data: { label: "检查条件" },
    },
    {
      id: "iterate",
      type: "step",
      position: { x: 256, y: 16 },
      data: { label: "遍历条目" },
    },
    {
      id: "loop",
      type: "decision",
      position: { x: 388, y: 0 },
      data: { label: "继续迭代" },
    },
    {
      id: "generate",
      type: "step",
      position: { x: 512, y: 16 },
      data: { label: "生成结果" },
    },
    {
      id: "missing",
      type: "step",
      position: { x: 256, y: 104 },
      data: { label: "返回提示" },
    },
    {
      id: "fallback",
      type: "step",
      position: { x: 256, y: 192 },
      data: { label: "调整输出" },
    },
    {
      id: "output",
      type: "step",
      position: { x: 644, y: 104 },
      data: { label: "最终输出" },
    },
  ];
}

function getSharedFlowEdges(): Edge[] {
  return [
    { id: "input-check", source: "input", target: "check", type: "smoothstep" },
    {
      id: "check-iterate",
      source: "check",
      sourceHandle: "branch-top",
      target: "iterate",
      type: "smoothstep",
      label: "通过",
      labelStyle: {
        fill: "rgba(226,232,240,0.92)",
        fontSize: 10,
        fontWeight: 500,
      },
      labelShowBg: true,
      labelBgStyle: {
        fill: "rgba(15,23,42,0.92)",
        stroke: "rgba(255,255,255,0.08)",
      },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 999,
    },
    {
      id: "check-missing",
      source: "check",
      sourceHandle: "branch-mid",
      target: "missing",
      type: "smoothstep",
      label: "缺失",
      labelStyle: {
        fill: "rgba(226,232,240,0.92)",
        fontSize: 10,
        fontWeight: 500,
      },
      labelShowBg: true,
      labelBgStyle: {
        fill: "rgba(15,23,42,0.92)",
        stroke: "rgba(255,255,255,0.08)",
      },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 999,
    },
    {
      id: "check-fallback",
      source: "check",
      sourceHandle: "branch-bottom",
      target: "fallback",
      type: "smoothstep",
      label: "异常",
      labelStyle: {
        fill: "rgba(226,232,240,0.92)",
        fontSize: 10,
        fontWeight: 500,
      },
      labelShowBg: true,
      labelBgStyle: {
        fill: "rgba(15,23,42,0.92)",
        stroke: "rgba(255,255,255,0.08)",
      },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 999,
    },
    { id: "iterate-loop", source: "iterate", target: "loop", type: "smoothstep" },
    {
      id: "loop-iterate",
      source: "loop",
      sourceHandle: "branch-top",
      target: "iterate",
      type: "smoothstep",
      label: "继续",
      labelStyle: {
        fill: "rgba(226,232,240,0.92)",
        fontSize: 10,
        fontWeight: 500,
      },
      labelShowBg: true,
      labelBgStyle: {
        fill: "rgba(15,23,42,0.92)",
        stroke: "rgba(255,255,255,0.08)",
      },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 999,
    },
    {
      id: "loop-generate",
      source: "loop",
      sourceHandle: "branch-mid",
      target: "generate",
      type: "smoothstep",
      label: "完成",
      labelStyle: {
        fill: "rgba(226,232,240,0.92)",
        fontSize: 10,
        fontWeight: 500,
      },
      labelShowBg: true,
      labelBgStyle: {
        fill: "rgba(15,23,42,0.92)",
        stroke: "rgba(255,255,255,0.08)",
      },
      labelBgPadding: [6, 3],
      labelBgBorderRadius: 999,
    },
    { id: "generate-output", source: "generate", target: "output", type: "smoothstep" },
    { id: "missing-output", source: "missing", target: "output", type: "smoothstep" },
    { id: "fallback-iterate", source: "fallback", target: "iterate", type: "smoothstep" },
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
