import { Plugin, Editor, MarkdownView, Notice, PluginSettingTab, Setting, Menu } from "obsidian";
import { ClaudeWriterView, VIEW_TYPE } from "./view";

// ─── Template Prompts ────────────────────────────────

export const TEMPLATE_PROMPTS: Record<string, { prompt: string; model: string; tone: string }> = {
  "회의록": {
    prompt: `현대자동차 인도기술연구소 내장설계팀의 회의록 작성 전문가입니다.
원문(현장 메모/단편적 키워드)을 완성된 회의록으로 변환하세요.
구조: ## 기본정보(일시/참석자/장소) → ## 안건 → ## 결정 사항 → ## Action Items → ## 메모
Action Items은 '- [ ] [내용] 📅 YYYY-MM-DD' 형식. 자동차 업계 약어(QU2, CFT, T/O 등) 유지. 설명 없이 결과만.`,
    model: "sonnet", tone: "격식체-보고",
  },
  "업무보고": {
    prompt: `현대자동차 내장설계팀 주재원 업무보고서 작성.
Executive Summary 3줄 이내. 현황 마크다운 표. 이슈는 영향도(H/M/L) 포함. 합니다/습니다 격식체.
Action Items은 '- [ ] [내용] 📅 YYYY-MM-DD' 형식. 설명 없이 결과만.`,
    model: "sonnet", tone: "격식체-보고",
  },
  "새프로젝트": {
    prompt: `차종 개발 프로젝트 계획서 작성. 차종명, 목표, 마감, 담당자 구조화. 이슈 테이블 포함. 자동차 개발 일정 맥락 반영. 설명 없이 결과만.`,
    model: "sonnet", tone: "격식체-보고",
  },
  "기술노트": {
    prompt: `기술 리서치 노트 작성. ## 개요 → ## 핵심 내용 → ## 관련 문서 → ## 참고 자료. 전문 기술 용어 정확히. 한국어 설명 + 영어 기술 용어 병기. 설명 없이 결과만.`,
    model: "haiku", tone: "전문기술",
  },
  "콘텐츠-기획": {
    prompt: `YouTube/Instagram 콘텐츠 기획 문서. 훅(Hook, 7초 이내) → 구조 → 대본/스크립트 → 퍼블리싱 체크리스트. 쇼츠면 60초 이내 스크립트. 설명 없이 결과만.`,
    model: "sonnet", tone: "콘텐츠",
  },
  "파인만-노트": {
    prompt: `파인만 기법으로 개념 정리. Step1: 초등학생 수준 설명(비유 필수) → Step2: 막히는 부분 → Step3: 재설명 → Step4: 핵심 비유 1문장. 설명 없이 결과만.`,
    model: "haiku", tone: "전문기술",
  },
  "의사결정-저널": {
    prompt: `의사결정 분석 구조화. 아이젠하워 매트릭스(Q1~Q4) → 2차 사고(1차/2차/3차 결과) → 역산법(실패 조건 3가지) → 선택지 비교표 → 최종 판단. 감정 배제, 논리 기반. 설명 없이 결과만.`,
    model: "sonnet", tone: "분석적",
  },
  "제텔노트": {
    prompt: `핵심 인사이트 1건 추출. 단일 아이디어를 명확하게 정제. 핵심 주장 1문장 → 근거 2~3개 → 연결 가능한 개념 태그. 설명 없이 결과만.`,
    model: "haiku", tone: "분석적",
  },
  "데일리-브리프": {
    prompt: `AI/기술 데일리 브리핑 작성. 핵심 뉴스 3~5개 불릿. 각각 한 줄 요약 + 임팩트. 설명 없이 결과만.`,
    model: "haiku", tone: "콘텐츠",
  },
  "SQ3R-독서노트": {
    prompt: `SQ3R 독서법으로 정리. Survey(훑어보기) → Question(질문) → Read(읽기 핵심) → Recite(요약) → Review(복습 포인트). 설명 없이 결과만.`,
    model: "haiku", tone: "전문기술",
  },
  "GTD-주간리뷰": {
    prompt: `GTD 주간 리뷰 구조화. Inbox 정리 → 프로젝트 현황 → 다음 행동 → 대기 항목 → 언젠가/아마도. Action Items은 '- [ ] [내용] 📅 YYYY-MM-DD' 형식. 설명 없이 결과만.`,
    model: "sonnet", tone: "분석적",
  },
};

