#!/bin/bash
# Termômetro do débito de tipagem (Entrega 5). NÃO é gate de CI.
# typescript-eslint ainda não suporta o tsc nativo (TS 7); quando suportar,
# migrar para @typescript-eslint/no-explicit-any.
cd "$(dirname "$0")/.."
echo "── Débito de tipagem (js/**/*.ts) ──────────────────"
printf '%-28s %s\n' "': any' explícito:"    "$(grep -rhoE ':\s*any(\[\])?' js --include='*.ts' | wc -l)"
printf '%-28s %s\n' "'as any':"             "$(grep -rho 'as any' js --include='*.ts' | wc -l)"
printf '%-28s %s\n' "'!' (non-null):"       "$(grep -rhoE '![.);,\[]' js --include='*.ts' | wc -l)"
printf '%-28s %s\n' "@ts-expect-error:"     "$(grep -rho '@ts-expect-error' js --include='*.ts' | wc -l)"
echo "── Top 10 arquivos por 'as any' ────────────────────"
grep -rc 'as any' js --include='*.ts' | sort -t: -k2 -rn | head -10
