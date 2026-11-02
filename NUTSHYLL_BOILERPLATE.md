# Nutshyll Monorepo Architecture Boilerplate Guide

Yeh guide Nutshyll architecture ka complete boilerplate blueprint faraham karti hai. Is template ko use karke aap koi bhi naya project (Full-Stack Monorepo) isi architecture par start kar sakte hain.

---

## 1. Core Architecture Philosophy

Nutshyll architecture ke 6 bunyadi usool (Core Principles) hain:

1. **Self-Contained Workspace (Monorepo Foundation):**
   - Repository khud workspace hai. Koi unnecessary nested parent directory (e.g. `<project>/...`) nahi hoti.
   - Physical roots standard hain: `apps/`, `servers/`, `packages/`, `prebuilt/`, `enablers/`.
2. **Custom Control Plane (`codebase/`):**
   - Monorepo orchestration ke liye Turborepo, Nx, ya Lerna jese external tools par dependency **nahi** hai.
   - Project discovery, dependency graph, execution planning, caching, aur architecture rules repository ke apne control plane (`codebase/cli/repo.mjs`) ke zariye run hote hain.
3. **Standard Industry Engines:**
   - Package manager: `pnpm` (workspace protocol: `workspace:*`).
   - Typechecker: `tsc` (TypeScript strict mode).
   - Linter: `eslint`.
   - Tests: Node native test runner (`node --test`) ya `tsx --test`.
   - Secret Detection: `trufflehog`.
   - Dependency Audit: `pnpm audit`.
4. **Feature-First Architecture:**
   - Server aur app mein business logic ko layers ke bajaye **Features** ke hisaab se organize kiya jata hai (`features/<feature>/`).
   - Server features flat files se start hote hain:
     - `<feature>.route.ts` (HTTP routing)
     - `<feature>.controller.ts` (Request/Response orchestration)
     - `<feature>.service.ts` (Application business logic)
     - `<feature>.repository.ts` (Database persistence)
     - `<feature>.validation.ts` (Zod schemas / runtime validation)
     - `<feature>.model.ts` (Data models)
     - `<feature>.integration.ts` (External 3rd-party services)
     - `index.ts` (Feature ka public entrypoint)
   - Heavy OOP classes, decorators, ya service locators ke bajaye **Pure functional factories** aur explicit immutable dependency injection use hoti hai.
5. **Strict Architectural Boundaries:**
   - `packages/` kabhi bhi `apps/` ya `servers/` ko import nahi kar sakte.
   - `domain` pure TypeScript hota hai; wo Express, Next.js, Mongoose, ya UI ko import nahi kar sakta.
   - `service` kabhi bhi `route`, `controller`, ya UI components ko import nahi kar sakta.
6. **Progressive Modularization & Line Limits:**
   - Files ko clean aur maintainable rakhne ke liye har file strictly **250 - 270 lines** ke andar honi chahiye. Jab file barhi ho to use logical micro-modules mein split kiya jata hai.

---

## 2. Directory Structure (Folder Tree)

Naye project ke liye folder structure aisi hogi:

```text
my-nutshyll-project/
├── .agent/                      # AI Agent Operating Instructions & Standards
│   ├── instructions/
│   │   ├── architecture.md
│   │   ├── ui-composition.md
│   │   └── integrations.md
│   └── standards/
│       ├── development.md
│       ├── testing.md
│       └── types-validation.md
├── .github/                     # Workflows & CI
│   └── workflows/
├── apps/                        # Frontend Applications
│   └── web/                     # Next.js App
│       ├── app/
│       ├── features/
│       ├── public/
│       ├── package.json
│       ├── project.json         # Workspace Unit Manifest
│       ├── tsconfig.json
│       └── next.config.ts
├── servers/                     # Backend API & Workers
│   └── api/                     # Express / Node API
│       ├── bootstrap/
│       │   ├── create-app.ts
│       │   └── server.ts
│       ├── features/
│       │   └── health/
│       │       ├── health.route.ts
│       │       ├── health.controller.ts
│       │       └── index.ts
│       ├── package.json
│       ├── project.json         # Workspace Unit Manifest
│       └── tsconfig.json
├── packages/                    # Reusable Shared Code
│   ├── tsconfig/                # Base TSConfigs (base.json, next.json, node.json)
│   │   ├── package.json
│   │   └── project.json
│   ├── eslint-config/           # Shared ESLint rules
│   │   ├── package.json
│   │   └── project.json
│   ├── types/                   # Cross-workspace API & Entity Contracts
│   │   ├── src/
│   │   ├── package.json
│   │   └── project.json
│   └── ui/                      # Shared UI Components (shadcn/radix/tailwind)
│       ├── src/
│       │   ├── primitives/
│       │   └── utilities.ts
│       ├── package.json
│       └── project.json
├── prebuilt/                    # Pre-assembled solutions (optional)
├── enablers/                    # Operational enablers & scripts
├── codebase/                    # Control Plane (No Turborepo/Nx!)
│   ├── cli/
│   │   └── repo.mjs             # Main Monorepo CLI orchestrator
│   ├── configuration/
│   ├── dependency/
│   ├── execution/
│   ├── policy/
│   └── checks/
├── AGENTS.md                    # Agent Operating Guide
├── CLAUDE.md                    # Project Quick Instructions
├── architecture.yaml            # Authoritative Monorepo Policy (JSON-compatible)
├── package.json                 # Root package.json
├── pnpm-workspace.yaml          # pnpm workspace definition
├── pnpm-lock.yaml
├── commitlint.config.mjs        # Conventional Commits Policy
├── lint-staged.config.mjs       # Pre-commit hooks config
├── .editorconfig
└── .gitattributes
```

---

## 3. Essential Starter Configuration Files

### File 1: `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "servers/*"
  - "packages/*"
  - "prebuilt/*"
  - "prebuilt/*/*"

allowBuilds:
  esbuild: true

audit:
  level: high