// ─── Command Definitions ─────────────────────────────

export interface CmdDef {
  id: string;
  name: string;
  label: string;
  icon: string;
  desc: string;
  prompt: string;
}

export const COMMANDS: CmdDef[] = [
  { id: "rewrite", name: "다듬기 (Rewrite)", label: "다듬기", icon: "✏️", desc: "문체·문법 개선",
    prompt: "다음 텍스트의 문체와 문법을 자연스럽게 다듬어줘. 원래 의미와 톤 유지. 마크다운 유지. 설명 없이 결과만." },
  { id: "reconstruct", name: "구조화 (Reconstruct)", label: "구조화", icon: "📐", desc: "템플릿에 맞춰 완성",
    prompt: "다음 메모/키워드를 구조화된 문서로 완성해줘. 마크다운 유지. 설명 없이 결과만." },
  { id: "summarize", name: "요약 (Summarize)", label: "요약", icon: "📋", desc: "핵심 불릿",
    prompt: "다음 텍스트를 핵심만 간결하게 요약. 불릿 포인트. 설명 없이 결과만." },
  { id: "translate-en", name: "한→영 (KR→EN)", label: "한→영", icon: "🇺🇸", desc: "한국어→영어",
    prompt: "다음 한국어 텍스트를 자연스러운 영어로 번역. 설명 없이 결과만." },
  { id: "translate-kr", name: "영→한 (EN→KR)", label: "영→한", icon: "🇰🇷", desc: "영어→한국어",
    prompt: "다음 영어 텍스트를 자연스러운 한국어로 번역. 설명 없이 결과만." },
  { id: "formalize-en", name: "영문보고서화 (Formalize EN)", label: "보고서화", icon: "📄", desc: "KR→EN 기술보고서",
    prompt: `한국어 자동차 기술 문서를 영문 기술 보고서로 변환.
자동차 공학 용어(HMI, ADAS, BOM 등) 사용. 현대차 내부 문서 스타일(formal, concise).
숫자·부품명·코드는 정확히 보존. Executive Summary → Details → Action Items 구조. 영어만 출력. 설명 없이 결과만.` },
  { id: "insight", name: "인사이트 추출 (Insight)", label: "인사이트", icon: "💡", desc: "제텔노트용",
    prompt: "다음 텍스트에서 핵심 인사이트 1건 추출. 핵심 주장 1문장 → 근거 2~3개 → 연결 태그. 설명 없이 결과만." },
  { id: "explain", name: "풀어설명 (Explain)", label: "풀어설명", icon: "🔍", desc: "레벨별 심층 설명",
    prompt: "" },
  { id: "visualize", name: "시각화 (Visualize)", label: "시각화", icon: "📊", desc: "시각화 기법 추천+생성",
    prompt: "" },
  { id: "custom", name: "자유 프롬프트 (Custom)", label: "자유", icon: "💬", desc: "직접 지시",
    prompt: "" },
];

// ─── Explain Levels ──────────────────────────────────

