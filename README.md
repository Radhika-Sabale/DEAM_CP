# DEAM Digital Electronics Lab

DEAM is a browser based digital electronics lab built with React, TypeScript, Vite, Tailwind, and Zustand. It includes number systems, Boolean expressions, Karnaugh maps, circuit simulation, flip-flops, sequential design, practice, quizzes, assessments, usability surveys, teacher tools, an ALU, an 8086 emulator, and interrupt simulation.

## Run

```sh
git clone https://github.com/Radhika-Sabale/DEAM_CP.git
cd DEAM_CP
npm install
npm run dev
```

## Check

```sh
npm run typecheck
npm run lint
npm run test
npm run build
npm run e2e
```

## Folders

- `src/components/`: shared layout and UI components
- `src/modules/`: student-facing modules
- `src/engine/`: logic, simulation, and feedback engines
- `src/store/`: project, settings, and persistence state
- `e2e/`: Playwright end-to-end tests
- `docs/`: architecture, user guide, research, and generated reports

## Optional AI rephrasing

AI hint rephrasing is disabled by default. When enabled, the browser sends diagnostic feedback to the Anthropic Messages API. See [the evaluation protocol](docs/evaluation-protocol.md) for the study disclosure.

