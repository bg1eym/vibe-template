# PCK Mistake Book (oc-personal-agent-lab)

证据化记录失败模式、根因、修复策略与回归。

---

## Entry 1 — ATLAS-ITER-010: deliverables claimed but not landed in correct workspace

| 字段 | 内容 |
|------|------|
| **Symptom** | `bash tools/atlas-env-audit.sh` from oc-personal-agent-lab: No such file or directory |
| **Verified Root Cause** | ITER-009 artifacts (atlas-env-audit.sh, CT-ATLAS-ENV-001, RG-ATLAS-ENV-001, ledger) were created in atlas-radar repo; user ran from oc-personal-agent-lab. Workspace mismatch. |
| **Evidence Pointers** | find $HOME: artifacts at /Users/qiangguo/atlas-radar; Run Journal: 03-runs/ATLAS-ITER-010-20260220.md |
| **Fix Strategy** | Create all artifacts in oc-personal-agent-lab; Gate Chain Lock in regress.sh enforces tools/atlas-env-audit.sh, RG-ATLAS-ENV-001.sh, CT-ATLAS-ENV-001.sh exist and executable |
| **New Regression(s)** | RG-ATLAS-ENV-001.sh: static checks + audit produces JSON |
| **How to detect earlier next time** | Run acceptance from target workspace before claiming done; Gate Chain Lock blocks regress if critical files missing |
