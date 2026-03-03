import { ItemView, WorkspaceLeaf, MarkdownView, Notice } from "obsidian";
import type ClaudeWriterPlugin from "./main";
import { callClaude, callClaudeMobile, isMobile, getAuthStatus, claudeAuthLogout, claudeAuthLogin, detectTemplate, extractSectionHeaders, extractUsefulContent, COMMANDS, TONES, EXPLAIN_LEVELS, VIZ_SUGGEST_PROMPT, VIZ_GENERATE_PROMPT, ANSWER_QUESTION_PROMPT, parseQuestions, type SavedCommand } from "./main";
import type { CmdDef } from "./main";
import { scanVaultStructure, simulateMigration, runFullMigration, type MigrationPhase } from "./vault-ops";

export const VIEW_TYPE = "claude-writer-view";
type ViewState = "idle" | "processing" | "done" | "error";

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

  // Console DOM
  private consoleSection: HTMLElement;
  private consoleInput: HTMLTextAreaElement;
  private consoleSavedList: HTMLElement;
  private consoleSaveNameInput: HTMLInputElement;

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

    // vault-ops, console, answer-questions handled separately
    if (cmdId === "vault-ops") { this.triggerVaultOps(); return; }
    if (cmdId === "console") { this.triggerConsole(); return; }
    if (cmdId === "answer-questions") {
      const editor = this.findMarkdownEditor();
      if (editor) this.triggerAnswerQuestions(editor);
      return;
    }

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

  /** Route to desktop CLI or mobile bridge */
  private callClaudeAuto(
    model: string, systemPrompt: string, userText: string, maxChars: number, tone: string,
    onChunk: (chunk: string) => void, onDone: () => void, onError: (err: string) => void,
    replaceMode = true,
  ): { kill: () => void } {
    if (isMobile()) {
      return callClaudeMobile(
        this.plugin.settings.bridgeUrl, model, systemPrompt, userText, maxChars, tone,
        onChunk, onDone, onError, replaceMode,
      );
    }
    return callClaude(
      this.plugin.getClaudePath(), model, systemPrompt, userText, maxChars, tone,
      onChunk, onDone, onError, replaceMode,
    );
  }

  /** Find a markdown editor — prefer lastEditor, fallback to workspace scan */
  private findMarkdownEditor(): any | null {
    // 1. Use tracked lastEditor (set by active-leaf-change)
    if (this.lastEditor) {
      try {
        const ed = this.lastEditor.editor;
        if (ed && typeof ed.getValue === "function") return ed;
      } catch {}
    }
    // 2. Fallback: find any open MarkdownView
    const active = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (active) {
      this.lastEditor = { editor: active.editor, leaf: active.leaf };
      return active.editor;
    }
    // 3. Scan all leaves
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view as any;
      if (view?.editor) {
        this.lastEditor = { editor: view.editor, leaf };
        return view.editor;
      }
    }
    return null;
  }

  // ─── Vault Ops (PARA → GTD+PARA Migration) ─────

  triggerVaultOps() {
    if (this.state === "processing") { new Notice("이미 처리 중입니다"); return; }

    this.activeCommand = "vault-ops";
    this.outputContent.empty();
    this.inputSection.addClass("cw-hidden");
    this.explainRow.addClass("cw-hidden");
    this.vizRow.addClass("cw-hidden");
    this.customRow.addClass("cw-hidden");
    this.consoleSection.addClass("cw-hidden");
    this.outputSection.removeClass("cw-hidden");

    // Scan current state
    const scan = scanVaultStructure(this.app);

    const container = this.outputContent;
    container.createEl("h4", { text: "🏗️ Vault Ops — PARA → GTD+PARA" });

    // Status summary
    const statusDiv = container.createDiv({ cls: "cw-vault-status" });
    statusDiv.createEl("p", { text: `총 파일: ${scan.totalFiles}개` });
    statusDiv.createEl("p", { text: `PARA 폴더: ${scan.paraFolders.join(", ") || "없음"}` });
    statusDiv.createEl("p", { text: `GTD 폴더: ${scan.gtdFolders.join(", ") || "없음"}` });
    statusDiv.createEl("p", { text: `이동 대상: ${scan.filesToMigrate}개` });

    if (scan.hasGtd && !scan.hasPara) {
      statusDiv.createEl("p", { text: "✅ 이미 GTD+PARA 구조입니다!", cls: "cw-vault-done" });
      return;
    }

    // Simulate button
    const btnRow = container.createDiv({ cls: "cw-vault-btns" });

    const simBtn = btnRow.createEl("button", { text: "📋 시뮬레이션", cls: "cw-btn" });
    simBtn.addEventListener("click", () => {
      const sim = simulateMigration(this.app);
      const simDiv = container.createDiv({ cls: "cw-vault-sim" });
      simDiv.createEl("pre", { text: sim.summary });

      // Show file move preview (first 20)
      if (sim.filesToMove.length > 0) {
        const previewDiv = simDiv.createDiv();
        previewDiv.createEl("h5", { text: `파일 이동 미리보기 (${Math.min(20, sim.filesToMove.length)}/${sim.filesToMove.length})` });
        const list = previewDiv.createEl("ul");
        for (const move of sim.filesToMove.slice(0, 20)) {
          list.createEl("li", { text: `${move.from} → ${move.to}` });
        }
        if (sim.filesToMove.length > 20) {
          previewDiv.createEl("p", { text: `... 외 ${sim.filesToMove.length - 20}개`, cls: "cw-vault-more" });
        }
      }
    });

    // Execute button
    const execBtn = btnRow.createEl("button", { text: "🚀 대수술 실행", cls: "cw-btn cw-btn-primary" });
    execBtn.addEventListener("click", async () => {
      execBtn.disabled = true;
      simBtn.disabled = true;

      const progressDiv = container.createDiv({ cls: "cw-vault-progress" });
      const phaseEl = progressDiv.createEl("p", { text: "시작...", cls: "cw-vault-phase" });
      const barContainer = progressDiv.createDiv({ cls: "cw-vault-bar-container" });
      const bar = barContainer.createDiv({ cls: "cw-vault-bar" });
      const fileEl = progressDiv.createEl("p", { text: "", cls: "cw-vault-file" });
      const logEl = progressDiv.createEl("div", { cls: "cw-vault-log" });

      this.setState("processing");

      const result = await runFullMigration(
        this.app,
        (phase: MigrationPhase, msg: string) => {
          phaseEl.setText(`[${phase}] ${msg}`);
          logEl.createEl("p", { text: msg });
          // Auto-scroll
          logEl.scrollTop = logEl.scrollHeight;
        },
        (current: number, total: number, file: string) => {
          const pct = total > 0 ? Math.round((current / total) * 100) : 0;
          bar.style.width = `${pct}%`;
          fileEl.setText(`${current}/${total}: ${file.split("/").pop()}`);
        },
        (errMsg: string) => {
          logEl.createEl("p", { text: `❌ ${errMsg}`, cls: "cw-vault-error" });
        },
      );

      bar.style.width = "100%";
      this.setState("done");

      // Summary
      const summaryDiv = container.createDiv({ cls: "cw-vault-summary" });
      summaryDiv.createEl("h4", { text: "✅ 마이그레이션 완료" });
      summaryDiv.createEl("p", { text: `폴더 생성: ${result.foldersCreated}개` });
      summaryDiv.createEl("p", { text: `파일 이동: ${result.filesMoved}개` });
      summaryDiv.createEl("p", { text: `링크 수정: ${result.linksUpdated}개` });
      if (result.errors.length > 0) {
        summaryDiv.createEl("p", { text: `오류: ${result.errors.length}건`, cls: "cw-vault-error" });
      }

      new Notice(`Vault Ops 완료! ${result.filesMoved}개 파일 이동, ${result.linksUpdated}개 링크 수정`);
    });
  }

  // ─── Command Console ─────────────────────────────

  triggerConsole() {
    if (this.state === "processing") { new Notice("이미 처리 중입니다"); return; }

    this.activeCommand = "console";
    this.inputSection.addClass("cw-hidden");
    this.explainRow.addClass("cw-hidden");
    this.vizRow.addClass("cw-hidden");
    this.customRow.addClass("cw-hidden");
    this.outputSection.addClass("cw-hidden");
    this.consoleSection.removeClass("cw-hidden");
    this.consoleInput.focus();
    this.refreshSavedCommands();
  }

  private executeConsoleCommand(command: string) {
    if (!command.trim()) { new Notice("명령을 입력해주세요"); return; }

    this.consoleSection.addClass("cw-hidden");
    this.outputContent.empty();
    this.outputContent.addClass("cw-streaming");
    this.outputSection.removeClass("cw-hidden");
    this.setState("processing");

    this.currentResult = "";
    this.activeCommand = "console";

    // Build vault-aware system prompt
    const vaultRoot = (this.app.vault as any).adapter?.basePath || "";
    const activeFile = this.app.workspace.getActiveFile();
    const activeFilePath = activeFile ? activeFile.path : "(없음)";
    const context = this.contextCache.get(this.currentDocPath) || "";

    const systemPrompt = `당신은 Obsidian 볼트 작업 전문가입니다. 사용자의 명령을 수행하세요.

현재 볼트 정보:
- 볼트 경로: ${vaultRoot}
- 열린 파일: ${activeFilePath}
- 구조: GTD+PARA (00_Dashboard ~ 07_Resources)

규칙:
1. 문서 생성 요청 시: 완성된 마크다운 문서를 출력하세요. frontmatter 포함.
2. 분석/검색 요청 시: 결과를 구조화된 마크다운으로 출력하세요.
3. 수정 요청 시: 수정된 전체 내용을 출력하세요.
4. 항상 한국어. 설명 없이 결과만.
${context ? `\n[참고 맥락]\n${context}` : ""}`;

    // If there's a selection, include it
    const selection = this.getEditorSelection(true);
    let userText = command;
    if (selection) {
      userText = `[명령]\n${command}\n\n[선택된 텍스트]\n${selection}`;
    }

    const handle = this.callClaudeAuto(
      this.modelSelect.value, systemPrompt, userText,
      0, this.plugin.settings.tone,
      (chunk) => { this.currentResult += chunk; this.outputContent.setText(this.currentResult); this.outputContent.scrollTop = this.outputContent.scrollHeight; },
      () => {
        this.killProcess = null;
        this.outputContent.removeClass("cw-streaming");
        this.setState("done");
      },
      (err) => { this.killProcess = null; this.outputContent.removeClass("cw-streaming"); this.setState("error"); this.outputContent.setText(`오류: ${err}`); },
      false,
    );
    this.killProcess = handle.kill;
  }

  private async saveConsoleCommand(name: string, command: string) {
    if (!name.trim() || !command.trim()) { new Notice("이름과 명령을 모두 입력해주세요"); return; }
    const saved = this.plugin.settings.savedCommands;
    const existing = saved.findIndex(s => s.name === name);
    if (existing >= 0) {
      saved[existing].command = command;
    } else {
      saved.push({ name, command });
    }
    await this.plugin.saveSettings();
    new Notice(`커맨드 저장: ${name}`);
    this.refreshSavedCommands();
  }

  private async deleteConsoleCommand(name: string) {
    this.plugin.settings.savedCommands = this.plugin.settings.savedCommands.filter(s => s.name !== name);
    await this.plugin.saveSettings();
    this.refreshSavedCommands();
  }

  private refreshSavedCommands() {
    this.consoleSavedList.empty();
    const saved = this.plugin.settings.savedCommands;
    if (saved.length === 0) {
      this.consoleSavedList.createEl("p", { text: "저장된 커맨드 없음", cls: "cw-console-empty" });
      return;
    }
    for (const cmd of saved) {
      const item = this.consoleSavedList.createDiv({ cls: "cw-console-saved-item" });
      const nameBtn = item.createEl("button", { text: cmd.name, cls: "cw-console-saved-name" });
      nameBtn.title = cmd.command;
      nameBtn.addEventListener("click", () => {
        this.consoleInput.value = cmd.command;
        this.consoleInput.focus();
      });
      const delBtn = item.createEl("button", { text: "×", cls: "cw-console-saved-del" });
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.deleteConsoleCommand(cmd.name);
      });
    }
  }

  // ─── Answer Questions (EPUB++ integration) ──────

  triggerAnswerQuestions(editor: any) {
    if (this.state === "processing") { new Notice("이미 처리 중입니다"); return; }

    const content = editor.getValue();
    const { questions, title, author } = parseQuestions(content);
    const unanswered = questions.filter(q => !q.answered);

    if (questions.length === 0) {
      new Notice("❓ 질문이 없습니다. EPUB++ 독서노트에서 사용하세요.");
      return;
    }

    if (unanswered.length === 0) {
      new Notice(`✅ 모든 질문에 답변 완료 (${questions.length}건)`);
      return;
    }

    new Notice(`❓ ${unanswered.length}건 미답변 발견 (전체 ${questions.length}건). AI 답변 시작...`);

    // Show progress in sidebar
    this.activeCommand = "answer-questions";
    this.outputContent.empty();
    this.outputContent.addClass("cw-streaming");
    this.outputSection.removeClass("cw-hidden");
    this.inputSection.addClass("cw-hidden");
    this.setState("processing");

    this.executeAnswerQuestions(editor, unanswered, title, author);
  }

  private async executeAnswerQuestions(
    editor: any,
    unanswered: { lineIndex: number; question: string; passage: string }[],
    title: string,
    author: string,
  ) {
    const model = this.plugin.settings.model;
    let completed = 0;
    let failed = 0;

    // Process bottom-to-top so line insertions don't shift earlier positions
    const sorted = [...unanswered].sort((a, b) => b.lineIndex - a.lineIndex);

    for (const q of sorted) {
      completed++;
      this.outputContent.setText(`🤖 AI 답변 생성 중... ${completed}/${unanswered.length}\n\n❓ ${q.question}`);

      try {
        const answer = await this.callClaudeSync(
          model, title, author, q.passage, q.question,
        );

        // Build the answer block: > [!tip]- 🤖 AI 답변\n> answer lines
        const answerLines = answer.split("\n").map((l: string) => `> ${l}`).join("\n");
        const block = `\n> [!tip]- 🤖 AI 답변\n${answerLines}`;

        // Insert after the ❓ line
        const lineText = editor.getLine(q.lineIndex);
        editor.replaceRange(block, { line: q.lineIndex, ch: lineText.length });
      } catch (err: any) {
        failed++;
        const errorBlock = `\n> [!warning]- ⚠️ AI 응답 실패\n> ${err.message || err}`;
        const lineText = editor.getLine(q.lineIndex);
        editor.replaceRange(errorBlock, { line: q.lineIndex, ch: lineText.length });
      }
    }

    this.outputContent.removeClass("cw-streaming");
    const msg = `✅ AI 답변 완료: ${unanswered.length - failed}건 성공` + (failed > 0 ? ` / ${failed}건 실패` : "");
    this.outputContent.setText(msg);
    new Notice(msg);
    this.setState("done");
  }

  /** Synchronous (Promise-based) wrapper for sequential processing */
  private callClaudeSync(
    model: string,
    bookTitle: string, bookAuthor: string,
    passage: string, question: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const systemPrompt = ANSWER_QUESTION_PROMPT
        .replace("{TITLE}", bookTitle)
        .replace("{AUTHOR}", bookAuthor);

      const userText = `📖 원문:\n${passage}\n\n❓ 질문:\n${question}`;
      let result = "";

      const handle = this.callClaudeAuto(
        model, systemPrompt, userText,
        0, "auto",
        (chunk) => { result += chunk; },
        () => { resolve(result.trim()); },
        (err) => { reject(new Error(err)); },
        false,
      );

      this.killProcess = handle.kill;
    });
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

    // ── Command grid (PRIMARY) ──
    this.cmdGrid = c.createDiv("cw-cmd-grid");
    const SPECIAL_IDS = new Set(["custom", "explain", "visualize", "answer-questions", "console"]);
    const topCmds = COMMANDS.filter(cmd => !SPECIAL_IDS.has(cmd.id));
    for (const cmd of topCmds) {
      const btn = this.cmdGrid.createDiv({ cls: "cw-cmd-btn", attr: { role: "button", tabindex: "0", title: cmd.desc } });
      btn.createEl("span", { text: cmd.icon, cls: "cw-cmd-icon" });
      btn.createEl("span", { text: cmd.label, cls: "cw-cmd-label" });
      btn.addEventListener("click", () => this.onCommandClick(cmd.id));
      btn.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); this.onCommandClick(cmd.id); } });
      this.actionBtns.set(cmd.id, btn);
    }
    // Explain + Visualize + Custom (full width, need selection)
    for (const id of ["explain", "visualize", "custom"]) {
      const cmd = COMMANDS.find(c => c.id === id)!;
      const btn = this.cmdGrid.createDiv({ cls: "cw-cmd-btn cw-cmd-full", attr: { role: "button", tabindex: "0", title: cmd.desc } });
      btn.createEl("span", { text: cmd.icon, cls: "cw-cmd-icon" });
      btn.createEl("span", { text: cmd.label, cls: "cw-cmd-label" });
      btn.addEventListener("click", () => this.onCommandClick(id));
      this.actionBtns.set(id, btn);
    }
    // Answer Questions (full width, always active — no selection needed)
    {
      const cmd = COMMANDS.find(c => c.id === "answer-questions")!;
      const btn = this.cmdGrid.createDiv({ cls: "cw-cmd-btn cw-cmd-full cw-cmd-no-sel", attr: { role: "button", tabindex: "0", title: cmd.desc } });
      btn.createEl("span", { text: cmd.icon, cls: "cw-cmd-icon" });
      btn.createEl("span", { text: cmd.label, cls: "cw-cmd-label" });
      btn.addEventListener("click", () => this.onCommandClick("answer-questions"));
      this.actionBtns.set("answer-questions", btn);
    }
    // Console (full width, always active — no selection needed)
    {
      const cmd = COMMANDS.find(c => c.id === "console")!;
      const btn = this.cmdGrid.createDiv({ cls: "cw-cmd-btn cw-cmd-full cw-cmd-no-sel cw-cmd-console", attr: { role: "button", tabindex: "0", title: cmd.desc } });
      btn.createEl("span", { text: cmd.icon, cls: "cw-cmd-icon" });
      btn.createEl("span", { text: cmd.label, cls: "cw-cmd-label" });
      btn.addEventListener("click", () => this.onCommandClick("console"));
      this.actionBtns.set("console", btn);
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

    // ── Command Console ──
    this.consoleSection = c.createDiv("cw-console-section cw-hidden");
    this.consoleSection.createEl("div", { text: "⌨️ 커맨드 콘솔", cls: "cw-section-label" });
    this.consoleInput = this.consoleSection.createEl("textarea", { cls: "cw-console-input", attr: { placeholder: "명령을 입력하세요...\n예: '회의록 새로 만들어줘' / '이 문서 요약해서 새 노트로' / '프로젝트 현황 정리'\nCtrl+Enter로 실행", rows: "4" } });
    const consoleActions = this.consoleSection.createDiv("cw-console-actions");
    consoleActions.createEl("button", { text: "▶ 실행", cls: "cw-btn cw-btn-primary" }).addEventListener("click", () => this.executeConsoleCommand(this.consoleInput.value));
    // Save row
    const saveRow = consoleActions.createDiv("cw-console-save-row");
    this.consoleSaveNameInput = saveRow.createEl("input", { cls: "cw-console-save-name", attr: { placeholder: "커맨드 이름", type: "text" } });
    saveRow.createEl("button", { text: "💾 저장", cls: "cw-btn cw-btn-xs" }).addEventListener("click", () => {
      this.saveConsoleCommand(this.consoleSaveNameInput.value, this.consoleInput.value);
      this.consoleSaveNameInput.value = "";
    });
    consoleActions.createEl("button", { text: "닫기", cls: "cw-btn" }).addEventListener("click", () => { this.consoleSection.addClass("cw-hidden"); this.setState("idle"); });
    this.consoleInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.executeConsoleCommand(this.consoleInput.value); } });
    // Saved commands list
    this.consoleSection.createEl("div", { text: "저장된 커맨드", cls: "cw-section-label cw-console-saved-label" });
    this.consoleSavedList = this.consoleSection.createDiv("cw-console-saved-list");

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
    this.applyBtn.addEventListener("click", () => this.applyResult());
    this.insertBelowBtn.addEventListener("click", () => this.insertBelow());
    this.insertCalloutBtn.addEventListener("click", () => this.insertAsCallout());
    this.insertLinkBtn.addEventListener("click", () => this.insertAsLinkedNote());
    this.appendBtn.addEventListener("click", () => this.appendResult());
    this.copyBtn.addEventListener("click", () => { navigator.clipboard.writeText(this.currentResult); new Notice("클립보드에 복사됨"); });
    this.dismissBtn.addEventListener("click", () => { this.setState("idle"); new Notice("결과 닫힘 — 원문 유지"); });
    this.cancelBtn.addEventListener("click", () => { this.forceKill(); this.setState("idle"); });
    this.retryBtn.addEventListener("click", () => { if (this.isExplainMode) this.explainRow.removeClass("cw-hidden"); else this.executeCommand(this.activeCommand); });
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

    // console doesn't need a selection
    if (cmdId === "console") { this.triggerConsole(); return; }

    // answer-questions doesn't need a selection — uses full document
    if (cmdId === "answer-questions") {
      const editor = this.findMarkdownEditor();
      if (!editor) { new Notice("마크다운 파일을 열어주세요"); return; }
      this.triggerAnswerQuestions(editor);
      return;
    }

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

    const handle = this.callClaudeAuto(
      this.modelSelect.value, enriched, userPayload,
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

    const handle = this.callClaudeAuto(
      "haiku", VIZ_SUGGEST_PROMPT, userPayload,
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

    const handle = this.callClaudeAuto(
      this.modelSelect.value, enriched, userPayload,
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

    const handle = this.callClaudeAuto(
      this.modelSelect.value, enriched, userPayload,
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

    const handle = this.callClaudeAuto(
      useModel, enriched, userPayload,
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
        this.consoleSection.addClass("cw-hidden");
        this.actionBtns.forEach(btn => btn.removeClass("cw-cmd-active"));
        break;
      case "processing":
        b.setText("⏳ 처리 중..."); b.addClass("cw-badge-processing");
        if (ar) {
          ar.removeClass("cw-hidden");
          hide(this.applyBtn); hide(this.insertBelowBtn); hide(this.insertCalloutBtn); hide(this.insertLinkBtn);
          hide(this.appendBtn); hide(this.copyBtn); hide(this.dismissBtn); hide(this.retryBtn);
          show(this.cancelBtn);
        }
        break;
      case "done":
        b.setText("완료"); b.addClass("cw-badge-done");
        if (ar) {
          ar.removeClass("cw-hidden"); hide(this.cancelBtn); hide(this.retryBtn);
          show(this.applyBtn); show(this.insertBelowBtn); show(this.insertCalloutBtn); show(this.insertLinkBtn);
          show(this.appendBtn); show(this.copyBtn); show(this.dismissBtn);
        }
        break;
      case "error":
        b.setText("오류"); b.addClass("cw-badge-error");
        if (ar) {
          ar.removeClass("cw-hidden");
          hide(this.applyBtn); hide(this.insertBelowBtn); hide(this.insertCalloutBtn); hide(this.insertLinkBtn);
          hide(this.appendBtn); hide(this.copyBtn); hide(this.cancelBtn);
          show(this.dismissBtn); show(this.retryBtn);
        }
        break;
    }
  }
}
