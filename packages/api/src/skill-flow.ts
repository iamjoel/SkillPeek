import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { env } from "@my-better-t-app/env/server";
import { generateObject } from "ai";
import { z } from "zod";

const MAX_FILE_COUNT = 20;
const MAX_FILE_SIZE = 100_000;
const MAX_TOTAL_CHARS = 220_000;
const MODEL_ID = "gemini-3-flash-preview";

const textFilePattern =
  /\.(md|mdx|txt|json|ya?ml|toml|ini|cfg|conf|ts|tsx|js|jsx|mjs|cjs)$/i;

const docNamePattern =
  /(skill|readme|guide|usage|prompt|workflow|flow|doc|instruction|example|template)/i;

type OutputLanguage = "en" | "zh";

type SkillTextFile = {
  path: string;
  content: string;
};

type ParsedGitHubUrl =
  | {
      type: "raw" | "blob";
      owner: string;
      repo: string;
      ref: string;
      path: string;
    }
  | {
      type: "tree" | "repo";
      owner: string;
      repo: string;
      ref: string;
      path: string;
    };

const uploadedSkillSchema = z.object({
  kind: z.literal("upload"),
  label: z.string().trim().min(1).max(120).optional(),
  files: z
    .array(
      z.object({
        path: z.string().min(1).max(300),
        content: z.string().min(1).max(MAX_FILE_SIZE),
      }),
    )
    .min(1),
});

const repoSkillSchema = z.object({
  kind: z.literal("repo"),
  repoUrl: z.url(),
});

export const analyzeSkillInputSchema = z.object({
  source: z.union([uploadedSkillSchema, repoSkillSchema]),
  outputLanguage: z.enum(["same_as_user", "en", "zh"]).default("same_as_user"),
  requestLanguage: z.enum(["en", "zh"]).default("zh"),
});

const featureAnalysisSchema = z.object({
  skill_name: z.string(),
  summary: z.string(),
  skill_purpose: z.string(),
  trigger_conditions: z.array(z.string()).max(10),
  non_trigger_conditions: z.array(z.string()).max(10),
  inputs: z.array(z.string()).max(12),
  prechecks: z.array(z.string()).max(12),
  execution_steps: z.array(z.string()).max(14),
  failure_modes: z.array(z.string()).max(12),
  outputs: z.array(z.string()).max(12),
  flow_breakdown: z.object({
    trigger: z.array(z.string()).max(8),
    input_parsing: z.array(z.string()).max(8),
    prechecks: z.array(z.string()).max(8),
    execution: z.array(z.string()).max(10),
    failure_paths: z.array(z.string()).max(8),
    outputs: z.array(z.string()).max(8),
  }),
  assumptions: z.array(z.string()).max(8),
});

const safetyAnalysisSchema = z.object({
  risk_level: z.enum(["safe", "caution", "unsafe"]),
  is_malicious_or_unsafe: z.boolean(),
  verdict: z.string(),
  findings: z.array(z.string()).max(12),
  metadata_review: z.array(z.string()).max(10),
  permission_scope: z.array(z.string()).max(12),
  red_flags: z.array(z.string()).max(12),
  trust_signals: z.array(z.string()).max(12),
  blocked_capabilities: z.array(z.string()).max(10),
  notes: z.array(z.string()).max(8),
});

type FeatureAnalysis = z.infer<typeof featureAnalysisSchema>;
type SafetyAnalysis = z.infer<typeof safetyAnalysisSchema>;

const google = createGoogleGenerativeAI({
  apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
});

function resolveOutputLanguage(input: z.infer<typeof analyzeSkillInputSchema>): OutputLanguage {
  if (input.outputLanguage === "en" || input.outputLanguage === "zh") {
    return input.outputLanguage;
  }

  return input.requestLanguage;
}

function dedupeItems(items: string[], limit = 8) {
  const seen = new Set<string>();
  const deduped: string[] = [];

  for (const rawItem of items) {
    const item = rawItem.replace(/\s+/g, " ").trim();
    if (!item) {
      continue;
    }

    const key = item.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(item);
    if (deduped.length >= limit) {
      break;
    }
  }

  return deduped;
}

