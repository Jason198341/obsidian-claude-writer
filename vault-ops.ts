import { App, TFile, TFolder, Notice, Vault } from "obsidian";

// ─── Folder Structure Definitions ────────────────────

export interface FolderDef {
  path: string;
  desc: string;
  subfolders?: string[];
}

export const GTD_FOLDERS: FolderDef[] = [
  { path: "00_Dashboard", desc: "현황판", subfolders: [] },
  { path: "01_Intake", desc: "업무 수집", subfolders: ["Mail", "Official", "Quick"] },
  { path: "02_Tasks", desc: "태스크 관리", subfolders: ["Active", "Waiting", "Someday"] },
  { path: "04_Output", desc: "아웃풋", subfolders: ["Drafts", "Sent", "assets"] },
];

export const PARA_REMAP: Record<string, string> = {
  "1_Projects": "03_Projects",
  "2_Areas": "06_Areas",
  "3_Resources": "07_Resources",
  "4_Archive": "05_Archive",
};

export const LINK_REMAP: Record<string, string> = {
  "1_Projects": "03_Projects",
  "2_Areas": "06_Areas",
  "3_Resources": "07_Resources",
  "4_Archive": "05_Archive",
  "0_Inbox": "01_Intake/_unsorted",
};

// ─── Migration State ─────────────────────────────────

export type MigrationPhase =
  | "idle"
  | "scanning"
  | "creating-folders"
  | "migrating-files"
  | "updating-links"
  | "generating-dashboard"
  | "generating-templates"
  | "verifying"
  | "done"
  | "error";

export interface MigrationProgress {
  phase: MigrationPhase;
  total: number;
  current: number;
  currentFile: string;
  errors: string[];
  log: string[];
}

// ─── Vault Scanner ───────────────────────────────────

export function scanVaultStructure(app: App): {
  hasPara: boolean;
  hasGtd: boolean;
  paraFolders: string[];
  gtdFolders: string[];
  totalFiles: number;
  filesToMigrate: number;
} {
  const vault = app.vault;
  const allFiles = vault.getFiles();
  const allFolders = vault.getAllLoadedFiles()
    .filter((f): f is TFolder => f instanceof TFolder)
    .map(f => f.path);

  const paraFolders = Object.keys(PARA_REMAP).filter(p => allFolders.includes(p));
  const gtdFolders = [...GTD_FOLDERS.map(f => f.path), ...Object.values(PARA_REMAP)]
    .filter(p => allFolders.includes(p));

  let filesToMigrate = 0;
  for (const pf of paraFolders) {
    filesToMigrate += allFiles.filter(f => f.path.startsWith(pf + "/")).length;
  }
  // Also count 0_Inbox
  if (allFolders.includes("0_Inbox")) {
    filesToMigrate += allFiles.filter(f => f.path.startsWith("0_Inbox/")).length;
  }

  return {
    hasPara: paraFolders.length > 0,
    hasGtd: gtdFolders.length >= 4,
    paraFolders,
    gtdFolders,
    totalFiles: allFiles.length,
    filesToMigrate,
  };
}

// ─── Folder Creator ──────────────────────────────────