export const EXPLAIN_LEVELS = [
  { level: 1, label: "초등", desc: "비유와 예시 중심",
    prompt: `초등학생도 완전히 이해할 수 있도록 풀어 설명하세요.
- 어려운 단어는 쉬운 말로 바꾸고, 일상 비유 필수 ("이건 마치 ~와 같아요")
- 배경(왜 중요한지) → 원리(어떻게 되는지) → 쉬운 예시
- 구성 요소 간 관계를 그림 그리듯 설명
- 한국어. 마크다운 사용.` },
  { level: 2, label: "중고등", desc: "개념·원리 중심",
    prompt: `중고등학생 수준으로 풀어 설명하세요.
- 핵심 개념 정의 → 작동 원리 → 구성 요소 관계 → 실생활 예시
- 전문 용어는 처음 등장 시 괄호로 풀어쓰기
- 배경, 원리, 인과관계를 논리적으로 연결
- 한국어. 마크다운 사용.` },
  { level: 3, label: "일반인", desc: "배경·원리·관계 균형",
    prompt: `일반 성인이 완전히 이해할 수 있도록 설명하세요.
- 배경(왜 이것이 중요한가) → 핵심 원리(어떻게 작동하는가)
- 구성 요소 간 관계와 상호작용 → 실제 적용과 영향
- 필요하면 비교·대조로 개념 명확화
- 한국어. 마크다운 사용.` },
  { level: 4, label: "전문가", desc: "심층 기술 분석",
    prompt: `전문가 수준으로 심층 분석하세요.
- 기술적 세부사항과 메커니즘
- 역사적 맥락과 발전 과정
- Trade-off, 한계점, edge case
- 관련 이론/개념과의 연결, 비판적 관점
- 한국어. 전문 용어 영문 병기. 마크다운 사용.` },
];

// ─── Visualize Prompts ───────────────────────────────

export const VIZ_SUGGEST_PROMPT = `Analyze the text and suggest exactly 3 visualization techniques using Obsidian-compatible formats.

Available types:
- mermaid-flowchart: 프로세스, 의사결정 흐름
- mermaid-mindmap: 개념 구조, 주제 분류
- mermaid-sequence: 시간순 상호작용, 커뮤니케이션
- mermaid-timeline: 연대기, 단계별 진행
- mermaid-pie: 비율, 구성 비교
- mermaid-gantt: 일정, 프로젝트 관리
- mermaid-er: 엔티티 관계, 데이터 구조
- mermaid-state: 상태 전이, 라이프사이클
- mermaid-class: 계층 구조, 분류 체계
- mermaid-quadrant: 2축 비교 평가
- markdown-table: 비교표, 매트릭스

Choose the 3 BEST fits for this specific content. Each suggestion must use a DIFFERENT type.

Output ONLY a JSON array (no markdown, no explanation):
[{"name":"한국어 이름","type":"type-id","desc":"이 시각화가 보여주는 것 한 줄","icon":"이모지1개"}]`;

export const VIZ_GENERATE_PROMPT = `Generate an Obsidian-ready visualization for the following content.

Type: {TYPE}

Rules:
- For mermaid types: output the complete \`\`\`mermaid code block
- For markdown-table: output the table directly
- Use Korean labels
- Keep it clean, readable, not overly complex
- Output ONLY the visualization code, nothing else`;

// ─── Reading Note Prompt ────────────────────────────

export const READING_NOTE_PROMPT = `당신은 독서 노트 편집 전문가입니다. 아래의 Q&A 쌍들을 하나의 구조화된 학습 노트로 재구성하세요.

규칙:
1. 단순히 Q&A를 나열하지 말 것. 내용을 주제별로 재구조화할 것.
2. 구조: ## 핵심 개념 → ## 작동 원리 → ## 주요 용어 → ## 인사이트 → ## 추가 탐구 질문
3. 각 섹션에 해당하는 내용이 없으면 해당 섹션을 생략.
4. 중복 내용은 병합. 상호 연결이 있으면 명시.
5. 한국어. 마크다운 사용. 설명 없이 결과만.`;

// ─── Settings ────────────────────────────────────────

export interface ClaudeWriterSettings {
  claudePath: string;
  model: string;
  maxChars: number;
  tone: string;
  customPrompts: Record<string, string>;
}

export const DEFAULT_SETTINGS: ClaudeWriterSettings = {
  claudePath: "",
  model: "haiku",
  maxChars: 0,
  tone: "auto",
  customPrompts: {},
};

