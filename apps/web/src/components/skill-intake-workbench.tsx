import { Button } from "@my-better-t-app/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@my-better-t-app/ui/components/card";
import { Input } from "@my-better-t-app/ui/components/input";
import { Label } from "@my-better-t-app/ui/components/label";
import { cn } from "@my-better-t-app/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Copy,
  FolderSearch,
  Link2,
  LoaderCircle,
  Shield,
  Sparkles,
  Upload,
  Workflow,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { trpc, trpcClient } from "@/utils/trpc";

const ACCEPTED_FILE_PATTERN =
  /\.(md|mdx|txt|json|ya?ml|toml|ini|cfg|conf|ts|tsx|js|jsx|mjs|cjs)$/i;

type UploadedSkillFile = {
  path: string;
  content: string;
  size: number;
};

type SkillAnalysisResult = Awaited<ReturnType<typeof trpcClient.analyzeSkill.mutate>>;

const featureStageLabels: Array<{
  key: keyof SkillAnalysisResult["feature_analysis"]["flow_breakdown"];
  title: string;
  hint: string;
}> = [
  {
    key: "trigger",
    title: "Trigger",
    hint: "什么时候应该调用这个 Skill",
  },
  {
    key: "input_parsing",
    title: "Input Parsing",
    hint: "需要读取和整理哪些输入",
  },
  {
    key: "prechecks",
    title: "Prechecks",
    hint: "执行前必须确认的条件",
  },
  {
    key: "execution",
    title: "Execution",
    hint: "主流程的关键步骤",
  },
  {
    key: "failure_paths",
    title: "Failure Paths",
    hint: "失败时如何反馈或降级",
  },
  {
    key: "outputs",
    title: "Outputs",
    hint: "最终返回给用户什么",
  },
];

