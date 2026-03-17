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
  Controls,
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
  CheckCheck,
  CircleAlert,
  FolderSearch,
  LoaderCircle,
  MoreHorizontal,
  Orbit,
  Play,
  RotateCcw,
  ShieldAlert,
  Shield,
  Sparkles,
  Upload,
  Workflow,
} from "lucide-react";
import {
  startTransition,
  type DragEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
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
type FlowDemoState = "idle" | "running" | "done" | "warning" | "result";
type FlowDemoNodeData = {
  title: string;
  detail: string;
  state: FlowDemoState;
};
type FlowDemoStep = {
  id: string;
  title: string;
  detail: string;
};
type FlowDemoExample = {
  id: string;
  name: string;
  summary: string;
  resultLabel: string;
  resultValue: string;
  outcome: "success" | "warning";
  steps: FlowDemoStep[];
};
type FlowDemoNode = Node<FlowDemoNodeData, "status">;

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

const statusBadges = ["结构化输出", "流程可解释", "结果可预期"];

const riskLevelLabels: Record<
  SkillAnalysisResult["safety_analysis"]["risk_level"],
  string
> = {
  safe: "安全",
  caution: "注意",
  unsafe: "高风险",
};

const flowNodeTypes = {
  status: FlowStatusNode,
} satisfies NodeTypes;

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
  const [activeTab, setActiveTab] = useState<"feature" | "security">("feature");
  const [showMockResult, setShowMockResult] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeSkill = useMutation({
    mutationFn: (input: Parameters<typeof trpcClient.analyzeSkill.mutate>[0]) => {
      return trpcClient.analyzeSkill.mutate(input);
    },
    onSuccess: () => {
      setActiveTab("feature");
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
  const riskLevel = result?.safety_analysis.risk_level ?? "safe";
  const showResultPanel = analyzeSkill.isPending || Boolean(result);

  function handleRetryUpload() {
    analyzeSkill.reset();
    setRepoUrl("");
    setShowMockResult(false);
    setInputTab("upload");
    setActiveTab("feature");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
            <div className="mx-auto grid w-full max-w-6xl gap-6">
              <Card className="border border-white/10 bg-slate-950/88 text-slate-100 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
                <CardHeader className="border-b border-white/8 pb-5">
                  <CardTitle className="flex items-center justify-between gap-3 text-base text-white">
                    <span className="flex items-center gap-2">
                      <Workflow className="size-4 text-sky-300" />
                      结果
                    </span>
                    {result ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-2 border px-2.5 py-1 text-[11px] tracking-[0.18em] uppercase",
                          riskLevel === "unsafe"
                            ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
                            : riskLevel === "caution"
                              ? "border-amber-400/30 bg-amber-400/10 text-amber-200"
                              : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
                        )}
                      >
                        <Shield className="size-3.5" />
                        {riskLevelLabels[riskLevel]}
                      </span>
                    ) : null}
                  </CardTitle>
                  <CardDescription className="flex items-center justify-between gap-3 text-slate-400">
                    <span>
                      {result ? `源: ${result.source.label} · 已分析 ${result.source.file_count} 个文件` : "正在分析..."}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                      onClick={handleRetryUpload}
                    >
                      再试上传
                    </Button>
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-6 pt-5">
                  {!result ? (
                    <div className="grid min-h-96 place-items-center border border-dashed border-white/10 bg-white/3 p-8 text-center">
                      <div className="grid max-w-sm gap-4">
                        <div className="mx-auto inline-flex size-14 items-center justify-center rounded-full border border-sky-400/20 bg-sky-400/10">
                          <Workflow className="size-5 text-sky-200" />
                        </div>
                        <div className="text-xl font-medium text-white">正在分析</div>
                        <p className="text-sm leading-7 text-slate-400">
                          结果准备好后会显示功能和安全两个 tab。
                        </p>
                        <div className="mx-auto flex gap-2 text-xs text-slate-400">
                          <span className="border border-white/10 bg-black/20 px-3 py-1.5">功能</span>
                          <span className="border border-white/10 bg-black/20 px-3 py-1.5">安全</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="border border-white/8 bg-white/3 px-4 py-3 text-sm leading-7 text-slate-300">
                        <span className="font-semibold text-white">{result.skill_name}</span>
                        <span className="text-slate-400"> · </span>
                        {result.feature_analysis.summary}
                      </div>

                      <div className="inline-flex w-fit border border-white/10 bg-black/20 p-1">
                        <button
                          type="button"
                          className={cn(
                            "px-4 py-2 text-sm transition-colors",
                            activeTab === "feature"
                              ? "bg-sky-500 text-slate-950"
                              : "text-slate-300 hover:bg-white/6 hover:text-white",
                          )}
                          onClick={() => setActiveTab("feature")}
                        >
                          功能
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "px-4 py-2 text-sm transition-colors",
                            activeTab === "security"
                              ? "bg-amber-400 text-slate-950"
                              : "text-slate-300 hover:bg-white/6 hover:text-white",
                          )}
                          onClick={() => setActiveTab("security")}
                        >
                          安全
                        </button>
                      </div>

                      {activeTab === "feature" ? (
                        <FeatureTab result={result} />
                      ) : (
                        <SecurityTab result={result} />
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function FeatureTab({ result }: { result: SkillAnalysisResult }) {
  const feature = result.feature_analysis;
  const outputs = feature.outputs.slice(0, 4);

  return (
    <div className="grid gap-8">
      <section className="relative overflow-hidden rounded-[32px] border border-cyan-400/12 bg-[linear-gradient(135deg,rgba(8,47,73,0.52),rgba(15,23,42,0.94)_45%,rgba(30,41,59,0.92))] p-6 text-white shadow-[0_24px_100px_rgba(6,182,212,0.12)] md:p-8">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.24),transparent_52%)]" />
        <div className="relative grid gap-6">
          <div className="grid gap-5">
            <div className="flex flex-wrap gap-2">
              {statusBadges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-cyan-300/18 bg-cyan-400/10 px-3 py-1 text-[11px] tracking-[0.18em] text-cyan-100"
                >
                  {badge}
                </span>
              ))}
            </div>

            <div className="grid gap-3">
              <div className="text-sm tracking-[0.22em] text-cyan-100/70">技能名称</div>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-balance md:text-5xl">
                {result.skill_name}
              </h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryBlock
                label="技能目的"
                value={feature.skill_purpose}
              />
              <SummaryBlock
                label="最终产物"
                value={outputs[0] ?? "返回结构化结果，方便直接继续使用。"}
              />
            </div>
          </div>

          <SkillFlowShowcase feature={feature} />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <ShowcaseSection
          eyebrow="如何工作"
          title="从输入到生成，中间发生了什么"
          description="把输入、校验和执行步骤拆开，便于快速理解 Skill 的运行方式。"
        >
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <TagCard
                title="输入信息"
                icon={<Orbit className="size-4 text-cyan-200" />}
                items={feature.inputs}
                emptyLabel="未给出输入要求。"
              />
              <ChecklistCard
                title="校验项"
                items={feature.prechecks}
                emptyLabel="没有额外校验项。"
              />
            </div>
            <TimelineCard
              title="执行流程"
              items={feature.execution_steps}
              emptyLabel="未给出执行步骤。"
            />
            <MoreUsagePanel feature={feature} />
          </div>
        </ShowcaseSection>

        <div className="grid gap-4">
          <Card className="overflow-hidden border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(8,47,73,0.22),rgba(15,23,42,0.94))] text-slate-100 shadow-[0_20px_70px_rgba(6,182,212,0.12)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-white">输出结果</CardTitle>
              <CardDescription className="text-sm leading-6 text-slate-300">
                最终交付会以清晰、可继续处理的结果形式返回。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3">
                {feature.outputs.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-cyan-300/12 bg-cyan-400/8 p-4"
                  >
                    <div className="text-sm font-medium text-cyan-50">{item}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/8 bg-slate-950/70 p-4">
                <div className="text-xs tracking-[0.2em] text-slate-500">交付说明</div>
                <div className="mt-3 grid gap-3 text-sm leading-7 text-slate-300">
                  <p>{result.language_note}</p>
                  <p>{feature.summary}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-amber-400/16 bg-[linear-gradient(180deg,rgba(120,53,15,0.18),rgba(15,23,42,0.94))] text-slate-100">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xl text-white">
                <CircleAlert className="size-5 text-amber-200" />
                常见失败情况
              </CardTitle>
              <CardDescription className="text-sm leading-6 text-slate-300">
                这些情况通常意味着输入不足、结构冲突，或需要走兜底方案。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {feature.failure_modes.length === 0 ? (
                <div className="rounded-2xl border border-white/8 bg-white/4 p-4 text-sm leading-6 text-slate-300">
                  没有明显的失败模式，整体流程相对稳定。
                </div>
              ) : (
                feature.failure_modes.map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-amber-300/14 bg-amber-400/8 p-4 text-sm leading-6 text-amber-50"
                  >
                    {item}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function SecurityTab({ result }: { result: SkillAnalysisResult }) {
  const safety = result.safety_analysis;

  return (
    <div className="grid gap-4">
      <InfoList title="审查结论" items={safety.findings} emptyLabel="没有额外发现。" />

      <div className="grid gap-4 md:grid-cols-2">
        <InfoList
          title="元数据检查"
          items={safety.metadata_review}
          emptyLabel="未给出。"
        />
        <InfoList
          title="权限范围"
          items={safety.permission_scope}
          emptyLabel="未给出。"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoList title="风险信号" items={safety.red_flags} emptyLabel="未发现明显红旗。" />
        <InfoList title="可信依据" items={safety.trust_signals} emptyLabel="未给出。" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoList
          title="需要阻断的能力"
          items={safety.blocked_capabilities}
          emptyLabel="没有需要阻断的能力项。"
        />
        <InfoList title="补充说明" items={safety.notes} emptyLabel="没有额外备注。" />
      </div>
    </div>
  );
}

function SkillFlowShowcase({ feature }: { feature: FeatureAnalysis }) {
  const examples = buildFlowExamples(feature);
  const [selectedExampleId, setSelectedExampleId] = useState(examples[0]?.id ?? "");
  const [runIndex, setRunIndex] = useState(-1);
  const [runState, setRunState] = useState<"idle" | "running" | "done">("idle");

  const selectedExample = examples.find((example) => example.id === selectedExampleId) ?? examples[0];
  const flowNodes = createFlowDemoNodes(selectedExample, runIndex, runState);
  const flowEdges = createFlowDemoEdges(selectedExample, runIndex, runState);
  const currentStep =
    runState === "running" && runIndex >= 0 ? selectedExample.steps[runIndex] : undefined;

  useEffect(() => {
    if (runState !== "running" || !selectedExample) {
      return;
    }

    if (runIndex >= selectedExample.steps.length) {
      setRunState("done");
      return;
    }

    const timer = window.setTimeout(() => {
      setRunIndex((current) => current + 1);
    }, 820);

    return () => {
      window.clearTimeout(timer);
    };
  }, [runIndex, runState, selectedExample]);

  useEffect(() => {
    startTransition(() => {
      setSelectedExampleId(examples[0]?.id ?? "");
      setRunIndex(-1);
      setRunState("idle");
    });
  }, [feature.skill_name]);

  if (!selectedExample) {
    return null;
  }

  const runLabel =
    runState === "running"
      ? `正在运行 · ${currentStep?.title ?? "准备中"}`
      : runState === "done"
        ? selectedExample.outcome === "warning"
          ? "已完成 · 已走回退路径"
          : "已完成 · 已生成结果"
        : "等待运行";

  return (
    <div className="grid gap-5 rounded-[30px] border border-white/10 bg-slate-950/36 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] md:p-5">
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr] xl:items-start">
        <div className="grid gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
            <Sparkles className="size-4" />
            流程示例
          </div>
          <div className="max-w-xl text-sm leading-7 text-slate-300">
            不用看抽象说明，直接运行 3 个典型路径，观察它如何读取输入、执行校验并返回结果。
          </div>
          <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1">
            {examples.map((example) => (
              <button
                key={example.id}
                type="button"
                className={cn(
                  "grid gap-2 rounded-[22px] border px-4 py-4 text-left transition-all",
                  example.id === selectedExample.id
                    ? "border-cyan-300/28 bg-cyan-400/12 shadow-[0_12px_40px_rgba(34,211,238,0.12)]"
                    : "border-white/8 bg-white/4 hover:border-white/14 hover:bg-white/6",
                )}
                onClick={() => {
                  startTransition(() => {
                    setSelectedExampleId(example.id);
                    setRunIndex(-1);
                    setRunState("idle");
                  });
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-white">{example.name}</div>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-1 text-[10px] tracking-[0.18em]",
                      example.outcome === "warning"
                        ? "border-amber-300/20 bg-amber-400/10 text-amber-100"
                        : "border-cyan-300/20 bg-cyan-400/10 text-cyan-100",
                    )}
                  >
                    {example.outcome === "warning" ? "回退" : "直达"}
                  </span>
                </div>
                <div className="text-sm leading-6 text-slate-300">{example.summary}</div>
              </button>
            ))}
          </div>
        </div>

        <Card className="overflow-hidden border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(2,6,23,0.82))] text-slate-100 shadow-[0_24px_80px_rgba(2,6,23,0.3)]">
          <CardHeader className="gap-4 border-b border-white/8 pb-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="grid gap-2">
                <CardTitle className="text-xl text-white">{selectedExample.name}</CardTitle>
                <CardDescription className="text-sm leading-6 text-slate-300">
                  {selectedExample.summary}
                </CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                disabled={runState === "running"}
                onClick={() => {
                  setRunIndex(0);
                  setRunState("running");
                }}
              >
                {runState === "done" ? <RotateCcw className="size-4" /> : <Play className="size-4" />}
                {runState === "done" ? "重新运行" : "运行示例"}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                {runLabel}
              </span>
              <span>
                {runState === "idle"
                  ? "点击运行后会逐步点亮当前步骤。"
                  : runState === "running"
                    ? "当前节点与连线会实时高亮。"
                    : "流程结束后会显示最终输出。"}
              </span>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 p-4 md:p-5">
            <div className="overflow-hidden rounded-[24px] border border-white/8 bg-slate-950/70">
              <div className="h-[380px] w-full">
                <ReactFlow<FlowDemoNode, Edge>
                  key={selectedExample.id}
                  nodes={flowNodes}
                  edges={flowEdges}
                  nodeTypes={flowNodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.14 }}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  panOnDrag
                  zoomOnDoubleClick={false}
                  minZoom={0.7}
                >
                  <Background
                    variant={BackgroundVariant.Dots}
                    gap={18}
                    size={1}
                    color="rgba(148, 163, 184, 0.22)"
                  />
                  <Controls position="bottom-right" showInteractive={false} />
                </ReactFlow>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="rounded-[24px] border border-white/8 bg-white/4 p-4">
                <div className="text-xs tracking-[0.18em] text-slate-500">当前状态</div>
                <div className="mt-3 text-base font-medium text-white">
                  {runState === "idle"
                    ? "还没有开始运行"
                    : runState === "running"
                      ? currentStep?.title ?? "正在准备"
                      : selectedExample.resultLabel}
                </div>
                <div className="mt-2 text-sm leading-7 text-slate-300">
                  {runState === "idle"
                    ? "点击运行后，会依次展示分析 Skill 的每一个关键动作。"
                    : runState === "running"
                      ? currentStep?.detail
                      : selectedExample.resultValue}
                </div>
              </div>

              <div className="rounded-[24px] border border-cyan-300/12 bg-cyan-400/8 p-4">
                <div className="text-xs tracking-[0.18em] text-cyan-100/70">最终输出</div>
                <div className="mt-3 text-base font-medium text-white">{selectedExample.resultLabel}</div>
                <div className="mt-2 text-sm leading-7 text-slate-100">{selectedExample.resultValue}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FlowStatusNode({
  data,
}: NodeProps<FlowDemoNode>) {
  const stateClass =
    data.state === "running"
      ? "border-cyan-300/30 bg-cyan-400/12 shadow-[0_0_0_1px_rgba(34,211,238,0.12),0_16px_40px_rgba(34,211,238,0.12)]"
      : data.state === "done"
        ? "border-emerald-300/24 bg-emerald-400/10"
        : data.state === "warning"
          ? "border-amber-300/24 bg-amber-400/10"
          : data.state === "result"
            ? "border-violet-300/24 bg-violet-400/12"
            : "border-white/8 bg-slate-950/80";

  const dotClass =
    data.state === "running"
      ? "bg-cyan-300 shadow-[0_0_16px_rgba(34,211,238,0.7)]"
      : data.state === "done"
        ? "bg-emerald-300"
        : data.state === "warning"
          ? "bg-amber-300"
          : data.state === "result"
            ? "bg-violet-300"
            : "bg-slate-500";

  return (
    <div className={cn("w-[220px] rounded-[22px] border p-4 text-left backdrop-blur-sm", stateClass)}>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <Handle type="source" position={Position.Right} className="!opacity-0" />
      <div className="flex items-center gap-2">
        <span className={cn("size-2.5 rounded-full", dotClass)} />
        <span className="text-[11px] tracking-[0.18em] text-slate-400">
          {data.state === "running"
            ? "RUNNING"
            : data.state === "done"
              ? "DONE"
              : data.state === "warning"
                ? "FALLBACK"
                : data.state === "result"
                  ? "OUTPUT"
                  : "WAITING"}
        </span>
      </div>
      <div className="mt-3 text-sm font-medium text-white">{data.title}</div>
      <div className="mt-2 text-xs leading-6 text-slate-300">{data.detail}</div>
    </div>
  );
}

function buildFlowExamples(feature: FeatureAnalysis): FlowDemoExample[] {
  return [
    {
      id: "direct-hit",
      name: "标准命中",
      summary: "输入完整、结构清晰时，流程会直接进入生成阶段并返回最终结果。",
      resultLabel: "输出结果",
      resultValue: feature.outputs[0] ?? "返回结构化结果。",
      outcome: "success",
      steps: [
        {
          id: "receive",
          title: "接收请求",
          detail: feature.trigger_conditions[0] ?? feature.skill_purpose,
        },
        {
          id: "parse",
          title: "解析输入",
          detail: feature.inputs[0] ?? "读取用户输入与上下文。",
        },
        {
          id: "check",
          title: "执行校验",
          detail: feature.prechecks[0] ?? "确认输入完整、结构可用。",
        },
        {
          id: "generate",
          title: "生成结果",
          detail: feature.execution_steps[0] ?? "进入主流程，组织最终输出。",
        },
        {
          id: "deliver",
          title: "返回输出",
          detail: feature.outputs[0] ?? "交付结构化结果。",
        },
      ],
    },
    {
      id: "missing-input",
      name: "信息不足",
      summary: "当关键输入缺失时，流程会停在校验阶段，并直接返回补充说明。",
      resultLabel: "回退结果",
      resultValue: feature.failure_modes[0] ?? "提示补充必要输入后再继续。",
      outcome: "warning",
      steps: [
        {
          id: "receive",
          title: "接收请求",
          detail: feature.trigger_conditions[0] ?? "识别到需要调用这个 Skill。",
        },
        {
          id: "parse",
          title: "整理输入",
          detail: feature.inputs[1] ?? feature.inputs[0] ?? "整理现有输入。",
        },
        {
          id: "check",
          title: "发现缺失",
          detail: feature.prechecks[0] ?? "校验时发现必要字段不足。",
        },
        {
          id: "fallback",
          title: "返回补充说明",
          detail: feature.failure_modes[0] ?? "请用户补充缺失信息。",
        },
      ],
    },
    {
      id: "structure-fallback",
      name: "结构回退",
      summary: "当模板与内容结构不匹配时，会走兜底路径，尽量交付一个可用结果。",
      resultLabel: "兜底输出",
      resultValue:
        feature.failure_modes[1] ?? feature.outputs.at(-1) ?? "回退到保守结构后继续输出。",
      outcome: "success",
      steps: [
        {
          id: "receive",
          title: "接收请求",
          detail: feature.trigger_conditions[1] ?? feature.skill_purpose,
        },
        {
          id: "parse",
          title: "提取结构",
          detail: feature.inputs[0] ?? "先读取标题、内容和结构。",
        },
        {
          id: "conflict",
          title: "发现冲突",
          detail: feature.failure_modes[1] ?? "模板与内容结构不一致。",
        },
        {
          id: "fallback",
          title: "切到兜底方案",
          detail: feature.flow_breakdown.failure_paths[0] ?? "切换到更保守的处理路径。",
        },
        {
          id: "deliver",
          title: "交付结果",
          detail: feature.outputs.at(-1) ?? "输出保底结果。",
        },
      ],
    },
  ];
}

function createFlowDemoNodes(
  example: FlowDemoExample,
  runIndex: number,
  runState: "idle" | "running" | "done",
): FlowDemoNode[] {
  const yPattern = [0, -52, 52, -32, 0];

  return example.steps.map((step, index) => {
    let state: FlowDemoState = "idle";

    if (runState === "running") {
      if (index < runIndex) {
        state = "done";
      } else if (index === runIndex) {
        state = "running";
      }
    }

    if (runState === "done") {
      if (index === example.steps.length - 1) {
        state = example.outcome === "warning" ? "warning" : "result";
      } else {
        state = "done";
      }
    }

    return {
      id: step.id,
      type: "status",
      draggable: false,
      selectable: false,
      position: {
        x: index * 245,
        y: yPattern[index] ?? 0,
      },
      data: {
        title: step.title,
        detail: step.detail,
        state,
      },
    };
  });
}

function createFlowDemoEdges(
  example: FlowDemoExample,
  runIndex: number,
  runState: "idle" | "running" | "done",
): Edge[] {
  return example.steps.slice(0, -1).map((step, index) => {
    const isActive = runState === "done" || index < runIndex;
    const stroke =
      runState === "done" && example.outcome === "warning" && index === example.steps.length - 2
        ? "#fbbf24"
        : isActive
          ? "#67e8f9"
          : "rgba(148, 163, 184, 0.35)";

    return {
      id: `${step.id}-${example.steps[index + 1]?.id}`,
      source: step.id,
      target: example.steps[index + 1]?.id ?? step.id,
      type: "smoothstep",
      animated: isActive,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 18,
        height: 18,
        color: stroke,
      },
      style: {
        stroke,
        strokeWidth: isActive ? 2.4 : 1.5,
      },
    };
  });
}

function MoreUsagePanel({ feature }: { feature: FeatureAnalysis }) {
  return (
    <details className="group rounded-[24px] border border-white/8 bg-white/4 p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-base font-medium text-white">
          <MoreHorizontal className="size-4 text-cyan-200" />
          More
        </div>
        <span className="text-sm text-slate-400 transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-5 grid gap-4">
        <ConditionCard
          title="什么时候使用"
          items={feature.trigger_conditions}
          emptyLabel="适合用于结构化处理与明确输出的任务。"
          tone="positive"
        />
        <ConditionCard
          title="什么时候不使用"
          items={feature.non_trigger_conditions}
          emptyLabel="没有明显的非触发条件。"
          tone="neutral"
        />
        <InfoStrip
          title="使用假设"
          items={
            feature.assumptions.length === 0 ? ["当前没有额外假设。"] : feature.assumptions
          }
        />
      </div>
    </details>
  );
}

function InfoList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <Card className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(2,6,23,0.82))] text-slate-100">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm leading-6 text-slate-500">{emptyLabel}</div>
        ) : (
          <ul className="grid gap-2 text-sm leading-6 text-slate-300">
            {items.map((item) => (
              <li key={item} className="rounded-2xl border border-white/6 bg-white/4 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="grid gap-2">
      <div className="text-xs tracking-[0.24em] text-cyan-100/60">{eyebrow}</div>
      <h3 className="text-2xl font-semibold tracking-[-0.04em] text-white md:text-3xl">
        {title}
      </h3>
      <p className="max-w-2xl text-sm leading-7 text-slate-400 md:text-base">{description}</p>
    </div>
  );
}

function ShowcaseSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-white/8 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.86))] p-6 shadow-[0_16px_60px_rgba(2,6,23,0.24)]">
      <div className="grid gap-5">
        <SectionHeading eyebrow={eyebrow} title={title} description={description} />
        {children}
      </div>
    </section>
  );
}

function SummaryBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
      <div className="text-xs tracking-[0.18em] text-cyan-100/60">{label}</div>
      <div className="mt-2 text-sm leading-7 text-slate-100">{value}</div>
    </div>
  );
}

function InfoStrip({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-slate-950/45 p-4">
      <div className="text-sm font-medium text-white">{title}</div>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <div
            key={item}
            className="rounded-2xl border border-white/8 bg-white/4 px-3 py-2 text-sm leading-6 text-slate-300"
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConditionCard({
  title,
  items,
  emptyLabel,
  tone,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
  tone: "positive" | "neutral";
}) {
  const icon =
    tone === "positive" ? (
      <CheckCheck className="size-4 text-cyan-200" />
    ) : (
      <ShieldAlert className="size-4 text-slate-300" />
    );

  return (
    <div className="rounded-[24px] border border-white/8 bg-white/4 p-5">
      <div className="flex items-center gap-2 text-base font-medium text-white">
        {icon}
        {title}
      </div>
      <div className="mt-4 flex flex-wrap gap-2.5">
        {(items.length === 0 ? [emptyLabel] : items).map((item) => (
          <span
            key={item}
            className={cn(
              "rounded-full border px-3.5 py-2 text-sm leading-6",
              tone === "positive"
                ? "border-cyan-300/16 bg-cyan-400/8 text-cyan-50"
                : "border-white/8 bg-slate-950/50 text-slate-300",
            )}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function TagCard({
  title,
  icon,
  items,
  emptyLabel,
}: {
  title: string;
  icon: ReactNode;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-white/4 p-5">
      <div className="flex items-center gap-2 text-base font-medium text-white">
        {icon}
        {title}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(items.length === 0 ? [emptyLabel] : items).map((item) => (
          <span
            key={item}
            className="rounded-full border border-white/8 bg-slate-950/50 px-3 py-1.5 text-sm text-slate-200"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function ChecklistCard({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-white/4 p-5">
      <div className="text-base font-medium text-white">{title}</div>
      <div className="mt-4 grid gap-3">
        {(items.length === 0 ? [emptyLabel] : items).map((item) => (
          <div key={item} className="flex gap-3 rounded-2xl bg-slate-950/45 px-4 py-3">
            <CheckCheck className="mt-0.5 size-4 shrink-0 text-cyan-200" />
            <div className="text-sm leading-6 text-slate-300">{item}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineCard({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
}) {
  const displayItems = items.length === 0 ? [emptyLabel] : items;

  return (
    <div className="rounded-[24px] border border-white/8 bg-white/4 p-5">
      <div className="text-base font-medium text-white">{title}</div>
      <div className="mt-5 grid gap-3">
        {displayItems.map((item, index) => (
          <div key={item} className="grid grid-cols-[auto_1fr] gap-3">
            <div className="flex flex-col items-center">
              <div className="flex size-8 items-center justify-center rounded-full bg-cyan-400/12 text-sm font-semibold text-cyan-100">
                {index + 1}
              </div>
              {index !== displayItems.length - 1 ? (
                <div className="mt-2 h-full w-px bg-gradient-to-b from-cyan-300/30 to-transparent" />
              ) : null}
            </div>
            <div className="rounded-2xl border border-white/8 bg-slate-950/50 px-4 py-3 text-sm leading-6 text-slate-300">
              {item}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
