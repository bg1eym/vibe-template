# Rollback — PCK-ATLAS-ITER-010

rm tools/atlas-env-audit.sh
rm .project-control/07-critical-tests/CT-ATLAS-ENV-001.sh
rm .project-control/02-regressions/RG-ATLAS-ENV-001.sh
# Revert critical-tests.sh, test-matrix.json, regress.sh
rm -rf .project-control/00-ledger/PCK-ATLAS-ITER-010