function humanFileSize(size: number) {
  if (size < 1024) {
    return `${size} B`;
  }

  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
  const [selectedFiles, setSelectedFiles] = useState<UploadedSkillFile[]>([]);
  const [uploadLabel, setUploadLabel] = useState("Uploaded Skill");
  const [isReadingFiles, setIsReadingFiles] = useState(false);
  const [activeTab, setActiveTab] = useState<"feature" | "security">("feature");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderInputRef.current?.setAttribute("webkitdirectory", "");
    folderInputRef.current?.setAttribute("directory", "");
  }, []);

  const healthCheck = useQuery(trpc.healthCheck.queryOptions());

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

  async function loadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const files = Array.from(fileList).filter((file) => ACCEPTED_FILE_PATTERN.test(file.name));

    if (files.length === 0) {
      toast.error("没有找到可读的文本文件。请上传 `SKILL.md`、README 或相关文档。");
      return;
    }

    setIsReadingFiles(true);

    try {
      const uploaded = await Promise.all(
        files.slice(0, 48).map(async (file) => {
          const content = await file.text();
          return {
            path: file.webkitRelativePath || file.name,
            content,
            size: file.size,
          };
        }),
      );

      setSelectedFiles(uploaded);
      setUploadLabel(pickUploadLabel(uploaded));
      toast.success(`已载入 ${uploaded.length} 个文件，准备分析。`);
    } finally {
      setIsReadingFiles(false);
    }
  }

  async function submitUpload() {
    if (selectedFiles.length === 0) {
      toast.error("请先上传一个 Skill 文件或目录。");
      return;
    }

    await analyzeSkill.mutateAsync({
      source: {
        kind: "upload",
        label: uploadLabel,
        files: selectedFiles.map(({ path, content }) => ({
          path,
          content,
        })),
      },
      outputLanguage: "zh",
      requestLanguage: "zh",
    });
  }

  async function submitRepo() {
    if (!repoUrl.trim()) {
      toast.error("请输入 Skill 仓库地址。");
      return;
    }

    await analyzeSkill.mutateAsync({
      source: {
        kind: "repo",
        repoUrl: repoUrl.trim(),
      },
      outputLanguage: "zh",
      requestLanguage: "zh",
    });
  }

  const result = analyzeSkill.data;
  const riskLevel = result?.safety_analysis.risk_level ?? "safe";

  return (
    <main className="min-h-[calc(100svh-49px)] overflow-y-auto bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.22),_transparent_34%),radial-gradient(circle_at_78%_12%,_rgba(249,115,22,0.16),_transparent_24%),linear-gradient(180deg,_rgba(2,6,23,0.98),_rgba(2,8,23,1))]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6 lg:px-8">
        <section className="grid gap-4 rounded-[28px] border border-white/10 bg-white/6 p-5 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_28px_120px_rgba(15,23,42,0.55)] backdrop-blur-xl md:grid-cols-[1.45fr_0.85fr] md:p-7">
          <div className="grid gap-4">
            <div className="inline-flex w-fit items-center gap-2 border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[11px] font-medium tracking-[0.24em] uppercase text-sky-100">
              <Sparkles className="size-3.5" />
              Skill Intake Workbench
            </div>
            <div className="grid gap-3">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] text-balance md:text-5xl">
                上传 Skill 或填写 repo 地址，生成 AI 版功能与安全双审查。
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                接入 Vercel AI SDK 与 Gemini Flash，结果拆成“功能”和“安全”两个视图。安全侧按
                skill-vetter 的思路做元数据、权限范围、红旗内容和可信度审查。
              </p>
            </div>
            <div className="grid gap-3 text-xs text-slate-300 sm:grid-cols-3">
              <div className="border border-white/10 bg-slate-950/40 p-3">
                <div className="mb-2 inline-flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-slate-400">
                  <Workflow className="size-3.5" />
                  Function
                </div>
                <p>由模型抽取 purpose、trigger、inputs、prechecks、execution、failure 和 outputs。</p>
              </div>
              <div className="border border-white/10 bg-slate-950/40 p-3">
                <div className="mb-2 inline-flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-slate-400">
                  <Shield className="size-3.5" />
                  Safety
                </div>
                <p>按 skill-vetter 流程检查权限范围、红旗信号、可信度与阻断能力。</p>
              </div>
              <div className="border border-white/10 bg-slate-950/40 p-3">
                <div className="mb-2 inline-flex items-center gap-2 text-[11px] tracking-[0.2em] uppercase text-slate-400">
                  <Link2 className="size-3.5" />
                  Gemini
                </div>
                <p>服务端使用 Vercel AI SDK + Gemini 3 Flash Preview 输出结构化结果和 Mermaid。</p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 border border-white/10 bg-slate-950/45 p-4 text-xs text-slate-300 md:self-start">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] tracking-[0.2em] uppercase text-slate-500">API Status</div>
                <div className="mt-1 text-lg font-medium text-white">
                  {healthCheck.isLoading ? "Checking" : healthCheck.data ? "Connected" : "Unavailable"}
                </div>
              </div>
              <div
                className={`size-3 rounded-full ${healthCheck.data ? "bg-emerald-400 shadow-[0_0_16px_rgba(52,211,153,0.85)]" : "bg-rose-400 shadow-[0_0_16px_rgba(251,113,133,0.75)]"}`}
              />
            </div>
            <div className="grid gap-2 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between gap-3">
                <span>Source modes</span>
                <span className="font-mono text-slate-100">upload / repo</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Model</span>
                <span className="font-mono text-slate-100">
                  {result?.source.model ?? "gemini-3-flash-preview"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Tabs</span>
                <span className="font-mono text-slate-100">功能 / 安全</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.02fr_1.18fr]">
          <div className="grid gap-6">
            <Card className="border border-sky-500/15 bg-slate-950/85 text-slate-100 ring-sky-500/10">
              <CardHeader className="border-b border-white/8">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Upload className="size-4 text-sky-300" />
                  Upload Skill Files
                </CardTitle>
                <CardDescription className="text-slate-400">
                  支持上传单个 `SKILL.md`、多个文档文件，或整个 skill 目录。
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-3 border border-dashed border-sky-400/35 bg-sky-500/6 p-4">
                  <div className="grid gap-1">
                    <div className="text-sm font-medium text-white">把 Skill 资料送进 AI 分析流水线</div>
                    <p className="text-xs leading-6 text-slate-400">
                      推荐包含 `SKILL.md`、README、usage、workflow、prompt、guide 等文本文件。代码文件可带上，但分析会优先文档材料。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-sky-400/30 bg-sky-400/8 text-sky-50 hover:bg-sky-400/16"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isReadingFiles}
                    >
                      {isReadingFiles ? (
                        <LoaderCircle className="size-4 animate-spin" />
                      ) : (
                        <Upload className="size-4" />
                      )}
                      选择文件
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/10 bg-white/5 text-slate-100 hover:bg-white/10"
                      onClick={() => folderInputRef.current?.click()}
                      disabled={isReadingFiles}
                    >
                      <FolderSearch className="size-4" />
                      选择目录
                    </Button>
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
                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      void loadFiles(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] tracking-[0.18em] uppercase text-slate-500">
                      Loaded Files
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {selectedFiles.length} files
                    </div>
                  </div>
                  <div className="grid max-h-72 gap-2 overflow-y-auto border border-white/8 bg-black/20 p-2">
                    {selectedFiles.length === 0 ? (
                      <div className="p-3 text-xs leading-6 text-slate-500">
                        还没有载入文件。上传后会优先分析 `SKILL.md`、README 和文档类文件。
                      </div>
                    ) : (
                      selectedFiles.map((file) => (
                        <div
                          key={file.path}
                          className="flex items-center justify-between gap-3 border border-white/6 bg-white/4 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-slate-100">{file.path}</div>
                            <div className="mt-1 text-[11px] text-slate-500">{humanFileSize(file.size)}</div>
                          </div>
                          <div className="rounded-full border border-sky-400/20 bg-sky-400/8 px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase text-sky-200">
                            text
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  size="lg"
                  className="bg-sky-500 text-slate-950 hover:bg-sky-400"
                  onClick={() => void submitUpload()}
                  disabled={isReadingFiles || analyzeSkill.isPending || selectedFiles.length === 0}
                >
                  {analyzeSkill.isPending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Workflow className="size-4" />
                  )}
                  分析上传内容
                </Button>
              </CardContent>
            </Card>

            <Card className="border border-orange-500/15 bg-slate-950/85 text-slate-100 ring-orange-500/10">
              <CardHeader className="border-b border-white/8">
                <CardTitle className="flex items-center gap-2 text-base text-white">
                  <Link2 className="size-4 text-orange-300" />
                  Analyze Repository URL
                </CardTitle>
                <CardDescription className="text-slate-400">
                  当前支持 GitHub 仓库地址、GitHub 文件地址，以及直接指向文本文件的 URL。
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="repo-url" className="text-slate-300">
                    Repository URL
                  </Label>
                  <Input
                    id="repo-url"
                    value={repoUrl}
                    onChange={(event) => setRepoUrl(event.target.value)}
                    placeholder="https://github.com/owner/repo"
                    className="h-11 border-white/10 bg-white/4 text-sm text-slate-50 placeholder:text-slate-500"
                  />
                  <p className="text-xs leading-6 text-slate-500">
                    如果是整个 repo，会优先抓取 `SKILL.md`、README 和其它文档类文本文件，而不是盲扫全部代码。
                  </p>
                </div>
                <Button
                  type="button"
                  size="lg"
                  className="bg-orange-500 text-slate-950 hover:bg-orange-400"
                  onClick={() => void submitRepo()}
                  disabled={analyzeSkill.isPending || !repoUrl.trim()}
                >
                  {analyzeSkill.isPending ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <FolderSearch className="size-4" />
                  )}
                  分析仓库地址
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6">
            <Card className="border border-white/10 bg-slate-950/88 text-slate-100">
              <CardHeader className="border-b border-white/8">
                <CardTitle className="flex items-center justify-between gap-3 text-base text-white">
                  <span className="flex items-center gap-2">
                    <Workflow className="size-4 text-sky-300" />
                    AI Analysis Output
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
                      {riskLevel}
                    </span>
                  ) : null}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {result
                    ? `源: ${result.source.label} · 已分析 ${result.source.file_count} 个文件`
                    : "结果会分成“功能”和“安全”两个 tab 展示。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                {!result ? (
                  <div className="grid min-h-80 place-items-center border border-dashed border-white/10 bg-white/3 p-6 text-center">
                    <div className="grid max-w-md gap-3">
                      <div className="mx-auto inline-flex size-12 items-center justify-center rounded-full border border-sky-400/20 bg-sky-400/10">
                        <Workflow className="size-5 text-sky-200" />
                      </div>
                      <div className="text-lg font-medium text-white">等待一个 Skill 输入源</div>
                      <p className="text-sm leading-6 text-slate-400">
                        上传 `SKILL.md` 或输入 GitHub repo 地址后，右侧会输出功能分析和安全审查结果。
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                      <div className="grid gap-3 border border-white/8 bg-white/3 p-4">
                        <div className="text-[11px] tracking-[0.18em] uppercase text-slate-500">Skill</div>
                        <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">
                          {result.skill_name}
                        </h2>
                        <p className="text-sm leading-7 text-slate-300">
                          {result.feature_analysis.summary}
                        </p>
                      </div>
                      <div className="grid gap-3 border border-white/8 bg-white/3 p-4">
                        <div className="text-[11px] tracking-[0.18em] uppercase text-slate-500">
                          Safety Verdict
                        </div>
                        <div className="flex items-center gap-2 text-sm text-white">
                          <AlertTriangle
                            className={cn(
                              "size-4",
                              riskLevel === "unsafe"
                                ? "text-rose-300"
                                : riskLevel === "caution"
                                  ? "text-amber-300"
                                  : "text-emerald-300",
                            )}
                          />
                          {result.safety_analysis.verdict}
                        </div>
                        <div className="text-xs leading-6 text-slate-400">{result.language_note}</div>
                      </div>
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
        </section>
      </div>
    </main>
  );
}