function stripMarkdown(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/[*_>#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(text: string, max = 80) {
  const normalized = stripMarkdown(text);
  if (normalized.length <= max) {
    return normalized;
  }

  return `${normalized.slice(0, max - 1).trim()}…`;
}

function parseFrontmatterName(text: string) {
  const frontmatterMatch = text.match(/^---\s*[\r\n]+([\s\S]*?)[\r\n]+---/);
  if (!frontmatterMatch) {
    return null;
  }

  const nameMatch = frontmatterMatch[1]?.match(/^\s*name:\s*["']?(.+?)["']?\s*$/m);
  return nameMatch?.[1]?.trim() || null;
}

function parseSkillName(text: string) {
  const frontmatterName = parseFrontmatterName(text);
  if (frontmatterName) {
    return frontmatterName;
  }

  const skillHeading = text.match(/^#\s*Skill:\s*(.+)$/im);
  if (skillHeading?.[1]) {
    return skillHeading[1].trim();
  }

  const nameLine = text.match(/^\s*name:\s*["']?(.+?)["']?\s*$/m);
  if (nameLine?.[1]) {
    return nameLine[1].trim();
  }

  return "Unknown Skill";
}

function pickBestFiles(files: SkillTextFile[]) {
  const scored = files
    .filter((file) => textFilePattern.test(file.path))
    .map((file) => {
      let score = 0;
      const lowerPath = file.path.toLowerCase();

      if (/skill\.md$/i.test(lowerPath)) {
        score += 100;
      }
      if (/readme/i.test(lowerPath)) {
        score += 60;
      }
      if (docNamePattern.test(lowerPath)) {
        score += 30;
      }
      if (/\.(md|mdx|txt)$/i.test(lowerPath)) {
        score += 15;
      }
      if (/package\.json$/i.test(lowerPath)) {
        score -= 20;
      }
      if (/node_modules|dist|build|coverage|\.next|\.turbo/i.test(lowerPath)) {
        score -= 100;
      }

      return { ...file, score };
    })
    .filter((file) => file.score > -50)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));

  const selected: SkillTextFile[] = [];
  let totalChars = 0;

  for (const file of scored) {
    if (selected.length >= MAX_FILE_COUNT) {
      break;
    }

    const trimmed = file.content.trim();
    if (!trimmed) {
      continue;
    }

    const cappedContent = trimmed.slice(0, MAX_FILE_SIZE);
    if (totalChars + cappedContent.length > MAX_TOTAL_CHARS) {
      continue;
    }

    totalChars += cappedContent.length;
    selected.push({
      path: file.path,
      content: cappedContent,
    });
  }

  return selected;
}

function buildSourceDossier(label: string, files: SkillTextFile[]) {
  const header = [
    `Source Label: ${label}`,
    `Analyzed File Count: ${files.length}`,
    "Analyzed Files:",
    ...files.map((file) => `- ${file.path}`),
  ].join("\n");

  const contentBlocks = files
    .map((file) => {
      return [`## File: ${file.path}`, file.content.trim()].join("\n\n");
    })
    .join("\n\n");

  return `${header}\n\n${contentBlocks}`;
}

function getFeaturePrompts(language: OutputLanguage, defaultSkillName: string, dossier: string) {
  if (language === "en") {
    return {
      system: [
        "You analyze a Skill, prompt package, or repository and produce a concise functional breakdown.",
        "Use only evidence from the provided source. If information is missing, record the assumption in assumptions.",
        "Keep every list item short, concrete, and human-readable.",
        "Normalize the result into: trigger_conditions, non_trigger_conditions, inputs, prechecks, execution_steps, failure_modes, outputs, and flow_breakdown.",
        "Do not perform the safety review in this output.",
      ].join(" "),
      prompt: [
        `Default skill name: ${defaultSkillName}`,
        "Output language: English.",
        "Source dossier:",
        dossier,
      ].join("\n\n"),
    };
  }

  return {
    system: [
      "你是一个 Skill 文档分析器，负责把 Skill、prompt 包或 repo 文档整理成功能结构。",
      "只根据提供的材料输出，不要编造；如果信息缺失，把假设放到 assumptions。",
      "每个数组项保持简短、具体、可读。",
      "必须归一化到：trigger_conditions、non_trigger_conditions、inputs、prechecks、execution_steps、failure_modes、outputs、flow_breakdown。",
      "这里不要做安全结论，只做功能分析。",
    ].join(" "),
    prompt: [`默认 Skill 名称：${defaultSkillName}`, "输出语言：中文。", "源材料：", dossier].join(
      "\n\n",
    ),
  };
}

function getSafetyPrompts(language: OutputLanguage, defaultSkillName: string, dossier: string) {
  if (language === "en") {
    return {
      system: [
        "You are a strict skill vetter.",
        "Follow this workflow: metadata sanity check, permission and capability scope analysis, red-flag scan, provenance and trust review, then final classification.",
        "Mark unsafe if the Skill appears malicious, exfiltrative, destructive, phishing-oriented, evasive, persistent, or designed to bypass safeguards.",
        "Mark caution if the Skill is powerful, privacy-impacting, or unclear, even if not clearly malicious.",
        "Prefer caution over safe when evidence is incomplete.",
        "Return only evidence-based findings from the source.",
      ].join(" "),
      prompt: [
        `Default skill name: ${defaultSkillName}`,
        "Output language: English.",
        "Safety workflow to apply:",
        "1. Metadata sanity: name, purpose, transparency, instructions, source clarity.",
        "2. Permission scope: network, filesystem, shell execution, browser automation, auth/session, secrets, private data.",
        "3. Red flags: credential theft, exfiltration, phishing, impersonation, destructive actions, evasion, persistence, malware, bypass safeguards, fraud, harassment, surveillance.",
        "4. Trust signals: bounded scope, official docs, explicit permissions, human review, transparency.",
        "5. Final classification: safe / caution / unsafe.",
        "Source dossier:",
        dossier,
      ].join("\n\n"),
    };
  }

  return {
    system: [
      "你是严格的 Skill 安全审查器。",
      "按下面流程审查：元数据完整性检查、权限与能力范围分析、红旗内容扫描、来源与可信度判断、最后给出风险分类。",
      "如果出现恶意、窃密、外传数据、破坏性、钓鱼、规避防护、持久化、恶意软件或明显越权行为，标记为 unsafe。",
      "如果能力敏感、涉及隐私或证据不足，优先标记为 caution，而不是 safe。",
      "只输出能从材料中支持的结论。",
    ].join(" "),
    prompt: [
      `默认 Skill 名称：${defaultSkillName}`,
      "输出语言：中文。",
      "安全审查流程：",
      "1. 元数据完整性：名称、用途、来源、说明是否透明。",
      "2. 权限范围：网络、文件系统、命令执行、浏览器自动化、认证会话、密钥、私有数据。",
      "3. 红旗扫描：凭证窃取、数据外传、钓鱼、冒充、破坏性操作、规避检测、持久化、恶意软件、绕过防护、欺诈、骚扰、监控。",
      "4. 可信度：是否边界清晰、是否有官方来源、是否显式请求授权、是否保留人工复核。",
      "5. 最终分类：safe / caution / unsafe。",
      "源材料：",
      dossier,
    ].join("\n\n"),
  };
}

function toMermaidLabel(items: string[], fallback: string) {
  if (items.length === 0) {
    return fallback;
  }

  return truncateText(items.slice(0, 2).join(" / "), 64);
}

function buildFeatureMermaid(feature: FeatureAnalysis, language: OutputLanguage) {
  const labels =
    language === "en"
      ? {
          reviewTrigger: "Review trigger conditions",
          triggerCheck: "Should the Skill trigger?",
          noTrigger: "Do not call the Skill",
          parseInputs: "Parse inputs",
          inputCheck: "Are inputs complete?",
          missingInputs: "Return missing inputs or clarification",
          runPrechecks: "Run prechecks",
          precheckGate: "Do prechecks pass?",
          precheckFail: "Return the precheck failure reason",
          executeCore: "Execute core workflow",
          executionGate: "Did execution succeed?",
          executionFail: "Return error or fallback result",
          formatOutput: "Format structured output",
          deliverResult: "Return to user",
        }
      : {
          reviewTrigger: "检查触发条件",
          triggerCheck: "是否应该触发 Skill？",
          noTrigger: "不触发该 Skill",
          parseInputs: "解析输入",
          inputCheck: "输入是否完整？",
          missingInputs: "返回缺失输入或补充说明",
          runPrechecks: "执行前置检查",
          precheckGate: "预检查是否通过？",
          precheckFail: "返回预检查失败原因",
          executeCore: "执行核心流程",
          executionGate: "执行是否成功？",
          executionFail: "返回错误或降级结果",
          formatOutput: "整理结构化输出",
          deliverResult: "返回给用户",
        };

  return [
    "flowchart TD",
    `    A["${toMermaidLabel(feature.flow_breakdown.trigger, labels.reviewTrigger)}"] --> B{"${labels.triggerCheck}"}`,
    `    B -- "No" --> C["${labels.noTrigger}"]`,
    `    B -- "Yes" --> D["${toMermaidLabel(feature.flow_breakdown.input_parsing, labels.parseInputs)}"]`,
    `    D --> E{"${labels.inputCheck}"}`,
    `    E -- "No" --> F["${labels.missingInputs}"]`,
    `    E -- "Yes" --> G["${toMermaidLabel(feature.flow_breakdown.prechecks, labels.runPrechecks)}"]`,
    `    G --> H{"${labels.precheckGate}"}`,
    `    H -- "No" --> I["${toMermaidLabel(feature.failure_modes, labels.precheckFail)}"]`,
    `    H -- "Yes" --> J["${toMermaidLabel(feature.flow_breakdown.execution, labels.executeCore)}"]`,
    `    J --> K{"${labels.executionGate}"}`,
    `    K -- "No" --> L["${toMermaidLabel(feature.flow_breakdown.failure_paths, labels.executionFail)}"]`,
    `    K -- "Yes" --> M["${toMermaidLabel(feature.flow_breakdown.outputs, labels.formatOutput)}"]`,
    `    M --> N["${labels.deliverResult}"]`,
  ].join("\n");
}

function buildSafetyMermaid(safety: SafetyAnalysis, language: OutputLanguage) {
  const labels =
    language === "en"
      ? {
          readSource: "Read source materials",
          metadata: "Review metadata and purpose",
          scope: "Analyze permissions and capability scope",
          redFlags: "Scan for red flags",
          trust: "Review provenance and trust signals",
          riskGate: "Unsafe or malicious?",
          block: "Block normal execution",
          caution: "Require manual review",
          safe: "Mark as safe for normal review",
          verdict: "Return safety verdict",
        }
      : {
          readSource: "读取源材料",
          metadata: "审查元数据与用途",
          scope: "分析权限与能力范围",
          redFlags: "扫描红旗内容",
          trust: "检查来源与可信度",
          riskGate: "是否存在明显风险？",
          block: "阻断正常执行",
          caution: "要求人工复核",
          safe: "标记为可正常审查",
          verdict: "返回安全结论",
        };

  const branchLabel =
    safety.risk_level === "unsafe"
      ? labels.block
      : safety.risk_level === "caution"
        ? labels.caution
        : labels.safe;

  return [
    "flowchart TD",
    `    A["${labels.readSource}"] --> B["${toMermaidLabel(safety.metadata_review, labels.metadata)}"]`,
    `    B --> C["${toMermaidLabel(safety.permission_scope, labels.scope)}"]`,
    `    C --> D["${toMermaidLabel(safety.red_flags, labels.redFlags)}"]`,
    `    D --> E["${toMermaidLabel(safety.trust_signals, labels.trust)}"]`,
    `    E --> F{"${labels.riskGate}"}`,
    `    F --> G["${branchLabel}"]`,
    `    G --> H["${truncateText(safety.verdict, 72)}"]`,
    `    H --> I["${labels.verdict}"]`,
  ].join("\n");
}

async function runFeatureAnalysis(
  dossier: string,
  defaultSkillName: string,
  language: OutputLanguage,
) {
  const prompts = getFeaturePrompts(language, defaultSkillName, dossier);

  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema: featureAnalysisSchema,
    temperature: 0.1,
    system: prompts.system,
    prompt: prompts.prompt,
  });

  return object;
}

async function runSafetyAnalysis(
  dossier: string,
  defaultSkillName: string,
  language: OutputLanguage,
) {
  const prompts = getSafetyPrompts(language, defaultSkillName, dossier);

  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema: safetyAnalysisSchema,
    temperature: 0.1,
    system: prompts.system,
    prompt: prompts.prompt,
  });

  return object;
}