export const TONES: { id: string; label: string; desc: string; instruction: string }[] = [
  { id: "auto", label: "자동", desc: "템플릿 기반", instruction: "" },
  { id: "격식체-보고", label: "격식체", desc: "보고서/회의록", instruction: "격식체(합니다/습니다)로 작성. 명확하고 간결하게." },
  { id: "전문기술", label: "전문", desc: "기술문서", instruction: "전문 기술 용어를 정확히 사용. 영어 기술 용어 병기." },
  { id: "콘텐츠", label: "콘텐츠", desc: "유튜브/SNS", instruction: "흥미롭고 생동감 있게. 훅을 먼저, 핵심을 빠르게." },
  { id: "분석적", label: "분석", desc: "의사결정/분석", instruction: "논리적이고 구조적으로. 감정 배제, 근거 기반." },
];

// ─── Helpers ─────────────────────────────────────────

function getClaudeEnv(): Record<string, string | undefined> {
  const env = { ...process.env };
  delete env["CLAUDECODE"];
  return env;
}

// ─── Auth ────────────────────────────────────────────

export interface AuthInfo { loggedIn: boolean; email: string; subscriptionType: string; }

export function getAuthStatus(claudePath: string): Promise<AuthInfo> {
  return new Promise((resolve) => {
    const { spawn } = require("child_process");
    const child = spawn(claudePath, ["auth", "status"], { shell: true, env: getClaudeEnv(), stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.on("close", () => {
      try {
        const data = JSON.parse(stdout);
        resolve({ loggedIn: data.loggedIn || false, email: data.email || "", subscriptionType: data.subscriptionType || "" });
      } catch {
        const isLoggedIn = stdout.includes("logged in") || stdout.includes("Logged in");
        const emailMatch = stdout.match(/[\w.+-]+@[\w-]+\.[a-z]+/i);
        resolve({ loggedIn: isLoggedIn, email: emailMatch?.[0] || "", subscriptionType: "" });
      }
    });
    child.on("error", () => resolve({ loggedIn: false, email: "", subscriptionType: "" }));
  });
}

export function claudeAuthLogout(claudePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const { spawn } = require("child_process");
    const child = spawn(claudePath, ["auth", "logout"], { shell: true, env: getClaudeEnv(), stdio: ["pipe", "pipe", "pipe"] });
    child.on("close", (code: number) => code === 0 ? resolve() : reject(new Error(`exit ${code}`)));
    child.on("error", reject);
  });
}

