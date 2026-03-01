import { ItemView, WorkspaceLeaf, MarkdownView, Notice } from "obsidian";
import type ClaudeWriterPlugin from "./main";
import { callClaude, getAuthStatus, claudeAuthLogout, claudeAuthLogin, detectTemplate, extractSectionHeaders, extractUsefulContent, COMMANDS, TONES, EXPLAIN_LEVELS, VIZ_SUGGEST_PROMPT, VIZ_GENERATE_PROMPT, READING_NOTE_PROMPT } from "./main";
import type { CmdDef } from "./main";

export const VIEW_TYPE = "claude-writer-view";
type ViewState = "idle" | "processing" | "done" | "error";

interface SessionEntry {
  selectedText: string;
  command: string;
  response: string;
  timestamp: number;
}

interface ReadingSession {
  sourceFile: string;
  startedAt: number;
  entries: SessionEntry[];
  isActive: boolean;
}

// ─── LRU Cache ───────────────────────────────────────

class LRUCache<K, V> {
  private map = new Map<K, V>();
  constructor(private max: number) {}
  get(key: K): V | undefined { const v = this.map.get(key); if (v !== undefined) { this.map.delete(key); this.map.set(key, v); } return v; }
  set(key: K, value: V) { this.map.delete(key); if (this.map.size >= this.max) { const first = this.map.keys().next().value; if (first !== undefined) this.map.delete(first); } this.map.set(key, value); }
  has(key: K) { return this.map.has(key); }
}

// ─── View ────────────────────────────────────────────

export class ClaudeWriterView extends ItemView {
  private plugin: ClaudeWriterPlugin;

  // DOM
  private headerStatusEl: HTMLElement;
  private templateBadge: HTMLElement;
  private toneBtns: Map<string, HTMLElement> = new Map();
  private modelSelect: HTMLSelectElement;
  private cmdGrid: HTMLElement;
  private actionBtns: Map<string, HTMLElement> = new Map();
  private selectionHint: HTMLElement;
  private contextBanner: HTMLElement;
  private contextInfo: HTMLElement;
  private customRow: HTMLElement;
  private customInput: HTMLTextAreaElement;
  private explainRow: HTMLElement;
  private vizRow: HTMLElement;
  private vizCards: HTMLElement;
  private inputSection: HTMLElement;
  private originalSummary: HTMLElement;
  private outputSection: HTMLElement;
  private outputContent: HTMLElement;
  private applyBtn: HTMLElement;
  private appendBtn: HTMLElement;
  private insertBelowBtn: HTMLElement;
  private insertCalloutBtn: HTMLElement;
  private insertLinkBtn: HTMLElement;
  private copyBtn: HTMLElement;
  private dismissBtn: HTMLElement;
  private cancelBtn: HTMLElement;
  private retryBtn: HTMLElement;
  private accountEmailEl: HTMLElement;
  private accountPlanEl: HTMLElement;

  // State
  private state: ViewState = "idle";
  private currentSelection = "";
  private currentResult = "";
  private activeCommand = "";
  private isExplainMode = false;
  private isVizMode = false;
  private killProcess: (() => void) | null = null;
  private lastEditor: { editor: any; leaf: WorkspaceLeaf } | null = null;
  private savedFrom: any = null;
  private savedTo: any = null;
  private contextCache = new LRUCache<string, string>(20);
  private currentDocPath = "";
  private currentTemplate = "";
  private scanAbortPath = "";

  // Reading Session
  private readingSession: ReadingSession | null = null;
  private sessionBar: HTMLElement;
  private sessionToggleBtn: HTMLElement;
  private sessionCounter: HTMLElement;
  private sessionGenerateBtn: HTMLElement;
  private accumulateBtn: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: ClaudeWriterPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() { return VIEW_TYPE; }
  getDisplayText() { return "Claude Writer"; }
  getIcon() { return "pen-tool"; }

