const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const {
  ensureDirectory,
  readJson,
  renderString,
  toPythonPackage
} = require("./template-utils");
const {
  collectOperations,
  loadManifest,
  listVariants,
  normalizeStackSelection
} = require("./repo-generator");

const IGNORED_DIRS = new Set([
  ".agentum",
  ".git",
  ".next",
  ".venv",
  "build",
  "dist",
  "node_modules",
  "vendor"
]);

function safeRead(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, "utf8");
}

function safeReadJson(filePath) {
  const content = safeRead(filePath);
  if (!content) {
    return null;
  }
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function readGeneratorMetadata(repoRoot, targetDir) {
  const manifest = loadManifest(repoRoot);
  return safeReadJson(path.join(targetDir, manifest.metadataFile));
}

function getToolVersion(repoRoot) {
  return safeReadJson(path.join(repoRoot, "package.json"))?.version || "0.0.0";
}

function walkRepoFiles(targetDir) {
  const files = [];

  function visit(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) {
          visit(absolutePath);
        }
        continue;
      }
      files.push(absolutePath);
    }
  }

  visit(targetDir);
  return files;
}

function listDirectories(targetDir) {
  const directories = [];

  function visit(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (!entry.isDirectory()) {
        continue;
      }
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      directories.push(absolutePath);
      visit(absolutePath);
    }
  }

  visit(targetDir);
  return directories;
}

function buildRepoFingerprint(targetDir) {
  const hash = crypto.createHash("sha256");
  for (const filePath of walkRepoFiles(targetDir).sort()) {
    const relativePath = path.relative(targetDir, filePath).replace(/\\/g, "/");
    const stat = fs.statSync(filePath);
    hash.update(`${relativePath}:${stat.size}:${stat.mtimeMs}\n`);
  }
  return hash.digest("hex");
}