export function claudeAuthLogin(claudePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const { spawn } = require("child_process");
    const child = spawn(claudePath, ["auth", "login"], { shell: true, env: getClaudeEnv(), stdio: ["pipe", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (d: Buffer) => { output += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { output += d.toString(); });
    const timer = setTimeout(() => { child.kill(); reject(new Error("로그인 타임아웃 (120초). 브라우저에서 로그인을 완료해주세요.")); }, 120000);
    child.on("close", (code: number) => { clearTimeout(timer); code === 0 ? resolve(output) : reject(new Error(`Login failed (${code})\n${output}`)); });
    child.on("error", (e: Error) => { clearTimeout(timer); reject(e); });
  });
}

// ─── Claude Bridge ───────────────────────────────────

export function callClaude(
  claudePath: string, model: string, systemPrompt: string, userText: string, maxChars: number, tone: string,
  onChunk: (chunk: string) => void, onDone: () => void, onError: (err: string) => void,
  replaceMode = true,
): { kill: () => void } {
  const REPLACE_ONLY = `You are a text replacement tool. Rules:
1. Output ONLY the replacement for the [대체 대상] section.
2. Consider [앞 문맥] and [뒤 문맥] for tone, flow, and coherence — but NEVER output them.
3. The result must read naturally when placed between the surrounding context.
4. No preamble, no explanation, no code block wrapping. Raw replacement text only.`;
  const EXPLAIN_MODE = `You are an expert educator. Explain the [대체 대상] text so the reader fully understands it.
Use [앞 문맥] and [뒤 문맥] to understand the domain — but NEVER output them.
Cover: background, core principles, relationships between components, and real-world implications.`;
  const modePrefix = replaceMode ? REPLACE_ONLY : EXPLAIN_MODE;
  const toneInst = tone && tone !== "auto" ? `\n[톤: ${TONES.find(t => t.id === tone)?.instruction || ""}]` : "";
  const charLimit = maxChars > 0 ? `\n답변은 ${maxChars}자 이내로 제한.` : "";
  const fullPrompt = `${modePrefix}\n\n${systemPrompt}${toneInst}${charLimit}\n\n---\n\n${userText}`;

  const env = getClaudeEnv();
  const { spawn } = require("child_process");
  const timeoutMs = model === "opus" ? 180000 : model === "sonnet" ? 120000 : 60000;

  const child = spawn(claudePath, ["-p", "--output-format", "text", "--model", model, "--no-session-persistence", "--effort", "low"], {
    shell: true, env, stdio: ["pipe", "pipe", "pipe"],
  });

  let stderr = "";
  child.stdout.on("data", (d: Buffer) => onChunk(d.toString()));
  child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

  const timer = setTimeout(() => { child.kill(); onError(`타임아웃 (${timeoutMs / 1000}초)`); }, timeoutMs);
  child.on("close", (code: number) => { clearTimeout(timer); code !== 0 ? onError(`CLI 종료 ${code}: ${stderr}`) : onDone(); });
  child.on("error", (err: Error) => { clearTimeout(timer); onError(`실행 오류: ${err.message}`); });

  // Guard stdin
  if (child.stdin) { child.stdin.write(fullPrompt); child.stdin.end(); }
  else { clearTimeout(timer); child.kill(); onError("stdin not available"); }

  return { kill: () => { clearTimeout(timer); child.kill(); } };
}

// ─── Template Detection ──────────────────────────────

export function detectTemplate(app: any, filePath: string): string {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!file) return "";
  const cache = app.metadataCache.getFileCache(file);
  return cache?.frontmatter?.template || "";
}

