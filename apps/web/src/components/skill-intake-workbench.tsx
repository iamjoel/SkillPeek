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
import { useMutation } from "@tanstack/react-query";
import {
  Copy,
  FolderSearch,
  Link2,
  LoaderCircle,
  Shield,
  Sparkles,
  Upload,
  Workflow,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
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
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 md:px-6 lg:px-8 lg:py-10">
        <section className="rounded-[28px] border border-white/10 bg-white/6 p-6 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_28px_120px_rgba(15,23,42,0.55)] backdrop-blur-xl md:p-8">
          <div className="grid max-w-4xl gap-5">
            <div className="grid gap-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-[-0.05em] text-balance md:text-6xl">
                SkillPeek
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 md:text-base">
                高效了解 Skill 的功能边界，并提前规避潜在安全风险。
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr] xl:items-start">
          <div>
            <Card className="border border-white/10 bg-slate-950/88 text-slate-100 shadow-[0_20px_80px_rgba(2,6,23,0.35)]">
              <CardHeader className="border-b border-white/8 pb-5">
                <CardTitle className="text-lg text-white">输入</CardTitle>
                <CardDescription className="text-sm text-slate-400">
                  先上传文件，或者输入一个 GitHub repo 地址。
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 pt-5">
                <div className="grid gap-3 border border-dashed border-sky-400/30 bg-sky-500/6 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Upload className="size-4 text-sky-300" />
                    上传 Skill 文件
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
                  <Button
                    type="button"
                    size="lg"
                    className="mt-1 bg-sky-500 text-slate-950 hover:bg-sky-400"
                    onClick={() => void submitUpload()}
                    disabled={isReadingFiles || analyzeSkill.isPending || selectedFiles.length === 0}
                  >
                    {analyzeSkill.isPending ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Workflow className="size-4" />
                    )}
                    开始分析
                  </Button>
                </div>

                <div className="grid gap-3 border border-white/8 bg-white/3 p-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <Link2 className="size-4 text-orange-300" />
                    GitHub repo
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="repo-url" className="text-xs text-slate-400">
                      GitHub URL
                    </Label>
                    <Input
                      id="repo-url"
                      value={repoUrl}
                      onChange={(event) => setRepoUrl(event.target.value)}
                      placeholder="https://github.com/owner/repo"
                      className="h-11 border-white/10 bg-white/4 text-sm text-slate-50 placeholder:text-slate-500"
                    />
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
                    开始分析
                  </Button>
                </div>

                <div className="grid gap-2">
                  <div className="flex items-center justify-between text-[11px] tracking-[0.18em] uppercase text-slate-500">
                    <span>Loaded Files</span>
                    <span className="font-mono">{selectedFiles.length}</span>
                  </div>
                  {selectedFiles.length === 0 ? (
                    <div className="border border-white/6 bg-black/15 px-3 py-2 text-xs text-slate-500">
                      还没有选择文件
                    </div>
                  ) : (
                    <div className="grid max-h-48 gap-2 overflow-y-auto border border-white/6 bg-black/15 p-2">
                      {selectedFiles.map((file) => (
                        <div
                          key={file.path}
                          className="flex items-center justify-between gap-3 border border-white/6 bg-white/3 px-3 py-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-slate-200">{file.path}</div>
                            <div className="mt-1 text-[11px] text-slate-500">{humanFileSize(file.size)}</div>
                          </div>
                          <div className="rounded-full border border-sky-400/20 bg-sky-400/8 px-2 py-0.5 text-[10px] tracking-[0.12em] uppercase text-sky-200">
                            text
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6">
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
                      {riskLevel}
                    </span>
                  ) : null}
                </CardTitle>
                <CardDescription className="text-slate-400">
                  {result
                    ? `源: ${result.source.label} · 已分析 ${result.source.file_count} 个文件`
                    : "分析后，这里会显示结果。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 pt-5">
                {!result ? (
                  <div className="grid min-h-96 place-items-center border border-dashed border-white/10 bg-white/3 p-8 text-center">
                    <div className="grid max-w-sm gap-4">
                      <div className="mx-auto inline-flex size-14 items-center justify-center rounded-full border border-sky-400/20 bg-sky-400/10">
                        <Workflow className="size-5 text-sky-200" />
                      </div>
                      <div className="text-xl font-medium text-white">分析后显示结果</div>
                      <p className="text-sm leading-7 text-slate-400">
                        这里会出现两个 tab：功能 和 安全。
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
        </section>
      </div>
    </main>
  );
}

function FeatureTab({ result }: { result: SkillAnalysisResult }) {
  const feature = result.feature_analysis;

  return (
    <div className="grid gap-4">
      <MermaidPanel mermaid={feature.mermaid} description="功能流程 Mermaid" />

      <div className="grid gap-4 md:grid-cols-2">
        <InfoList title="Trigger Conditions" items={feature.trigger_conditions} emptyLabel="未给出。" />
        <InfoList
          title="Non-trigger Conditions"
          items={feature.non_trigger_conditions}
          emptyLabel="未给出。"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoList title="Inputs" items={feature.inputs} emptyLabel="未给出。" />
        <InfoList title="Prechecks" items={feature.prechecks} emptyLabel="未给出。" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoList
          title="Execution Steps"
          items={feature.execution_steps}
          emptyLabel="未给出。"
        />
        <InfoList title="Failure Modes" items={feature.failure_modes} emptyLabel="未给出。" />
      </div>

      <InfoList title="Outputs" items={feature.outputs} emptyLabel="未给出。" />

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

      <InfoList title="Assumptions" items={feature.assumptions} emptyLabel="没有额外假设。" />
    </div>
  );
}

function SecurityTab({ result }: { result: SkillAnalysisResult }) {
  const safety = result.safety_analysis;

  return (
    <div className="grid gap-4">
      <InfoList title="Findings" items={safety.findings} emptyLabel="没有额外发现。" />

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
        <InfoList title="Red Flags" items={safety.red_flags} emptyLabel="未发现明显红旗。" />
        <InfoList title="Trust Signals" items={safety.trust_signals} emptyLabel="未给出。" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <InfoList
          title="Blocked Capabilities"
          items={safety.blocked_capabilities}
          emptyLabel="没有需要阻断的能力项。"
        />
        <InfoList title="Notes" items={safety.notes} emptyLabel="没有额外备注。" />
      </div>
    </div>
  );
}

function MermaidPanel({ mermaid, description }: { mermaid: string; description: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderId = useId().replace(/:/g, "");
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState(true);

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
        setIsRendering(false);

        queueMicrotask(() => {
          if (!cancelled && containerRef.current && bindFunctions) {
            bindFunctions(containerRef.current);
          }
        });
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
              ref={containerRef}
              className="mermaid-preview overflow-x-auto [&_svg]:h-auto [&_svg]:min-w-full [&_svg]:max-w-none"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
        </div>
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
