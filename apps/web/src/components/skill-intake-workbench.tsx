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
  CheckCheck,
  CircleAlert,
  FolderSearch,
  LoaderCircle,
  Orbit,
  ShieldAlert,
  Shield,
  Sparkles,
  Upload,
  WandSparkles,
  Workflow,
} from "lucide-react";
import { type DragEvent, type ReactNode, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { trpcClient } from "@/utils/trpc";

const ACCEPTED_FILE_PATTERN =
  /\.(md|mdx|txt|json|ya?ml|toml|ini|cfg|conf|ts|tsx|js|jsx|mjs|cjs)$/i;

let mermaidPromise: Promise<(typeof import("mermaid"))["default"]> | null = null;
let mermaidInitialized = false;

type UploadedSkillFile = {
  path: string;
  content: string;
  size: number;
};

type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntry | null;
};

type SkillAnalysisResult = Awaited<ReturnType<typeof trpcClient.analyzeSkill.mutate>>;

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

const featureStageMeta: Array<{
  key: keyof SkillAnalysisResult["feature_analysis"]["flow_breakdown"];
  title: string;
  hint: string;
}> = [
  {
    key: "trigger",
    title: "识别场景",
    hint: "先判断这是不是它该接手的问题。",
  },
  {
    key: "input_parsing",
    title: "整理输入",
    hint: "读取标题、结构和关键字段。",
  },
  {
    key: "prechecks",
    title: "执行前校验",
    hint: "确认内容完整、结构可用。",
  },
  {
    key: "execution",
    title: "生成结果",
    hint: "进入主流程并产出结构化内容。",
  },
  {
    key: "failure_paths",
    title: "异常回退",
    hint: "信息不足或结构冲突时如何降级。",
  },
  {
    key: "outputs",
    title: "返回输出",
    hint: "最后交付给用户的内容形态。",
  },
];

const statusBadges = ["结构化输出", "流程可解释", "结果可预期"];

const riskLevelLabels: Record<
  SkillAnalysisResult["safety_analysis"]["risk_level"],
  string
> = {
  safe: "安全",
  caution: "注意",
  unsafe: "高风险",
};

function pickUploadLabel(files: UploadedSkillFile[]) {
  const firstRelativePath = files.find((file) => file.path.includes("/"))?.path;
  if (!firstRelativePath) {
    return files[0]?.path.replace(/\.[^.]+$/, "") || "Uploaded Skill";
  }

  return firstRelativePath.split("/")[0] || "Uploaded Skill";
}