```

---

### File 2: Root `package.json`
```json
{
  "name": "my-nutshyll-project",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.0.0",
  "scripts": {
    "repo": "node codebase/cli/repo.mjs",
    "projects": "node codebase/cli/repo.mjs projects",
    "graph": "node codebase/cli/repo.mjs graph",
    "tasks": "node codebase/cli/repo.mjs tasks",
    "affected": "node codebase/cli/repo.mjs affected",
    "dev": "node codebase/cli/repo.mjs run dev --concurrency 4",
    "build": "node codebase/cli/repo.mjs build --concurrency 2",
    "test": "pnpm run test:control-plane && pnpm run test:units",
    "test:control-plane": "node --test codebase/**/*.test.mjs",
    "test:units": "node codebase/cli/repo.mjs test --concurrency 2",
    "lint": "node codebase/cli/repo.mjs run lint --concurrency 2",
    "typecheck": "node codebase/cli/repo.mjs run typecheck --concurrency 2",
    "check": "node codebase/cli/repo.mjs check",
    "scan": "node codebase/cli/repo.mjs scan",
    "validate": "node codebase/cli/repo.mjs validate && pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build",
    "prepare": "husky"
  },
  "devDependencies": {
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "husky": "^9.0.0",
    "lint-staged": "^15.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  }
}
```

---

### File 3: `architecture.yaml` (Core Policy)
```yaml
{
  "version": 1,
  "foundation": {
    "name": "monorepo-foundation",
    "projectManifest": "project.json",
    "projectRoots": {
      "apps": "app",
      "servers": "server",
      "packages": "package",
      "prebuilt": "prebuilt"
    },
    "allowedProjectTypesByRoot": {
      "apps": ["app"],
      "servers": ["server"],
      "packages": ["package", "config"],
      "prebuilt": ["prebuilt"]
    },
    "requiredRoots": ["apps", "servers", "packages", "prebuilt", "codebase", "enablers", ".agent", ".github"],
    "requiredFiles": [
      "AGENTS.md",
      ".editorconfig",
      ".gitattributes",
      "architecture.yaml",
      "commitlint.config.mjs",
      "lint-staged.config.mjs",
      "package.json",
      "pnpm-workspace.yaml",
      "pnpm-lock.yaml"
    ],
    "disallowedOrchestrators": ["turbo", "turborepo", "nx", "lerna"],
    "ignoredDirectories": [".git", ".next", ".repo-cache", "node_modules", "dist", "build", "coverage"]
  },
  "workspaceModel": {
    "repositoryIsWorkspace": true,
    "mandatoryProjectNamespace": false,
    "defaultUnits": {
      "app": "apps/web",
      "server": "servers/api"
    },
    "additionalUnits": "when-required"
  },
  "growthModel": {
    "principle": "everything-available-nothing-unnecessarily-imposed",
    "progression": ["simple", "modular", "bounded", "scalable", "distributed-when-justified", "platform-when-justified"],
    "categorizationRule": "meaningful-ownership-or-growth",
    "commonFileCountHeuristic": 3,
    "fileCountIsMandatoryThreshold": false
  },
  "toolingModel": {
    "principle": "custom-orchestration-standard-engines",
    "controlPlaneOwns": ["discovery", "dependency-graph", "execution-planning", "task-orchestration", "caching", "repository-policy", "result-normalization", "cli"],
    "standardEngines": {
      "packageManagement": "pnpm",
      "typescript": "tsc",
      "lint": "eslint",
      "tests": "project-declared-runner",
      "dependencySecurity": "pnpm-audit",
      "secretDetection": "trufflehog"
    }
  },
  "featureModel": {
    "ownership": "feature-first",
    "growth": "progressive",
    "serverLayout": "flat-files-by-default",
    "optionalServerFileRoles": ["route", "controller", "service", "repository", "validation", "model", "integration"],
    "domainDirectory": "domain",
    "domainFileRoles": ["entity", "rules", "policy", "calculations", "commands", "queries", "events", "constants"],
    "serverFeatureRoot": "features",
    "serverFeatureRegistrationFile": "bootstrap/create-app.ts",
    "serverRouteFileSuffix": ".route.ts",
    "serverFeatureLayers": {
      "strategy": "progressive-categorized-when-justified",
      "publicEntry": "index.ts",
      "optional": {
        "routes": "HTTP routing and feature composition",
        "controllers": "HTTP-facing request and response orchestration",
        "services": "application operations and coordination",
        "domain": "framework-independent domain concepts and rules",
        "repositories": "feature persistence operations",
        "validations": "feature input and contract validation",
        "models": "feature persistence models",
        "integrations": "feature-specific external system adapters",
        "tests": "feature behavior and boundary verification"
      }
    }
  },
  "boundaries": {
    "packagesCannotImport": ["apps", "servers", "prebuilt"],
    "workspaceUnitCannotImport": {
      "app": ["servers", "prebuilt"],
      "server": ["apps", "prebuilt"],
      "package": ["apps", "servers", "prebuilt"]
    },
    "domainCannotImportSegments": ["controllers", "routes", "models"],
    "domainCannotImportFileRoles": ["route", "controller", "service", "repository", "validation", "model", "integration"],
    "domainCannotImportPackages": ["express", "mongoose", "next", "redis"],
    "serviceCannotImportSegments": ["routes", "controllers", "ui", "components"],
    "serviceCannotImportFileRoles": ["route", "controller", "model"],
    "uiSegments": ["components", "ui"],
    "persistenceSegments": ["models", "persistence", "repositories"],
    "persistenceFileRoles": ["model", "repository"]
  },
  "typescript": {
    "disallowExplicitAny": true,
    "forbiddenCompilerOptions": ["baseUrl", "ignoreDeprecations"],
    "requiredTypeBoundaryProjectTypes": ["app", "server"],
    "sharedConfigProject": "tsconfig",
    "policyConfigFile": "base.json",
    "presetConfigFiles": ["node.json", "next.json"]
  }
}
```

---

### File 4: Workspace Unit Manifest Example (`apps/web/project.json`)
Har app, server, ya package ke root par ek `project.json` hota hai jo control plane ko batata hai ki unit ka type kya hai aur iske tasks kya hain:

```json
{
  "name": "web",
  "type": "app",
  "description": "Primary Next.js web application.",
  "internalDependencies": ["eslint-config", "tsconfig", "ui", "types"],
  "externalDependencies": ["next", "react", "react-dom", "tailwindcss", "zod"],
  "capabilities": ["web", "app-router", "tailwind"],
  "tasks": {
    "dev": { "command": "pnpm run dev", "cache": false },
    "build": { "command": "pnpm run build", "outputs": [".next"], "cache": true },
    "test": { "command": "pnpm test", "cache": false },
    "lint": { "command": "pnpm run lint", "cache": false },
    "typecheck": { "command": "pnpm run typecheck", "cache": false }
  }
}
```

---

### File 5: Backend Server Manifest Example (`servers/api/project.json`)
```json
{
  "name": "api",
  "type": "server",
  "description": "Primary Express HTTP API runtime.",
  "internalDependencies": ["eslint-config", "tsconfig", "types"],
  "externalDependencies": ["dotenv", "express", "zod"],
  "capabilities": ["http-api", "health"],
  "tasks": {
    "dev": { "command": "pnpm run dev", "cache": false },
    "build": { "command": "pnpm run build", "outputs": ["dist"], "cache": true },
    "test": { "command": "pnpm test", "cache": false },
    "lint": { "command": "pnpm run lint", "cache": false },
    "typecheck": { "command": "pnpm run typecheck", "cache": false }
  }
}
```

---

## 4. Backend Feature Pattern Example

Nutshyll architecture mein server feature flat files se banta hai aur dependency injection functional factories ke through hoti hai:

### `servers/api/features/health/health.route.ts`
```typescript
import { Router } from "express";
import type { HealthController } from "./health.controller.js";

export const createHealthRouter = (controller: HealthController): Router => {
  const router = Router();
  router.get("/health", controller.getHealth);
  return router;
};
```

### `servers/api/features/health/health.controller.ts`
```typescript
import type { Request, Response } from "express";
import type { HealthService } from "./health.service.js";

export type HealthController = Readonly<{
  getHealth: (req: Request, res: Response) => Promise<void>;
}>;

export const createHealthController = (service: HealthService): HealthController => ({
  getHealth: async (_req: Request, res: Response): Promise<void> => {
    const status = await service.check();
    res.status(200).json(status);
  }
});
```

### `servers/api/features/health/health.service.ts`
```typescript
export type HealthStatus = Readonly<{
  ok: boolean;
  timestamp: string;
}>;

export type HealthService = Readonly<{
  check: () => Promise<HealthStatus>;
}>;

export const createHealthService = (): HealthService => ({
  check: async (): Promise<HealthStatus> => ({
    ok: true,
    timestamp: new Date().toISOString()
  })
});
```

### `servers/api/features/health/index.ts`
```typescript
import type { Router } from "express";
import { createHealthService } from "./health.service.js";
import { createHealthController } from "./health.controller.js";
import { createHealthRouter } from "./health.route.js";

export const createHealthFeature = (): Router => {
  const service = createHealthService();
  const controller = createHealthController(service);
  return createHealthRouter(controller);
};
```

---

## 5. Summary & How to Re-use

Jab bhi naya project shuru karna ho:
1. Root par `package.json`, `pnpm-workspace.yaml`, aur `architecture.yaml` copy karein.
2. `codebase/` folder ko template ke tor par copy karein (yeh aapka custom monorepo orchestrator hai).
3. `packages/tsconfig` aur `packages/eslint-config` se standard tooling configure karein.
4. `apps/` aur `servers/` mein apne projects create karke har aik ke sath uska `project.json` manifest define karein.
5. `pnpm install` run karein aur `pnpm run check` se architecture boundaries verify karein!