function FeatureTab({ result }: { result: SkillAnalysisResult }) {
  const feature = result.feature_analysis;

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <InfoList title="Trigger Conditions" items={feature.trigger_conditions} emptyLabel="未给出。"/>
        <InfoList
          title="Non-trigger Conditions"
          items={feature.non_trigger_conditions}
          emptyLabel="未给出。"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoList title="Inputs" items={feature.inputs} emptyLabel="未给出。"/>
        <InfoList title="Prechecks" items={feature.prechecks} emptyLabel="未给出。"/>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoList
          title="Execution Steps"
          items={feature.execution_steps}
          emptyLabel="未给出。"
        />
        <InfoList title="Failure Modes" items={feature.failure_modes} emptyLabel="未给出。"/>
      </div>

      <InfoList title="Outputs" items={feature.outputs} emptyLabel="未给出。"/>

      <div className="grid gap-4 xl:grid-cols-2">
        {featureStageLabels.map((stage) => (
          <Card key={stage.key} className="border border-white/8 bg-black/18 text-slate-100">
            <CardHeader className="border-b border-white/8">
              <CardTitle className="text-sm text-white">{stage.title}</CardTitle>
              <CardDescription className="text-slate-500">{stage.hint}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 text-sm leading-6 text-slate-300">
                {feature.flow_breakdown[stage.key].map((item) => (
                  <li key={item} className="border border-white/6 bg-white/3 px-3 py-2">
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <InfoList title="Assumptions" items={feature.assumptions} emptyLabel="没有额外假设。"/>

      <MermaidCard mermaid={feature.mermaid} description="功能流程 Mermaid" />
    </div>
  );
}

function SecurityTab({ result }: { result: SkillAnalysisResult }) {
  const safety = result.safety_analysis;

  return (
    <div className="grid gap-4">
      <InfoList title="Findings" items={safety.findings} emptyLabel="没有额外发现。"/>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoList
          title="Metadata Review"
          items={safety.metadata_review}
          emptyLabel="未给出。"
        />
        <InfoList
          title="Permission Scope"
          items={safety.permission_scope}
          emptyLabel="未给出。"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoList title="Red Flags" items={safety.red_flags} emptyLabel="未发现明显红旗。"/>
        <InfoList title="Trust Signals" items={safety.trust_signals} emptyLabel="未给出。"/>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoList
          title="Blocked Capabilities"
          items={safety.blocked_capabilities}
          emptyLabel="没有需要阻断的能力项。"
        />
        <InfoList title="Notes" items={safety.notes} emptyLabel="没有额外备注。"/>
      </div>

      <MermaidCard mermaid={safety.mermaid} description="安全审查 Mermaid" />
    </div>
  );
}

function MermaidCard({ mermaid, description }: { mermaid: string; description: string }) {
  return (
    <Card className="border border-white/8 bg-black/18 text-slate-100">
      <CardHeader className="border-b border-white/8">
        <CardTitle className="flex items-center justify-between gap-3 text-sm text-white">
          <span>{description}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white"
            onClick={async () => {
              await navigator.clipboard.writeText(mermaid);
              toast.success("Mermaid 已复制到剪贴板。");
            }}
          >
            <Copy className="size-4" />
            Copy
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="overflow-x-auto border border-sky-400/12 bg-slate-950/90 p-4 font-mono text-[12px] leading-6 text-sky-100">
          {mermaid}
        </pre>
      </CardContent>
    </Card>
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
    <Card className="border border-white/8 bg-black/18 text-slate-100">
      <CardHeader className="border-b border-white/8">
        <CardTitle className="text-sm text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="text-sm leading-6 text-slate-500">{emptyLabel}</div>
        ) : (
          <ul className="grid gap-2 text-sm leading-6 text-slate-300">
            {items.map((item) => (
              <li key={item} className="border border-white/6 bg-white/3 px-3 py-2">
                {item}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