function buildAnalysisResult(
  source: { kind: "upload" | "repo"; label: string },
  files: SkillTextFile[],
  feature: FeatureAnalysis,
  safety: SafetyAnalysis,
  language: OutputLanguage,
) {
  return {
    status: "success" as const,
    skill_name: feature.skill_name || parseSkillName(files[0]?.content ?? source.label),
    source: {
      kind: source.kind,
      label: source.label,
      analyzed_files: files.map((file) => file.path),
      file_count: files.length,
      model: MODEL_ID,
    },
    language_note:
      language === "en"
        ? "Output language follows the language used in the user's request."
        : "输出语言默认跟随用户请求所使用的语言。",
    feature_analysis: {
      ...feature,
      assumptions: dedupeItems(feature.assumptions, 8),
      trigger_conditions: dedupeItems(feature.trigger_conditions, 10),
      non_trigger_conditions: dedupeItems(feature.non_trigger_conditions, 10),
      inputs: dedupeItems(feature.inputs, 12),
      prechecks: dedupeItems(feature.prechecks, 12),
      execution_steps: dedupeItems(feature.execution_steps, 14),
      failure_modes: dedupeItems(feature.failure_modes, 12),
      outputs: dedupeItems(feature.outputs, 12),
      flow_breakdown: {
        trigger: dedupeItems(feature.flow_breakdown.trigger, 8),
        input_parsing: dedupeItems(feature.flow_breakdown.input_parsing, 8),
        prechecks: dedupeItems(feature.flow_breakdown.prechecks, 8),
        execution: dedupeItems(feature.flow_breakdown.execution, 10),
        failure_paths: dedupeItems(feature.flow_breakdown.failure_paths, 8),
        outputs: dedupeItems(feature.flow_breakdown.outputs, 8),
      },
      mermaid: buildFeatureMermaid(feature, language),
    },
    safety_analysis: {
      ...safety,
      findings: dedupeItems(safety.findings, 12),
      metadata_review: dedupeItems(safety.metadata_review, 10),
      permission_scope: dedupeItems(safety.permission_scope, 12),
      red_flags: dedupeItems(safety.red_flags, 12),
      trust_signals: dedupeItems(safety.trust_signals, 12),
      blocked_capabilities: dedupeItems(safety.blocked_capabilities, 10),
      notes: dedupeItems(safety.notes, 8),
      mermaid: buildSafetyMermaid(safety, language),
    },
  };
}