  async onOpen() {
    this.buildUI();
    this.setState("idle");
    this.refreshAuth();

    this.registerEvent(this.app.workspace.on("active-leaf-change", (leaf) => {
      if (leaf && leaf.view instanceof MarkdownView) {
        this.lastEditor = { editor: leaf.view.editor, leaf };
        this.onDocumentChanged(leaf.view);
      }
    }));

    // Selection state polling — dim buttons when no selection
    this.registerInterval(window.setInterval(() => {
      const hasSel = !!this.getEditorSelection(true);
      this.cmdGrid.toggleClass("cw-no-selection", !hasSel);
      this.selectionHint.toggleClass("cw-hidden", hasSel);
    }, 800));

    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active) {
      this.lastEditor = { editor: active.editor, leaf: active.leaf };
      this.onDocumentChanged(active);
    }
  }

  async onClose() { this.forceKill(); this.contentEl.empty(); }
  forceKill() { if (this.killProcess) { this.killProcess(); this.killProcess = null; } }

  triggerCommand(cmdId: string, selection: string) {
    if (this.state === "processing") { new Notice("이미 처리 중입니다"); return; }
    this.currentSelection = selection || "";
    if (!this.currentSelection) { new Notice("텍스트를 선택해주세요"); return; }

    // Save cursor range for accurate apply
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active) {
      this.lastEditor = { editor: active.editor, leaf: active.leaf };
      this.savedFrom = active.editor.getCursor("from");
      this.savedTo = active.editor.getCursor("to");
    } else if (this.lastEditor) {
      this.savedFrom = this.lastEditor.editor.getCursor("from");
      this.savedTo = this.lastEditor.editor.getCursor("to");
    }

    if (cmdId === "explain") { this.explainRow.removeClass("cw-hidden"); return; }
    if (cmdId === "visualize") { this.executeVisualizeSuggest(); return; }
    if (cmdId === "custom") { this.showCustomInput(); return; }
    this.isExplainMode = false;
    this.isVizMode = false;
    this.executeCommand(cmdId);
  }

  // ─── Build UI ────────────────────────────────────

  private buildUI() {
    const c = this.contentEl;
    c.empty();
    c.addClass("cw-panel");

    // Header
    const header = c.createDiv("cw-header");
    const titleRow = header.createDiv("cw-title-row");
    titleRow.createEl("span", { text: "Claude Writer", cls: "cw-title" });
    this.headerStatusEl = titleRow.createEl("span", { cls: "cw-status-badge" });
    this.templateBadge = header.createDiv("cw-template-badge cw-hidden");

    // ── Tone bar ──
    const toneBar = c.createDiv("cw-tone-bar");
    for (const tone of TONES) {
      const btn = toneBar.createEl("button", { text: tone.label, cls: "cw-tone-btn", attr: { title: tone.desc } });
      if (this.plugin.settings.tone === tone.id) btn.addClass("cw-tone-active");
      btn.addEventListener("click", async () => {
        this.toneBtns.forEach(b => b.removeClass("cw-tone-active"));
        btn.addClass("cw-tone-active");
        this.plugin.settings.tone = tone.id;
        await this.plugin.saveSettings();
      });
      this.toneBtns.set(tone.id, btn);
    }

    // ── Model + settings compact ──
    const toolbar = c.createDiv("cw-toolbar");
    this.modelSelect = toolbar.createEl("select", { cls: "cw-select-sm" });
    for (const m of [{ v: "haiku", l: "Haiku" }, { v: "sonnet", l: "Sonnet" }, { v: "opus", l: "Opus" }]) {
      this.modelSelect.createEl("option", { text: m.l, attr: { value: m.v } });
    }
    this.modelSelect.value = this.plugin.settings.model;
    this.modelSelect.addEventListener("change", async () => {
      this.plugin.settings.model = this.modelSelect.value;
      await this.plugin.saveSettings();
    });

    // ── Context banner ──
    this.contextBanner = c.createDiv("cw-context-banner cw-hidden");
    const bannerText = this.contextBanner.createDiv("cw-context-banner-text");
    const bannerActions = this.contextBanner.createDiv("cw-context-banner-actions");
    bannerActions.createEl("button", { text: "허락", cls: "cw-btn cw-btn-xs cw-btn-primary" })
      .addEventListener("click", () => this.scanContext());
    bannerActions.createEl("button", { text: "건너뛰기", cls: "cw-btn cw-btn-xs" })
      .addEventListener("click", () => this.contextBanner.addClass("cw-hidden"));
    this.contextInfo = c.createDiv("cw-context-info cw-hidden");

    // ── Reading Session bar ──
    this.sessionBar = c.createDiv("cw-session-bar");
    this.sessionToggleBtn = this.sessionBar.createEl("button", { text: "📖 읽기 세션", cls: "cw-btn cw-btn-session" });
    this.sessionCounter = this.sessionBar.createEl("span", { text: "0건", cls: "cw-session-counter cw-hidden" });
    this.sessionGenerateBtn = this.sessionBar.createEl("button", { text: "노트 생성", cls: "cw-btn cw-btn-primary cw-btn-xs cw-hidden" });
    this.sessionToggleBtn.addEventListener("click", () => this.toggleReadingSession());
    this.sessionGenerateBtn.addEventListener("click", () => this.generateReadingNote());

    // ── Command grid (PRIMARY) ──
    this.cmdGrid = c.createDiv("cw-cmd-grid");
    const SPECIAL_IDS = new Set(["custom", "explain", "visualize"]);
    const topCmds = COMMANDS.filter(cmd => !SPECIAL_IDS.has(cmd.id));
    for (const cmd of topCmds) {
      const btn = this.cmdGrid.createDiv({ cls: "cw-cmd-btn", attr: { role: "button", tabindex: "0", title: cmd.desc } });
      btn.createEl("span", { text: cmd.icon, cls: "cw-cmd-icon" });
      btn.createEl("span", { text: cmd.label, cls: "cw-cmd-label" });
      btn.addEventListener("click", () => this.onCommandClick(cmd.id));
      btn.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.onCommandClick(cmd.id); } });
      this.actionBtns.set(cmd.id, btn);
    }
    // Explain + Visualize + Custom (full width)
    for (const id of ["explain", "visualize", "custom"]) {
      const cmd = COMMANDS.find(c => c.id === id)!;
      const btn = this.cmdGrid.createDiv({ cls: "cw-cmd-btn cw-cmd-full", attr: { role: "button", tabindex: "0", title: cmd.desc } });
      btn.createEl("span", { text: cmd.icon, cls: "cw-cmd-icon" });
      btn.createEl("span", { text: cmd.label, cls: "cw-cmd-label" });
      btn.addEventListener("click", () => this.onCommandClick(id));
      this.actionBtns.set(id, btn);
    }

    this.selectionHint = c.createDiv("cw-selection-hint");
    this.selectionHint.setText("텍스트를 선택하면 명령을 사용할 수 있습니다");

    // ── Explain level picker ──
    this.explainRow = c.createDiv("cw-explain-row cw-hidden");
    this.explainRow.createEl("div", { text: "설명 레벨 선택", cls: "cw-section-label" });
    const levelGrid = this.explainRow.createDiv("cw-level-grid");
    for (const lv of EXPLAIN_LEVELS) {
      const btn = levelGrid.createEl("button", { cls: "cw-level-btn", attr: { title: lv.desc } });
      btn.createEl("span", { text: String(lv.level), cls: "cw-level-num" });
      btn.createEl("span", { text: lv.label, cls: "cw-level-label" });
      btn.createEl("span", { text: lv.desc, cls: "cw-level-desc" });
      btn.addEventListener("click", () => { this.explainRow.addClass("cw-hidden"); this.executeExplain(lv.level); });
    }
    const explainCancel = this.explainRow.createDiv("cw-custom-actions");
    explainCancel.createEl("button", { text: "취소", cls: "cw-btn" }).addEventListener("click", () => this.explainRow.addClass("cw-hidden"));

    // ── Visualize suggestion cards ──
    this.vizRow = c.createDiv("cw-viz-row cw-hidden");
    this.vizRow.createEl("div", { text: "시각화 기법 추천", cls: "cw-section-label" });
    this.vizCards = this.vizRow.createDiv("cw-viz-cards");
    const vizCancel = this.vizRow.createDiv("cw-custom-actions");
    vizCancel.createEl("button", { text: "취소", cls: "cw-btn" }).addEventListener("click", () => { this.vizRow.addClass("cw-hidden"); this.setState("idle"); });

    // ── Custom prompt ──
    this.customRow = c.createDiv("cw-custom-row cw-hidden");
    this.customInput = this.customRow.createEl("textarea", { cls: "cw-custom-input", attr: { placeholder: "지시를 입력하세요... (Ctrl+Enter 실행)", rows: "3" } });
    const customActions = this.customRow.createDiv("cw-custom-actions");
    customActions.createEl("button", { text: "실행", cls: "cw-btn cw-btn-primary" }).addEventListener("click", () => this.onCustomRun());
    customActions.createEl("button", { text: "취소", cls: "cw-btn" }).addEventListener("click", () => this.customRow.addClass("cw-hidden"));
    this.customInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.onCustomRun(); } });

    // ── Original (compact summary) ──
    this.inputSection = c.createDiv("cw-section cw-hidden");
    this.inputSection.createEl("div", { text: "원본", cls: "cw-section-label" });
    this.originalSummary = this.inputSection.createDiv("cw-original-summary");

    // ── Result ──
    this.outputSection = c.createDiv("cw-section cw-hidden");
    this.outputSection.createDiv("cw-output-header").createEl("div", { text: "결과", cls: "cw-section-label" });
    this.outputContent = this.outputSection.createDiv("cw-text-box cw-result");

    const actionRow = this.outputSection.createDiv("cw-action-row cw-hidden");
    this.applyBtn = actionRow.createEl("button", { text: "대체", cls: "cw-btn cw-btn-primary", attr: { title: "선택 영역을 결과로 교체" } });
    this.insertBelowBtn = actionRow.createEl("button", { text: "바로 아래", cls: "cw-btn", attr: { title: "선택 영역 바로 아래에 삽입" } });
    this.insertCalloutBtn = actionRow.createEl("button", { text: "콜아웃", cls: "cw-btn", attr: { title: "> [!info] 펼치기 블록으로 삽입" } });
    this.insertLinkBtn = actionRow.createEl("button", { text: "새 노트", cls: "cw-btn", attr: { title: "새 노트 생성 + 위키링크 삽입" } });
    this.appendBtn = actionRow.createEl("button", { text: "문서 끝", cls: "cw-btn", attr: { title: "문서 맨 끝에 추가" } });
    this.copyBtn = actionRow.createEl("button", { text: "복사", cls: "cw-btn" });
    this.dismissBtn = actionRow.createEl("button", { text: "닫기", cls: "cw-btn" });
    this.cancelBtn = actionRow.createEl("button", { text: "중단", cls: "cw-btn cw-btn-danger" });
    this.retryBtn = actionRow.createEl("button", { text: "다시 시도", cls: "cw-btn cw-btn-primary" });
    this.accumulateBtn = actionRow.createEl("button", { text: "📖 축적", cls: "cw-btn cw-btn-accumulate" });

    this.applyBtn.addEventListener("click", () => this.applyResult());
    this.insertBelowBtn.addEventListener("click", () => this.insertBelow());
    this.insertCalloutBtn.addEventListener("click", () => this.insertAsCallout());
    this.insertLinkBtn.addEventListener("click", () => this.insertAsLinkedNote());
    this.appendBtn.addEventListener("click", () => this.appendResult());
    this.copyBtn.addEventListener("click", () => { navigator.clipboard.writeText(this.currentResult); new Notice("클립보드에 복사됨"); });
    this.dismissBtn.addEventListener("click", () => { this.setState("idle"); new Notice("결과 닫힘 — 원문 유지"); });
    this.cancelBtn.addEventListener("click", () => { this.forceKill(); this.setState("idle"); });
    this.retryBtn.addEventListener("click", () => { if (this.isExplainMode) this.explainRow.removeClass("cw-hidden"); else this.executeCommand(this.activeCommand); });
    this.accumulateBtn.addEventListener("click", () => this.addSessionEntry());

    // ── Account (collapsible, bottom) ──
    const accountDetails = c.createEl("details", { cls: "cw-account-details" });
    const accountSummary = accountDetails.createEl("summary", { cls: "cw-account-summary" });
    this.accountEmailEl = accountSummary.createEl("span", { text: "확인 중...", cls: "cw-account-email" });
    this.accountPlanEl = accountSummary.createEl("span", { text: "", cls: "cw-account-plan" });

    const accountBody = accountDetails.createDiv("cw-account-body");
    accountBody.createEl("button", { text: "↻ 새로고침", cls: "cw-btn cw-btn-xs" }).addEventListener("click", () => this.refreshAuth());
    accountBody.createEl("button", { text: "로그아웃", cls: "cw-btn cw-btn-xs" }).addEventListener("click", () => this.handleLogout());
    accountBody.createEl("button", { text: "로그인", cls: "cw-btn cw-btn-xs cw-btn-primary" }).addEventListener("click", () => this.handleLogin());
  }

  // ─── Template Detection ──────────────────────────

  private onDocumentChanged(mdView: MarkdownView) {
    const file = mdView.file;
    if (!file || file.path === this.currentDocPath) return;
    this.currentDocPath = file.path;

    // Detect template
    this.currentTemplate = detectTemplate(this.app, file.path);
    if (this.currentTemplate) {
      this.templateBadge.removeClass("cw-hidden");
      this.templateBadge.setText(`📋 ${this.currentTemplate}`);
      // Auto-switch tone if "auto"
      if (this.plugin.settings.tone === "auto") {
        const { TEMPLATE_PROMPTS } = require("./main");
        const tpl = TEMPLATE_PROMPTS[this.currentTemplate];
        if (tpl) {
          this.toneBtns.forEach(b => b.removeClass("cw-tone-active"));
          const autoBtn = this.toneBtns.get(tpl.tone);
          if (autoBtn) autoBtn.addClass("cw-tone-active");
          // Auto model
          this.modelSelect.value = tpl.model;
        }
      }
    } else {
      this.templateBadge.addClass("cw-hidden");
    }

    // Context scan prompt
    if (!this.contextCache.has(file.path)) {
      this.contextBanner.removeClass("cw-hidden");
      const textEl = this.contextBanner.querySelector(".cw-context-banner-text");
      if (textEl) textEl.setText(`📄 "${file.basename}" — 맥락을 파악하시겠습니까?`);
    } else {
      this.contextBanner.addClass("cw-hidden");
      this.showContextInfo(file.path);
    }
  }

  // ─── Context Scan (3-depth) ──────────────────────

  private async scanContext() {
    this.contextBanner.addClass("cw-hidden");
    this.contextInfo.removeClass("cw-hidden");
    this.contextInfo.setText("🔍 맥락 파악 중... 0%");

    const file = this.app.workspace.getActiveFile();
    if (!file) return;
    const targetPath = file.path;
    this.scanAbortPath = targetPath;

    try {
      const content = await this.app.vault.cachedRead(file);
      const useful = extractUsefulContent(content);
      if (this.scanAbortPath !== targetPath) return;
      this.contextInfo.setText("🔍 현재 문서 분석... 10%");

      const links1 = this.extractLinks(content);
      const depth1: { path: string; content: string }[] = [];

      // Depth 1 — parallel
      const depth1Results = await Promise.all(links1.map(async (l) => {
        const f = this.app.metadataCache.getFirstLinkpathDest(l, file.path);
        if (!f) return null;
        const c = await this.app.vault.cachedRead(f);
        return { path: f.path, content: extractUsefulContent(c) };
      }));
      for (const r of depth1Results) { if (r) depth1.push(r); }
      if (this.scanAbortPath !== targetPath) return;
      this.contextInfo.setText(`🔍 1단계 ${depth1.length}개 완료... 40%`);

      // Depth 2
      const seen = new Set<string>([file.basename, ...links1]);
      const depth2Links: string[] = [];
      for (const doc of depth1) {
        for (const l of this.extractLinks(doc.content)) {
          if (!seen.has(l)) { seen.add(l); depth2Links.push(l); }
        }
      }
      const depth2: { path: string; content: string }[] = [];
      const d2Batch = await Promise.all(depth2Links.slice(0, 10).map(async (l) => {
        const f = this.app.metadataCache.getFirstLinkpathDest(l, file.path);
        if (!f) return null;
        const c = await this.app.vault.cachedRead(f);
        return { path: f.path, content: extractUsefulContent(c) };
      }));
      for (const r of d2Batch) { if (r) depth2.push(r); }
      if (this.scanAbortPath !== targetPath) return;
      this.contextInfo.setText(`🔍 2단계 ${depth2.length}개 완료... 65%`);

      // Depth 3
      const depth3Links: string[] = [];
      for (const doc of depth2) {
        for (const l of this.extractLinks(doc.content)) {
          if (!seen.has(l)) { seen.add(l); depth3Links.push(l); }
        }
      }
      const depth3: { path: string; content: string }[] = [];
      const d3Batch = await Promise.all(depth3Links.slice(0, 5).map(async (l) => {
        const f = this.app.metadataCache.getFirstLinkpathDest(l, file.path);
        if (!f) return null;
        const c = await this.app.vault.cachedRead(f);
        return { path: f.path, content: extractUsefulContent(c) };
      }));
      for (const r of d3Batch) { if (r) depth3.push(r); }
      if (this.scanAbortPath !== targetPath) return;

      // Build summary
      const trunc = (s: string, n: number) => s.length > n ? s.slice(0, n) + "..." : s;
      let summary = `[현재: ${file.basename}]\n${trunc(useful, 2000)}\n\n`;
      for (const d of depth1) summary += `[1단계: ${d.path}]\n${trunc(d.content, 500)}\n\n`;
      for (const d of depth2) summary += `[2단계: ${d.path}]\n${trunc(d.content, 300)}\n\n`;
      for (const d of depth3) summary += `[3단계: ${d.path}]\n${trunc(d.content, 200)}\n\n`;

      this.contextCache.set(targetPath, summary);
      const total = 1 + depth1.length + depth2.length + depth3.length;
      this.contextInfo.setText(`✅ 맥락 파악 완료 (100%) — ${depth1.length}(1단계) + ${depth2.length}(2단계) + ${depth3.length}(3단계) = 총 ${total}개`);
    } catch (err: any) {
      this.contextInfo.setText(`❌ 실패: ${err.message}`);
    }
  }

  private showContextInfo(path: string) {
    const cached = this.contextCache.get(path);
    if (cached) {
      this.contextInfo.removeClass("cw-hidden");
      const count = (cached.match(/\[\d단계:/g) || []).length;
      this.contextInfo.setText(`✅ 캐시됨 — 연결 문서 ${count}개`);
    }
  }

  private extractLinks(content: string): string[] {
    const seen = new Set<string>();
    const re = /\[\[([^\]|#]+?)(?:\|[^\]]*?)?\]\]/g;
    let m;
    while ((m = re.exec(content)) !== null) seen.add(m[1].trim());
    return [...seen];
  }

  // ─── Editor ──────────────────────────────────────

  private getEditorSelection(silent = false): string | null {
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active?.editor) {
      const sel = active.editor.getSelection();
      if (sel) { this.lastEditor = { editor: active.editor, leaf: active.leaf }; return sel; }
    }
    if (this.lastEditor) {
      try { const sel = this.lastEditor.editor.getSelection(); if (sel) return sel; } catch {}
    }
    const leaves = this.app.workspace.getLeavesOfType("markdown");
    for (const leaf of leaves) {
      const v = leaf.view as MarkdownView;
      if (!v?.editor) continue;
      try {
        const sel = v.editor.getSelection();
        if (sel) { this.lastEditor = { editor: v.editor, leaf }; return sel; }
      } catch {}
    }
    return null;
  }

  // ─── Surrounding Context ─────────────────────────

  private buildUserPayload(selection: string): string {
    if (!this.lastEditor || !this.savedFrom || !this.savedTo) return selection;
    try {
      const editor = this.lastEditor.editor;
      const doc = editor.getValue();
      // Convert cursor positions to character offsets
      let offsetFrom = 0;
      for (let i = 0; i < this.savedFrom.line; i++) {
        offsetFrom += editor.getLine(i).length + 1; // +1 for newline
      }
      offsetFrom += this.savedFrom.ch;

      let offsetTo = 0;
      for (let i = 0; i < this.savedTo.line; i++) {
        offsetTo += editor.getLine(i).length + 1;
      }
      offsetTo += this.savedTo.ch;

      const WINDOW = 500;
      const before = doc.slice(Math.max(0, offsetFrom - WINDOW), offsetFrom).trim();
      const after = doc.slice(offsetTo, offsetTo + WINDOW).trim();

      if (!before && !after) return selection;
      let payload = "";
      if (before) payload += `[앞 문맥]\n${before}\n\n`;
      payload += `[대체 대상]\n${selection}`;
      if (after) payload += `\n\n[뒤 문맥]\n${after}`;
      return payload;
    } catch {
      return selection;
    }
  }

  // ─── Commands ────────────────────────────────────

  private onCommandClick(cmdId: string) {
    if (this.state === "processing") { new Notice("이미 처리 중입니다"); return; }
    const selection = this.getEditorSelection();
    if (!selection) { new Notice("텍스트를 선택해주세요"); return; }
    this.currentSelection = selection;

    // Save cursor range for accurate apply
    if (this.lastEditor) {
      this.savedFrom = this.lastEditor.editor.getCursor("from");
      this.savedTo = this.lastEditor.editor.getCursor("to");
    }

    if (cmdId === "explain") { this.explainRow.removeClass("cw-hidden"); this.customRow.addClass("cw-hidden"); this.vizRow.addClass("cw-hidden"); return; }
    if (cmdId === "visualize") { this.vizRow.addClass("cw-hidden"); this.explainRow.addClass("cw-hidden"); this.customRow.addClass("cw-hidden"); this.executeVisualizeSuggest(); return; }
    if (cmdId === "custom") { this.showCustomInput(); return; }
    this.isExplainMode = false;
    this.isVizMode = false;
    this.executeCommand(cmdId);
  }

  private showCustomInput() { this.explainRow.addClass("cw-hidden"); this.customRow.removeClass("cw-hidden"); this.customInput.value = ""; this.customInput.focus(); }

  private executeExplain(level: number) {
    this.isExplainMode = true;
    this.activeCommand = "explain";
    this.currentResult = "";

    const lv = EXPLAIN_LEVELS.find(l => l.level === level)!;
    const context = this.contextCache.get(this.currentDocPath);
    const enriched = context ? `${lv.prompt}\n\n[참고 맥락]\n${context}` : lv.prompt;

    this.originalSummary.setText(this.currentSelection.length > 80 ? this.currentSelection.slice(0, 80) + "..." : this.currentSelection);
    this.inputSection.removeClass("cw-hidden");
    this.outputContent.empty();
    this.outputContent.addClass("cw-streaming");
    this.outputSection.removeClass("cw-hidden");
    this.actionBtns.forEach((btn, id) => btn.toggleClass("cw-cmd-active", id === "explain"));
    this.setState("processing");

    const userPayload = this.buildUserPayload(this.currentSelection);

    const handle = callClaude(
      this.plugin.getClaudePath(), this.modelSelect.value, enriched, userPayload,
      this.plugin.settings.maxChars, this.plugin.settings.tone,
      (chunk) => { this.currentResult += chunk; this.outputContent.setText(this.currentResult); this.outputContent.scrollTop = this.outputContent.scrollHeight; },
      () => { this.killProcess = null; this.outputContent.removeClass("cw-streaming"); this.setState("done"); },
      (err) => { this.killProcess = null; this.outputContent.removeClass("cw-streaming"); this.setState("error"); this.outputContent.setText(`오류: ${err}`); },
      false, // replaceMode = false
    );
    this.killProcess = handle.kill;
  }

  // ─── Visualize (2-step) ─────────────────────────

  private executeVisualizeSuggest() {
    this.isVizMode = true;
    this.isExplainMode = false;
    this.activeCommand = "visualize";
    this.currentResult = "";

    this.originalSummary.setText(this.currentSelection.length > 80 ? this.currentSelection.slice(0, 80) + "..." : this.currentSelection);
    this.inputSection.removeClass("cw-hidden");
    this.outputContent.empty();
    this.outputContent.addClass("cw-streaming");
    this.outputContent.setText("시각화 기법 분석 중...");
    this.outputSection.removeClass("cw-hidden");
    this.actionBtns.forEach((btn, id) => btn.toggleClass("cw-cmd-active", id === "visualize"));
    this.setState("processing");

    const userPayload = this.buildUserPayload(this.currentSelection);

    const handle = callClaude(
      this.plugin.getClaudePath(), "haiku", VIZ_SUGGEST_PROMPT, userPayload,
      0, "auto",
      (chunk) => { this.currentResult += chunk; },
      () => {
        this.killProcess = null;
        this.outputContent.removeClass("cw-streaming");
        this.parseVizSuggestions();
      },
      (err) => { this.killProcess = null; this.outputContent.removeClass("cw-streaming"); this.setState("error"); this.outputContent.setText(`분석 실패: ${err}`); },
      false,
    );
    this.killProcess = handle.kill;
  }

  private parseVizSuggestions() {
    try {
      // Extract JSON from response (handle potential markdown wrapping)
      let json = this.currentResult.trim();
      const jsonMatch = json.match(/\[[\s\S]*\]/);
      if (jsonMatch) json = jsonMatch[0];
      const suggestions: { name: string; type: string; desc: string; icon: string }[] = JSON.parse(json);

      if (!Array.isArray(suggestions) || suggestions.length === 0) throw new Error("빈 결과");

      // Show suggestion cards
      this.vizCards.empty();
      for (const s of suggestions.slice(0, 3)) {
        const card = this.vizCards.createDiv("cw-viz-card");
        card.createEl("span", { text: s.icon || "📊", cls: "cw-viz-card-icon" });
        const info = card.createDiv("cw-viz-card-info");
        info.createEl("div", { text: s.name, cls: "cw-viz-card-name" });
        info.createEl("div", { text: s.desc, cls: "cw-viz-card-desc" });
        info.createEl("div", { text: s.type, cls: "cw-viz-card-type" });
        card.addEventListener("click", () => {
          this.vizRow.addClass("cw-hidden");
          this.executeVisualizeGenerate(s.type, s.name);
        });
      }

      this.outputSection.addClass("cw-hidden");
      this.vizRow.removeClass("cw-hidden");
      this.setState("idle");
    } catch (err: any) {
      this.outputContent.setText(`추천 파싱 실패: ${err.message}\n\n원본:\n${this.currentResult}`);
      this.setState("error");
    }
  }

  private executeVisualizeGenerate(vizType: string, vizName: string) {
    this.currentResult = "";
    this.activeCommand = "visualize";

    const prompt = VIZ_GENERATE_PROMPT.replace("{TYPE}", vizType);
    const context = this.contextCache.get(this.currentDocPath);
    const enriched = context ? `${prompt}\n\n[참고 맥락]\n${context}` : prompt;
    const userPayload = this.buildUserPayload(this.currentSelection);

    this.outputContent.empty();
    this.outputContent.addClass("cw-streaming");
    this.outputContent.setText(`${vizName} 생성 중...`);
    this.outputSection.removeClass("cw-hidden");
    this.setState("processing");

    const handle = callClaude(
      this.plugin.getClaudePath(), this.modelSelect.value, enriched, userPayload,
      0, "auto",
      (chunk) => { this.currentResult += chunk; this.outputContent.setText(this.currentResult); this.outputContent.scrollTop = this.outputContent.scrollHeight; },
      () => { this.killProcess = null; this.outputContent.removeClass("cw-streaming"); this.isVizMode = true; this.setState("done"); },
      (err) => { this.killProcess = null; this.outputContent.removeClass("cw-streaming"); this.setState("error"); this.outputContent.setText(`생성 실패: ${err}`); },
      false, // replaceMode = false (not replacing text)
    );
    this.killProcess = handle.kill;
  }

  private onCustomRun() {
    const p = this.customInput.value.trim();
    if (!p) { new Notice("프롬프트를 입력해주세요"); return; }
    this.customRow.addClass("cw-hidden");
    // Store custom prompt temporarily
    this.currentResult = "";
    this.activeCommand = "custom";

    this.originalSummary.setText(this.currentSelection.length > 80 ? this.currentSelection.slice(0, 80) + "..." : this.currentSelection);
    this.inputSection.removeClass("cw-hidden");
    this.outputContent.empty();
    this.outputContent.addClass("cw-streaming");
    this.outputSection.removeClass("cw-hidden");
    this.actionBtns.forEach((btn, id) => btn.toggleClass("cw-cmd-active", id === "custom"));
    this.setState("processing");

    const context = this.contextCache.get(this.currentDocPath);
    const enriched = context ? `${p}\n\n[맥락]\n${context}` : p;

    const userPayload = this.buildUserPayload(this.currentSelection);

    const handle = callClaude(
      this.plugin.getClaudePath(), this.modelSelect.value, enriched, userPayload,
      this.plugin.settings.maxChars, this.plugin.settings.tone,
      (chunk) => { this.currentResult += chunk; this.outputContent.setText(this.currentResult); this.outputContent.scrollTop = this.outputContent.scrollHeight; },
      () => { this.killProcess = null; this.outputContent.removeClass("cw-streaming"); this.setState("done"); },
      (err) => { this.killProcess = null; this.outputContent.removeClass("cw-streaming"); this.setState("error"); this.outputContent.setText(`오류: ${err}`); },
    );
    this.killProcess = handle.kill;
  }

  private executeCommand(cmdId: string) {
    this.activeCommand = cmdId;
    this.currentResult = "";

    // Get effective prompt (template-aware for reconstruct)
    const { prompt, model, tone } = this.plugin.getEffectivePrompt(cmdId, this.currentTemplate);

    // For reconstruct, append section headers from current doc
    let finalPrompt = prompt;
    if (cmdId === "reconstruct" && this.currentDocPath) {
      const file = this.app.workspace.getActiveFile();
      if (file) {
        // We can't await here but cachedRead is sync-ish via cache
        const cached = this.app.metadataCache.getFileCache(file);
        if (cached) {
          const content = (this.app.vault as any).cache?.[file.path] || "";
          // Get section headers from existing content
        }
      }
    }

    // Context injection
    const context = this.contextCache.get(this.currentDocPath);
    const enriched = context ? `${finalPrompt}\n\n[참고 맥락]\n${context}` : finalPrompt;

    // UI
    this.originalSummary.setText(this.currentSelection.length > 80 ? this.currentSelection.slice(0, 80) + "..." : this.currentSelection);
    this.inputSection.removeClass("cw-hidden");
    this.outputContent.empty();
    this.outputContent.addClass("cw-streaming");
    this.outputSection.removeClass("cw-hidden");
    this.actionBtns.forEach((btn, id) => btn.toggleClass("cw-cmd-active", id === cmdId));
    this.setState("processing");

    // Use template model if reconstruct, else sidebar model
    const useModel = cmdId === "reconstruct" && model ? model : this.modelSelect.value;
    const useTone = cmdId === "reconstruct" && tone ? tone : this.plugin.settings.tone;

    const userPayload = this.buildUserPayload(this.currentSelection);

    const handle = callClaude(
      this.plugin.getClaudePath(), useModel, enriched, userPayload,
      this.plugin.settings.maxChars, useTone,
      (chunk) => { this.currentResult += chunk; this.outputContent.setText(this.currentResult); this.outputContent.scrollTop = this.outputContent.scrollHeight; },
      () => { this.killProcess = null; this.outputContent.removeClass("cw-streaming"); this.setState("done"); },
      (err) => { this.killProcess = null; this.outputContent.removeClass("cw-streaming"); this.setState("error"); this.outputContent.setText(`오류: ${err}`); },
    );
    this.killProcess = handle.kill;
  }

  // ─── Apply ───────────────────────────────────────

  private applyResult() {
    if (!this.currentResult || !this.lastEditor) { new Notice("에디터를 찾을 수 없습니다"); return; }
    const editor = this.lastEditor.editor;
    if (this.savedFrom && this.savedTo) {
      // replaceRange is more reliable than setSelection + replaceSelection
      editor.replaceRange(this.currentResult, this.savedFrom, this.savedTo);
    } else {
      editor.replaceSelection(this.currentResult);
    }
    new Notice("적용 완료");
    this.setState("idle");
  }

  private appendResult() {
    if (!this.currentResult || !this.lastEditor) { new Notice("에디터를 찾을 수 없습니다"); return; }
    const editor = this.lastEditor.editor;
    const lastLine = editor.lastLine();
    const lastLineText = editor.getLine(lastLine);
    editor.replaceRange("\n\n" + this.currentResult, { line: lastLine, ch: lastLineText.length });
    new Notice("문서 끝에 추가 완료");
    this.setState("idle");
  }

  private insertBelow() {
    if (!this.currentResult || !this.lastEditor) { new Notice("에디터를 찾을 수 없습니다"); return; }
    const editor = this.lastEditor.editor;
    const insertLine = this.savedTo ? this.savedTo.line : editor.getCursor().line;
    const lineText = editor.getLine(insertLine);
    editor.replaceRange("\n\n" + this.currentResult, { line: insertLine, ch: lineText.length });
    new Notice("선택 영역 아래에 삽입 완료");
    this.setState("idle");
  }

  private insertAsCallout() {
    if (!this.currentResult || !this.lastEditor) { new Notice("에디터를 찾을 수 없습니다"); return; }
    const editor = this.lastEditor.editor;
    // Build foldable callout
    const title = this.currentSelection.length > 30 ? this.currentSelection.slice(0, 30) + "..." : this.currentSelection;
    const calloutLines = this.currentResult.split("\n").map(l => "> " + l).join("\n");
    const callout = `\n\n> [!info]- ${title}\n${calloutLines}\n`;
    const insertLine = this.savedTo ? this.savedTo.line : editor.getCursor().line;
    const lineText = editor.getLine(insertLine);
    editor.replaceRange(callout, { line: insertLine, ch: lineText.length });
    new Notice("콜아웃으로 삽입 완료");
    this.setState("idle");
  }

  private async insertAsLinkedNote() {
    if (!this.currentResult) { new Notice("결과가 없습니다"); return; }
    // Generate note name from selection
    const baseName = this.currentSelection.slice(0, 40).replace(/[\\/:*?"<>|#^[\]]/g, "").trim();
    const noteName = `${baseName} (설명)`;
    const notePath = `3_Resources/${noteName}.md`;

    // Create the note
    const frontmatter = `---\ntags: [설명, 자동생성]\ncreated: ${new Date().toISOString().slice(0, 10)}\nmodified: ${new Date().toISOString().slice(0, 10)}\nstatus: reference\ncategory: resource\ntemplate: 파인만-노트\ndevice: home\n---\n\n`;
    const noteContent = frontmatter + this.currentResult;

    try {
      const existing = this.app.vault.getAbstractFileByPath(notePath);
      if (existing) {
        new Notice(`이미 존재: ${notePath}`);
      } else {
        await this.app.vault.create(notePath, noteContent);
      }
      // Insert wikilink in editor
      if (this.lastEditor) {
        const editor = this.lastEditor.editor;
        const insertLine = this.savedTo ? this.savedTo.line : editor.getCursor().line;
        const lineText = editor.getLine(insertLine);
        editor.replaceRange(` [[${noteName}]]`, { line: insertLine, ch: lineText.length });
      }
      new Notice(`새 노트 생성 + 링크 삽입: ${noteName}`);
    } catch (err: any) {
      new Notice(`실패: ${err.message}`);
    }
    this.setState("idle");
  }

  // ─── Reading Session ─────────────────────────

  private toggleReadingSession() {
    if (this.readingSession?.isActive) {
      const n = this.readingSession.entries.length;
      this.readingSession = null;
      this.sessionToggleBtn.removeClass("cw-session-active");
      this.sessionToggleBtn.setText("📖 읽기 세션");
      this.sessionCounter.addClass("cw-hidden");
      this.sessionGenerateBtn.addClass("cw-hidden");
      if (n > 0) new Notice(`세션 종료 (${n}건 미저장)`);
      else new Notice("읽기 세션 종료");
    } else {
      this.readingSession = {
        sourceFile: this.currentDocPath,
        startedAt: Date.now(),
        entries: [],
        isActive: true,
      };
      this.sessionToggleBtn.addClass("cw-session-active");
      this.sessionToggleBtn.setText("📖 읽기 중");
      this.updateSessionCounter();
      new Notice("읽기 세션 시작 — 텍스트 선택 후 설명을 요청하세요");
    }
  }

  private updateSessionCounter() {
    const n = this.readingSession?.entries.length || 0;
    this.sessionCounter.setText(`${n}건`);
    this.sessionCounter.removeClass("cw-hidden");
    if (n > 0) this.sessionGenerateBtn.removeClass("cw-hidden");
    else this.sessionGenerateBtn.addClass("cw-hidden");
  }

  private addSessionEntry() {
    if (!this.readingSession?.isActive || !this.currentResult) return;
    this.readingSession.entries.push({
      selectedText: this.currentSelection,
      command: this.activeCommand,
      response: this.currentResult,
      timestamp: Date.now(),
    });
    this.updateSessionCounter();
    new Notice(`축적 완료 (${this.readingSession.entries.length}건)`);
    this.setState("idle");
  }

  private generateReadingNote() {
    if (!this.readingSession || this.readingSession.entries.length === 0) {
      new Notice("축적된 항목이 없습니다");
      return;
    }

    const entries = this.readingSession.entries;
    let qaPayload = "";
    for (let i = 0; i < entries.length; i++) {
      const selPreview = entries[i].selectedText.length > 100
        ? entries[i].selectedText.slice(0, 100) + "..."
        : entries[i].selectedText;
      qaPayload += `### Q${i + 1}: ${selPreview}\n${entries[i].response}\n\n`;
    }

    const sourceFile = this.readingSession.sourceFile;
    const sourceBasename = sourceFile.replace(/\.md$/, "").split("/").pop() || "읽기노트";

    this.currentResult = "";
    this.outputContent.empty();
    this.outputContent.addClass("cw-streaming");
    this.outputContent.setText("읽기 노트 구조화 중...");
    this.outputSection.removeClass("cw-hidden");
    this.inputSection.addClass("cw-hidden");
    this.setState("processing");

    const prompt = READING_NOTE_PROMPT + `\n\n원본 문서: ${sourceBasename}\n총 ${entries.length}건의 Q&A`;
    const model = entries.length >= 5 ? "sonnet" : "haiku";

    const handle = callClaude(
      this.plugin.getClaudePath(), model, prompt, qaPayload,
      0, "auto",
      (chunk) => { this.currentResult += chunk; this.outputContent.setText(this.currentResult); this.outputContent.scrollTop = this.outputContent.scrollHeight; },
      async () => {
        this.killProcess = null;
        this.outputContent.removeClass("cw-streaming");

        const date = new Date().toISOString().slice(0, 10);
        const noteName = `${sourceBasename}_읽기노트`;
        const notePath = `3_Resources/${noteName}.md`;
        const frontmatter = `---\ntags: [읽기노트, 자동생성]\ncreated: ${date}\nmodified: ${date}\nstatus: reference\ncategory: resource\ntemplate: 파인만-노트\ndevice: home\nsource: "[[${sourceBasename}]]"\n---\n\n`;

        try {
          const existing = this.app.vault.getAbstractFileByPath(notePath);
          if (existing) {
            const existingContent = await this.app.vault.read(existing as any);
            await this.app.vault.modify(existing as any, existingContent + "\n\n---\n\n" + this.currentResult);
          } else {
            await this.app.vault.create(notePath, frontmatter + this.currentResult);
          }

          if (this.lastEditor) {
            const editor = this.lastEditor.editor;
            const lastLine = editor.lastLine();
            const lastLineText = editor.getLine(lastLine);
            editor.replaceRange(`\n\n> 📖 [[${noteName}]]`, { line: lastLine, ch: lastLineText.length });
          }

          new Notice(`읽기 노트 생성 완료: ${noteName}`);
        } catch (err: any) {
          new Notice(`노트 생성 실패: ${err.message}`);
        }

        // Clear session
        this.readingSession = null;
        this.sessionToggleBtn.removeClass("cw-session-active");
        this.sessionToggleBtn.setText("📖 읽기 세션");
        this.sessionCounter.addClass("cw-hidden");
        this.sessionGenerateBtn.addClass("cw-hidden");
        this.setState("done");
      },
      (err) => { this.killProcess = null; this.outputContent.removeClass("cw-streaming"); this.setState("error"); this.outputContent.setText(`구조화 실패: ${err}`); },
      false,
    );
    this.killProcess = handle.kill;
  }

  // ─── Auth ────────────────────────────────────────

  private async refreshAuth() {
    this.accountEmailEl.setText("확인 중...");
    this.accountPlanEl.setText("");
    try {
      const info = await getAuthStatus(this.plugin.getClaudePath());
      if (info.loggedIn) {
        this.accountEmailEl.setText(info.email);
        this.accountPlanEl.setText(info.subscriptionType.toUpperCase());
        this.accountPlanEl.className = "cw-account-plan cw-plan-active";
      } else {
        this.accountEmailEl.setText("로그인 필요");
        this.accountPlanEl.className = "cw-account-plan";
      }
    } catch {
      this.accountEmailEl.setText("확인 실패");
    }
  }

  private async handleLogout() {
    try {
      await claudeAuthLogout(this.plugin.getClaudePath());
      new Notice("로그아웃 완료");
      this.refreshAuth();
    } catch (err: any) { new Notice(`실패: ${err.message}`); }
  }

  private async handleLogin() {
    new Notice("브라우저에서 로그인 페이지가 열립니다...");
    try {
      await claudeAuthLogin(this.plugin.getClaudePath());
      new Notice("로그인 성공!");
      this.refreshAuth();
    } catch (err: any) { new Notice(`실패: ${err.message}`); }
  }

  // ─── State ───────────────────────────────────────

  private setState(s: ViewState) {
    this.state = s;
    const b = this.headerStatusEl;
    b.empty(); b.className = "cw-status-badge";
    const ar = this.outputSection.querySelector(".cw-action-row") as HTMLElement;

    const hide = (el: HTMLElement) => el.style.display = "none";
    const show = (el: HTMLElement) => el.style.display = "";

    switch (s) {
      case "idle":
        b.setText("대기"); b.addClass("cw-badge-idle");
        this.inputSection.addClass("cw-hidden");
        this.outputSection.addClass("cw-hidden");
        this.actionBtns.forEach(btn => btn.removeClass("cw-cmd-active"));
        break;
      case "processing":
        b.setText("⏳ 처리 중..."); b.addClass("cw-badge-processing");
        if (ar) {
          ar.removeClass("cw-hidden");
          hide(this.applyBtn); hide(this.insertBelowBtn); hide(this.insertCalloutBtn); hide(this.insertLinkBtn);
          hide(this.appendBtn); hide(this.copyBtn); hide(this.dismissBtn); hide(this.retryBtn);
          hide(this.accumulateBtn);
          show(this.cancelBtn);
        }
        break;
      case "done":
        b.setText("완료"); b.addClass("cw-badge-done");
        if (ar) {
          ar.removeClass("cw-hidden"); hide(this.cancelBtn); hide(this.retryBtn);
          show(this.applyBtn); show(this.insertBelowBtn); show(this.insertCalloutBtn); show(this.insertLinkBtn);
          show(this.appendBtn); show(this.copyBtn); show(this.dismissBtn);
          if (this.readingSession?.isActive) show(this.accumulateBtn); else hide(this.accumulateBtn);
        }
        break;
      case "error":
        b.setText("오류"); b.addClass("cw-badge-error");
        if (ar) {
          ar.removeClass("cw-hidden");
          hide(this.applyBtn); hide(this.insertBelowBtn); hide(this.insertCalloutBtn); hide(this.insertLinkBtn);
          hide(this.appendBtn); hide(this.copyBtn); hide(this.cancelBtn);
          hide(this.accumulateBtn);
          show(this.dismissBtn); show(this.retryBtn);
        }
        break;
    }
  }
}
