#!/bin/bash
cd /home/jafarsidik/hris/apps/web
npx eslint 'src/app/(app)/reports/movement/page.tsx' 'src/app/(app)/reports/turnover/page.tsx' 'src/features/reports/movement-screen.tsx' 'src/features/reports/turnover-screen.tsx' 'src/features/reports/movement-facts.ts' 'src/features/reports/turnover-facts.ts'
echo "ESLINT_EXIT:$?"
npx tsc --noEmit -p tsconfig.json
echo "TSC_EXIT:$?"
