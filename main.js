var V=Object.defineProperty;var ht=Object.getOwnPropertyDescriptor;var pt=Object.getOwnPropertyNames;var mt=Object.prototype.hasOwnProperty;var H=(l,r)=>()=>(l&&(r=l(l=0)),r);var gt=(l,r)=>{for(var t in r)V(l,t,{get:r[t],enumerable:!0})},wt=(l,r,t,e)=>{if(r&&typeof r=="object"||typeof r=="function")for(let s of pt(r))!mt.call(l,s)&&s!==t&&V(l,s,{get:()=>r[s],enumerable:!(e=ht(r,s))||e.enumerable});return l};var it=l=>wt(V({},"__esModule",{value:!0}),l);function I(l){let r=l.vault,t=r.getFiles(),e=r.getAllLoadedFiles().filter(i=>i instanceof R.TFolder).map(i=>i.path),s=Object.keys(P).filter(i=>e.includes(i)),n=[...z.map(i=>i.path),...Object.values(P)].filter(i=>e.includes(i)),o=0;for(let i of s)o+=t.filter(a=>a.path.startsWith(i+"/")).length;return e.includes("0_Inbox")&&(o+=t.filter(i=>i.path.startsWith("0_Inbox/")).length),{hasPara:s.length>0,hasGtd:n.length>=4,paraFolders:s,gtdFolders:n,totalFiles:t.length,filesToMigrate:o}}async function ft(l,r){let t=l.vault,e=[];for(let i of z){t.getAbstractFileByPath(i.path)||(await t.createFolder(i.path),e.push(i.path),r(`\uD3F4\uB354 \uC0DD\uC131: ${i.path}`));for(let a of i.subfolders||[]){let c=`${i.path}/${a}`;t.getAbstractFileByPath(c)||(await t.createFolder(c),e.push(c))}}for(let i of Object.values(P))t.getAbstractFileByPath(i)||(await t.createFolder(i),e.push(i),r(`\uD3F4\uB354 \uC0DD\uC131: ${i}`));let s="01_Intake/_unsorted";t.getAbstractFileByPath(s)||(await t.createFolder(s),e.push(s));let n=new Date,o=`05_Archive/${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,"0")}`;return t.getAbstractFileByPath(o)||(await t.createFolder(o),e.push(o)),e}async function vt(l,r,t){let e=l.vault,s=0,n=0;for(let[i,a]of Object.entries(P)){let c=e.getAbstractFileByPath(i);if(!c||!(c instanceof R.TFolder))continue;let u=e.getFiles().filter(g=>g.path.startsWith(i+"/")),d=u.length;for(let g=0;g<u.length;g++){let f=u[g],w=f.path.replace(i,a);r(s+g+1,d,f.path);try{let E=w.substring(0,w.lastIndexOf("/"));if(E&&!e.getAbstractFileByPath(E)&&await e.createFolder(E),e.getAbstractFileByPath(w))continue;await e.rename(f,w),s++}catch(E){n++,t(`\uC774\uB3D9 \uC2E4\uD328: ${f.path} \u2192 ${w}: ${E.message}`)}}}let o=e.getAbstractFileByPath("0_Inbox");if(o&&o instanceof R.TFolder){let i=e.getFiles().filter(a=>a.path.startsWith("0_Inbox/"));for(let a of i){let c=a.path.replace("0_Inbox","01_Intake/_unsorted");try{let u=c.substring(0,c.lastIndexOf("/"));u&&!e.getAbstractFileByPath(u)&&await e.createFolder(u),e.getAbstractFileByPath(c)||(await e.rename(a,c),s++)}catch(u){n++,t(`Inbox \uC774\uB3D9 \uC2E4\uD328: ${a.path}: ${u.message}`)}}}return{moved:s,errors:n}}async function Et(l,r){let t=l.vault,e=t.getMarkdownFiles(),s=0,n=0;for(let o=0;o<e.length;o++){let i=e[o];r(o+1,e.length,i.path);let a=await t.read(i),c=!1;for(let[u,d]of Object.entries(at)){let g=new RegExp(`\\[\\[${B(u)}/`,"g");g.test(a)&&(a=a.replace(g,`[[${d}/`),c=!0,n++);let f=new RegExp(`\\[\\[${B(u)}/([^\\]|]+)\\|`,"g");f.test(a)&&(a=a.replace(f,`[[${d}/$1|`),c=!0);let w=new RegExp(`\\]\\(${B(u)}/`,"g");w.test(a)&&(a=a.replace(w,`](${d}/`),c=!0,n++);let E=new RegExp(`FROM\\s+"${B(u)}`,"g");E.test(a)&&(a=a.replace(E,`FROM "${d}`),c=!0,n++)}c&&(await t.modify(i,a),s++)}return{updated:s,linksFixed:n}}function B(l){return l.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")}async function xt(l){let r=l.vault,t="00_Dashboard/Dashboard.md",e=`---
tags: [dashboard]
created: ${D()}
modified: ${D()}
status: active
category: area
---

# \uC5C5\uBB34 \uD604\uD669\uD310

> \uC624\uB298: \`= date(today)\` \xB7 \`= date(today).toFormat("cccc")\`

---

## \u{1F534} \uAE30\uD55C \uC9C0\uB0A8 (\uC989\uC2DC \uCC98\uB9AC)
\`\`\`dataview
TASK
FROM "02_Tasks/Active" OR "03_Projects"
WHERE !completed AND due < date(today)
SORT due ASC
\`\`\`

## \u{1F7E1} \uC624\uB298 \uD560 \uC77C
\`\`\`dataview
TASK
FROM "02_Tasks/Active" OR "03_Projects"
WHERE !completed AND due = date(today)
SORT priority ASC
\`\`\`

## \u{1F4CB} \uC774\uBC88 \uC8FC
\`\`\`dataview
TASK
FROM "02_Tasks/Active" OR "03_Projects"
WHERE !completed
AND due >= date(sow) AND due <= date(eow)
AND due != date(today)
SORT due ASC
\`\`\`

## \u{1F4C5} \uC774\uBC88 \uB2EC
\`\`\`dataview
TASK
FROM "02_Tasks/Active" OR "03_Projects"
WHERE !completed
AND due.month = date(today).month
AND due > date(eow)
SORT due ASC
\`\`\`

## \u23F3 \uB300\uAE30\uC911
\`\`\`dataview
TABLE project AS "\uD504\uB85C\uC81D\uD2B8", due AS "\uAE30\uD55C"
FROM "02_Tasks/Waiting"
WHERE status = "waiting"
SORT due ASC
\`\`\`

## \u{1F4CA} \uD504\uB85C\uC81D\uD2B8 \uC9C4\uD589\uB960
\`\`\`dataview
TABLE
  length(filter(file.tasks, (t) => t.completed)) AS "\uC644\uB8CC",
  length(filter(file.tasks, (t) => !t.completed)) AS "\uB0A8\uC74C",
  round(length(filter(file.tasks, (t) => t.completed)) / length(file.tasks) * 100) + "%" AS "\uC9C4\uD589\uB960"
FROM "03_Projects"
WHERE contains(tags, "project") AND status = "active"
SORT file.name ASC
\`\`\`

## \u2705 \uCD5C\uADFC \uC644\uB8CC (7\uC77C)
\`\`\`dataview
TASK
FROM "02_Tasks" OR "03_Projects"
WHERE completed AND completion >= date(today) - dur(7d)
SORT completion DESC
LIMIT 20
\`\`\`

## \u{1F4E5} \uBBF8\uCC98\uB9AC Intake
\`\`\`dataview
LIST
FROM "01_Intake"
WHERE !contains(tags, "processed")
SORT file.ctime DESC
\`\`\`
`,s=r.getAbstractFileByPath(t);s&&s instanceof R.TFile?await r.modify(s,e):await r.create(t,e);let n="00_Dashboard/Weekly-Review.md",o=`---
tags: [dashboard, review, weekly]
created: ${D()}
status: active
---

# \uC8FC\uAC04 \uB9AC\uBDF0

## \uC774\uBC88 \uC8FC \uC644\uB8CC
\`\`\`dataview
TASK FROM "02_Tasks" OR "03_Projects"
WHERE completed AND completion >= date(sow)
SORT completion DESC
\`\`\`

## \uB2E4\uC74C \uC8FC \uC608\uC815
\`\`\`dataview
TASK FROM "02_Tasks/Active" OR "03_Projects"
WHERE !completed AND due >= date(eow) + dur(1d) AND due <= date(eow) + dur(7d)
SORT due ASC
\`\`\`

## \uD68C\uACE0
- \uC798\uD55C \uC810:
- \uAC1C\uC120\uD560 \uC810:
`,i=r.getAbstractFileByPath(n);i&&i instanceof R.TFile?await r.modify(i,o):await r.create(n,o)}async function Ct(l){let r=l.vault,t=[],e={"_templates/\uD0DC\uC2A4\uD06C.md":`---
tags: [task]
created: {{date}}
project:
status: active
priority: 3-medium
due:
---

# {{title}}

## \uD560 \uC77C
- [ ] \u{1F4C5}

## \uB9C8\uC77C\uC2A4\uD1A4
- [ ] \uC790\uB8CC \uC218\uC9D1
- [ ] \uCD08\uC548 \uC791\uC131
- [ ] \uAC80\uD1A0
- [ ] \uCD5C\uC885 \uC81C\uCD9C

## \uC544\uC6C3\uD48B
- \uD615\uD0DC:
- \uC81C\uCD9C\uCC98:
- \uD30C\uC77C: [[04_Output/Drafts/]]

## \uAD00\uB828
- \uCD9C\uCC98: [[01_Intake/]]
- \uD504\uB85C\uC81D\uD2B8: [[03_Projects/]]`,"_templates/\uD504\uB85C\uC81D\uD2B8.md":`---
tags: [project]
created: {{date}}
status: active
deadline:
---

# \uD504\uB85C\uC81D\uD2B8: {{title}}

## \uB9C8\uC77C\uC2A4\uD1A4
- [ ] M1: \uC815\uBCF4 \uC218\uC9D1 \u{1F4C5}
- [ ] M2: \uCD08\uC548 \uC791\uC131 \u{1F4C5}
- [ ] M3: \uB0B4\uBD80 \uAC80\uD1A0 \u{1F4C5}
- [ ] M4: \uCD5C\uC885 \uC81C\uCD9C \u{1F4C5}

## \uAD00\uB828 \uD0DC\uC2A4\uD06C
\\\`\\\`\\\`dataview
TASK FROM [[]] WHERE !completed SORT due ASC
\\\`\\\`\\\``,"_templates/\uBA54\uC77C\uBD84\uC11D.md":`---
tags: [intake, mail]
created: {{date}}
from:
subject:
urgency: medium
deadline:
action_required: true
---

# \uBA54\uC77C: {{subject}}

## \uC6D0\uBB38 \uC694\uC57D
-

## \uC2DD\uBCC4\uB41C \uD560 \uC77C
- [ ] \u{1F4C5}

## \uAD00\uB828 \uD504\uB85C\uC81D\uD2B8
- [[]]

## \uD68C\uC2E0 \uD544\uC694
- [ ] \uD68C\uC2E0 (\uAE30\uD55C: )`,"_templates/\uB370\uC77C\uB9AC.md":`---
tags: [daily]
created: {{date}}
---

# {{date}} \uB370\uC77C\uB9AC

## \uC624\uB298 \uD560 \uC77C
- [ ]

## \uC644\uB8CC
-

## \uBA54\uBAA8
-`};for(let[s,n]of Object.entries(e))r.getAbstractFileByPath(s)||(await r.create(s,n),t.push(s));return t}async function bt(l){let r=l.vault,t="HOME.md",e=`---
tags: [dashboard, home]
created: ${D()}
modified: ${D()}
status: active
cssclass: dashboard
---

# HOME

> PARA + GTD \uD558\uC774\uBE0C\uB9AC\uB4DC \uC9C0\uC2DD\xB7\uC5C5\uBB34 \uAD00\uB9AC \uC2DC\uC2A4\uD15C

---

## GTD \uC6CC\uD06C\uD50C\uB85C\uC6B0

| # | \uD3F4\uB354 | \uC5ED\uD560 |
|---|---|---|
| 00 | [[00_Dashboard/Dashboard\\|Dashboard]] | \uD604\uD669\uD310 |
| 01 | [[01_Intake/_INDEX\\|Intake]] | \uC218\uC9D1 \u2014 \uBA54\uC77C/\uACF5\uBB38/\uAD6C\uB450 |
| 02 | [[02_Tasks/_INDEX\\|Tasks]] | \uD0DC\uC2A4\uD06C \u2014 Active/Waiting/Someday |
| 03 | [[03_Projects]] | \uD504\uB85C\uC81D\uD2B8 |
| 04 | [[04_Output/_INDEX\\|Output]] | \uC544\uC6C3\uD48B \u2014 Drafts/Sent |
| 05 | [[05_Archive]] | \uC544\uCE74\uC774\uBE0C |

## PARA \uC9C0\uC2DD\uAD00\uB9AC

| # | \uD3F4\uB354 | \uC5ED\uD560 |
|---|---|---|
| 06 | [[06_Areas]] | \uC9C0\uC18D \uC601\uC5ED |
| 07 | [[07_Resources]] | \uCC38\uACE0\uC790\uB8CC |

---

## \uC624\uB298 \uD560 \uC77C
\`\`\`dataview
TASK FROM "02_Tasks/Active" OR "03_Projects"
WHERE !completed AND due = date(today)
SORT priority ASC
\`\`\`

## \uC9C4\uD589\uC911 \uD504\uB85C\uC81D\uD2B8
\`\`\`dataview
TABLE status AS "\uC0C1\uD0DC", modified AS "\uC218\uC815\uC77C"
FROM "03_Projects"
WHERE file.name != "_INDEX"
SORT file.mtime DESC
LIMIT 10
\`\`\`

---

## \uBE60\uB978 \uC811\uADFC

### \uC5C5\uBB34
- [[00_Dashboard/Dashboard|\uB300\uC2DC\uBCF4\uB4DC]] | [[02_Tasks/Active|\uC9C4\uD589\uC911]] | [[01_Intake/_INDEX|\uC218\uC9D1\uD568]]

### \uC601\uC5ED
- [[06_Areas/\uC790\uB3D9\uCC28-\uC5C5\uBB34|\uC790\uB3D9\uCC28-\uC5C5\uBB34]] | [[06_Areas/\uCF54\uB529-AI|\uCF54\uB529-AI]] | [[06_Areas/\uC601\uC5B4\uD559\uC2B5|\uC601\uC5B4\uD559\uC2B5]]
- [[06_Areas/\uC720\uD29C\uBE0C|\uC720\uD29C\uBE0C]] | [[06_Areas/\uC790\uAE30\uACC4\uBC1C|\uC790\uAE30\uACC4\uBC1C]]

### \uB808\uD37C\uB7F0\uC2A4
- [[07_Resources/\uC790\uB3D9\uCC28\uAE30\uC220|\uC790\uB3D9\uCC28\uAE30\uC220]] | [[07_Resources/\uBE44\uC988\uB2C8\uC2A4|\uBE44\uC988\uB2C8\uC2A4]] | [[07_Resources/AI-\uCF54\uB529|AI-\uCF54\uB529]]
- [[07_Resources/\uAC1C\uBC1C\uAC00\uC774\uB4DC|\uAC1C\uBC1C\uAC00\uC774\uB4DC]] | [[07_Resources/\uD504\uB86C\uD504\uD2B8|\uD504\uB86C\uD504\uD2B8]]

---
*PARA+GTD Hybrid \u2014 Claude Writer Vault Ops*
`,s=r.getAbstractFileByPath(t);s&&s instanceof R.TFile?await r.modify(s,e):await r.create(t,e)}async function ot(l,r,t,e){let s=[],n=0,o=0,i=0;try{r("scanning","\uBCFC\uD2B8 \uAD6C\uC870 \uC2A4\uCE94 \uC911...");let a=I(l);r("scanning",`\uD30C\uC77C ${a.totalFiles}\uAC1C, \uC774\uB3D9 \uB300\uC0C1 ${a.filesToMigrate}\uAC1C`),r("creating-folders","GTD \uD3F4\uB354 \uC0DD\uC131 \uC911..."),n=(await ft(l,f=>r("creating-folders",f))).length,r("migrating-files","\uD30C\uC77C \uC774\uB3D9 \uC911..."),o=(await vt(l,t,f=>{s.push(f),e(f)})).moved,r("updating-links","\uB0B4\uBD80 \uB9C1\uD06C \uC5C5\uB370\uC774\uD2B8 \uC911..."),i=(await Et(l,t)).linksFixed,r("generating-dashboard","\uB300\uC2DC\uBCF4\uB4DC \uC0DD\uC131 \uC911..."),await xt(l),await bt(l),r("generating-templates","\uC6CC\uD06C\uD50C\uB85C\uC6B0 \uD15C\uD50C\uB9BF \uC0DD\uC131 \uC911..."),await Ct(l),r("verifying","\uAC80\uC99D \uC911...");let g=I(l);r("verifying",`\uAC80\uC99D \uC644\uB8CC: GTD \uD3F4\uB354 ${g.gtdFolders.length}\uAC1C \uD655\uC778`),r("done",`\uC644\uB8CC! \uD3F4\uB354 ${n}\uAC1C \uC0DD\uC131, \uD30C\uC77C ${o}\uAC1C \uC774\uB3D9, \uB9C1\uD06C ${i}\uAC1C \uC218\uC815`)}catch(a){s.push(a.message),r("error",`\uC624\uB958: ${a.message}`)}return{foldersCreated:n,filesMoved:o,linksUpdated:i,errors:s}}function rt(l){let r=l.vault,t=[],e=[];for(let a of z){r.getAbstractFileByPath(a.path)||t.push(a.path);for(let c of a.subfolders||[]){let u=`${a.path}/${c}`;r.getAbstractFileByPath(u)||t.push(u)}}for(let a of Object.values(P))r.getAbstractFileByPath(a)||t.push(a);for(let[a,c]of Object.entries(P)){let u=r.getFiles().filter(d=>d.path.startsWith(a+"/"));for(let d of u)e.push({from:d.path,to:d.path.replace(a,c)})}let s=r.getFiles().filter(a=>a.path.startsWith("0_Inbox/"));for(let a of s)e.push({from:a.path,to:a.path.replace("0_Inbox","01_Intake/_unsorted")});let n=0,o=r.getMarkdownFiles();for(let a of o){let c=l.metadataCache.getFileCache(a);if(c!=null&&c.links)for(let u of c.links)for(let d of Object.keys(at))u.link.startsWith(d+"/")&&n++}let i=`[\uC2DC\uBBAC\uB808\uC774\uC158 \uACB0\uACFC]
- \uC0DD\uC131\uD560 \uD3F4\uB354: ${t.length}\uAC1C
- \uC774\uB3D9\uD560 \uD30C\uC77C: ${e.length}\uAC1C
- \uC218\uC815\uD560 \uB9C1\uD06C: ~${n}\uAC1C (\uCD94\uC815)
- Dashboard.md + HOME.md \uC0DD\uC131
- \uC6CC\uD06C\uD50C\uB85C\uC6B0 \uD15C\uD50C\uB9BF 4\uC885 \uC0DD\uC131`;return{foldersToCreate:t,filesToMove:e,linksToUpdate:n,summary:i}}function D(){return new Date().toISOString().split("T")[0]}var R,z,P,at,ct=H(()=>{R=require("obsidian"),z=[{path:"00_Dashboard",desc:"\uD604\uD669\uD310",subfolders:[]},{path:"01_Intake",desc:"\uC5C5\uBB34 \uC218\uC9D1",subfolders:["Mail","Official","Quick"]},{path:"02_Tasks",desc:"\uD0DC\uC2A4\uD06C \uAD00\uB9AC",subfolders:["Active","Waiting","Someday"]},{path:"04_Output",desc:"\uC544\uC6C3\uD48B",subfolders:["Drafts","Sent","assets"]}],P={"1_Projects":"03_Projects","2_Areas":"06_Areas","3_Resources":"07_Resources","4_Archive":"05_Archive"},at={"1_Projects":"03_Projects","2_Areas":"06_Areas","3_Resources":"07_Resources","4_Archive":"05_Archive","0_Inbox":"01_Intake/_unsorted"}});var m,A,W,O,lt=H(()=>{m=require("obsidian");et();ct();A="claude-writer-view",W=class{constructor(r){this.max=r;this.map=new Map}get(r){let t=this.map.get(r);return t!==void 0&&(this.map.delete(r),this.map.set(r,t)),t}set(r,t){if(this.map.delete(r),this.map.size>=this.max){let e=this.map.keys().next().value;e!==void 0&&this.map.delete(e)}this.map.set(r,t)}has(r){return this.map.has(r)}},O=class extends m.ItemView{constructor(t,e){super(t);this.toneBtns=new Map;this.actionBtns=new Map;this.state="idle";this.currentSelection="";this.currentResult="";this.activeCommand="";this.isExplainMode=!1;this.isVizMode=!1;this.killProcess=null;this.lastEditor=null;this.savedFrom=null;this.savedTo=null;this.contextCache=new W(20);this.currentDocPath="";this.currentTemplate="";this.scanAbortPath="";this.plugin=e}getViewType(){return A}getDisplayText(){return"Claude Writer"}getIcon(){return"pen-tool"}async onOpen(){this.buildUI(),this.setState("idle"),this.refreshAuth(),this.registerEvent(this.app.workspace.on("active-leaf-change",e=>{e&&e.view instanceof m.MarkdownView&&(this.lastEditor={editor:e.view.editor,leaf:e},this.onDocumentChanged(e.view))})),this.registerInterval(window.setInterval(()=>{let e=!!this.getEditorSelection(!0);this.cmdGrid.toggleClass("cw-no-selection",!e),this.selectionHint.toggleClass("cw-hidden",e)},800));let t=this.app.workspace.getActiveViewOfType(m.MarkdownView);t&&(this.lastEditor={editor:t.editor,leaf:t.leaf},this.onDocumentChanged(t))}async onClose(){this.forceKill(),this.contentEl.empty()}forceKill(){this.killProcess&&(this.killProcess(),this.killProcess=null)}triggerCommand(t,e){if(this.state==="processing"){new m.Notice("\uC774\uBBF8 \uCC98\uB9AC \uC911\uC785\uB2C8\uB2E4");return}if(t==="vault-ops"){this.triggerVaultOps();return}if(t==="console"){this.triggerConsole();return}if(t==="answer-questions"){let n=this.findMarkdownEditor();n&&this.triggerAnswerQuestions(n);return}if(this.currentSelection=e||"",!this.currentSelection){new m.Notice("\uD14D\uC2A4\uD2B8\uB97C \uC120\uD0DD\uD574\uC8FC\uC138\uC694");return}let s=this.app.workspace.getActiveViewOfType(m.MarkdownView);if(s?(this.lastEditor={editor:s.editor,leaf:s.leaf},this.savedFrom=s.editor.getCursor("from"),this.savedTo=s.editor.getCursor("to")):this.lastEditor&&(this.savedFrom=this.lastEditor.editor.getCursor("from"),this.savedTo=this.lastEditor.editor.getCursor("to")),t==="explain"){this.explainRow.removeClass("cw-hidden");return}if(t==="visualize"){this.executeVisualizeSuggest();return}if(t==="custom"){this.showCustomInput();return}this.isExplainMode=!1,this.isVizMode=!1,this.executeCommand(t)}callClaudeAuto(t,e,s,n,o,i,a,c,u=!0){return Z()?J(this.plugin.settings.bridgeUrl,t,e,s,n,o,i,a,c,u):X(this.plugin.getClaudePath(),t,e,s,n,o,i,a,c,u)}findMarkdownEditor(){if(this.lastEditor)try{let e=this.lastEditor.editor;if(e&&typeof e.getValue=="function")return e}catch(e){}let t=this.app.workspace.getActiveViewOfType(m.MarkdownView);if(t)return this.lastEditor={editor:t.editor,leaf:t.leaf},t.editor;for(let e of this.app.workspace.getLeavesOfType("markdown")){let s=e.view;if(s!=null&&s.editor)return this.lastEditor={editor:s.editor,leaf:e},s.editor}return null}triggerVaultOps(){if(this.state==="processing"){new m.Notice("\uC774\uBBF8 \uCC98\uB9AC \uC911\uC785\uB2C8\uB2E4");return}this.activeCommand="vault-ops",this.outputContent.empty(),this.inputSection.addClass("cw-hidden"),this.explainRow.addClass("cw-hidden"),this.vizRow.addClass("cw-hidden"),this.customRow.addClass("cw-hidden"),this.consoleSection.addClass("cw-hidden"),this.outputSection.removeClass("cw-hidden");let t=I(this.app),e=this.outputContent;e.createEl("h4",{text:"\u{1F3D7}\uFE0F Vault Ops \u2014 PARA \u2192 GTD+PARA"});let s=e.createDiv({cls:"cw-vault-status"});if(s.createEl("p",{text:`\uCD1D \uD30C\uC77C: ${t.totalFiles}\uAC1C`}),s.createEl("p",{text:`PARA \uD3F4\uB354: ${t.paraFolders.join(", ")||"\uC5C6\uC74C"}`}),s.createEl("p",{text:`GTD \uD3F4\uB354: ${t.gtdFolders.join(", ")||"\uC5C6\uC74C"}`}),s.createEl("p",{text:`\uC774\uB3D9 \uB300\uC0C1: ${t.filesToMigrate}\uAC1C`}),t.hasGtd&&!t.hasPara){s.createEl("p",{text:"\u2705 \uC774\uBBF8 GTD+PARA \uAD6C\uC870\uC785\uB2C8\uB2E4!",cls:"cw-vault-done"});return}let n=e.createDiv({cls:"cw-vault-btns"}),o=n.createEl("button",{text:"\u{1F4CB} \uC2DC\uBBAC\uB808\uC774\uC158",cls:"cw-btn"});o.addEventListener("click",()=>{let a=rt(this.app),c=e.createDiv({cls:"cw-vault-sim"});if(c.createEl("pre",{text:a.summary}),a.filesToMove.length>0){let u=c.createDiv();u.createEl("h5",{text:`\uD30C\uC77C \uC774\uB3D9 \uBBF8\uB9AC\uBCF4\uAE30 (${Math.min(20,a.filesToMove.length)}/${a.filesToMove.length})`});let d=u.createEl("ul");for(let g of a.filesToMove.slice(0,20))d.createEl("li",{text:`${g.from} \u2192 ${g.to}`});a.filesToMove.length>20&&u.createEl("p",{text:`... \uC678 ${a.filesToMove.length-20}\uAC1C`,cls:"cw-vault-more"})}});let i=n.createEl("button",{text:"\u{1F680} \uB300\uC218\uC220 \uC2E4\uD589",cls:"cw-btn cw-btn-primary"});i.addEventListener("click",async()=>{i.disabled=!0,o.disabled=!0;let a=e.createDiv({cls:"cw-vault-progress"}),c=a.createEl("p",{text:"\uC2DC\uC791...",cls:"cw-vault-phase"}),d=a.createDiv({cls:"cw-vault-bar-container"}).createDiv({cls:"cw-vault-bar"}),g=a.createEl("p",{text:"",cls:"cw-vault-file"}),f=a.createEl("div",{cls:"cw-vault-log"});this.setState("processing");let w=await ot(this.app,(S,C)=>{c.setText(`[${S}] ${C}`),f.createEl("p",{text:C}),f.scrollTop=f.scrollHeight},(S,C,y)=>{let p=C>0?Math.round(S/C*100):0;d.style.width=`${p}%`,g.setText(`${S}/${C}: ${y.split("/").pop()}`)},S=>{f.createEl("p",{text:`\u274C ${S}`,cls:"cw-vault-error"})});d.style.width="100%",this.setState("done");let E=e.createDiv({cls:"cw-vault-summary"});E.createEl("h4",{text:"\u2705 \uB9C8\uC774\uADF8\uB808\uC774\uC158 \uC644\uB8CC"}),E.createEl("p",{text:`\uD3F4\uB354 \uC0DD\uC131: ${w.foldersCreated}\uAC1C`}),E.createEl("p",{text:`\uD30C\uC77C \uC774\uB3D9: ${w.filesMoved}\uAC1C`}),E.createEl("p",{text:`\uB9C1\uD06C \uC218\uC815: ${w.linksUpdated}\uAC1C`}),w.errors.length>0&&E.createEl("p",{text:`\uC624\uB958: ${w.errors.length}\uAC74`,cls:"cw-vault-error"}),new m.Notice(`Vault Ops \uC644\uB8CC! ${w.filesMoved}\uAC1C \uD30C\uC77C \uC774\uB3D9, ${w.linksUpdated}\uAC1C \uB9C1\uD06C \uC218\uC815`)})}triggerConsole(){if(this.state==="processing"){new m.Notice("\uC774\uBBF8 \uCC98\uB9AC \uC911\uC785\uB2C8\uB2E4");return}this.activeCommand="console",this.inputSection.addClass("cw-hidden"),this.explainRow.addClass("cw-hidden"),this.vizRow.addClass("cw-hidden"),this.customRow.addClass("cw-hidden"),this.outputSection.addClass("cw-hidden"),this.consoleSection.removeClass("cw-hidden"),this.consoleInput.focus(),this.refreshSavedCommands()}executeConsoleCommand(t){var d;if(!t.trim()){new m.Notice("\uBA85\uB839\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694");return}this.consoleSection.addClass("cw-hidden"),this.outputContent.empty(),this.outputContent.addClass("cw-streaming"),this.outputSection.removeClass("cw-hidden"),this.setState("processing"),this.currentResult="",this.activeCommand="console";let e=((d=this.app.vault.adapter)==null?void 0:d.basePath)||"",s=this.app.workspace.getActiveFile(),n=s?s.path:"(\uC5C6\uC74C)",o=this.contextCache.get(this.currentDocPath)||"",i=`\uB2F9\uC2E0\uC740 Obsidian \uBCFC\uD2B8 \uC791\uC5C5 \uC804\uBB38\uAC00\uC785\uB2C8\uB2E4. \uC0AC\uC6A9\uC790\uC758 \uBA85\uB839\uC744 \uC218\uD589\uD558\uC138\uC694.

\uD604\uC7AC \uBCFC\uD2B8 \uC815\uBCF4:
- \uBCFC\uD2B8 \uACBD\uB85C: ${e}
- \uC5F4\uB9B0 \uD30C\uC77C: ${n}
- \uAD6C\uC870: GTD+PARA (00_Dashboard ~ 07_Resources)

\uADDC\uCE59:
1. \uBB38\uC11C \uC0DD\uC131 \uC694\uCCAD \uC2DC: \uC644\uC131\uB41C \uB9C8\uD06C\uB2E4\uC6B4 \uBB38\uC11C\uB97C \uCD9C\uB825\uD558\uC138\uC694. frontmatter \uD3EC\uD568.
2. \uBD84\uC11D/\uAC80\uC0C9 \uC694\uCCAD \uC2DC: \uACB0\uACFC\uB97C \uAD6C\uC870\uD654\uB41C \uB9C8\uD06C\uB2E4\uC6B4\uC73C\uB85C \uCD9C\uB825\uD558\uC138\uC694.
3. \uC218\uC815 \uC694\uCCAD \uC2DC: \uC218\uC815\uB41C \uC804\uCCB4 \uB0B4\uC6A9\uC744 \uCD9C\uB825\uD558\uC138\uC694.
4. \uD56D\uC0C1 \uD55C\uAD6D\uC5B4. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC.
${o?`
[\uCC38\uACE0 \uB9E5\uB77D]
${o}`:""}`,a=this.getEditorSelection(!0),c=t;a&&(c=`[\uBA85\uB839]
${t}

[\uC120\uD0DD\uB41C \uD14D\uC2A4\uD2B8]
${a}`);let u=this.callClaudeAuto(this.modelSelect.value,i,c,0,this.plugin.settings.tone,g=>{this.currentResult+=g,this.outputContent.setText(this.currentResult),this.outputContent.scrollTop=this.outputContent.scrollHeight},()=>{this.killProcess=null,this.outputContent.removeClass("cw-streaming"),this.setState("done")},g=>{this.killProcess=null,this.outputContent.removeClass("cw-streaming"),this.setState("error"),this.outputContent.setText(`\uC624\uB958: ${g}`)},!1);this.killProcess=u.kill}async saveConsoleCommand(t,e){if(!t.trim()||!e.trim()){new m.Notice("\uC774\uB984\uACFC \uBA85\uB839\uC744 \uBAA8\uB450 \uC785\uB825\uD574\uC8FC\uC138\uC694");return}let s=this.plugin.settings.savedCommands,n=s.findIndex(o=>o.name===t);n>=0?s[n].command=e:s.push({name:t,command:e}),await this.plugin.saveSettings(),new m.Notice(`\uCEE4\uB9E8\uB4DC \uC800\uC7A5: ${t}`),this.refreshSavedCommands()}async deleteConsoleCommand(t){this.plugin.settings.savedCommands=this.plugin.settings.savedCommands.filter(e=>e.name!==t),await this.plugin.saveSettings(),this.refreshSavedCommands()}refreshSavedCommands(){this.consoleSavedList.empty();let t=this.plugin.settings.savedCommands;if(t.length===0){this.consoleSavedList.createEl("p",{text:"\uC800\uC7A5\uB41C \uCEE4\uB9E8\uB4DC \uC5C6\uC74C",cls:"cw-console-empty"});return}for(let e of t){let s=this.consoleSavedList.createDiv({cls:"cw-console-saved-item"}),n=s.createEl("button",{text:e.name,cls:"cw-console-saved-name"});n.title=e.command,n.addEventListener("click",()=>{this.consoleInput.value=e.command,this.consoleInput.focus()}),s.createEl("button",{text:"\xD7",cls:"cw-console-saved-del"}).addEventListener("click",i=>{i.stopPropagation(),this.deleteConsoleCommand(e.name)})}}triggerAnswerQuestions(t){if(this.state==="processing"){new m.Notice("\uC774\uBBF8 \uCC98\uB9AC \uC911\uC785\uB2C8\uB2E4");return}let e=t.getValue(),{questions:s,title:n,author:o}=q(e),i=s.filter(a=>!a.answered);if(s.length===0){new m.Notice("\u2753 \uC9C8\uBB38\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. EPUB++ \uB3C5\uC11C\uB178\uD2B8\uC5D0\uC11C \uC0AC\uC6A9\uD558\uC138\uC694.");return}if(i.length===0){new m.Notice(`\u2705 \uBAA8\uB4E0 \uC9C8\uBB38\uC5D0 \uB2F5\uBCC0 \uC644\uB8CC (${s.length}\uAC74)`);return}new m.Notice(`\u2753 ${i.length}\uAC74 \uBBF8\uB2F5\uBCC0 \uBC1C\uACAC (\uC804\uCCB4 ${s.length}\uAC74). AI \uB2F5\uBCC0 \uC2DC\uC791...`),this.activeCommand="answer-questions",this.outputContent.empty(),this.outputContent.addClass("cw-streaming"),this.outputSection.removeClass("cw-hidden"),this.inputSection.addClass("cw-hidden"),this.setState("processing"),this.executeAnswerQuestions(t,i,n,o)}async executeAnswerQuestions(t,e,s,n){let o=this.plugin.settings.model,i=0,a=0,c=[...e].sort((d,g)=>g.lineIndex-d.lineIndex);for(let d of c){i++,this.outputContent.setText(`\u{1F916} AI \uB2F5\uBCC0 \uC0DD\uC131 \uC911... ${i}/${e.length}

\u2753 ${d.question}`);try{let w=`
> [!tip]- \u{1F916} AI \uB2F5\uBCC0
${(await this.callClaudeSync(o,s,n,d.passage,d.question)).split(`
`).map(S=>`> ${S}`).join(`
`)}`,E=t.getLine(d.lineIndex);t.replaceRange(w,{line:d.lineIndex,ch:E.length})}catch(g){a++;let f=`
> [!warning]- \u26A0\uFE0F AI \uC751\uB2F5 \uC2E4\uD328
> ${g.message||g}`,w=t.getLine(d.lineIndex);t.replaceRange(f,{line:d.lineIndex,ch:w.length})}}this.outputContent.removeClass("cw-streaming");let u=`\u2705 AI \uB2F5\uBCC0 \uC644\uB8CC: ${e.length-a}\uAC74 \uC131\uACF5`+(a>0?` / ${a}\uAC74 \uC2E4\uD328`:"");this.outputContent.setText(u),new m.Notice(u),this.setState("done")}callClaudeSync(t,e,s,n,o){return new Promise((i,a)=>{let c=G.replace("{TITLE}",e).replace("{AUTHOR}",s),u=`\u{1F4D6} \uC6D0\uBB38:
${n}

\u2753 \uC9C8\uBB38:
${o}`,d="",g=this.callClaudeAuto(t,c,u,0,"auto",f=>{d+=f},()=>{i(d.trim())},f=>{a(new Error(f))},!1);this.killProcess=g.kill})}buildUI(){let t=this.contentEl;t.empty(),t.addClass("cw-panel");let e=t.createDiv("cw-header"),s=e.createDiv("cw-title-row");s.createEl("span",{text:"Claude Writer",cls:"cw-title"}),this.headerStatusEl=s.createEl("span",{cls:"cw-status-badge"}),this.templateBadge=e.createDiv("cw-template-badge cw-hidden");let n=t.createDiv("cw-tone-bar");for(let h of $){let v=n.createEl("button",{text:h.label,cls:"cw-tone-btn",attr:{title:h.desc}});this.plugin.settings.tone===h.id&&v.addClass("cw-tone-active"),v.addEventListener("click",async()=>{this.toneBtns.forEach(b=>b.removeClass("cw-tone-active")),v.addClass("cw-tone-active"),this.plugin.settings.tone=h.id,await this.plugin.saveSettings()}),this.toneBtns.set(h.id,v)}let o=t.createDiv("cw-toolbar");this.modelSelect=o.createEl("select",{cls:"cw-select-sm"});for(let h of[{v:"haiku",l:"Haiku"},{v:"sonnet",l:"Sonnet"},{v:"opus",l:"Opus"}])this.modelSelect.createEl("option",{text:h.l,attr:{value:h.v}});this.modelSelect.value=this.plugin.settings.model,this.modelSelect.addEventListener("change",async()=>{this.plugin.settings.model=this.modelSelect.value,await this.plugin.saveSettings()}),this.contextBanner=t.createDiv("cw-context-banner cw-hidden");let i=this.contextBanner.createDiv("cw-context-banner-text"),a=this.contextBanner.createDiv("cw-context-banner-actions");a.createEl("button",{text:"\uD5C8\uB77D",cls:"cw-btn cw-btn-xs cw-btn-primary"}).addEventListener("click",()=>this.scanContext()),a.createEl("button",{text:"\uAC74\uB108\uB6F0\uAE30",cls:"cw-btn cw-btn-xs"}).addEventListener("click",()=>this.contextBanner.addClass("cw-hidden")),this.contextInfo=t.createDiv("cw-context-info cw-hidden"),this.cmdGrid=t.createDiv("cw-cmd-grid");let c=new Set(["custom","explain","visualize","answer-questions","console"]),u=k.filter(h=>!c.has(h.id));for(let h of u){let v=this.cmdGrid.createDiv({cls:"cw-cmd-btn",attr:{role:"button",tabindex:"0",title:h.desc}});v.createEl("span",{text:h.icon,cls:"cw-cmd-icon"}),v.createEl("span",{text:h.label,cls:"cw-cmd-label"}),v.addEventListener("click",()=>this.onCommandClick(h.id)),v.addEventListener("keydown",b=>{(b.key==="Enter"||b.key===" ")&&(b.preventDefault(),this.onCommandClick(h.id))}),this.actionBtns.set(h.id,v)}for(let h of["explain","visualize","custom"]){let v=k.find(ut=>ut.id===h),b=this.cmdGrid.createDiv({cls:"cw-cmd-btn cw-cmd-full",attr:{role:"button",tabindex:"0",title:v.desc}});b.createEl("span",{text:v.icon,cls:"cw-cmd-icon"}),b.createEl("span",{text:v.label,cls:"cw-cmd-label"}),b.addEventListener("click",()=>this.onCommandClick(h)),this.actionBtns.set(h,b)}{let h=k.find(b=>b.id==="answer-questions"),v=this.cmdGrid.createDiv({cls:"cw-cmd-btn cw-cmd-full cw-cmd-no-sel",attr:{role:"button",tabindex:"0",title:h.desc}});v.createEl("span",{text:h.icon,cls:"cw-cmd-icon"}),v.createEl("span",{text:h.label,cls:"cw-cmd-label"}),v.addEventListener("click",()=>this.onCommandClick("answer-questions")),this.actionBtns.set("answer-questions",v)}{let h=k.find(b=>b.id==="console"),v=this.cmdGrid.createDiv({cls:"cw-cmd-btn cw-cmd-full cw-cmd-no-sel cw-cmd-console",attr:{role:"button",tabindex:"0",title:h.desc}});v.createEl("span",{text:h.icon,cls:"cw-cmd-icon"}),v.createEl("span",{text:h.label,cls:"cw-cmd-label"}),v.addEventListener("click",()=>this.onCommandClick("console")),this.actionBtns.set("console",v)}this.selectionHint=t.createDiv("cw-selection-hint"),this.selectionHint.setText("\uD14D\uC2A4\uD2B8\uB97C \uC120\uD0DD\uD558\uBA74 \uBA85\uB839\uC744 \uC0AC\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4"),this.explainRow=t.createDiv("cw-explain-row cw-hidden"),this.explainRow.createEl("div",{text:"\uC124\uBA85 \uB808\uBCA8 \uC120\uD0DD",cls:"cw-section-label"});let d=this.explainRow.createDiv("cw-level-grid");for(let h of _){let v=d.createEl("button",{cls:"cw-level-btn",attr:{title:h.desc}});v.createEl("span",{text:String(h.level),cls:"cw-level-num"}),v.createEl("span",{text:h.label,cls:"cw-level-label"}),v.createEl("span",{text:h.desc,cls:"cw-level-desc"}),v.addEventListener("click",()=>{this.explainRow.addClass("cw-hidden"),this.executeExplain(h.level)})}this.explainRow.createDiv("cw-custom-actions").createEl("button",{text:"\uCDE8\uC18C",cls:"cw-btn"}).addEventListener("click",()=>this.explainRow.addClass("cw-hidden")),this.vizRow=t.createDiv("cw-viz-row cw-hidden"),this.vizRow.createEl("div",{text:"\uC2DC\uAC01\uD654 \uAE30\uBC95 \uCD94\uCC9C",cls:"cw-section-label"}),this.vizCards=this.vizRow.createDiv("cw-viz-cards"),this.vizRow.createDiv("cw-custom-actions").createEl("button",{text:"\uCDE8\uC18C",cls:"cw-btn"}).addEventListener("click",()=>{this.vizRow.addClass("cw-hidden"),this.setState("idle")}),this.customRow=t.createDiv("cw-custom-row cw-hidden"),this.customInput=this.customRow.createEl("textarea",{cls:"cw-custom-input",attr:{placeholder:"\uC9C0\uC2DC\uB97C \uC785\uB825\uD558\uC138\uC694... (Ctrl+Enter \uC2E4\uD589)",rows:"3"}});let w=this.customRow.createDiv("cw-custom-actions");w.createEl("button",{text:"\uC2E4\uD589",cls:"cw-btn cw-btn-primary"}).addEventListener("click",()=>this.onCustomRun()),w.createEl("button",{text:"\uCDE8\uC18C",cls:"cw-btn"}).addEventListener("click",()=>this.customRow.addClass("cw-hidden")),this.customInput.addEventListener("keydown",h=>{h.key==="Enter"&&(h.ctrlKey||h.metaKey)&&(h.preventDefault(),this.onCustomRun())}),this.consoleSection=t.createDiv("cw-console-section cw-hidden"),this.consoleSection.createEl("div",{text:"\u2328\uFE0F \uCEE4\uB9E8\uB4DC \uCF58\uC194",cls:"cw-section-label"}),this.consoleInput=this.consoleSection.createEl("textarea",{cls:"cw-console-input",attr:{placeholder:`\uBA85\uB839\uC744 \uC785\uB825\uD558\uC138\uC694...
\uC608: '\uD68C\uC758\uB85D \uC0C8\uB85C \uB9CC\uB4E4\uC5B4\uC918' / '\uC774 \uBB38\uC11C \uC694\uC57D\uD574\uC11C \uC0C8 \uB178\uD2B8\uB85C' / '\uD504\uB85C\uC81D\uD2B8 \uD604\uD669 \uC815\uB9AC'
Ctrl+Enter\uB85C \uC2E4\uD589`,rows:"4"}});let E=this.consoleSection.createDiv("cw-console-actions");E.createEl("button",{text:"\u25B6 \uC2E4\uD589",cls:"cw-btn cw-btn-primary"}).addEventListener("click",()=>this.executeConsoleCommand(this.consoleInput.value));let S=E.createDiv("cw-console-save-row");this.consoleSaveNameInput=S.createEl("input",{cls:"cw-console-save-name",attr:{placeholder:"\uCEE4\uB9E8\uB4DC \uC774\uB984",type:"text"}}),S.createEl("button",{text:"\u{1F4BE} \uC800\uC7A5",cls:"cw-btn cw-btn-xs"}).addEventListener("click",()=>{this.saveConsoleCommand(this.consoleSaveNameInput.value,this.consoleInput.value),this.consoleSaveNameInput.value=""}),E.createEl("button",{text:"\uB2EB\uAE30",cls:"cw-btn"}).addEventListener("click",()=>{this.consoleSection.addClass("cw-hidden"),this.setState("idle")}),this.consoleInput.addEventListener("keydown",h=>{h.key==="Enter"&&(h.ctrlKey||h.metaKey)&&(h.preventDefault(),this.executeConsoleCommand(this.consoleInput.value))}),this.consoleSection.createEl("div",{text:"\uC800\uC7A5\uB41C \uCEE4\uB9E8\uB4DC",cls:"cw-section-label cw-console-saved-label"}),this.consoleSavedList=this.consoleSection.createDiv("cw-console-saved-list"),this.inputSection=t.createDiv("cw-section cw-hidden"),this.inputSection.createEl("div",{text:"\uC6D0\uBCF8",cls:"cw-section-label"}),this.originalSummary=this.inputSection.createDiv("cw-original-summary"),this.outputSection=t.createDiv("cw-section cw-hidden"),this.outputSection.createDiv("cw-output-header").createEl("div",{text:"\uACB0\uACFC",cls:"cw-section-label"}),this.outputContent=this.outputSection.createDiv("cw-text-box cw-result");let C=this.outputSection.createDiv("cw-action-row cw-hidden");this.applyBtn=C.createEl("button",{text:"\uB300\uCCB4",cls:"cw-btn cw-btn-primary",attr:{title:"\uC120\uD0DD \uC601\uC5ED\uC744 \uACB0\uACFC\uB85C \uAD50\uCCB4"}}),this.insertBelowBtn=C.createEl("button",{text:"\uBC14\uB85C \uC544\uB798",cls:"cw-btn",attr:{title:"\uC120\uD0DD \uC601\uC5ED \uBC14\uB85C \uC544\uB798\uC5D0 \uC0BD\uC785"}}),this.insertCalloutBtn=C.createEl("button",{text:"\uCF5C\uC544\uC6C3",cls:"cw-btn",attr:{title:"> [!info] \uD3BC\uCE58\uAE30 \uBE14\uB85D\uC73C\uB85C \uC0BD\uC785"}}),this.insertLinkBtn=C.createEl("button",{text:"\uC0C8 \uB178\uD2B8",cls:"cw-btn",attr:{title:"\uC0C8 \uB178\uD2B8 \uC0DD\uC131 + \uC704\uD0A4\uB9C1\uD06C \uC0BD\uC785"}}),this.appendBtn=C.createEl("button",{text:"\uBB38\uC11C \uB05D",cls:"cw-btn",attr:{title:"\uBB38\uC11C \uB9E8 \uB05D\uC5D0 \uCD94\uAC00"}}),this.copyBtn=C.createEl("button",{text:"\uBCF5\uC0AC",cls:"cw-btn"}),this.dismissBtn=C.createEl("button",{text:"\uB2EB\uAE30",cls:"cw-btn"}),this.cancelBtn=C.createEl("button",{text:"\uC911\uB2E8",cls:"cw-btn cw-btn-danger"}),this.retryBtn=C.createEl("button",{text:"\uB2E4\uC2DC \uC2DC\uB3C4",cls:"cw-btn cw-btn-primary"}),this.applyBtn.addEventListener("click",()=>this.applyResult()),this.insertBelowBtn.addEventListener("click",()=>this.insertBelow()),this.insertCalloutBtn.addEventListener("click",()=>this.insertAsCallout()),this.insertLinkBtn.addEventListener("click",()=>this.insertAsLinkedNote()),this.appendBtn.addEventListener("click",()=>this.appendResult()),this.copyBtn.addEventListener("click",()=>{navigator.clipboard.writeText(this.currentResult),new m.Notice("\uD074\uB9BD\uBCF4\uB4DC\uC5D0 \uBCF5\uC0AC\uB428")}),this.dismissBtn.addEventListener("click",()=>{this.setState("idle"),new m.Notice("\uACB0\uACFC \uB2EB\uD798 \u2014 \uC6D0\uBB38 \uC720\uC9C0")}),this.cancelBtn.addEventListener("click",()=>{this.forceKill(),this.setState("idle")}),this.retryBtn.addEventListener("click",()=>{this.isExplainMode?this.explainRow.removeClass("cw-hidden"):this.executeCommand(this.activeCommand)});let y=t.createEl("details",{cls:"cw-account-details"}),p=y.createEl("summary",{cls:"cw-account-summary"});this.accountEmailEl=p.createEl("span",{text:"\uD655\uC778 \uC911...",cls:"cw-account-email"}),this.accountPlanEl=p.createEl("span",{text:"",cls:"cw-account-plan"});let x=y.createDiv("cw-account-body");x.createEl("button",{text:"\u21BB \uC0C8\uB85C\uACE0\uCE68",cls:"cw-btn cw-btn-xs"}).addEventListener("click",()=>this.refreshAuth()),x.createEl("button",{text:"\uB85C\uADF8\uC544\uC6C3",cls:"cw-btn cw-btn-xs"}).addEventListener("click",()=>this.handleLogout()),x.createEl("button",{text:"\uB85C\uADF8\uC778",cls:"cw-btn cw-btn-xs cw-btn-primary"}).addEventListener("click",()=>this.handleLogin())}onDocumentChanged(t){let e=t.file;if(!(!e||e.path===this.currentDocPath)){if(this.currentDocPath=e.path,this.currentTemplate=tt(this.app,e.path),this.currentTemplate){if(this.templateBadge.removeClass("cw-hidden"),this.templateBadge.setText(`\u{1F4CB} ${this.currentTemplate}`),this.plugin.settings.tone==="auto"){let{TEMPLATE_PROMPTS:s}=(et(),it(dt)),n=s[this.currentTemplate];if(n){this.toneBtns.forEach(i=>i.removeClass("cw-tone-active"));let o=this.toneBtns.get(n.tone);o&&o.addClass("cw-tone-active"),this.modelSelect.value=n.model}}}else this.templateBadge.addClass("cw-hidden");if(this.contextCache.has(e.path))this.contextBanner.addClass("cw-hidden"),this.showContextInfo(e.path);else{this.contextBanner.removeClass("cw-hidden");let s=this.contextBanner.querySelector(".cw-context-banner-text");s&&s.setText(`\u{1F4C4} "${e.basename}" \u2014 \uB9E5\uB77D\uC744 \uD30C\uC545\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`)}}}async scanContext(){this.contextBanner.addClass("cw-hidden"),this.contextInfo.removeClass("cw-hidden"),this.contextInfo.setText("\u{1F50D} \uB9E5\uB77D \uD30C\uC545 \uC911... 0%");let t=this.app.workspace.getActiveFile();if(!t)return;let e=t.path;this.scanAbortPath=e;try{let s=await this.app.vault.cachedRead(t),n=L(s);if(this.scanAbortPath!==e)return;this.contextInfo.setText("\u{1F50D} \uD604\uC7AC \uBB38\uC11C \uBD84\uC11D... 10%");let o=this.extractLinks(s),i=[],a=await Promise.all(o.map(async p=>{let x=this.app.metadataCache.getFirstLinkpathDest(p,t.path);if(!x)return null;let h=await this.app.vault.cachedRead(x);return{path:x.path,content:L(h)}}));for(let p of a)p&&i.push(p);if(this.scanAbortPath!==e)return;this.contextInfo.setText(`\u{1F50D} 1\uB2E8\uACC4 ${i.length}\uAC1C \uC644\uB8CC... 40%`);let c=new Set([t.basename,...o]),u=[];for(let p of i)for(let x of this.extractLinks(p.content))c.has(x)||(c.add(x),u.push(x));let d=[],g=await Promise.all(u.slice(0,10).map(async p=>{let x=this.app.metadataCache.getFirstLinkpathDest(p,t.path);if(!x)return null;let h=await this.app.vault.cachedRead(x);return{path:x.path,content:L(h)}}));for(let p of g)p&&d.push(p);if(this.scanAbortPath!==e)return;this.contextInfo.setText(`\u{1F50D} 2\uB2E8\uACC4 ${d.length}\uAC1C \uC644\uB8CC... 65%`);let f=[];for(let p of d)for(let x of this.extractLinks(p.content))c.has(x)||(c.add(x),f.push(x));let w=[],E=await Promise.all(f.slice(0,5).map(async p=>{let x=this.app.metadataCache.getFirstLinkpathDest(p,t.path);if(!x)return null;let h=await this.app.vault.cachedRead(x);return{path:x.path,content:L(h)}}));for(let p of E)p&&w.push(p);if(this.scanAbortPath!==e)return;let S=(p,x)=>p.length>x?p.slice(0,x)+"...":p,C=`[\uD604\uC7AC: ${t.basename}]
${S(n,2e3)}

`;for(let p of i)C+=`[1\uB2E8\uACC4: ${p.path}]
${S(p.content,500)}

`;for(let p of d)C+=`[2\uB2E8\uACC4: ${p.path}]
${S(p.content,300)}

`;for(let p of w)C+=`[3\uB2E8\uACC4: ${p.path}]
${S(p.content,200)}

`;this.contextCache.set(e,C);let y=1+i.length+d.length+w.length;this.contextInfo.setText(`\u2705 \uB9E5\uB77D \uD30C\uC545 \uC644\uB8CC (100%) \u2014 ${i.length}(1\uB2E8\uACC4) + ${d.length}(2\uB2E8\uACC4) + ${w.length}(3\uB2E8\uACC4) = \uCD1D ${y}\uAC1C`)}catch(s){this.contextInfo.setText(`\u274C \uC2E4\uD328: ${s.message}`)}}showContextInfo(t){let e=this.contextCache.get(t);if(e){this.contextInfo.removeClass("cw-hidden");let s=(e.match(/\[\d단계:/g)||[]).length;this.contextInfo.setText(`\u2705 \uCE90\uC2DC\uB428 \u2014 \uC5F0\uACB0 \uBB38\uC11C ${s}\uAC1C`)}}extractLinks(t){let e=new Set,s=/\[\[([^\]|#]+?)(?:\|[^\]]*?)?\]\]/g,n;for(;(n=s.exec(t))!==null;)e.add(n[1].trim());return[...e]}getEditorSelection(t=!1){let e=this.app.workspace.getActiveViewOfType(m.MarkdownView);if(e!=null&&e.editor){let n=e.editor.getSelection();if(n)return this.lastEditor={editor:e.editor,leaf:e.leaf},n}if(this.lastEditor)try{let n=this.lastEditor.editor.getSelection();if(n)return n}catch(n){}let s=this.app.workspace.getLeavesOfType("markdown");for(let n of s){let o=n.view;if(o!=null&&o.editor)try{let i=o.editor.getSelection();if(i)return this.lastEditor={editor:o.editor,leaf:n},i}catch(i){}}return null}buildUserPayload(t){if(!this.lastEditor||!this.savedFrom||!this.savedTo)return t;try{let e=this.lastEditor.editor,s=e.getValue(),n=0;for(let d=0;d<this.savedFrom.line;d++)n+=e.getLine(d).length+1;n+=this.savedFrom.ch;let o=0;for(let d=0;d<this.savedTo.line;d++)o+=e.getLine(d).length+1;o+=this.savedTo.ch;let i=500,a=s.slice(Math.max(0,n-i),n).trim(),c=s.slice(o,o+i).trim();if(!a&&!c)return t;let u="";return a&&(u+=`[\uC55E \uBB38\uB9E5]
${a}

`),u+=`[\uB300\uCCB4 \uB300\uC0C1]
${t}`,c&&(u+=`

[\uB4A4 \uBB38\uB9E5]
${c}`),u}catch(e){return t}}onCommandClick(t){if(this.state==="processing"){new m.Notice("\uC774\uBBF8 \uCC98\uB9AC \uC911\uC785\uB2C8\uB2E4");return}if(t==="console"){this.triggerConsole();return}if(t==="answer-questions"){let s=this.findMarkdownEditor();if(!s){new m.Notice("\uB9C8\uD06C\uB2E4\uC6B4 \uD30C\uC77C\uC744 \uC5F4\uC5B4\uC8FC\uC138\uC694");return}this.triggerAnswerQuestions(s);return}let e=this.getEditorSelection();if(!e){new m.Notice("\uD14D\uC2A4\uD2B8\uB97C \uC120\uD0DD\uD574\uC8FC\uC138\uC694");return}if(this.currentSelection=e,this.lastEditor&&(this.savedFrom=this.lastEditor.editor.getCursor("from"),this.savedTo=this.lastEditor.editor.getCursor("to")),t==="explain"){this.explainRow.removeClass("cw-hidden"),this.customRow.addClass("cw-hidden"),this.vizRow.addClass("cw-hidden");return}if(t==="visualize"){this.vizRow.addClass("cw-hidden"),this.explainRow.addClass("cw-hidden"),this.customRow.addClass("cw-hidden"),this.executeVisualizeSuggest();return}if(t==="custom"){this.showCustomInput();return}this.isExplainMode=!1,this.isVizMode=!1,this.executeCommand(t)}showCustomInput(){this.explainRow.addClass("cw-hidden"),this.customRow.removeClass("cw-hidden"),this.customInput.value="",this.customInput.focus()}executeExplain(t){this.isExplainMode=!0,this.activeCommand="explain",this.currentResult="";let e=_.find(a=>a.level===t),s=this.contextCache.get(this.currentDocPath),n=s?`${e.prompt}

[\uCC38\uACE0 \uB9E5\uB77D]
${s}`:e.prompt;this.originalSummary.setText(this.currentSelection.length>80?this.currentSelection.slice(0,80)+"...":this.currentSelection),this.inputSection.removeClass("cw-hidden"),this.outputContent.empty(),this.outputContent.addClass("cw-streaming"),this.outputSection.removeClass("cw-hidden"),this.actionBtns.forEach((a,c)=>a.toggleClass("cw-cmd-active",c==="explain")),this.setState("processing");let o=this.buildUserPayload(this.currentSelection),i=this.callClaudeAuto(this.modelSelect.value,n,o,this.plugin.settings.maxChars,this.plugin.settings.tone,a=>{this.currentResult+=a,this.outputContent.setText(this.currentResult),this.outputContent.scrollTop=this.outputContent.scrollHeight},()=>{this.killProcess=null,this.outputContent.removeClass("cw-streaming"),this.setState("done")},a=>{this.killProcess=null,this.outputContent.removeClass("cw-streaming"),this.setState("error"),this.outputContent.setText(`\uC624\uB958: ${a}`)},!1);this.killProcess=i.kill}executeVisualizeSuggest(){this.isVizMode=!0,this.isExplainMode=!1,this.activeCommand="visualize",this.currentResult="",this.originalSummary.setText(this.currentSelection.length>80?this.currentSelection.slice(0,80)+"...":this.currentSelection),this.inputSection.removeClass("cw-hidden"),this.outputContent.empty(),this.outputContent.addClass("cw-streaming"),this.outputContent.setText("\uC2DC\uAC01\uD654 \uAE30\uBC95 \uBD84\uC11D \uC911..."),this.outputSection.removeClass("cw-hidden"),this.actionBtns.forEach((s,n)=>s.toggleClass("cw-cmd-active",n==="visualize")),this.setState("processing");let t=this.buildUserPayload(this.currentSelection),e=this.callClaudeAuto("haiku",j,t,0,"auto",s=>{this.currentResult+=s},()=>{this.killProcess=null,this.outputContent.removeClass("cw-streaming"),this.parseVizSuggestions()},s=>{this.killProcess=null,this.outputContent.removeClass("cw-streaming"),this.setState("error"),this.outputContent.setText(`\uBD84\uC11D \uC2E4\uD328: ${s}`)},!1);this.killProcess=e.kill}parseVizSuggestions(){try{let t=this.currentResult.trim(),e=t.match(/\[[\s\S]*\]/);e&&(t=e[0]);let s=JSON.parse(t);if(!Array.isArray(s)||s.length===0)throw new Error("\uBE48 \uACB0\uACFC");this.vizCards.empty();for(let n of s.slice(0,3)){let o=this.vizCards.createDiv("cw-viz-card");o.createEl("span",{text:n.icon||"\u{1F4CA}",cls:"cw-viz-card-icon"});let i=o.createDiv("cw-viz-card-info");i.createEl("div",{text:n.name,cls:"cw-viz-card-name"}),i.createEl("div",{text:n.desc,cls:"cw-viz-card-desc"}),i.createEl("div",{text:n.type,cls:"cw-viz-card-type"}),o.addEventListener("click",()=>{this.vizRow.addClass("cw-hidden"),this.executeVisualizeGenerate(n.type,n.name)})}this.outputSection.addClass("cw-hidden"),this.vizRow.removeClass("cw-hidden"),this.setState("idle")}catch(t){this.outputContent.setText(`\uCD94\uCC9C \uD30C\uC2F1 \uC2E4\uD328: ${t.message}

\uC6D0\uBCF8:
${this.currentResult}`),this.setState("error")}}executeVisualizeGenerate(t,e){this.currentResult="",this.activeCommand="visualize";let s=U.replace("{TYPE}",t),n=this.contextCache.get(this.currentDocPath),o=n?`${s}

[\uCC38\uACE0 \uB9E5\uB77D]
${n}`:s,i=this.buildUserPayload(this.currentSelection);this.outputContent.empty(),this.outputContent.addClass("cw-streaming"),this.outputContent.setText(`${e} \uC0DD\uC131 \uC911...`),this.outputSection.removeClass("cw-hidden"),this.setState("processing");let a=this.callClaudeAuto(this.modelSelect.value,o,i,0,"auto",c=>{this.currentResult+=c,this.outputContent.setText(this.currentResult),this.outputContent.scrollTop=this.outputContent.scrollHeight},()=>{this.killProcess=null,this.outputContent.removeClass("cw-streaming"),this.isVizMode=!0,this.setState("done")},c=>{this.killProcess=null,this.outputContent.removeClass("cw-streaming"),this.setState("error"),this.outputContent.setText(`\uC0DD\uC131 \uC2E4\uD328: ${c}`)},!1);this.killProcess=a.kill}onCustomRun(){let t=this.customInput.value.trim();if(!t){new m.Notice("\uD504\uB86C\uD504\uD2B8\uB97C \uC785\uB825\uD574\uC8FC\uC138\uC694");return}this.customRow.addClass("cw-hidden"),this.currentResult="",this.activeCommand="custom",this.originalSummary.setText(this.currentSelection.length>80?this.currentSelection.slice(0,80)+"...":this.currentSelection),this.inputSection.removeClass("cw-hidden"),this.outputContent.empty(),this.outputContent.addClass("cw-streaming"),this.outputSection.removeClass("cw-hidden"),this.actionBtns.forEach((i,a)=>i.toggleClass("cw-cmd-active",a==="custom")),this.setState("processing");let e=this.contextCache.get(this.currentDocPath),s=e?`${t}

[\uB9E5\uB77D]
${e}`:t,n=this.buildUserPayload(this.currentSelection),o=this.callClaudeAuto(this.modelSelect.value,s,n,this.plugin.settings.maxChars,this.plugin.settings.tone,i=>{this.currentResult+=i,this.outputContent.setText(this.currentResult),this.outputContent.scrollTop=this.outputContent.scrollHeight},()=>{this.killProcess=null,this.outputContent.removeClass("cw-streaming"),this.setState("done")},i=>{this.killProcess=null,this.outputContent.removeClass("cw-streaming"),this.setState("error"),this.outputContent.setText(`\uC624\uB958: ${i}`)});this.killProcess=o.kill}executeCommand(t){var f;this.activeCommand=t,this.currentResult="";let{prompt:e,model:s,tone:n}=this.plugin.getEffectivePrompt(t,this.currentTemplate),o=e;if(t==="reconstruct"&&this.currentDocPath){let w=this.app.workspace.getActiveFile();if(w&&this.app.metadataCache.getFileCache(w)){let S=((f=this.app.vault.cache)==null?void 0:f[w.path])||""}}let i=this.contextCache.get(this.currentDocPath),a=i?`${o}

[\uCC38\uACE0 \uB9E5\uB77D]
${i}`:o;this.originalSummary.setText(this.currentSelection.length>80?this.currentSelection.slice(0,80)+"...":this.currentSelection),this.inputSection.removeClass("cw-hidden"),this.outputContent.empty(),this.outputContent.addClass("cw-streaming"),this.outputSection.removeClass("cw-hidden"),this.actionBtns.forEach((w,E)=>w.toggleClass("cw-cmd-active",E===t)),this.setState("processing");let c=t==="reconstruct"&&s?s:this.modelSelect.value,u=t==="reconstruct"&&n?n:this.plugin.settings.tone,d=this.buildUserPayload(this.currentSelection),g=this.callClaudeAuto(c,a,d,this.plugin.settings.maxChars,u,w=>{this.currentResult+=w,this.outputContent.setText(this.currentResult),this.outputContent.scrollTop=this.outputContent.scrollHeight},()=>{this.killProcess=null,this.outputContent.removeClass("cw-streaming"),this.setState("done")},w=>{this.killProcess=null,this.outputContent.removeClass("cw-streaming"),this.setState("error"),this.outputContent.setText(`\uC624\uB958: ${w}`)});this.killProcess=g.kill}applyResult(){if(!this.currentResult||!this.lastEditor){new m.Notice("\uC5D0\uB514\uD130\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4");return}let t=this.lastEditor.editor;this.savedFrom&&this.savedTo?t.replaceRange(this.currentResult,this.savedFrom,this.savedTo):t.replaceSelection(this.currentResult),new m.Notice("\uC801\uC6A9 \uC644\uB8CC"),this.setState("idle")}appendResult(){if(!this.currentResult||!this.lastEditor){new m.Notice("\uC5D0\uB514\uD130\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4");return}let t=this.lastEditor.editor,e=t.lastLine(),s=t.getLine(e);t.replaceRange(`

`+this.currentResult,{line:e,ch:s.length}),new m.Notice("\uBB38\uC11C \uB05D\uC5D0 \uCD94\uAC00 \uC644\uB8CC"),this.setState("idle")}insertBelow(){if(!this.currentResult||!this.lastEditor){new m.Notice("\uC5D0\uB514\uD130\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4");return}let t=this.lastEditor.editor,e=this.savedTo?this.savedTo.line:t.getCursor().line,s=t.getLine(e);t.replaceRange(`

`+this.currentResult,{line:e,ch:s.length}),new m.Notice("\uC120\uD0DD \uC601\uC5ED \uC544\uB798\uC5D0 \uC0BD\uC785 \uC644\uB8CC"),this.setState("idle")}insertAsCallout(){if(!this.currentResult||!this.lastEditor){new m.Notice("\uC5D0\uB514\uD130\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4");return}let t=this.lastEditor.editor,e=this.currentSelection.length>30?this.currentSelection.slice(0,30)+"...":this.currentSelection,s=this.currentResult.split(`
`).map(a=>"> "+a).join(`
`),n=`

> [!info]- ${e}
${s}
`,o=this.savedTo?this.savedTo.line:t.getCursor().line,i=t.getLine(o);t.replaceRange(n,{line:o,ch:i.length}),new m.Notice("\uCF5C\uC544\uC6C3\uC73C\uB85C \uC0BD\uC785 \uC644\uB8CC"),this.setState("idle")}async insertAsLinkedNote(){if(!this.currentResult){new m.Notice("\uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4");return}let e=`${this.currentSelection.slice(0,40).replace(/[\\/:*?"<>|#^[\]]/g,"").trim()} (\uC124\uBA85)`,s=`3_Resources/${e}.md`,o=`---
tags: [\uC124\uBA85, \uC790\uB3D9\uC0DD\uC131]
created: ${new Date().toISOString().slice(0,10)}
modified: ${new Date().toISOString().slice(0,10)}
status: reference
category: resource
template: \uD30C\uC778\uB9CC-\uB178\uD2B8
device: home
---

`+this.currentResult;try{if(this.app.vault.getAbstractFileByPath(s)?new m.Notice(`\uC774\uBBF8 \uC874\uC7AC: ${s}`):await this.app.vault.create(s,o),this.lastEditor){let a=this.lastEditor.editor,c=this.savedTo?this.savedTo.line:a.getCursor().line,u=a.getLine(c);a.replaceRange(` [[${e}]]`,{line:c,ch:u.length})}new m.Notice(`\uC0C8 \uB178\uD2B8 \uC0DD\uC131 + \uB9C1\uD06C \uC0BD\uC785: ${e}`)}catch(i){new m.Notice(`\uC2E4\uD328: ${i.message}`)}this.setState("idle")}async refreshAuth(){this.accountEmailEl.setText("\uD655\uC778 \uC911..."),this.accountPlanEl.setText("");try{let t=await Y(this.plugin.getClaudePath());t.loggedIn?(this.accountEmailEl.setText(t.email),this.accountPlanEl.setText(t.subscriptionType.toUpperCase()),this.accountPlanEl.className="cw-account-plan cw-plan-active"):(this.accountEmailEl.setText("\uB85C\uADF8\uC778 \uD544\uC694"),this.accountPlanEl.className="cw-account-plan")}catch(t){this.accountEmailEl.setText("\uD655\uC778 \uC2E4\uD328")}}async handleLogout(){try{await K(this.plugin.getClaudePath()),new m.Notice("\uB85C\uADF8\uC544\uC6C3 \uC644\uB8CC"),this.refreshAuth()}catch(t){new m.Notice(`\uC2E4\uD328: ${t.message}`)}}async handleLogin(){new m.Notice("\uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uB85C\uADF8\uC778 \uD398\uC774\uC9C0\uAC00 \uC5F4\uB9BD\uB2C8\uB2E4...");try{await Q(this.plugin.getClaudePath()),new m.Notice("\uB85C\uADF8\uC778 \uC131\uACF5!"),this.refreshAuth()}catch(t){new m.Notice(`\uC2E4\uD328: ${t.message}`)}}setState(t){this.state=t;let e=this.headerStatusEl;e.empty(),e.className="cw-status-badge";let s=this.outputSection.querySelector(".cw-action-row"),n=i=>i.style.display="none",o=i=>i.style.display="";switch(t){case"idle":e.setText("\uB300\uAE30"),e.addClass("cw-badge-idle"),this.inputSection.addClass("cw-hidden"),this.outputSection.addClass("cw-hidden"),this.consoleSection.addClass("cw-hidden"),this.actionBtns.forEach(i=>i.removeClass("cw-cmd-active"));break;case"processing":e.setText("\u23F3 \uCC98\uB9AC \uC911..."),e.addClass("cw-badge-processing"),s&&(s.removeClass("cw-hidden"),n(this.applyBtn),n(this.insertBelowBtn),n(this.insertCalloutBtn),n(this.insertLinkBtn),n(this.appendBtn),n(this.copyBtn),n(this.dismissBtn),n(this.retryBtn),o(this.cancelBtn));break;case"done":e.setText("\uC644\uB8CC"),e.addClass("cw-badge-done"),s&&(s.removeClass("cw-hidden"),n(this.cancelBtn),n(this.retryBtn),o(this.applyBtn),o(this.insertBelowBtn),o(this.insertCalloutBtn),o(this.insertLinkBtn),o(this.appendBtn),o(this.copyBtn),o(this.dismissBtn));break;case"error":e.setText("\uC624\uB958"),e.addClass("cw-badge-error"),s&&(s.removeClass("cw-hidden"),n(this.applyBtn),n(this.insertBelowBtn),n(this.insertCalloutBtn),n(this.insertLinkBtn),n(this.appendBtn),n(this.copyBtn),n(this.cancelBtn),o(this.dismissBtn),o(this.retryBtn));break}}}});var dt={};gt(dt,{ANSWER_QUESTION_PROMPT:()=>G,COMMANDS:()=>k,DEFAULT_SETTINGS:()=>st,EXPLAIN_LEVELS:()=>_,READING_NOTE_PROMPT:()=>St,TEMPLATE_PROMPTS:()=>M,TONES:()=>$,VIZ_GENERATE_PROMPT:()=>U,VIZ_SUGGEST_PROMPT:()=>j,callClaude:()=>X,callClaudeMobile:()=>J,claudeAuthLogin:()=>Q,claudeAuthLogout:()=>K,default:()=>F,detectTemplate:()=>tt,extractSectionHeaders:()=>yt,extractUsefulContent:()=>L,getAuthStatus:()=>Y,isMobile:()=>Z,parseQuestions:()=>q});module.exports=it(dt);function q(l){let r=l.split(`
`),t="Unknown",e="Unknown";for(let o of r){let i=o.match(/^#\s+(.+?)\s*—\s*독서\s*하이라이트/);i&&(t=i[1].trim());let a=o.match(/^>\s*📚\s+(.+?)\s*\|/);a&&(e=a[1].trim())}let s=l.match(/tags:\s*\[독서노트,\s*(.+?)(?:,\s*(.+?))?\]/);s&&(t==="Unknown"&&s[1]&&(t=s[1].trim()),e==="Unknown"&&s[2]&&(e=s[2].trim()));let n=[];for(let o=0;o<r.length;o++){let i=r[o].match(/^>\s*❓\s*\*\*(.+?)\*\*/);if(!i)continue;let a=i[1],c="";for(let d=o-1;d>=0;d--){let g=r[d];if(g.match(/^>\s*\[!quote\]/)||!g.startsWith(">"))break;let f=g.replace(/^>\s*/,"").trim();f&&!f.startsWith("\u2014")&&!f.startsWith("\u2753")&&(c=f+(c?`
`+c:""))}let u=!1;for(let d=o+1;d<r.length&&d<=o+5;d++){let g=r[d].trim();if(g!==""){g.match(/^>\s*\[!tip\].*AI\s*답변/)&&(u=!0);break}}n.push({lineIndex:o,question:a,passage:c,answered:u})}return{questions:n,title:t,author:e}}function N(){let l={...process.env};return delete l.CLAUDECODE,l}function Y(l){return new Promise(r=>{let{spawn:t}=require("child_process"),e=t(l,["auth","status"],{shell:!0,env:N(),stdio:["pipe","pipe","pipe"]}),s="";e.stdout.on("data",n=>{s+=n.toString()}),e.on("close",()=>{try{let n=JSON.parse(s);r({loggedIn:n.loggedIn||!1,email:n.email||"",subscriptionType:n.subscriptionType||""})}catch(n){let o=s.includes("logged in")||s.includes("Logged in"),i=s.match(/[\w.+-]+@[\w-]+\.[a-z]+/i);r({loggedIn:o,email:(i==null?void 0:i[0])||"",subscriptionType:""})}}),e.on("error",()=>r({loggedIn:!1,email:"",subscriptionType:""}))})}function K(l){return new Promise((r,t)=>{let{spawn:e}=require("child_process"),s=e(l,["auth","logout"],{shell:!0,env:N(),stdio:["pipe","pipe","pipe"]});s.on("close",n=>n===0?r():t(new Error(`exit ${n}`))),s.on("error",t)})}function Q(l){return new Promise((r,t)=>{let{spawn:e}=require("child_process"),s=e(l,["auth","login"],{shell:!0,env:N(),stdio:["pipe","pipe","pipe"]}),n="";s.stdout.on("data",i=>{n+=i.toString()}),s.stderr.on("data",i=>{n+=i.toString()});let o=setTimeout(()=>{s.kill(),t(new Error("\uB85C\uADF8\uC778 \uD0C0\uC784\uC544\uC6C3 (120\uCD08). \uBE0C\uB77C\uC6B0\uC800\uC5D0\uC11C \uB85C\uADF8\uC778\uC744 \uC644\uB8CC\uD574\uC8FC\uC138\uC694."))},12e4);s.on("close",i=>{clearTimeout(o),i===0?r(n):t(new Error(`Login failed (${i})
${n}`))}),s.on("error",i=>{clearTimeout(o),t(i)})})}function X(l,r,t,e,s,n,o,i,a,c=!0){var v;let g=c?`You are a text replacement tool. Rules:
1. Output ONLY the replacement for the [\uB300\uCCB4 \uB300\uC0C1] section.
2. Consider [\uC55E \uBB38\uB9E5] and [\uB4A4 \uBB38\uB9E5] for tone, flow, and coherence \u2014 but NEVER output them.
3. The result must read naturally when placed between the surrounding context.
4. No preamble, no explanation, no code block wrapping. Raw replacement text only.`:`You are an expert educator. Explain the [\uB300\uCCB4 \uB300\uC0C1] text so the reader fully understands it.
Use [\uC55E \uBB38\uB9E5] and [\uB4A4 \uBB38\uB9E5] to understand the domain \u2014 but NEVER output them.
Cover: background, core principles, relationships between components, and real-world implications.`,f=n&&n!=="auto"?`
[\uD1A4: ${((v=$.find(b=>b.id===n))==null?void 0:v.instruction)||""}]`:"",w=s>0?`
\uB2F5\uBCC0\uC740 ${s}\uC790 \uC774\uB0B4\uB85C \uC81C\uD55C.`:"",E=`${g}

${t}${f}${w}

---

${e}`,S=N(),{spawn:C}=require("child_process"),y=r==="opus"?18e4:r==="sonnet"?12e4:6e4,p=C(l,["-p","--output-format","text","--model",r,"--no-session-persistence","--effort","low"],{shell:!0,env:S,stdio:["pipe","pipe","pipe"]}),x="";p.stdout.on("data",b=>o(b.toString())),p.stderr.on("data",b=>{x+=b.toString()});let h=setTimeout(()=>{p.kill(),a(`\uD0C0\uC784\uC544\uC6C3 (${y/1e3}\uCD08)`)},y);return p.on("close",b=>{clearTimeout(h),b!==0?a(`CLI \uC885\uB8CC ${b}: ${x}`):i()}),p.on("error",b=>{clearTimeout(h),a(`\uC2E4\uD589 \uC624\uB958: ${b.message}`)}),p.stdin?(p.stdin.write(E),p.stdin.end()):(clearTimeout(h),p.kill(),a("stdin not available")),{kill:()=>{clearTimeout(h),p.kill()}}}function J(l,r,t,e,s,n,o,i,a,c=!0){var C;let g=c?`You are a text replacement tool. Rules:
1. Output ONLY the replacement for the [\uB300\uCCB4 \uB300\uC0C1] section.
2. Consider [\uC55E \uBB38\uB9E5] and [\uB4A4 \uBB38\uB9E5] for tone, flow, and coherence \u2014 but NEVER output them.
3. The result must read naturally when placed between the surrounding context.
4. No preamble, no explanation, no code block wrapping. Raw replacement text only.`:`You are an expert educator. Explain the [\uB300\uCCB4 \uB300\uC0C1] text so the reader fully understands it.
Use [\uC55E \uBB38\uB9E5] and [\uB4A4 \uBB38\uB9E5] to understand the domain \u2014 but NEVER output them.
Cover: background, core principles, relationships between components, and real-world implications.`,f=n&&n!=="auto"?`
[\uD1A4: ${((C=$.find(y=>y.id===n))==null?void 0:C.instruction)||""}]`:"",w=s>0?`
\uB2F5\uBCC0\uC740 ${s}\uC790 \uC774\uB0B4\uB85C \uC81C\uD55C.`:"",E=`${g}

${t}${f}${w}

---

${e}`,S=!1;return(async()=>{try{let y=await(0,T.requestUrl)({url:`${l}/ask`,method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt:E,model:r,timeout:r==="opus"?18e4:r==="sonnet"?12e4:6e4})});if(S)return;let p=y.json;p.error?a(p.error):(o(p.response||""),i())}catch(y){S||a(`Bridge \uC5F0\uACB0 \uC2E4\uD328: ${y.message}
Termux\uC5D0\uC11C bridge.mjs\uAC00 \uC2E4\uD589 \uC911\uC778\uC9C0 \uD655\uC778\uD558\uC138\uC694.`)}})(),{kill:()=>{S=!0}}}function Z(){return T.Platform.isMobile}function tt(l,r){var s;let t=l.vault.getAbstractFileByPath(r);if(!t)return"";let e=l.metadataCache.getFileCache(t);return((s=e==null?void 0:e.frontmatter)==null?void 0:s.template)||""}function yt(l){return(l.match(/^##+ .+/gm)||[]).slice(0,15)}function L(l){let r=l.replace(/^---[\s\S]*?---\n?/,"");return r=r.replace(/\[\[.*?\|←.*?\]\]/g,""),r=r.replace(/^##[^\n]+\n+(?=##|\s*$)/gm,""),r.trim().slice(0,1500)}var T,M,k,_,j,U,St,G,st,$,F,nt,et=H(()=>{T=require("obsidian");lt();M={\uD68C\uC758\uB85D:{prompt:`\uD68C\uC758\uB85D \uC791\uC131 \uC804\uBB38\uAC00\uC785\uB2C8\uB2E4. \uC6D0\uBB38(\uD604\uC7A5 \uBA54\uBAA8/\uB2E8\uD3B8\uC801 \uD0A4\uC6CC\uB4DC)\uC744 \uC644\uC131\uB41C \uD68C\uC758\uB85D\uC73C\uB85C \uBCC0\uD658\uD558\uC138\uC694.
\uAD6C\uC870: ## \uAE30\uBCF8\uC815\uBCF4(\uC77C\uC2DC/\uCC38\uC11D\uC790/\uC7A5\uC18C) \u2192 ## \uC548\uAC74 \u2192 ## \uACB0\uC815 \uC0AC\uD56D \u2192 ## Action Items \u2192 ## \uBA54\uBAA8
Action Items\uC740 '- [ ] [\uB0B4\uC6A9] \u{1F4C5} YYYY-MM-DD' \uD615\uC2DD. \uC5C5\uACC4 \uC57D\uC5B4\uB294 \uADF8\uB300\uB85C \uC720\uC9C0. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC.`,model:"sonnet",tone:"\uACA9\uC2DD\uCCB4-\uBCF4\uACE0"},\uC5C5\uBB34\uBCF4\uACE0:{prompt:`\uC5C5\uBB34\uBCF4\uACE0\uC11C \uC791\uC131. Executive Summary 3\uC904 \uC774\uB0B4. \uD604\uD669 \uB9C8\uD06C\uB2E4\uC6B4 \uD45C. \uC774\uC288\uB294 \uC601\uD5A5\uB3C4(H/M/L) \uD3EC\uD568. \uD569\uB2C8\uB2E4/\uC2B5\uB2C8\uB2E4 \uACA9\uC2DD\uCCB4.
Action Items\uC740 '- [ ] [\uB0B4\uC6A9] \u{1F4C5} YYYY-MM-DD' \uD615\uC2DD. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC.`,model:"sonnet",tone:"\uACA9\uC2DD\uCCB4-\uBCF4\uACE0"},\uC0C8\uD504\uB85C\uC81D\uD2B8:{prompt:"\uD504\uB85C\uC81D\uD2B8 \uACC4\uD68D\uC11C \uC791\uC131. \uD504\uB85C\uC81D\uD2B8\uBA85, \uBAA9\uD45C, \uB9C8\uAC10, \uB2F4\uB2F9\uC790 \uAD6C\uC870\uD654. \uC774\uC288 \uD14C\uC774\uBE14 \uD3EC\uD568. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC.",model:"sonnet",tone:"\uACA9\uC2DD\uCCB4-\uBCF4\uACE0"},\uAE30\uC220\uB178\uD2B8:{prompt:"\uAE30\uC220 \uB9AC\uC11C\uCE58 \uB178\uD2B8 \uC791\uC131. ## \uAC1C\uC694 \u2192 ## \uD575\uC2EC \uB0B4\uC6A9 \u2192 ## \uAD00\uB828 \uBB38\uC11C \u2192 ## \uCC38\uACE0 \uC790\uB8CC. \uC804\uBB38 \uAE30\uC220 \uC6A9\uC5B4 \uC815\uD655\uD788. \uD55C\uAD6D\uC5B4 \uC124\uBA85 + \uC601\uC5B4 \uAE30\uC220 \uC6A9\uC5B4 \uBCD1\uAE30. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC.",model:"haiku",tone:"\uC804\uBB38\uAE30\uC220"},"\uCF58\uD150\uCE20-\uAE30\uD68D":{prompt:"YouTube/Instagram \uCF58\uD150\uCE20 \uAE30\uD68D \uBB38\uC11C. \uD6C5(Hook, 7\uCD08 \uC774\uB0B4) \u2192 \uAD6C\uC870 \u2192 \uB300\uBCF8/\uC2A4\uD06C\uB9BD\uD2B8 \u2192 \uD37C\uBE14\uB9AC\uC2F1 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8. \uC1FC\uCE20\uBA74 60\uCD08 \uC774\uB0B4 \uC2A4\uD06C\uB9BD\uD2B8. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC.",model:"sonnet",tone:"\uCF58\uD150\uCE20"},"\uD30C\uC778\uB9CC-\uB178\uD2B8":{prompt:"\uD30C\uC778\uB9CC \uAE30\uBC95\uC73C\uB85C \uAC1C\uB150 \uC815\uB9AC. Step1: \uCD08\uB4F1\uD559\uC0DD \uC218\uC900 \uC124\uBA85(\uBE44\uC720 \uD544\uC218) \u2192 Step2: \uB9C9\uD788\uB294 \uBD80\uBD84 \u2192 Step3: \uC7AC\uC124\uBA85 \u2192 Step4: \uD575\uC2EC \uBE44\uC720 1\uBB38\uC7A5. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC.",model:"haiku",tone:"\uC804\uBB38\uAE30\uC220"},"\uC758\uC0AC\uACB0\uC815-\uC800\uB110":{prompt:"\uC758\uC0AC\uACB0\uC815 \uBD84\uC11D \uAD6C\uC870\uD654. \uC544\uC774\uC820\uD558\uC6CC \uB9E4\uD2B8\uB9AD\uC2A4(Q1~Q4) \u2192 2\uCC28 \uC0AC\uACE0(1\uCC28/2\uCC28/3\uCC28 \uACB0\uACFC) \u2192 \uC5ED\uC0B0\uBC95(\uC2E4\uD328 \uC870\uAC74 3\uAC00\uC9C0) \u2192 \uC120\uD0DD\uC9C0 \uBE44\uAD50\uD45C \u2192 \uCD5C\uC885 \uD310\uB2E8. \uAC10\uC815 \uBC30\uC81C, \uB17C\uB9AC \uAE30\uBC18. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC.",model:"sonnet",tone:"\uBD84\uC11D\uC801"},\uC81C\uD154\uB178\uD2B8:{prompt:"\uD575\uC2EC \uC778\uC0AC\uC774\uD2B8 1\uAC74 \uCD94\uCD9C. \uB2E8\uC77C \uC544\uC774\uB514\uC5B4\uB97C \uBA85\uD655\uD558\uAC8C \uC815\uC81C. \uD575\uC2EC \uC8FC\uC7A5 1\uBB38\uC7A5 \u2192 \uADFC\uAC70 2~3\uAC1C \u2192 \uC5F0\uACB0 \uAC00\uB2A5\uD55C \uAC1C\uB150 \uD0DC\uADF8. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC.",model:"haiku",tone:"\uBD84\uC11D\uC801"},"\uB370\uC77C\uB9AC-\uBE0C\uB9AC\uD504":{prompt:"AI/\uAE30\uC220 \uB370\uC77C\uB9AC \uBE0C\uB9AC\uD551 \uC791\uC131. \uD575\uC2EC \uB274\uC2A4 3~5\uAC1C \uBD88\uB9BF. \uAC01\uAC01 \uD55C \uC904 \uC694\uC57D + \uC784\uD329\uD2B8. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC.",model:"haiku",tone:"\uCF58\uD150\uCE20"},"SQ3R-\uB3C5\uC11C\uB178\uD2B8":{prompt:"SQ3R \uB3C5\uC11C\uBC95\uC73C\uB85C \uC815\uB9AC. Survey(\uD6D1\uC5B4\uBCF4\uAE30) \u2192 Question(\uC9C8\uBB38) \u2192 Read(\uC77D\uAE30 \uD575\uC2EC) \u2192 Recite(\uC694\uC57D) \u2192 Review(\uBCF5\uC2B5 \uD3EC\uC778\uD2B8). \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC.",model:"haiku",tone:"\uC804\uBB38\uAE30\uC220"},"GTD-\uC8FC\uAC04\uB9AC\uBDF0":{prompt:"GTD \uC8FC\uAC04 \uB9AC\uBDF0 \uAD6C\uC870\uD654. Inbox \uC815\uB9AC \u2192 \uD504\uB85C\uC81D\uD2B8 \uD604\uD669 \u2192 \uB2E4\uC74C \uD589\uB3D9 \u2192 \uB300\uAE30 \uD56D\uBAA9 \u2192 \uC5B8\uC820\uAC00/\uC544\uB9C8\uB3C4. Action Items\uC740 '- [ ] [\uB0B4\uC6A9] \u{1F4C5} YYYY-MM-DD' \uD615\uC2DD. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC.",model:"sonnet",tone:"\uBD84\uC11D\uC801"}},k=[{id:"rewrite",name:"\uB2E4\uB4EC\uAE30 (Rewrite)",label:"\uB2E4\uB4EC\uAE30",icon:"\u270F\uFE0F",desc:"\uBB38\uCCB4\xB7\uBB38\uBC95 \uAC1C\uC120",prompt:"\uB2E4\uC74C \uD14D\uC2A4\uD2B8\uC758 \uBB38\uCCB4\uC640 \uBB38\uBC95\uC744 \uC790\uC5F0\uC2A4\uB7FD\uAC8C \uB2E4\uB4EC\uC5B4\uC918. \uC6D0\uB798 \uC758\uBBF8\uC640 \uD1A4 \uC720\uC9C0. \uB9C8\uD06C\uB2E4\uC6B4 \uC720\uC9C0. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC."},{id:"reconstruct",name:"\uAD6C\uC870\uD654 (Reconstruct)",label:"\uAD6C\uC870\uD654",icon:"\u{1F4D0}",desc:"\uD15C\uD50C\uB9BF\uC5D0 \uB9DE\uCDB0 \uC644\uC131",prompt:"\uB2E4\uC74C \uBA54\uBAA8/\uD0A4\uC6CC\uB4DC\uB97C \uAD6C\uC870\uD654\uB41C \uBB38\uC11C\uB85C \uC644\uC131\uD574\uC918. \uB9C8\uD06C\uB2E4\uC6B4 \uC720\uC9C0. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC."},{id:"summarize",name:"\uC694\uC57D (Summarize)",label:"\uC694\uC57D",icon:"\u{1F4CB}",desc:"\uD575\uC2EC \uBD88\uB9BF",prompt:"\uB2E4\uC74C \uD14D\uC2A4\uD2B8\uB97C \uD575\uC2EC\uB9CC \uAC04\uACB0\uD558\uAC8C \uC694\uC57D. \uBD88\uB9BF \uD3EC\uC778\uD2B8. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC."},{id:"translate-en",name:"\uD55C\u2192\uC601 (KR\u2192EN)",label:"\uD55C\u2192\uC601",icon:"\u{1F1FA}\u{1F1F8}",desc:"\uD55C\uAD6D\uC5B4\u2192\uC601\uC5B4",prompt:"\uB2E4\uC74C \uD55C\uAD6D\uC5B4 \uD14D\uC2A4\uD2B8\uB97C \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uC601\uC5B4\uB85C \uBC88\uC5ED. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC."},{id:"translate-kr",name:"\uC601\u2192\uD55C (EN\u2192KR)",label:"\uC601\u2192\uD55C",icon:"\u{1F1F0}\u{1F1F7}",desc:"\uC601\uC5B4\u2192\uD55C\uAD6D\uC5B4",prompt:"\uB2E4\uC74C \uC601\uC5B4 \uD14D\uC2A4\uD2B8\uB97C \uC790\uC5F0\uC2A4\uB7EC\uC6B4 \uD55C\uAD6D\uC5B4\uB85C \uBC88\uC5ED. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC."},{id:"formalize-en",name:"\uC601\uBB38\uBCF4\uACE0\uC11C\uD654 (Formalize EN)",label:"\uBCF4\uACE0\uC11C\uD654",icon:"\u{1F4C4}",desc:"KR\u2192EN \uAE30\uC220\uBCF4\uACE0\uC11C",prompt:`\uD55C\uAD6D\uC5B4 \uC790\uB3D9\uCC28 \uAE30\uC220 \uBB38\uC11C\uB97C \uC601\uBB38 \uAE30\uC220 \uBCF4\uACE0\uC11C\uB85C \uBCC0\uD658.
\uC804\uBB38 \uAE30\uC220 \uC6A9\uC5B4 \uC0AC\uC6A9. Formal, concise \uC2A4\uD0C0\uC77C.
\uC22B\uC790\xB7\uBD80\uD488\uBA85\xB7\uCF54\uB4DC\uB294 \uC815\uD655\uD788 \uBCF4\uC874. Executive Summary \u2192 Details \u2192 Action Items \uAD6C\uC870. \uC601\uC5B4\uB9CC \uCD9C\uB825. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC.`},{id:"insight",name:"\uC778\uC0AC\uC774\uD2B8 \uCD94\uCD9C (Insight)",label:"\uC778\uC0AC\uC774\uD2B8",icon:"\u{1F4A1}",desc:"\uC81C\uD154\uB178\uD2B8\uC6A9",prompt:"\uB2E4\uC74C \uD14D\uC2A4\uD2B8\uC5D0\uC11C \uD575\uC2EC \uC778\uC0AC\uC774\uD2B8 1\uAC74 \uCD94\uCD9C. \uD575\uC2EC \uC8FC\uC7A5 1\uBB38\uC7A5 \u2192 \uADFC\uAC70 2~3\uAC1C \u2192 \uC5F0\uACB0 \uD0DC\uADF8. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC."},{id:"explain",name:"\uD480\uC5B4\uC124\uBA85 (Explain)",label:"\uD480\uC5B4\uC124\uBA85",icon:"\u{1F50D}",desc:"\uB808\uBCA8\uBCC4 \uC2EC\uCE35 \uC124\uBA85",prompt:""},{id:"visualize",name:"\uC2DC\uAC01\uD654 (Visualize)",label:"\uC2DC\uAC01\uD654",icon:"\u{1F4CA}",desc:"\uC2DC\uAC01\uD654 \uAE30\uBC95 \uCD94\uCC9C+\uC0DD\uC131",prompt:""},{id:"custom",name:"\uC790\uC720 \uD504\uB86C\uD504\uD2B8 (Custom)",label:"\uC790\uC720",icon:"\u{1F4AC}",desc:"\uC9C1\uC811 \uC9C0\uC2DC",prompt:""},{id:"answer-questions",name:"\uB3C5\uC11C\uB178\uD2B8 AI \uB2F5\uBCC0 (Answer Questions)",label:"AI \uB2F5\uBCC0",icon:"\u2753",desc:"\uBBF8\uB2F5\uBCC0 \uC9C8\uBB38 \uC790\uB3D9 \uB2F5\uBCC0",prompt:""},{id:"vault-ops",name:"\uBCFC\uD2B8 \uB300\uC218\uC220 (Vault Ops)",label:"\uBCFC\uD2B8 Ops",icon:"\u{1F3D7}\uFE0F",desc:"PARA\u2192GTD+PARA \uC790\uB3D9 \uB9C8\uC774\uADF8\uB808\uC774\uC158",prompt:""},{id:"console",name:"\uCEE4\uB9E8\uB4DC \uCF58\uC194 (Command Console)",label:"\uCF58\uC194",icon:"\u2328\uFE0F",desc:"\uC790\uC720 \uBA85\uB839 \uC785\uB825 + \uBB38\uC11C \uC0DD\uC131/\uC791\uC5C5",prompt:""}],_=[{level:1,label:"\uCD08\uB4F1",desc:"\uBE44\uC720\uC640 \uC608\uC2DC \uC911\uC2EC",prompt:`\uCD08\uB4F1\uD559\uC0DD\uB3C4 \uC644\uC804\uD788 \uC774\uD574\uD560 \uC218 \uC788\uB3C4\uB85D \uD480\uC5B4 \uC124\uBA85\uD558\uC138\uC694.
- \uC5B4\uB824\uC6B4 \uB2E8\uC5B4\uB294 \uC26C\uC6B4 \uB9D0\uB85C \uBC14\uAFB8\uACE0, \uC77C\uC0C1 \uBE44\uC720 \uD544\uC218 ("\uC774\uAC74 \uB9C8\uCE58 ~\uC640 \uAC19\uC544\uC694")
- \uBC30\uACBD(\uC65C \uC911\uC694\uD55C\uC9C0) \u2192 \uC6D0\uB9AC(\uC5B4\uB5BB\uAC8C \uB418\uB294\uC9C0) \u2192 \uC26C\uC6B4 \uC608\uC2DC
- \uAD6C\uC131 \uC694\uC18C \uAC04 \uAD00\uACC4\uB97C \uADF8\uB9BC \uADF8\uB9AC\uB4EF \uC124\uBA85
- \uD55C\uAD6D\uC5B4. \uB9C8\uD06C\uB2E4\uC6B4 \uC0AC\uC6A9.`},{level:2,label:"\uC911\uACE0\uB4F1",desc:"\uAC1C\uB150\xB7\uC6D0\uB9AC \uC911\uC2EC",prompt:`\uC911\uACE0\uB4F1\uD559\uC0DD \uC218\uC900\uC73C\uB85C \uD480\uC5B4 \uC124\uBA85\uD558\uC138\uC694.
- \uD575\uC2EC \uAC1C\uB150 \uC815\uC758 \u2192 \uC791\uB3D9 \uC6D0\uB9AC \u2192 \uAD6C\uC131 \uC694\uC18C \uAD00\uACC4 \u2192 \uC2E4\uC0DD\uD65C \uC608\uC2DC
- \uC804\uBB38 \uC6A9\uC5B4\uB294 \uCC98\uC74C \uB4F1\uC7A5 \uC2DC \uAD04\uD638\uB85C \uD480\uC5B4\uC4F0\uAE30
- \uBC30\uACBD, \uC6D0\uB9AC, \uC778\uACFC\uAD00\uACC4\uB97C \uB17C\uB9AC\uC801\uC73C\uB85C \uC5F0\uACB0
- \uD55C\uAD6D\uC5B4. \uB9C8\uD06C\uB2E4\uC6B4 \uC0AC\uC6A9.`},{level:3,label:"\uC77C\uBC18\uC778",desc:"\uBC30\uACBD\xB7\uC6D0\uB9AC\xB7\uAD00\uACC4 \uADE0\uD615",prompt:`\uC77C\uBC18 \uC131\uC778\uC774 \uC644\uC804\uD788 \uC774\uD574\uD560 \uC218 \uC788\uB3C4\uB85D \uC124\uBA85\uD558\uC138\uC694.
- \uBC30\uACBD(\uC65C \uC774\uAC83\uC774 \uC911\uC694\uD55C\uAC00) \u2192 \uD575\uC2EC \uC6D0\uB9AC(\uC5B4\uB5BB\uAC8C \uC791\uB3D9\uD558\uB294\uAC00)
- \uAD6C\uC131 \uC694\uC18C \uAC04 \uAD00\uACC4\uC640 \uC0C1\uD638\uC791\uC6A9 \u2192 \uC2E4\uC81C \uC801\uC6A9\uACFC \uC601\uD5A5
- \uD544\uC694\uD558\uBA74 \uBE44\uAD50\xB7\uB300\uC870\uB85C \uAC1C\uB150 \uBA85\uD655\uD654
- \uD55C\uAD6D\uC5B4. \uB9C8\uD06C\uB2E4\uC6B4 \uC0AC\uC6A9.`},{level:4,label:"\uC804\uBB38\uAC00",desc:"\uC2EC\uCE35 \uAE30\uC220 \uBD84\uC11D",prompt:`\uC804\uBB38\uAC00 \uC218\uC900\uC73C\uB85C \uC2EC\uCE35 \uBD84\uC11D\uD558\uC138\uC694.
- \uAE30\uC220\uC801 \uC138\uBD80\uC0AC\uD56D\uACFC \uBA54\uCEE4\uB2C8\uC998
- \uC5ED\uC0AC\uC801 \uB9E5\uB77D\uACFC \uBC1C\uC804 \uACFC\uC815
- Trade-off, \uD55C\uACC4\uC810, edge case
- \uAD00\uB828 \uC774\uB860/\uAC1C\uB150\uACFC\uC758 \uC5F0\uACB0, \uBE44\uD310\uC801 \uAD00\uC810
- \uD55C\uAD6D\uC5B4. \uC804\uBB38 \uC6A9\uC5B4 \uC601\uBB38 \uBCD1\uAE30. \uB9C8\uD06C\uB2E4\uC6B4 \uC0AC\uC6A9.`}],j=`Analyze the text and suggest exactly 3 visualization techniques using Obsidian-compatible formats.

Available types:
- mermaid-flowchart: \uD504\uB85C\uC138\uC2A4, \uC758\uC0AC\uACB0\uC815 \uD750\uB984
- mermaid-mindmap: \uAC1C\uB150 \uAD6C\uC870, \uC8FC\uC81C \uBD84\uB958
- mermaid-sequence: \uC2DC\uAC04\uC21C \uC0C1\uD638\uC791\uC6A9, \uCEE4\uBBA4\uB2C8\uCF00\uC774\uC158
- mermaid-timeline: \uC5F0\uB300\uAE30, \uB2E8\uACC4\uBCC4 \uC9C4\uD589
- mermaid-pie: \uBE44\uC728, \uAD6C\uC131 \uBE44\uAD50
- mermaid-gantt: \uC77C\uC815, \uD504\uB85C\uC81D\uD2B8 \uAD00\uB9AC
- mermaid-er: \uC5D4\uD2F0\uD2F0 \uAD00\uACC4, \uB370\uC774\uD130 \uAD6C\uC870
- mermaid-state: \uC0C1\uD0DC \uC804\uC774, \uB77C\uC774\uD504\uC0AC\uC774\uD074
- mermaid-class: \uACC4\uCE35 \uAD6C\uC870, \uBD84\uB958 \uCCB4\uACC4
- mermaid-quadrant: 2\uCD95 \uBE44\uAD50 \uD3C9\uAC00
- markdown-table: \uBE44\uAD50\uD45C, \uB9E4\uD2B8\uB9AD\uC2A4

Choose the 3 BEST fits for this specific content. Each suggestion must use a DIFFERENT type.

Output ONLY a JSON array (no markdown, no explanation):
[{"name":"\uD55C\uAD6D\uC5B4 \uC774\uB984","type":"type-id","desc":"\uC774 \uC2DC\uAC01\uD654\uAC00 \uBCF4\uC5EC\uC8FC\uB294 \uAC83 \uD55C \uC904","icon":"\uC774\uBAA8\uC9C01\uAC1C"}]`,U=`Generate an Obsidian-ready visualization for the following content.

Type: {TYPE}

Rules:
- For mermaid types: output the complete \`\`\`mermaid code block
- For markdown-table: output the table directly
- Use Korean labels
- Keep it clean, readable, not overly complex
- Output ONLY the visualization code, nothing else`,St=`\uB2F9\uC2E0\uC740 \uB3C5\uC11C \uB178\uD2B8 \uD3B8\uC9D1 \uC804\uBB38\uAC00\uC785\uB2C8\uB2E4. \uC544\uB798\uC758 Q&A \uC30D\uB4E4\uC744 \uD558\uB098\uC758 \uAD6C\uC870\uD654\uB41C \uD559\uC2B5 \uB178\uD2B8\uB85C \uC7AC\uAD6C\uC131\uD558\uC138\uC694.

\uADDC\uCE59:
1. \uB2E8\uC21C\uD788 Q&A\uB97C \uB098\uC5F4\uD558\uC9C0 \uB9D0 \uAC83. \uB0B4\uC6A9\uC744 \uC8FC\uC81C\uBCC4\uB85C \uC7AC\uAD6C\uC870\uD654\uD560 \uAC83.
2. \uAD6C\uC870: ## \uD575\uC2EC \uAC1C\uB150 \u2192 ## \uC791\uB3D9 \uC6D0\uB9AC \u2192 ## \uC8FC\uC694 \uC6A9\uC5B4 \u2192 ## \uC778\uC0AC\uC774\uD2B8 \u2192 ## \uCD94\uAC00 \uD0D0\uAD6C \uC9C8\uBB38
3. \uAC01 \uC139\uC158\uC5D0 \uD574\uB2F9\uD558\uB294 \uB0B4\uC6A9\uC774 \uC5C6\uC73C\uBA74 \uD574\uB2F9 \uC139\uC158\uC744 \uC0DD\uB7B5.
4. \uC911\uBCF5 \uB0B4\uC6A9\uC740 \uBCD1\uD569. \uC0C1\uD638 \uC5F0\uACB0\uC774 \uC788\uC73C\uBA74 \uBA85\uC2DC.
5. \uD55C\uAD6D\uC5B4. \uB9C8\uD06C\uB2E4\uC6B4 \uC0AC\uC6A9. \uC124\uBA85 \uC5C6\uC774 \uACB0\uACFC\uB9CC.`,G=`\uB2F9\uC2E0\uC740 \uB3C5\uC11C \uB3C4\uC6B0\uBBF8\uC785\uB2C8\uB2E4.
\uCC45: "{TITLE}" ({AUTHOR})

\uB3C5\uC790\uAC00 \uCC45\uC758 \uD55C \uAD6C\uC808\uC744 \uC77D\uACE0 \uC9C8\uBB38\uD588\uC2B5\uB2C8\uB2E4.
\uAD6C\uC808\uC758 \uB9E5\uB77D\uC744 \uACE0\uB824\uD558\uC5EC \uAC04\uACB0\uD558\uAC8C \uB2F5\uBCC0\uD574\uC8FC\uC138\uC694.

\uADDC\uCE59:
- 2~3\uBB38\uB2E8, \uD55C\uAD6D\uC5B4\uB85C \uB2F5\uBCC0
- \uB9C8\uD06C\uB2E4\uC6B4 \uC11C\uC2DD \uC0AC\uC6A9\uD558\uC9C0 \uB9C8\uC138\uC694 (\uBCFC\uB4DC, \uD5E4\uB354 \uB4F1 \uAE08\uC9C0)
- \uC778\uC0AC\uB9D0\uC774\uB098 \uBA38\uB9AC\uB9D0 \uC5C6\uC774 \uBC14\uB85C \uB2F5\uBCC0
- \uCC45\uC758 \uB9E5\uB77D\uACFC \uC77C\uBC18 \uC9C0\uC2DD\uC744 \uACB0\uD569\uD558\uC5EC \uB2F5\uBCC0`;st={claudePath:"",model:"haiku",maxChars:0,tone:"auto",customPrompts:{},bridgeUrl:"http://127.0.0.1:3456",savedCommands:[]},$=[{id:"auto",label:"\uC790\uB3D9",desc:"\uD15C\uD50C\uB9BF \uAE30\uBC18",instruction:""},{id:"\uACA9\uC2DD\uCCB4-\uBCF4\uACE0",label:"\uACA9\uC2DD\uCCB4",desc:"\uBCF4\uACE0\uC11C/\uD68C\uC758\uB85D",instruction:"\uACA9\uC2DD\uCCB4(\uD569\uB2C8\uB2E4/\uC2B5\uB2C8\uB2E4)\uB85C \uC791\uC131. \uBA85\uD655\uD558\uACE0 \uAC04\uACB0\uD558\uAC8C."},{id:"\uC804\uBB38\uAE30\uC220",label:"\uC804\uBB38",desc:"\uAE30\uC220\uBB38\uC11C",instruction:"\uC804\uBB38 \uAE30\uC220 \uC6A9\uC5B4\uB97C \uC815\uD655\uD788 \uC0AC\uC6A9. \uC601\uC5B4 \uAE30\uC220 \uC6A9\uC5B4 \uBCD1\uAE30."},{id:"\uCF58\uD150\uCE20",label:"\uCF58\uD150\uCE20",desc:"\uC720\uD29C\uBE0C/SNS",instruction:"\uD765\uBBF8\uB86D\uACE0 \uC0DD\uB3D9\uAC10 \uC788\uAC8C. \uD6C5\uC744 \uBA3C\uC800, \uD575\uC2EC\uC744 \uBE60\uB974\uAC8C."},{id:"\uBD84\uC11D\uC801",label:"\uBD84\uC11D",desc:"\uC758\uC0AC\uACB0\uC815/\uBD84\uC11D",instruction:"\uB17C\uB9AC\uC801\uC774\uACE0 \uAD6C\uC870\uC801\uC73C\uB85C. \uAC10\uC815 \uBC30\uC81C, \uADFC\uAC70 \uAE30\uBC18."}];F=class extends T.Plugin{constructor(){super(...arguments);this.settings=st}async onload(){await this.loadSettings(),this.registerView(A,t=>new O(t,this)),this.addRibbonIcon("pen-tool","Claude Writer",()=>this.activateView());for(let t of k)t.id==="vault-ops"?this.addCommand({id:t.id,name:t.name,callback:async()=>{await this.activateView();let e=this.getView();e&&e.triggerVaultOps()}}):t.id==="console"?this.addCommand({id:t.id,name:t.name,callback:async()=>{await this.activateView();let e=this.getView();e&&e.triggerConsole()}}):t.id==="answer-questions"?this.addCommand({id:t.id,name:t.name,editorCallback:async e=>{await this.activateView();let s=this.getView();s&&s.triggerAnswerQuestions(e)}}):this.addCommand({id:t.id,name:t.name,editorCallback:async e=>{await this.activateView();let s=this.getView();s&&s.triggerCommand(t.id,e.getSelection())}});this.registerEvent(this.app.workspace.on("editor-menu",(t,e)=>{let s=e.getSelection();if(!s)return;t.addSeparator();let n=["rewrite","reconstruct","summarize","translate-en","formalize-en"];for(let o of n){let i=k.find(a=>a.id===o);i&&t.addItem(a=>{a.setTitle(`Claude: ${i.label}`).setIcon("pen-tool").onClick(async()=>{await this.activateView();let c=this.getView();c&&c.triggerCommand(o,s)})})}})),this.addSettingTab(new nt(this.app,this))}async onunload(){let t=this.getView();t&&t.forceKill(),this.app.workspace.detachLeavesOfType(A)}getClaudePath(){if(this.settings.claudePath)return this.settings.claudePath;let t=process.env.USERPROFILE||process.env.HOME||"";return process.platform==="win32"?`${t}\\AppData\\Roaming\\npm\\claude.cmd`:"/usr/local/bin/claude"}getView(){let t=this.app.workspace.getLeavesOfType(A);return t.length>0?t[0].view:null}async activateView(){let t=this.app.workspace.getLeavesOfType(A);if(t.length>0){this.app.workspace.revealLeaf(t[0]);return}let e=this.app.workspace.getRightLeaf(!1);e&&(await e.setViewState({type:A,active:!0}),this.app.workspace.revealLeaf(e))}getEffectivePrompt(t,e){if(t==="reconstruct"&&e&&M[e])return M[e];let s=k.find(n=>n.id===t);return{prompt:(s==null?void 0:s.prompt)||"",model:this.settings.model,tone:this.settings.tone}}async loadSettings(){this.settings=Object.assign({},st,await this.loadData())}async saveSettings(){await this.saveData(this.settings)}},nt=class extends T.PluginSettingTab{constructor(r,t){super(r,t),this.plugin=t}display(){let{containerEl:r}=this;r.empty(),r.createEl("h2",{text:"Claude Writer"}),new T.Setting(r).setName("Claude CLI \uACBD\uB85C").setDesc("\uBE44\uC6CC\uB450\uBA74 \uC790\uB3D9 \uAC10\uC9C0").addText(t=>t.setPlaceholder("auto-detect").setValue(this.plugin.settings.claudePath).onChange(async e=>{this.plugin.settings.claudePath=e,await this.plugin.saveSettings()})),new T.Setting(r).setName("\uAE30\uBCF8 \uBAA8\uB378").addDropdown(t=>t.addOption("haiku","Haiku (\uBE60\uB984)").addOption("sonnet","Sonnet (\uADE0\uD615)").addOption("opus","Opus (\uCD5C\uACE0 \uD488\uC9C8)").setValue(this.plugin.settings.model).onChange(async e=>{this.plugin.settings.model=e,await this.plugin.saveSettings()})),new T.Setting(r).setName("\uAE30\uBCF8 \uD1A4").addDropdown(t=>{$.forEach(e=>t.addOption(e.id,`${e.label} (${e.desc})`)),t.setValue(this.plugin.settings.tone).onChange(async e=>{this.plugin.settings.tone=e,await this.plugin.saveSettings()})}),new T.Setting(r).setName("\uAE00\uC790\uC218 \uC81C\uD55C").setDesc("0 = \uBB34\uC81C\uD55C").addText(t=>t.setValue(String(this.plugin.settings.maxChars)).onChange(async e=>{this.plugin.settings.maxChars=parseInt(e)||0,await this.plugin.saveSettings()})),new T.Setting(r).setName("\uBAA8\uBC14\uC77C Bridge URL").setDesc("Termux bridge.mjs \uC8FC\uC18C (\uBAA8\uBC14\uC77C \uC804\uC6A9)").addText(t=>t.setPlaceholder("http://127.0.0.1:3456").setValue(this.plugin.settings.bridgeUrl).onChange(async e=>{this.plugin.settings.bridgeUrl=e,await this.plugin.saveSettings()})),r.createEl("h3",{text:"\uD15C\uD50C\uB9BF\uBCC4 \uD504\uB86C\uD504\uD2B8 (\uC790\uB3D9 \uAC10\uC9C0)"}),r.createEl("p",{text:"frontmatter\uC758 template \uD544\uB4DC\uB97C \uAE30\uBC18\uC73C\uB85C \uC790\uB3D9 \uC801\uC6A9\uB429\uB2C8\uB2E4.",cls:"setting-item-description"});for(let[t,e]of Object.entries(M))new T.Setting(r).setName(t).setDesc(`\uBAA8\uB378: ${e.model} | \uD1A4: ${e.tone}`).addTextArea(s=>s.setValue(e.prompt).onChange(async n=>{M[t].prompt=n}))}}});et();0&&(module.exports={ANSWER_QUESTION_PROMPT,COMMANDS,DEFAULT_SETTINGS,EXPLAIN_LEVELS,READING_NOTE_PROMPT,TEMPLATE_PROMPTS,TONES,VIZ_GENERATE_PROMPT,VIZ_SUGGEST_PROMPT,callClaude,callClaudeMobile,claudeAuthLogin,claudeAuthLogout,detectTemplate,extractSectionHeaders,extractUsefulContent,getAuthStatus,isMobile,parseQuestions});