function parseGitHubUrl(rawUrl: string): ParsedGitHubUrl | null {
  const url = new URL(rawUrl);

  if (url.hostname === "raw.githubusercontent.com") {
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments.length < 4) {
      return null;
    }

    const owner = segments[0]!;
    const repo = segments[1]!;
    const ref = segments[2]!;
    const pathSegments = segments.slice(3);
    return {
      type: "raw" as const,
      owner,
      repo: repo.replace(/\.git$/i, ""),
      ref,
      path: pathSegments.join("/"),
    };
  }

  if (url.hostname !== "github.com") {
    return null;
  }

  const segments = url.pathname.replace(/\.git$/i, "").split("/").filter(Boolean);
  if (segments.length < 2) {
    return null;
  }

  const owner = segments[0]!;
  const repo = segments[1]!;
  const mode = segments[2];
  const ref = segments[3];
  const pathSegments = segments.slice(4);

  if (mode === "blob" && ref && pathSegments.length > 0) {
    return {
      type: "blob" as const,
      owner,
      repo,
      ref,
      path: pathSegments.join("/"),
    };
  }

  if (mode === "tree") {
    return {
      type: "tree" as const,
      owner,
      repo,
      ref: ref || "",
      path: pathSegments.join("/"),
    };
  }

  return {
    type: "repo" as const,
    owner,
    repo,
    ref: "",
    path: "",
  };
}