async function getMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import("mermaid").then((module) => {
      const mermaid = module.default;

      if (!mermaidInitialized) {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          themeVariables: {
            background: "#020617",
            primaryColor: "#0f172a",
            primaryTextColor: "#e2e8f0",
            primaryBorderColor: "#334155",
            lineColor: "#60a5fa",
            secondaryColor: "#111827",
            secondaryTextColor: "#e2e8f0",
            secondaryBorderColor: "#475569",
            tertiaryColor: "#1e293b",
            tertiaryTextColor: "#e2e8f0",
            tertiaryBorderColor: "#f59e0b",
            clusterBkg: "#0f172a",
            clusterBorder: "#334155",
            edgeLabelBackground: "#0f172a",
            fontFamily: "IBM Plex Sans",
          },
          flowchart: {
            curve: "basis",
            htmlLabels: true,
            useMaxWidth: true,
          },
        });
        mermaidInitialized = true;
      }

      return mermaid;
    });
  }

  return mermaidPromise;
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
  const useCases = feature.trigger_conditions.slice(0, 4);
  const outputs = feature.outputs.slice(0, 4);
  const workflowStages = featureStageMeta
    .map((stage) => ({
      ...stage,
      items: feature.flow_breakdown[stage.key],
    }))
    .filter((stage) => stage.items.length > 0);

  return (
    <div className="grid gap-8">
      <section className="relative overflow-hidden rounded-[32px] border border-cyan-400/12 bg-[linear-gradient(135deg,rgba(8,47,73,0.52),rgba(15,23,42,0.94)_45%,rgba(30,41,59,0.92))] p-6 text-white shadow-[0_24px_100px_rgba(6,182,212,0.12)] md:p-8">
        <div className="absolute inset-x-0 top-0 h-40 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.24),transparent_52%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
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
              <p className="max-w-2xl text-base leading-8 text-slate-200 md:text-lg">
                {feature.summary}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <SummaryBlock
                label="适用场景"
                value={useCases[0] ?? "适合处理结构清晰、需要规则化输出的任务。"}
              />
              <SummaryBlock
                label="最终产物"
                value={outputs[0] ?? "返回结构化结果，方便直接继续使用。"}
              />
            </div>
          </div>

          <div className="grid gap-4">
            <HighlightPanel
              icon={<Sparkles className="size-4 text-cyan-200" />}
              title="最佳使用时机"
              items={useCases}
              emptyLabel="适合在需要结构化处理时调用。"
              tone="cyan"
            />
            <HighlightPanel
              icon={<WandSparkles className="size-4 text-violet-200" />}
              title="你会得到什么"
              items={outputs}
              emptyLabel="输出会以清晰、可继续处理的结果形式返回。"
              tone="violet"
            />
          </div>
        </div>
      </section>

      <section className="grid gap-5">
        <SectionHeading
          eyebrow="主流程"
          title="一眼看懂这个 Skill 如何工作"
          description="把触发条件、校验动作和最终输出压缩成一条容易理解的流程。"
        />
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <MermaidPanel mermaid={feature.mermaid} description="技能工作流" />

          <Card className="border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(2,6,23,0.88))] text-slate-100 shadow-[0_20px_60px_rgba(2,6,23,0.3)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-white">流程拆解</CardTitle>
              <CardDescription className="text-sm leading-6 text-slate-400">
                用 6 个阶段快速理解它从接收请求到返回结果的关键动作。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {workflowStages.map((stage, index) => (
                <div
                  key={stage.key}
                  className="grid gap-2 rounded-2xl border border-white/8 bg-white/4 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-8 items-center justify-center rounded-full bg-cyan-400/12 text-sm font-semibold text-cyan-100">
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{stage.title}</div>
                      <div className="text-xs leading-5 text-slate-400">{stage.hint}</div>
                    </div>
                  </div>
                  <p className="pl-11 text-sm leading-6 text-slate-300">{stage.items[0]}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <ShowcaseSection
          eyebrow="何时使用"
          title="哪些情况下该交给它"
          description="把适合与不适合的场景分开看，判断是否应该触发会更快。"
        >
          <div className="grid gap-4">
            <ConditionCard
              title="推荐使用"
              items={feature.trigger_conditions}
              emptyLabel="适合用于结构化处理与明确输出的任务。"
              tone="positive"
            />
            <ConditionCard
              title="不建议使用"
              items={feature.non_trigger_conditions}
              emptyLabel="没有明显的非触发条件。"
              tone="neutral"
            />
          </div>
        </ShowcaseSection>

        <ShowcaseSection
          eyebrow="如何工作"
          title="从输入到生成，中间发生了什么"
          description="把输入、校验和执行步骤拆开，便于用户快速理解 Skill 的工作方式。"
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
          </div>
        </ShowcaseSection>
      </section>

      <section className="grid gap-5">
        <SectionHeading
          eyebrow="结果"
          title="你将获得什么"
          description="输出结果会被优先强调，失败路径则单独提示，避免混在一起。"
        />
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="overflow-hidden border border-cyan-400/12 bg-[linear-gradient(180deg,rgba(8,47,73,0.22),rgba(15,23,42,0.94))] text-slate-100 shadow-[0_20px_70px_rgba(6,182,212,0.12)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl text-white">输出结果</CardTitle>
              <CardDescription className="text-sm leading-6 text-slate-300">
                最终交付会以清晰、可直接继续使用的结果形式返回。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 md:grid-cols-2">
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
                  <p>{feature.skill_purpose}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
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

            <Card className="border border-white/8 bg-white/4 text-slate-100">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white">使用假设</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {(feature.assumptions.length === 0
                    ? ["当前没有额外假设。"]
                    : feature.assumptions
                  ).map((item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-white/8 bg-slate-950/55 p-4 text-sm leading-6 text-slate-300"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
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

function MermaidPanel({ mermaid, description }: { mermaid: string; description: string }) {
  const inlineContainerRef = useRef<HTMLDivElement>(null);
  const expandedContainerRef = useRef<HTMLDivElement>(null);
  const bindFunctionsRef = useRef<((element: Element) => void) | undefined>(undefined);
  const renderId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderMermaid() {
      setIsRendering(true);
      setError(null);

      try {
        const mermaidApi = await getMermaid();
        const { svg: renderedSvg, bindFunctions } = await mermaidApi.render(
          `skillpeek-mermaid-${renderId}`,
          mermaid,
        );

        if (cancelled) {
          return;
        }

        setSvg(renderedSvg);
        bindFunctionsRef.current = bindFunctions;
        setIsRendering(false);
      } catch (err) {
        if (cancelled) {
          return;
        }

        setError(err instanceof Error ? err.message : "Mermaid render failed");
        setIsRendering(false);
      }
    }

    void renderMermaid();

    return () => {
      cancelled = true;
    };
  }, [mermaid, renderId]);

  useEffect(() => {
    const bindFunctions = bindFunctionsRef.current;
    if (!bindFunctions) {
      return;
    }

    queueMicrotask(() => {
      if (inlineContainerRef.current) {
        bindFunctions(inlineContainerRef.current);
      }

      if (expandedContainerRef.current) {
        bindFunctions(expandedContainerRef.current);
      }
    });
  }, [svg, isExpanded]);

  useEffect(() => {
    if (!isExpanded) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsExpanded(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExpanded]);

  return (
    <>
      <Card className="border border-white/8 bg-black/18 text-slate-100">
        <CardHeader className="border-b border-white/8">
          <CardTitle className="flex items-center justify-between gap-3 text-sm text-white">
            <span>{description}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 text-lg text-slate-300 hover:bg-white/6 hover:text-white"
              aria-label="全屏查看流程图"
              onClick={() => {
                setIsExpanded(true);
              }}
            >
              🔍
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border border-white/8 bg-slate-950/60 p-3">
            {isRendering ? (
              <div className="flex min-h-56 items-center justify-center text-sm text-slate-400">
                <LoaderCircle className="mr-2 size-4 animate-spin" />
                正在渲染 Mermaid
              </div>
            ) : error ? (
              <div className="min-h-56 p-3 text-sm leading-6 text-rose-300">
                Mermaid 渲染失败：{error}
              </div>
            ) : (
              <div
                ref={inlineContainerRef}
                data-size="inline"
                className="mermaid-preview overflow-auto"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {isExpanded ? (
        <div className="fixed inset-0 z-50 bg-slate-950/88 px-4 py-5 backdrop-blur-md sm:px-6 sm:py-6">
          <div className="mx-auto flex h-full w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between gap-4 border-b border-white/8 px-5 py-4">
              <div>
                <div className="text-sm font-semibold text-white">{description}</div>
                <div className="mt-1 text-xs text-slate-400">Esc 关闭</div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 text-xl text-slate-300 hover:bg-white/6 hover:text-white"
                aria-label="关闭全屏查看"
                onClick={() => {
                  setIsExpanded(false);
                }}
              >
                ✕
              </Button>
            </div>

            <div className="flex-1 overflow-auto px-4 py-4 sm:px-6 sm:py-6">
              {error ? (
                <div className="rounded-2xl border border-rose-400/20 bg-rose-500/8 p-4 text-sm leading-6 text-rose-300">
                  Mermaid 渲染失败：{error}
                </div>
              ) : (
                <div className="rounded-2xl border border-white/8 bg-slate-950/70 p-4 sm:p-6">
                  <div
                    ref={expandedContainerRef}
                    data-size="fullscreen"
                    className="mermaid-preview overflow-auto"
                    dangerouslySetInnerHTML={{ __html: svg }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
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

function HighlightPanel({
  icon,
  title,
  items,
  emptyLabel,
  tone,
}: {
  icon: ReactNode;
  title: string;
  items: string[];
  emptyLabel: string;
  tone: "cyan" | "violet";
}) {
  const toneClass =
    tone === "cyan"
      ? "border-cyan-300/14 bg-cyan-400/8"
      : "border-violet-300/14 bg-violet-400/8";

  return (
    <div className={cn("rounded-[24px] border p-5", toneClass)}>
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        {icon}
        {title}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(items.length === 0 ? [emptyLabel] : items).map((item) => (
          <span
            key={item}
            className="rounded-full border border-white/8 bg-slate-950/35 px-3 py-1.5 text-sm text-slate-200"
          >
            {item}
          </span>
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