export async function createGtdFolders(
  app: App,
  onProgress: (msg: string) => void,
): Promise<string[]> {
  const vault = app.vault;
  const created: string[] = [];

  for (const def of GTD_FOLDERS) {
    if (!vault.getAbstractFileByPath(def.path)) {
      await vault.createFolder(def.path);
      created.push(def.path);
      onProgress(`폴더 생성: ${def.path}`);
    }
    for (const sub of def.subfolders || []) {
      const subPath = `${def.path}/${sub}`;
      if (!vault.getAbstractFileByPath(subPath)) {
        await vault.createFolder(subPath);
        created.push(subPath);
      }
    }
  }

  // Create target PARA-remap folders
  for (const target of Object.values(PARA_REMAP)) {
    if (!vault.getAbstractFileByPath(target)) {
      await vault.createFolder(target);
      created.push(target);
      onProgress(`폴더 생성: ${target}`);
    }
  }

  // Unsorted inbox
  const unsorted = "01_Intake/_unsorted";
  if (!vault.getAbstractFileByPath(unsorted)) {
    await vault.createFolder(unsorted);
    created.push(unsorted);
  }

  // Monthly archive
  const now = new Date();
  const month = `05_Archive/${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (!vault.getAbstractFileByPath(month)) {
    await vault.createFolder(month);
    created.push(month);
  }

  return created;
}

// ─── File Migrator ───────────────────────────────────

export async function migrateFiles(
  app: App,
  onProgress: (current: number, total: number, file: string) => void,
  onError: (msg: string) => void,
): Promise<{ moved: number; errors: number }> {
  const vault = app.vault;
  let moved = 0;
  let errors = 0;

  // Migrate PARA folders
  for (const [source, target] of Object.entries(PARA_REMAP)) {
    const sourceFolder = vault.getAbstractFileByPath(source);
    if (!sourceFolder || !(sourceFolder instanceof TFolder)) continue;

    const files = vault.getFiles().filter(f => f.path.startsWith(source + "/"));
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const newPath = file.path.replace(source, target);
      onProgress(moved + i + 1, total, file.path);

      try {
        // Ensure parent folder exists
        const parentPath = newPath.substring(0, newPath.lastIndexOf("/"));
        if (parentPath && !vault.getAbstractFileByPath(parentPath)) {
          await vault.createFolder(parentPath);
        }

        // Check if target already exists
        if (vault.getAbstractFileByPath(newPath)) {
          continue; // Skip duplicates
        }

        await vault.rename(file, newPath);
        moved++;
      } catch (e: any) {
        errors++;
        onError(`이동 실패: ${file.path} → ${newPath}: ${e.message}`);
      }
    }
  }

  // Migrate 0_Inbox → 01_Intake/_unsorted
  const inbox = vault.getAbstractFileByPath("0_Inbox");
  if (inbox && inbox instanceof TFolder) {
    const inboxFiles = vault.getFiles().filter(f => f.path.startsWith("0_Inbox/"));
    for (const file of inboxFiles) {
      const newPath = file.path.replace("0_Inbox", "01_Intake/_unsorted");
      try {
        const parentPath = newPath.substring(0, newPath.lastIndexOf("/"));
        if (parentPath && !vault.getAbstractFileByPath(parentPath)) {
          await vault.createFolder(parentPath);
        }
        if (!vault.getAbstractFileByPath(newPath)) {
          await vault.rename(file, newPath);
          moved++;
        }
      } catch (e: any) {
        errors++;
        onError(`Inbox 이동 실패: ${file.path}: ${e.message}`);
      }
    }
  }

  return { moved, errors };
}

// ─── Link Updater ────────────────────────────────────

export async function updateInternalLinks(
  app: App,
  onProgress: (current: number, total: number, file: string) => void,
): Promise<{ updated: number; linksFixed: number }> {
  const vault = app.vault;
  const mdFiles = vault.getMarkdownFiles();
  let updated = 0;
  let linksFixed = 0;

  for (let i = 0; i < mdFiles.length; i++) {
    const file = mdFiles[i];
    onProgress(i + 1, mdFiles.length, file.path);

    let content = await vault.read(file);
    let changed = false;

    for (const [oldPrefix, newPrefix] of Object.entries(LINK_REMAP)) {
      // Update [[wikilinks]]
      const wikiPattern = new RegExp(`\\[\\[${escapeRegex(oldPrefix)}/`, "g");
      if (wikiPattern.test(content)) {
        content = content.replace(wikiPattern, `[[${newPrefix}/`);
        changed = true;
        linksFixed++;
      }

      // Update [[wikilinks|aliases]]
      const aliasPattern = new RegExp(`\\[\\[${escapeRegex(oldPrefix)}/([^\\]|]+)\\|`, "g");
      if (aliasPattern.test(content)) {
        content = content.replace(aliasPattern, `[[${newPrefix}/$1|`);
        changed = true;
      }

      // Update markdown [links](path)
      const mdPattern = new RegExp(`\\]\\(${escapeRegex(oldPrefix)}/`, "g");
      if (mdPattern.test(content)) {
        content = content.replace(mdPattern, `](${newPrefix}/`);
        changed = true;
        linksFixed++;
      }

      // Update dataview FROM "old_path"
      const dvPattern = new RegExp(`FROM\\s+"${escapeRegex(oldPrefix)}`, "g");
      if (dvPattern.test(content)) {
        content = content.replace(dvPattern, `FROM "${newPrefix}`);
        changed = true;
        linksFixed++;
      }
    }

    if (changed) {
      await vault.modify(file, content);
      updated++;
    }
  }

  return { updated, linksFixed };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ─── Dashboard Generator ─────────────────────────────

export async function generateDashboard(app: App): Promise<void> {
  const vault = app.vault;
  const dashPath = "00_Dashboard/Dashboard.md";

  const content = `---
tags: [dashboard]
created: ${todayStr()}
modified: ${todayStr()}
status: active
category: area
---

# 업무 현황판

> 오늘: \`= date(today)\` · \`= date(today).toFormat("cccc")\`

---

## 🔴 기한 지남 (즉시 처리)
\`\`\`dataview
TASK
FROM "02_Tasks/Active" OR "03_Projects"
WHERE !completed AND due < date(today)
SORT due ASC
\`\`\`

## 🟡 오늘 할 일
\`\`\`dataview
TASK
FROM "02_Tasks/Active" OR "03_Projects"
WHERE !completed AND due = date(today)
SORT priority ASC
\`\`\`

## 📋 이번 주
\`\`\`dataview
TASK
FROM "02_Tasks/Active" OR "03_Projects"
WHERE !completed
AND due >= date(sow) AND due <= date(eow)
AND due != date(today)
SORT due ASC
\`\`\`

## 📅 이번 달
\`\`\`dataview
TASK
FROM "02_Tasks/Active" OR "03_Projects"
WHERE !completed
AND due.month = date(today).month
AND due > date(eow)
SORT due ASC
\`\`\`

## ⏳ 대기중
\`\`\`dataview
TABLE project AS "프로젝트", due AS "기한"
FROM "02_Tasks/Waiting"
WHERE status = "waiting"
SORT due ASC
\`\`\`

## 📊 프로젝트 진행률
\`\`\`dataview
TABLE
  length(filter(file.tasks, (t) => t.completed)) AS "완료",
  length(filter(file.tasks, (t) => !t.completed)) AS "남음",
  round(length(filter(file.tasks, (t) => t.completed)) / length(file.tasks) * 100) + "%" AS "진행률"
FROM "03_Projects"
WHERE contains(tags, "project") AND status = "active"
SORT file.name ASC
\`\`\`

## ✅ 최근 완료 (7일)
\`\`\`dataview
TASK
FROM "02_Tasks" OR "03_Projects"
WHERE completed AND completion >= date(today) - dur(7d)
SORT completion DESC
LIMIT 20
\`\`\`

## 📥 미처리 Intake
\`\`\`dataview
LIST
FROM "01_Intake"
WHERE !contains(tags, "processed")
SORT file.ctime DESC
\`\`\`
`;

  const existing = vault.getAbstractFileByPath(dashPath);
  if (existing && existing instanceof TFile) {
    await vault.modify(existing, content);
  } else {
    await vault.create(dashPath, content);
  }

  // Weekly Review
  const weeklyPath = "00_Dashboard/Weekly-Review.md";
  const weeklyContent = `---
tags: [dashboard, review, weekly]
created: ${todayStr()}
status: active
---

# 주간 리뷰

## 이번 주 완료
\`\`\`dataview
TASK FROM "02_Tasks" OR "03_Projects"
WHERE completed AND completion >= date(sow)
SORT completion DESC
\`\`\`

## 다음 주 예정
\`\`\`dataview
TASK FROM "02_Tasks/Active" OR "03_Projects"
WHERE !completed AND due >= date(eow) + dur(1d) AND due <= date(eow) + dur(7d)
SORT due ASC
\`\`\`

## 회고
- 잘한 점:
- 개선할 점:
`;

  const weeklyExisting = vault.getAbstractFileByPath(weeklyPath);
  if (weeklyExisting && weeklyExisting instanceof TFile) {
    await vault.modify(weeklyExisting, weeklyContent);
  } else {
    await vault.create(weeklyPath, weeklyContent);
  }
}

// ─── Template Generator ──────────────────────────────

export async function generateWorkflowTemplates(app: App): Promise<string[]> {
  const vault = app.vault;
  const created: string[] = [];

  const templates: Record<string, string> = {
    "_templates/태스크.md": `---
tags: [task]
created: {{date}}
project:
status: active
priority: 3-medium
due:
---

# {{title}}

## 할 일
- [ ] 📅

## 마일스톤
- [ ] 자료 수집
- [ ] 초안 작성
- [ ] 검토
- [ ] 최종 제출

## 아웃풋
- 형태:
- 제출처:
- 파일: [[04_Output/Drafts/]]

## 관련
- 출처: [[01_Intake/]]
- 프로젝트: [[03_Projects/]]`,

    "_templates/프로젝트.md": `---
tags: [project]
created: {{date}}
status: active
deadline:
---

# 프로젝트: {{title}}

## 마일스톤
- [ ] M1: 정보 수집 📅
- [ ] M2: 초안 작성 📅
- [ ] M3: 내부 검토 📅
- [ ] M4: 최종 제출 📅

## 관련 태스크
\\\`\\\`\\\`dataview
TASK FROM [[]] WHERE !completed SORT due ASC
\\\`\\\`\\\``,

    "_templates/메일분석.md": `---
tags: [intake, mail]
created: {{date}}
from:
subject:
urgency: medium
deadline:
action_required: true
---

# 메일: {{subject}}

## 원문 요약
-

## 식별된 할 일
- [ ] 📅

## 관련 프로젝트
- [[]]

## 회신 필요
- [ ] 회신 (기한: )`,

    "_templates/데일리.md": `---
tags: [daily]
created: {{date}}
---

# {{date}} 데일리

## 오늘 할 일
- [ ]

## 완료
-

## 메모
-`,
  };

  for (const [path, content] of Object.entries(templates)) {
    const existing = vault.getAbstractFileByPath(path);
    if (!existing) {
      await vault.create(path, content);
      created.push(path);
    }
  }

  return created;
}

// ─── HOME.md Generator ──────────────────────────────

export async function generateHome(app: App): Promise<void> {
  const vault = app.vault;
  const homePath = "HOME.md";

  const content = `---
tags: [dashboard, home]
created: ${todayStr()}
modified: ${todayStr()}
status: active
cssclass: dashboard
---

# HOME

> PARA + GTD 하이브리드 지식·업무 관리 시스템

---

## GTD 워크플로우

| # | 폴더 | 역할 |
|---|---|---|
| 00 | [[00_Dashboard/Dashboard\\|Dashboard]] | 현황판 |
| 01 | [[01_Intake/_INDEX\\|Intake]] | 수집 — 메일/공문/구두 |
| 02 | [[02_Tasks/_INDEX\\|Tasks]] | 태스크 — Active/Waiting/Someday |
| 03 | [[03_Projects]] | 프로젝트 |
| 04 | [[04_Output/_INDEX\\|Output]] | 아웃풋 — Drafts/Sent |
| 05 | [[05_Archive]] | 아카이브 |

## PARA 지식관리

| # | 폴더 | 역할 |
|---|---|---|
| 06 | [[06_Areas]] | 지속 영역 |
| 07 | [[07_Resources]] | 참고자료 |

---

## 오늘 할 일
\`\`\`dataview
TASK FROM "02_Tasks/Active" OR "03_Projects"
WHERE !completed AND due = date(today)
SORT priority ASC
\`\`\`

## 진행중 프로젝트
\`\`\`dataview
TABLE status AS "상태", modified AS "수정일"
FROM "03_Projects"
WHERE file.name != "_INDEX"
SORT file.mtime DESC
LIMIT 10
\`\`\`

---

## 빠른 접근

### 업무
- [[00_Dashboard/Dashboard|대시보드]] | [[02_Tasks/Active|진행중]] | [[01_Intake/_INDEX|수집함]]

### 영역
- [[06_Areas/자동차-업무|자동차-업무]] | [[06_Areas/코딩-AI|코딩-AI]] | [[06_Areas/영어학습|영어학습]]
- [[06_Areas/유튜브|유튜브]] | [[06_Areas/자기계발|자기계발]]

### 레퍼런스
- [[07_Resources/자동차기술|자동차기술]] | [[07_Resources/비즈니스|비즈니스]] | [[07_Resources/AI-코딩|AI-코딩]]
- [[07_Resources/개발가이드|개발가이드]] | [[07_Resources/프롬프트|프롬프트]]

---
*PARA+GTD Hybrid — Claude Writer Vault Ops*
`;

  const existing = vault.getAbstractFileByPath(homePath);
  if (existing && existing instanceof TFile) {
    await vault.modify(existing, content);
  } else {
    await vault.create(homePath, content);
  }
}

// ─── Full Migration Pipeline ─────────────────────────

export async function runFullMigration(
  app: App,
  onPhase: (phase: MigrationPhase, msg: string) => void,
  onProgress: (current: number, total: number, file: string) => void,
  onError: (msg: string) => void,
): Promise<{
  foldersCreated: number;
  filesMoved: number;
  linksUpdated: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let foldersCreated = 0;
  let filesMoved = 0;
  let linksUpdated = 0;

  try {
    // Phase 1: Scan
    onPhase("scanning", "볼트 구조 스캔 중...");
    const scan = scanVaultStructure(app);
    onPhase("scanning", `파일 ${scan.totalFiles}개, 이동 대상 ${scan.filesToMigrate}개`);

    // Phase 2: Create folders
    onPhase("creating-folders", "GTD 폴더 생성 중...");
    const created = await createGtdFolders(app, (msg) => onPhase("creating-folders", msg));
    foldersCreated = created.length;

    // Phase 3: Migrate files
    onPhase("migrating-files", "파일 이동 중...");
    const migResult = await migrateFiles(app, onProgress, (msg) => {
      errors.push(msg);
      onError(msg);
    });
    filesMoved = migResult.moved;

    // Phase 4: Update links
    onPhase("updating-links", "내부 링크 업데이트 중...");
    const linkResult = await updateInternalLinks(app, onProgress);
    linksUpdated = linkResult.linksFixed;

    // Phase 5: Generate Dashboard
    onPhase("generating-dashboard", "대시보드 생성 중...");
    await generateDashboard(app);
    await generateHome(app);

    // Phase 6: Generate Templates
    onPhase("generating-templates", "워크플로우 템플릿 생성 중...");
    await generateWorkflowTemplates(app);

    // Phase 7: Verify
    onPhase("verifying", "검증 중...");
    const postScan = scanVaultStructure(app);
    onPhase("verifying", `검증 완료: GTD 폴더 ${postScan.gtdFolders.length}개 확인`);

    onPhase("done", `완료! 폴더 ${foldersCreated}개 생성, 파일 ${filesMoved}개 이동, 링크 ${linksUpdated}개 수정`);
  } catch (e: any) {
    errors.push(e.message);
    onPhase("error", `오류: ${e.message}`);
  }

  return { foldersCreated, filesMoved, linksUpdated, errors };
}

// ─── Dry Run (Simulation) ────────────────────────────

export function simulateMigration(app: App): {
  foldersToCreate: string[];
  filesToMove: { from: string; to: string }[];
  linksToUpdate: number;
  summary: string;
} {
  const vault = app.vault;
  const foldersToCreate: string[] = [];
  const filesToMove: { from: string; to: string }[] = [];

  // Check what folders need creating
  for (const def of GTD_FOLDERS) {
    if (!vault.getAbstractFileByPath(def.path)) foldersToCreate.push(def.path);
    for (const sub of def.subfolders || []) {
      const p = `${def.path}/${sub}`;
      if (!vault.getAbstractFileByPath(p)) foldersToCreate.push(p);
    }
  }
  for (const target of Object.values(PARA_REMAP)) {
    if (!vault.getAbstractFileByPath(target)) foldersToCreate.push(target);
  }

  // Check what files would move
  for (const [source, target] of Object.entries(PARA_REMAP)) {
    const files = vault.getFiles().filter(f => f.path.startsWith(source + "/"));
    for (const f of files) {
      filesToMove.push({ from: f.path, to: f.path.replace(source, target) });
    }
  }

  // 0_Inbox
  const inboxFiles = vault.getFiles().filter(f => f.path.startsWith("0_Inbox/"));
  for (const f of inboxFiles) {
    filesToMove.push({ from: f.path, to: f.path.replace("0_Inbox", "01_Intake/_unsorted") });
  }

  // Estimate link updates
  let linksToUpdate = 0;
  const mdFiles = vault.getMarkdownFiles();
  for (const file of mdFiles) {
    const cache = app.metadataCache.getFileCache(file);
    if (cache?.links) {
      for (const link of cache.links) {
        for (const oldPrefix of Object.keys(LINK_REMAP)) {
          if (link.link.startsWith(oldPrefix + "/")) linksToUpdate++;
        }
      }
    }
  }

  const summary = `[시뮬레이션 결과]
- 생성할 폴더: ${foldersToCreate.length}개
- 이동할 파일: ${filesToMove.length}개
- 수정할 링크: ~${linksToUpdate}개 (추정)
- Dashboard.md + HOME.md 생성
- 워크플로우 템플릿 4종 생성`;

  return { foldersToCreate, filesToMove, linksToUpdate, summary };
}

function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}