export function extractSectionHeaders(content: string): string[] {
  return (content.match(/^##+ .+/gm) || []).slice(0, 15);
}

export function extractUsefulContent(content: string): string {
  let c = content.replace(/^---[\s\S]*?---\n?/, "");
  c = c.replace(/\[\[.*?\|←.*?\]\]/g, "");
  c = c.replace(/^##[^\n]+\n+(?=##|\s*$)/gm, "");
  return c.trim().slice(0, 1500);
}

// ─── Main Plugin ─────────────────────────────────────

export default class ClaudeWriterPlugin extends Plugin {
  settings: ClaudeWriterSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();
    this.registerView(VIEW_TYPE, (leaf) => new ClaudeWriterView(leaf, this));
    this.addRibbonIcon("pen-tool", "Claude Writer", () => this.activateView());

    // Register editor commands
    for (const cmd of COMMANDS) {
      this.addCommand({
        id: cmd.id, name: cmd.name,
        editorCallback: async (editor: Editor) => {
          await this.activateView();
          const view = this.getView();
          if (view) view.triggerCommand(cmd.id, editor.getSelection());
        },
      });
    }

    // Right-click context menu
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
        const sel = editor.getSelection();
        if (!sel) return;
        menu.addSeparator();
        const quickCmds = ["rewrite", "reconstruct", "summarize", "translate-en", "formalize-en"];
        for (const cmdId of quickCmds) {
          const cmd = COMMANDS.find(c => c.id === cmdId);
          if (!cmd) continue;
          menu.addItem((item: any) => {
            item.setTitle(`Claude: ${cmd.label}`).setIcon("pen-tool").onClick(async () => {
              await this.activateView();
              const view = this.getView();
              if (view) view.triggerCommand(cmdId, sel);
            });
          });
        }
      })
    );

    this.addSettingTab(new ClaudeWriterSettingTab(this.app, this));
  }

  async onunload() {
    const view = this.getView();
    if (view) view.forceKill();
    this.app.workspace.detachLeavesOfType(VIEW_TYPE);
  }

  getClaudePath(): string {
    if (this.settings.claudePath) return this.settings.claudePath;
    const home = process.env.USERPROFILE || process.env.HOME || "";
    return process.platform === "win32" ? `${home}\\AppData\\Roaming\\npm\\claude.cmd` : "/usr/local/bin/claude";
  }

  getView(): ClaudeWriterView | null {
    const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    return leaves.length > 0 ? (leaves[0].view as ClaudeWriterView) : null;
  }

  async activateView() {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE);
    if (existing.length > 0) { this.app.workspace.revealLeaf(existing[0]); return; }
    const leaf = this.app.workspace.getRightLeaf(false);
    if (leaf) { await leaf.setViewState({ type: VIEW_TYPE, active: true }); this.app.workspace.revealLeaf(leaf); }
  }

  getEffectivePrompt(cmdId: string, templateType: string): { prompt: string; model: string; tone: string } {
    // For reconstruct, use template-specific prompt if available
    if (cmdId === "reconstruct" && templateType && TEMPLATE_PROMPTS[templateType]) {
      return TEMPLATE_PROMPTS[templateType];
    }
    const cmd = COMMANDS.find(c => c.id === cmdId);
    return { prompt: cmd?.prompt || "", model: this.settings.model, tone: this.settings.tone };
  }

  async loadSettings() { this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData()); }
  async saveSettings() { await this.saveData(this.settings); }
}

// ─── Settings Tab ────────────────────────────────────

class ClaudeWriterSettingTab extends PluginSettingTab {
  plugin: ClaudeWriterPlugin;
  constructor(app: any, plugin: ClaudeWriterPlugin) { super(app, plugin); this.plugin = plugin; }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Claude Writer" });

    new Setting(containerEl).setName("Claude CLI 경로").setDesc("비워두면 자동 감지")
      .addText((t) => t.setPlaceholder("auto-detect").setValue(this.plugin.settings.claudePath)
        .onChange(async (v) => { this.plugin.settings.claudePath = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl).setName("기본 모델")
      .addDropdown((d) => d.addOption("haiku", "Haiku (빠름)").addOption("sonnet", "Sonnet (균형)").addOption("opus", "Opus (최고 품질)")
        .setValue(this.plugin.settings.model).onChange(async (v) => { this.plugin.settings.model = v; await this.plugin.saveSettings(); }));

    new Setting(containerEl).setName("기본 톤")
      .addDropdown((d) => { TONES.forEach(t => d.addOption(t.id, `${t.label} (${t.desc})`)); d.setValue(this.plugin.settings.tone)
        .onChange(async (v) => { this.plugin.settings.tone = v; await this.plugin.saveSettings(); }); });

    new Setting(containerEl).setName("글자수 제한").setDesc("0 = 무제한")
      .addText((t) => t.setValue(String(this.plugin.settings.maxChars))
        .onChange(async (v) => { this.plugin.settings.maxChars = parseInt(v) || 0; await this.plugin.saveSettings(); }));

    containerEl.createEl("h3", { text: "템플릿별 프롬프트 (자동 감지)" });
    containerEl.createEl("p", { text: "frontmatter의 template 필드를 기반으로 자동 적용됩니다.", cls: "setting-item-description" });

    for (const [name, def] of Object.entries(TEMPLATE_PROMPTS)) {
      new Setting(containerEl).setName(name).setDesc(`모델: ${def.model} | 톤: ${def.tone}`)
        .addTextArea((t) => t.setValue(def.prompt).onChange(async (v) => { TEMPLATE_PROMPTS[name].prompt = v; }));
    }
  }
}