async function fetchJson<T>(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json, application/json",
      "User-Agent": "SkillPeek",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

async function fetchText(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/plain, text/markdown, application/json",
      "User-Agent": "SkillPeek",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

type GitHubRepoInfo = {
  default_branch: string;
};

type GitHubTreeItem = {
  path: string;
  type: "blob" | "tree";
};

type GitHubTreeResponse = {
  tree: GitHubTreeItem[];
};

function buildRawGitHubUrl(owner: string, repo: string, ref: string, path: string) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${path}`;
}

async function fetchFilesFromGithubRepository(
  owner: string,
  repo: string,
  refHint: string,
  pathPrefix: string,
) {
  const repoInfo = await fetchJson<GitHubRepoInfo>(`https://api.github.com/repos/${owner}/${repo}`);
  const ref = refHint || repoInfo.default_branch;
  const tree = await fetchJson<GitHubTreeResponse>(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${ref}?recursive=1`,
  );

  const normalizedPrefix = pathPrefix.replace(/^\/+|\/+$/g, "");
  const candidatePaths = tree.tree
    .filter((item) => item.type === "blob")
    .map((item) => item.path)
    .filter((path) =>
      normalizedPrefix ? path.startsWith(`${normalizedPrefix}/`) || path === normalizedPrefix : true,
    )
    .filter((path) => textFilePattern.test(path))
    .filter((path) => docNamePattern.test(path) || /skill\.md$/i.test(path) || /readme/i.test(path))
    .slice(0, MAX_FILE_COUNT);

  const files = await Promise.all(
    candidatePaths.map(async (path) => {
      const content = await fetchText(buildRawGitHubUrl(owner, repo, ref, path));
      return { path, content };
    }),
  );

  return {
    label: `${owner}/${repo}${normalizedPrefix ? `/${normalizedPrefix}` : ""}`,
    files,
  };
}

async function fetchRemoteSkillFiles(repoUrl: string, language: OutputLanguage) {
  const github = parseGitHubUrl(repoUrl);

  if (github) {
    if (github.type === "raw" || github.type === "blob") {
      const ref = github.ref || "main";
      const content =
        github.type === "raw"
          ? await fetchText(repoUrl)
          : await fetchText(buildRawGitHubUrl(github.owner, github.repo, ref, github.path));

      return {
        label: `${github.owner}/${github.repo}/${github.path}`,
        files: [{ path: github.path, content }],
      };
    }

    return fetchFilesFromGithubRepository(github.owner, github.repo, github.ref, github.path);
  }

  const url = new URL(repoUrl);
  if (!textFilePattern.test(url.pathname)) {
    throw new Error(
      language === "en"
        ? "Only GitHub repositories, GitHub file URLs, or direct text document URLs are supported."
        : "目前只支持 GitHub 仓库、GitHub 文件链接或直接文本文件链接。",
    );
  }

  const content = await fetchText(repoUrl);
  const path = url.pathname.split("/").filter(Boolean).pop() || "remote-skill.txt";
  return {
    label: url.hostname,
    files: [{ path, content }],
  };
}

async function analyzeSkillFiles(
  files: SkillTextFile[],
  source: { kind: "upload" | "repo"; label: string },
  language: OutputLanguage,
) {
  const relevantFiles = pickBestFiles(files);

  if (relevantFiles.length === 0) {
    throw new Error(
      language === "en"
        ? "No readable Skill documents were found in the provided source."
        : "提供的内容里没有找到可读的 Skill 文档文件。",
    );
  }

  const defaultSkillName =
    parseSkillName(relevantFiles.find((file) => /skill\.md$/i.test(file.path))?.content || "") ||
    source.label;
  const dossier = buildSourceDossier(source.label, relevantFiles);

  const [feature, safety] = await Promise.all([
    runFeatureAnalysis(dossier, defaultSkillName, language),
    runSafetyAnalysis(dossier, defaultSkillName, language),
  ]);

  return buildAnalysisResult(source, relevantFiles, feature, safety, language);
}

export async function analyzeSkillSource(input: z.infer<typeof analyzeSkillInputSchema>) {
  const language = resolveOutputLanguage(input);

  if (input.source.kind === "upload") {
    return analyzeSkillFiles(
      input.source.files,
      {
        kind: "upload",
        label: input.source.label || "Uploaded Skill",
      },
      language,
    );
  }

  const remote = await fetchRemoteSkillFiles(input.source.repoUrl, language);
  return analyzeSkillFiles(
    remote.files,
    {
      kind: "repo",
      label: remote.label,
    },
    language,
  );
}