function detectPackageManager(targetDir) {
  if (fs.existsSync(path.join(targetDir, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (fs.existsSync(path.join(targetDir, "yarn.lock"))) {
    return "yarn";
  }
  if (fs.existsSync(path.join(targetDir, "package-lock.json"))) {
    return "npm";
  }
  if (fs.existsSync(path.join(targetDir, "composer.lock"))) {
    return "composer";
  }
  if (fs.existsSync(path.join(targetDir, "uv.lock"))) {
    return "uv";
  }
  return null;
}

function detectProjectStyle(targetDir) {
  const phpFiles = walkRepoFiles(targetDir)
    .map((filePath) => path.relative(targetDir, filePath).replace(/\\/g, "/"))
    .filter((filePath) => filePath.endsWith(".php"));

  const hasPluginHeader = phpFiles.some((filePath) => {
    const content = safeRead(path.join(targetDir, filePath)) || "";
    return /Plugin Name:/i.test(content);
  });
  const hasWpHooks = phpFiles.some((filePath) => {
    const content = safeRead(path.join(targetDir, filePath)) || "";
    return /add_action\s*\(|add_filter\s*\(/.test(content);
  });

  if (hasPluginHeader || (fs.existsSync(path.join(targetDir, "includes")) && hasWpHooks)) {
    return "wordpress-plugin";
  }
  if (fs.existsSync(path.join(targetDir, "composer.json"))) {
    return "generic-php";
  }
  if (fs.existsSync(path.join(targetDir, "next.config.js")) || fs.existsSync(path.join(targetDir, "next.config.ts"))) {
    return "nextjs-app";
  }
  if (fs.existsSync(path.join(targetDir, "vite.config.ts"))) {
    return "react-spa";
  }
  return "generic";
}

function scoreVariant(targetDir, variant) {
  const packageJson = safeReadJson(path.join(targetDir, "package.json")) || {};
  const dependencies = {
    ...(packageJson.dependencies || {}),
    ...(packageJson.devDependencies || {})
  };
  const markers = variant.markers || {};
  let score = 0;
  const reasons = [];

  for (const file of markers.files || []) {
    if (fs.existsSync(path.join(targetDir, file))) {
      score += 2;
      reasons.push(`file:${file}`);
    }
  }
  for (const file of markers.anyFiles || []) {
    if (fs.existsSync(path.join(targetDir, file))) {
      score += 3;
      reasons.push(`file:${file}`);
    }
  }
  for (const pattern of markers.contentPatterns || []) {
    const [relativePath, expression] = pattern.split("::");
    const content = safeRead(path.join(targetDir, relativePath));
    if (content && new RegExp(expression, "i").test(content)) {
      score += 3;
      reasons.push(`content:${relativePath}`);
    }
  }
  for (const indicator of markers.packageJsonIndicators || []) {
    if (dependencies[indicator]) {
      score += 2;
      reasons.push(`dep:${indicator}`);
    }
  }
  for (const file of markers.disallowFiles || []) {
    if (fs.existsSync(path.join(targetDir, file))) {
      score -= 1;
    }
  }
  if (variant.name === "react" && dependencies.next) {
    score -= 3;
  }
  if (variant.name === "node" && (dependencies.react || dependencies.next || fs.existsSync(path.join(targetDir, "vite.config.ts")))) {
    score -= 2;
  }

  return { name: variant.name, score, reasons };
}

function detectVariant(repoRoot, targetDir) {
  const candidates = listVariants(repoRoot)
    .map((variant) => scoreVariant(targetDir, variant))
    .sort((left, right) => right.score - left.score);
  const top = candidates[0];
  const second = candidates[1];
  // Confidence reflects how clearly the top candidate beats its closest rival.
  // A 2-point lead floors at 0.35 (ambiguous, still worth showing) and a 4-point
  // lead caps near 0.98 (effectively certain). The +2 offset prevents a 1-point
  // gap from looking too confident; the /6 normaliser was tuned against the
  // observed score range across the existing variants (0–6).
  const confidence =
    !top || top.score <= 0
      ? 0
      : !second
        ? 1
        : Math.max(0.35, Math.min(0.98, (top.score - second.score + 2) / 6));

  return {
    detectedVariant: top && top.score > 0 ? top.name : null,
    confidence,
    candidates
  };
}

function collectRepoMarkers(targetDir) {
  return [
    "package.json",
    "next.config.js",
    "next.config.ts",
    "vite.config.ts",
    "composer.json",
    "pyproject.toml",
    "AGENTS.md",
    ".github/workflows/ci.yml",
    "includes"
  ].filter((file) => fs.existsSync(path.join(targetDir, file)));
}

function assessManifestQuality(targetDir) {
  const results = [];

  const composer = safeReadJson(path.join(targetDir, "composer.json"));
  if (composer) {
    const hasAutoloadSrc = Boolean(composer.autoload?.["psr-4"] && Object.values(composer.autoload["psr-4"]).includes("src/"));
    const genericDescription = /generated php project skeleton/i.test(composer.description || "");
    results.push({
      file: "composer.json",
      status: hasAutoloadSrc && !genericDescription ? "project-ready" : genericDescription || !hasAutoloadSrc ? "generic" : "present",
      reason: hasAutoloadSrc ? "autoload-src-present" : "autoload-src-missing"
    });
  }

  const packageJson = safeReadJson(path.join(targetDir, "package.json"));
  if (packageJson) {
    const hasScripts = Boolean(packageJson.scripts && Object.keys(packageJson.scripts).length > 0);
    results.push({
      file: "package.json",
      status: hasScripts ? "project-ready" : "generic",
      reason: hasScripts ? "scripts-present" : "scripts-missing"
    });
  }

  const pyproject = safeRead(path.join(targetDir, "pyproject.toml"));
  if (pyproject) {
    const hasProject = /\[project\]/.test(pyproject);
    results.push({
      file: "pyproject.toml",
      status: hasProject ? "project-ready" : "generic",
      reason: hasProject ? "project-table-present" : "project-table-missing"
    });
  }

  return results;
}

function summarizeGovernance(repoRoot, targetDir) {
  const manifest = loadManifest(repoRoot);
  const missing = [];
  const present = [];
  const divergent = [];

  for (const file of manifest.requiredBaseFiles) {
    const absolutePath = path.join(targetDir, file);
    if (!fs.existsSync(absolutePath)) {
      missing.push(file);
      continue;
    }
    if (file === "AGENTS.md" || file === "README.md") {
      divergent.push({ file, reason: "existing-project-specific" });
      continue;
    }
    present.push(file);
  }

  return { missing, present, divergent };
}

function collectConflicts(targetDir) {
  const conflicts = [];
  if (fs.existsSync(path.join(targetDir, "AGENTS.md"))) {
    conflicts.push({ file: "AGENTS.md", reason: "Existing agent instructions require manual review." });
  }
  if (fs.existsSync(path.join(targetDir, ".github", "workflows", "ci.yml"))) {
    conflicts.push({ file: ".github/workflows/ci.yml", reason: "Existing CI workflow should not be overwritten automatically." });
  }
  if (fs.existsSync(path.join(targetDir, "CLAUDE.md"))) {
    conflicts.push({ file: "CLAUDE.md", reason: "Existing mirrored instruction file already present." });
  }
  if (fs.existsSync(path.join(targetDir, ".github", "copilot-instructions.md"))) {
    conflicts.push({
      file: ".github/copilot-instructions.md",
      reason: "Existing Copilot instructions should be reviewed before replacement."
    });
  }
  return conflicts;
}

function scanRepository(repoRoot, targetDir, options = {}) {
  const variantDetection = detectVariant(repoRoot, targetDir);
  const metadata = readGeneratorMetadata(repoRoot, targetDir);
  const selectedVariant = options.variant || variantDetection.detectedVariant;
  const selectedStacks = normalizeStackSelection(options.stacks || metadata?.stacks || []);
  const selectedProfile = metadata?.profile || null;
  const selectedRuntime = metadata?.runtime || null;
  const selectedModules = normalizeStackSelection(metadata?.modules || []);
  const selectedPolicies = normalizeStackSelection(metadata?.policies || []);
  const governance = summarizeGovernance(repoRoot, targetDir);
  const repoFiles = walkRepoFiles(targetDir).map((filePath) => path.relative(targetDir, filePath).replace(/\\/g, "/"));
  const repoDirectories = listDirectories(targetDir).map((dirPath) => path.relative(targetDir, dirPath).replace(/\\/g, "/"));
  const projectStyle = detectProjectStyle(targetDir);
  const conflicts = collectConflicts(targetDir);

  let recommendedNextAction = "retrofit-plan";
  if (!selectedVariant) {
    recommendedNextAction = "scan with --variant";
  } else if (conflicts.length > 0) {
    recommendedNextAction = "retrofit-plan then review manual items";
  }

  return {
    targetDir,
    detectedVariant: variantDetection.detectedVariant,
    confidence: variantDetection.confidence,
    selectedVariant,
    selectedStacks,
    selectedProfile,
    selectedRuntime,
    selectedModules,
    selectedPolicies,
    packageManager: options.packageManager || detectPackageManager(targetDir),
    projectStyle,
    repoMarkers: collectRepoMarkers(targetDir),
    presentFiles: repoFiles,
    presentDirectories: repoDirectories,
    missingFiles: governance.missing,
    presentGovernance: governance.present,
    divergentFiles: governance.divergent,
    manifestQuality: assessManifestQuality(targetDir),
    conflicts,
    candidateVariants: variantDetection.candidates,
    repoFingerprint: buildRepoFingerprint(targetDir),
    recommendedNextAction
  };
}

function renderReadmeMerge(projectName, variantName) {
  return [
    "",
    "## Agentum Governance",
    "",
    `This repository is aligned with the \`${variantName}\` governance profile.`,
    "",
    "- Read `AGENTS.md` before structural or tooling changes.",
    "- Preserve security, validation, and review defaults.",
    `- Refactor incrementally and keep validation green after each step in ${projectName}.`
  ].join("\n");
}

function buildMergeOperation(relativePath, strategy, metadata = {}) {
  return {
    kind: "merge",
    file: relativePath,
    strategy,
    ...metadata
  };
}

function classifyOperation(operation, targetDir, context) {
  const relativePath = path.relative(targetDir, operation.target).replace(/\\/g, "/");
  const exists = fs.existsSync(operation.target);

  if (!exists) {
    return {
      kind: "add",
      file: relativePath,
      content: operation.content
    };
  }

  if (relativePath === ".gitignore") {
    const existing = fs.readFileSync(operation.target, "utf8");
    const lines = operation.content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !existing.includes(line));
    return lines.length > 0
      ? buildMergeOperation(relativePath, "append-lines", {
          lines,
          diffClass: "present-but-divergent",
          preview: lines.join("\n")
        })
      : null;
  }

  if (relativePath === ".env.example") {
    const existing = fs.readFileSync(operation.target, "utf8");
    const lines = operation.content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .filter((line) => !existing.includes(line));
    return lines.length > 0
      ? buildMergeOperation(relativePath, "append-env", {
          lines,
          diffClass: "present-but-divergent",
          preview: lines.join("\n")
        })
      : null;
  }

  if (relativePath === "README.md") {
    const existing = fs.readFileSync(operation.target, "utf8");
    if (existing.includes("## Agentum Governance")) {
      return null;
    }
    return buildMergeOperation(relativePath, "append-readme-section", {
      diffClass: "present-but-divergent",
      preview: renderReadmeMerge(context.projectName, context.variant)
    });
  }

  if (
    relativePath === "AGENTS.md" ||
    relativePath === ".github/workflows/ci.yml" ||
    relativePath === "CLAUDE.md" ||
    relativePath === ".github/copilot-instructions.md"
  ) {
    return {
      kind: "manual",
      file: relativePath,
      reason: "Existing critical project file must be reviewed manually.",
      recommendedAction: "Review and merge manually.",
      suggestedContent: operation.content
    };
  }

  return {
    kind: "manual",
    file: relativePath,
    reason: "Existing project file would be overwritten and is left for manual review.",
    recommendedAction: "Compare existing file with generated template before changing it.",
    suggestedContent: operation.content
  };
}

function readExistingPlan(repoRoot, targetDir) {
  const manifest = loadManifest(repoRoot);
  const planPath = path.join(targetDir, manifest.retrofit.planJson);
  if (!fs.existsSync(planPath)) {
    return null;
  }
  return readJson(planPath);
}

function buildRetrofitPlan(repoRoot, targetDir, options = {}) {
  const scan = scanRepository(repoRoot, targetDir, options);
  if (!scan.selectedVariant) {
    throw new Error("Unable to determine a variant. Re-run with --variant.");
  }

  const packageManager = options.packageManager || scan.packageManager;
  const projectName = options.projectName || path.basename(targetDir);
  const stacks = normalizeStackSelection(options.stacks || scan.selectedStacks || []);
  const generated = collectOperations(repoRoot, {
    targetDir,
    variant: scan.selectedVariant,
    projectName,
    packageManager,
    stacks,
    withCi: Boolean(options.withCi),
    withMirrorFiles: Boolean(options.withMirrorFiles)
  });
  const previousPlan = readExistingPlan(repoRoot, targetDir);

  const proposedOperations = [];
  const manualReviewItems = [];
  for (const operation of generated.operations.filter((entry) => entry.type === "write")) {
    const classified = classifyOperation(operation, targetDir, {
      projectName,
      variant: scan.selectedVariant
    });
    if (!classified) {
      continue;
    }
    if (classified.kind === "manual") {
      manualReviewItems.push(classified);
    } else {
      proposedOperations.push(classified);
    }
  }

  const currentFiles = new Set(scan.presentFiles);
  const previousMissing = new Set(previousPlan?.missingFiles || []);
  const resolvedSinceLastPlan = [...previousMissing].filter((file) => currentFiles.has(file));
  const obsoleteFindings = resolvedSinceLastPlan.map((file) => ({
    file,
    reason: "Previously missing but now present in repository."
  }));

  return {
    version: 2,
    generatedAt: new Date().toISOString(),
    toolVersion: getToolVersion(repoRoot),
    repoFingerprint: scan.repoFingerprint,
    targetDir,
    projectName,
    variant: scan.selectedVariant,
    detectedVariant: scan.detectedVariant,
    confidence: scan.confidence,
    packageManager: packageManager || generated.packageManager,
    selectedStacks: stacks,
    projectStyle: scan.projectStyle,
    repoMarkers: scan.repoMarkers,
    presentFiles: scan.presentFiles,
    presentDirectories: scan.presentDirectories,
    missingFiles: scan.missingFiles,
    presentGovernance: scan.presentGovernance,
    divergentFiles: scan.divergentFiles,
    manifestQuality: scan.manifestQuality,
    conflicts: scan.conflicts,
    proposedOperations,
    manualReviewItems,
    resolvedSinceLastPlan,
    obsoleteFindings,
    freshness: {
      status: "fresh"
    }
  };
}

function planToMarkdown(plan) {
  const lines = [
    "# Retrofit Plan",
    "",
    `- Project: \`${plan.projectName}\``,
    `- Variant: \`${plan.variant}\``,
    `- Project style: \`${plan.projectStyle}\``,
    `- Detected variant: \`${plan.detectedVariant || "unknown"}\``,
    `- Confidence: ${plan.confidence}`,
    `- Package manager: \`${plan.packageManager || "unknown"}\``,
    `- Generated at: ${plan.generatedAt}`,
    "",
    "## Current State",
    "",
    ...(plan.presentGovernance.length
      ? plan.presentGovernance.map((file) => `- Present governance: ${file}`)
      : ["- No baseline governance files detected."]),
    ...(plan.missingFiles.length
      ? plan.missingFiles.map((file) => `- Missing: ${file}`)
      : ["- No missing baseline governance files detected."]),
    ...(plan.divergentFiles.length
      ? plan.divergentFiles.map((item) => `- Divergent: ${item.file} (${item.reason})`)
      : ["- No divergent baseline files detected."]),
    "",
    "## Safe Changes",
    "",
    ...(plan.proposedOperations.length
      ? plan.proposedOperations.map((item) => `- ${item.kind}: ${item.file}${item.strategy ? ` (${item.strategy})` : ""}`)
      : ["- No automatic changes proposed."]),
    "",
    "## Manual Review",
    "",
    ...(plan.manualReviewItems.length
      ? plan.manualReviewItems.map((item) => `- ${item.file}: ${item.reason}`)
      : ["- None."])
  ];

  if (plan.obsoleteFindings.length > 0) {
    lines.push("", "## Resolved Since Previous Plan", "", ...plan.obsoleteFindings.map((item) => `- ${item.file}: ${item.reason}`));
  }

  return `${lines.join("\n")}\n`;
}

function writeRetrofitPlan(repoRoot, targetDir, plan) {
  const manifest = loadManifest(repoRoot);
  ensureDirectory(path.join(targetDir, manifest.retrofit.planDir));
  fs.writeFileSync(path.join(targetDir, manifest.retrofit.planJson), JSON.stringify(plan, null, 2), "utf8");
  fs.writeFileSync(path.join(targetDir, manifest.retrofit.planMarkdown), planToMarkdown(plan), "utf8");
}

function readRetrofitPlan(repoRoot, targetDir) {
  const manifest = loadManifest(repoRoot);
  const planPath = path.join(targetDir, manifest.retrofit.planJson);
  if (!fs.existsSync(planPath)) {
    throw new Error("Missing retrofit plan. Run `init-repo retrofit-plan <target-dir>` first.");
  }
  return readJson(planPath);
}

function refreshPlanStatus(repoRoot, targetDir, plan) {
  const currentFingerprint = buildRepoFingerprint(targetDir);
  return {
    ...plan,
    freshness: {
      status: currentFingerprint === plan.repoFingerprint ? "fresh" : "stale",
      currentFingerprint
    }
  };
}

function appendUniqueLines(filePath, lines) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  const missing = lines.filter((line) => !existing.includes(line));
  if (missing.length === 0) {
    return;
  }
  const next = existing.trimEnd() ? `${existing.trimEnd()}\n${missing.join("\n")}\n` : `${missing.join("\n")}\n`;
  fs.writeFileSync(filePath, next, "utf8");
}

function appendReadmeSection(filePath, block) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  if (existing.includes("## Agentum Governance")) {
    return;
  }
  const next = `${existing.trimEnd()}\n${block}\n`;
  fs.writeFileSync(filePath, next.trimStart(), "utf8");
}

function applyRetrofitPlan(repoRoot, targetDir) {
  const staleAwarePlan = refreshPlanStatus(repoRoot, targetDir, readRetrofitPlan(repoRoot, targetDir));
  if (staleAwarePlan.freshness.status === "stale") {
    throw new Error("Retrofit plan is stale. Re-run `init-repo retrofit-plan <target-dir>` first.");
  }

  for (const operation of staleAwarePlan.proposedOperations) {
    const absolutePath = path.join(targetDir, operation.file);
    ensureDirectory(path.dirname(absolutePath));
    if (operation.kind === "add") {
      if (!fs.existsSync(absolutePath)) {
        fs.writeFileSync(absolutePath, operation.content, "utf8");
      }
      continue;
    }
    if (operation.strategy === "append-lines" || operation.strategy === "append-env") {
      appendUniqueLines(absolutePath, operation.lines || []);
      continue;
    }
    if (operation.strategy === "append-readme-section") {
      appendReadmeSection(absolutePath, operation.preview);
    }
  }
  return staleAwarePlan;
}

function expectedDirectoriesForVariant(repoRoot, variantName, projectName) {
  const variant = listVariants(repoRoot).find((entry) => entry.name === variantName);
  if (!variant) {
    return [];
  }
  const variables = { PYTHON_PACKAGE: toPythonPackage(projectName) };
  return (variant.directories || []).map((directory) => renderString(directory, variables));
}

function analyzeHotspots(repoRoot, targetDir, projectStyle) {
  const manifest = loadManifest(repoRoot);
  return walkRepoFiles(targetDir)
    .map((filePath) => {
      const relative = path.relative(targetDir, filePath).replace(/\\/g, "/");
      if (relative.startsWith(".agentum/")) {
        return null;
      }
      if (relative.startsWith("docs/") || relative.startsWith("tests/")) {
        return null;
      }
      if (!/\.(js|jsx|ts|tsx|php|py)$/.test(relative)) {
        return null;
      }
      const content = fs.readFileSync(filePath, "utf8");
      const lines = content.split(/\r?\n/).length;
      const reasons = [];
      if (lines >= manifest.retrofit.largeFileLines) {
        reasons.push(`large-file:${lines}`);
      }
      if (/\bfetch\s*\(/.test(content) && /useState|jsx|tsx|React/.test(content)) {
        reasons.push("mixed-ui-and-data");
      }
      if (/SELECT\s+.+FROM|INSERT\s+INTO|UPDATE\s+\w+/i.test(content) && /\.(tsx|jsx|php)$/i.test(filePath)) {
        reasons.push("possible-persistence-in-presentation");
      }
      if (projectStyle === "wordpress-plugin" && /add_action\s*\(|add_filter\s*\(/.test(content) && lines > 80) {
        reasons.push("wordpress-bootstrap-and-domain-mixed");
      }
      return reasons.length > 0 ? { file: relative, reasons, lines } : null;
    })
    .filter(Boolean);
}

function buildArchitectureTarget(repoRoot, variant, projectStyle) {
  if (projectStyle === "wordpress-plugin") {
    return {
      description: "Keep WordPress bootstrap and hooks in `includes/`, move business logic into `src/Domain`, `src/Application`, and `src/Infrastructure`.",
      layers: ["includes (adapters)", "src/Domain", "src/Application", "src/Infrastructure"]
    };
  }
  if (variant === "php") {
    return {
      description: "Separate domain, application, infrastructure, and public entrypoints.",
      layers: ["src/Domain", "src/Application", "src/Infrastructure", "public"]
    };
  }
  return {
    description: "Align source code with the selected stack's layered structure.",
    layers: expectedDirectoriesForVariant(repoRoot, variant, "app")
  };
}

function buildRefactorPlan(repoRoot, targetDir, options = {}) {
  const scan = scanRepository(repoRoot, targetDir, options);
  const variant = options.variant || scan.selectedVariant || "unknown";
  const projectName = options.projectName || path.basename(targetDir);
  const hotspots = analyzeHotspots(repoRoot, targetDir, scan.projectStyle);
  const missingDirs = expectedDirectoriesForVariant(repoRoot, variant, projectName).filter(
    (directory) => !fs.existsSync(path.join(targetDir, directory))
  );
  const architectureTarget = buildArchitectureTarget(repoRoot, variant, scan.projectStyle);

  const adapterFiles = scan.projectStyle === "wordpress-plugin"
    ? hotspots.filter((item) => item.file.startsWith("includes/")).map((item) => item.file)
    : [];
  const serviceExtractionCandidates = hotspots.map((item) => ({
    file: item.file,
    currentRole: item.file.startsWith("includes/") ? "legacy-adapter-and-domain-mixed" : "mixed-responsibility",
    targetRole: scan.projectStyle === "wordpress-plugin" && item.file.startsWith("includes/")
      ? "keep-adapter-thin-and-extract-services"
      : "extract-service-or-use-case",
    recommendedExtraction: scan.projectStyle === "wordpress-plugin" && item.file.startsWith("includes/")
      ? "Move business decisions into `src/Application` and `src/Domain`; leave hooks/bootstrap in place."
      : "Split data access, orchestration, and presentation into separate files."
  }));
  const fileMoveSuggestions = missingDirs.map((directory) => ({
    target: directory,
    reason: "Expected by selected architecture but currently missing."
  }));
  const validationSteps = [
    "Regenerate or review retrofit plan if governance files changed.",
    "Refactor one hotspot at a time and run the most specific project validation after each step.",
    "Run `init-repo doctor <target-dir>` after structural changes."
  ];
  const doNotChangeYet = scan.conflicts.map((item) => item.file);

  const steps = [];
  if (scan.missingFiles.length > 0) {
    steps.push("Stabilize missing governance files first.");
  }
  if (missingDirs.length > 0) {
    steps.push(`Introduce target structure for \`${variant}\`: ${missingDirs.join(", ")}.`);
  }
  for (const candidate of serviceExtractionCandidates.slice(0, 5)) {
    steps.push(`Refactor ${candidate.file}: ${candidate.recommendedExtraction}`);
  }
  if (scan.conflicts.length > 0) {
    steps.push("Resolve manual-review items before changing existing CI or instruction files.");
  }
  steps.push("Finish with `init-repo doctor` and project-specific tests/build commands.");

  const markdown = [
    "# Refactor Plan",
    "",
    `- Variant: \`${variant}\``,
    `- Project style: \`${scan.projectStyle}\``,
    `- Confidence: ${scan.confidence}`,
    "",
    "## Target Architecture",
    "",
    `- ${architectureTarget.description}`,
    ...(Array.isArray(architectureTarget.layers) ? architectureTarget.layers.map((layer) => `- ${layer}`) : []),
    "",
    "## Hotspots",
    "",
    ...(hotspots.length
      ? hotspots.map((item) => `- ${item.file} (${item.reasons.join(", ")})`)
      : ["- No hotspot files detected by the lightweight heuristics."]),
    "",
    "## Extraction Candidates",
    "",
    ...(serviceExtractionCandidates.length
      ? serviceExtractionCandidates.map((item) => `- ${item.file}: ${item.recommendedExtraction}`)
      : ["- No extraction candidates detected."]),
    "",
    "## Prioritized Steps",
    "",
    ...steps.map((step) => `- ${step}`),
    "",
    "## Do Not Change Yet",
    "",
    ...(doNotChangeYet.length ? doNotChangeYet.map((item) => `- ${item}`) : ["- None."]),
    "",
    "## Validation",
    "",
    ...validationSteps.map((step) => `- ${step}`)
  ].join("\n");

  return {
    generatedAt: new Date().toISOString(),
    toolVersion: getToolVersion(repoRoot),
    repoFingerprint: scan.repoFingerprint,
    variant,
    projectStyle: scan.projectStyle,
    confidence: scan.confidence,
    architectureTarget,
    hotspots,
    adapterFiles,
    serviceExtractionCandidates,
    fileMoveSuggestions,
    validationSteps,
    doNotChangeYet,
    missingDirs,
    steps,
    markdown: `${markdown}\n`
  };
}

function writeRefactorPlan(repoRoot, targetDir, plan) {
  const manifest = loadManifest(repoRoot);
  ensureDirectory(path.join(targetDir, manifest.retrofit.planDir));
  fs.writeFileSync(path.join(targetDir, manifest.retrofit.refactorMarkdown), plan.markdown, "utf8");
  if (manifest.retrofit.refactorJson) {
    fs.writeFileSync(path.join(targetDir, manifest.retrofit.refactorJson), JSON.stringify(plan, null, 2), "utf8");
  }
}

module.exports = {
  applyRetrofitPlan,
  assessManifestQuality,
  buildRefactorPlan,
  buildRepoFingerprint,
  buildRetrofitPlan,
  detectProjectStyle,
  detectVariant,
  readRetrofitPlan,
  refreshPlanStatus,
  scanRepository,
  walkRepoFiles,
  writeRefactorPlan,
  writeRetrofitPlan
};
