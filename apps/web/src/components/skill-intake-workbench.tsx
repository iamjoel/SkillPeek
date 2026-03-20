import "@xyflow/react/dist/style.css";
import { Button } from "@my-better-t-app/ui/components/button";
import { Card, CardContent } from "@my-better-t-app/ui/components/card";
import { Input } from "@my-better-t-app/ui/components/input";
import { cn } from "@my-better-t-app/ui/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { FolderSearch, LoaderCircle, Upload, Workflow } from "lucide-react";
import { type DragEvent, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  DataTransferItemWithEntry,
  ShowcaseResult,
  SkillAnalysisResult,
  UploadedSkillFile,
} from "@/components/types";
import { trpcClient } from "@/utils/trpc";
import { FeatureTab } from "./skill-results-panel";

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
    is_malicious_or_unsafe: false,
    verdict: "能力边界清楚，但依赖外部平台和密钥配置，使用前应隔离验证。",
    findings: ["会调用外部营销与图像服务", "需要配置 Postiz 与图像生成密钥"],
    metadata_review: ["名称与用途明确", "执行边界有说明", "来源仍需人工确认"],
    permission_scope: ["读取本地配置", "写入报告文件", "调用外部 API"],
    red_flags: ["依赖外部平台授权", "需要配置第三方密钥"],
    trust_signals: ["目标清晰", "流程可审查", "输出可复盘"],
    blocked_capabilities: ["不应读取无关目录", "不应上传未授权数据"],
    notes: ["建议在隔离环境先验证一轮"],
    mermaid: `flowchart TD
    A["读取源材料"] --> B["名称与用途明确 / 执行边界有说明"]
    B --> C["读取本地配置 / 写入报告文件"]
    C --> D["依赖外部平台授权 / 需要第三方密钥"]
    D --> E["目标清晰 / 流程可审查"]
    E --> F{"是否存在明显风险？"}
    F --> G["要求人工复核"]
    G --> H["能力边界清楚，但依赖外部平台和密钥配置，使用前应隔离验证。"]
    H --> I["返回安全结论"]`,
  },
};

function toShowcaseResult(result: SkillAnalysisResult): ShowcaseResult {
  return {
    skill_name: result.skill_name,
    feature_analysis: {
      summary: result.feature_analysis.summary,
      outputs: result.feature_analysis.outputs,
      failure_modes: result.feature_analysis.failure_modes,
    },
    safety_analysis: result.safety_analysis,
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
