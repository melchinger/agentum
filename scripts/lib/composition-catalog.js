const fs = require("node:fs");
const path = require("node:path");
const {
  ensureDirectory,
  readJson,
  renderString,
  resolveTemplateTarget,
  slugify,
  toPythonPackage,
  walkTemplateFiles
} = require("./template-utils");

function loadManifest(repoRoot) {
  return readJson(path.join(repoRoot, "templates", "manifest.json"));
}

function loadEntity(repoRoot, relativeDir, manifestFile, label) {
  const entityDir = path.join(repoRoot, relativeDir);
  if (!fs.existsSync(entityDir)) {
    throw new Error(`Unknown ${label}: ${path.basename(relativeDir)}`);
  }

  return {
    dir: entityDir,
    manifest: readJson(path.join(entityDir, manifestFile)),
    overlay: fs.existsSync(path.join(entityDir, "agents.md"))
      ? fs.readFileSync(path.join(entityDir, "agents.md"), "utf8").trim()
      : ""
  };
}

function listEntityManifests(repoRoot, rootDir, manifestFile) {
  const absoluteRoot = path.join(repoRoot, rootDir);
  if (!fs.existsSync(absoluteRoot)) {
    return [];
  }

  const manifests = [];
  function visit(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.name === manifestFile) {
        manifests.push(readJson(absolutePath));
      }
    }
  }
  visit(absoluteRoot);
  return manifests.sort((left, right) => left.name.localeCompare(right.name));
}

function loadProfile(repoRoot, name) {
  return loadEntity(repoRoot, path.join("profiles", name), "profile.json", "profile");
}

function loadRuntime(repoRoot, name) {
  return loadEntity(repoRoot, path.join("runtimes", name), "runtime.json", "runtime");
}

function loadModule(repoRoot, category, name) {
  return loadEntity(repoRoot, path.join("modules", category, name), "module.json", "module");
}

function loadModuleByName(repoRoot, name) {
  const modulesRoot = path.join(repoRoot, "modules");
  for (const categoryEntry of fs.readdirSync(modulesRoot, { withFileTypes: true })) {
    if (!categoryEntry.isDirectory()) {
      continue;
    }
    const candidateDir = path.join(modulesRoot, categoryEntry.name, name);
    if (fs.existsSync(candidateDir)) {
      return {
        dir: candidateDir,
        manifest: readJson(path.join(candidateDir, "module.json")),
        overlay: fs.existsSync(path.join(candidateDir, "agents.md"))
          ? fs.readFileSync(path.join(candidateDir, "agents.md"), "utf8").trim()
          : ""
      };
    }
  }
  throw new Error(`Unknown module: ${name}`);
}

function loadPolicy(repoRoot, name) {
  return loadEntity(repoRoot, path.join("policies", name), "policy.json", "policy");
}

function normalizeSelection(input) {
  if (!input) {
    return [];
  }
  const values = Array.isArray(input) ? input : [input];
  return [...new Set(
    values
      .flatMap((value) => String(value).split(","))
      .map((value) => value.trim())
      .filter(Boolean)
  )];
}

function listProfiles(repoRoot) {
  return listEntityManifests(repoRoot, "profiles", "profile.json");
}

function listRuntimes(repoRoot) {
  return listEntityManifests(repoRoot, "runtimes", "runtime.json");
}

function listModules(repoRoot, filters = {}) {
  return listEntityManifests(repoRoot, "modules", "module.json")
    .filter((entry) => !filters.category || entry.category === filters.category)
    .filter((entry) => !filters.runtime || (entry.compatibleRuntimes || []).includes(filters.runtime));
}

function listPolicies(repoRoot) {
  return listEntityManifests(repoRoot, "policies", "policy.json");
}

function ensureModuleClosure(repoRoot, requestedNames) {
  const resolved = new Map();
  const queue = [...requestedNames];

  while (queue.length > 0) {
    const name = queue.shift();
    if (resolved.has(name)) {
      continue;
    }
    const moduleEntity = loadModuleByName(repoRoot, name);
    resolved.set(name, moduleEntity);
    for (const implied of moduleEntity.manifest.implies || []) {
      queue.push(implied);
    }
  }

  return [...resolved.values()].sort((left, right) => {
    const categoryCompare = left.manifest.category.localeCompare(right.manifest.category);
    return categoryCompare !== 0
      ? categoryCompare
      : left.manifest.name.localeCompare(right.manifest.name);
  });
}

function evaluateRuleWhen(context, when = {}) {
  if (when.runtimeIn && !when.runtimeIn.includes(context.runtime)) {
    return false;
  }
  if (when.runtimeNotIn && when.runtimeNotIn.includes(context.runtime)) {
    return false;
  }
  if (when.profileIn && !when.profileIn.includes(context.profile)) {
    return false;
  }
  if (when.profileNotIn && when.profileNotIn.includes(context.profile)) {
    return false;
  }
  if (when.modulesAll && !when.modulesAll.every((item) => context.modules.includes(item))) {
    return false;
  }
  if (when.modulesAny && !when.modulesAny.some((item) => context.modules.includes(item))) {
    return false;
  }
  if (when.modulesMissing && !when.modulesMissing.some((item) => !context.modules.includes(item))) {
    return false;
  }
  return true;
}

function resolveComposition(repoRoot, options = {}) {
  const profile = options.profile ? loadProfile(repoRoot, options.profile) : null;
  const runtimeName = options.runtime || profile?.manifest.recommendedRuntime;
  if (!runtimeName) {
    throw new Error("Composition requires a runtime or a profile with recommendedRuntime.");
  }
  const runtime = loadRuntime(repoRoot, runtimeName);
  const requestedModules = normalizeSelection([
    ...(profile?.manifest.defaultModules || []),
    ...(options.modules || [])
  ]);
  const modules = ensureModuleClosure(repoRoot, requestedModules);
  const policyNames = normalizeSelection([
    ...(profile?.manifest.requiredPolicies || []),
    ...(options.policies || []),
    ...(options.withCi ? ["ci"] : []),
    ...(options.withMirrorFiles ? ["mirror-instructions"] : [])
  ]);
  const policies = policyNames.map((name) => loadPolicy(repoRoot, name));

  const errors = [];
  const warnings = [];
  const info = [];
  const moduleNames = modules.map((entry) => entry.manifest.name);

  for (const moduleEntity of modules) {
    if (!(moduleEntity.manifest.compatibleRuntimes || []).includes(runtime.manifest.name)) {
      errors.push(`Module \`${moduleEntity.manifest.name}\` is not compatible with runtime \`${runtime.manifest.name}\`.`);
    }
    for (const dependency of moduleEntity.manifest.requiresModules || []) {
      if (!moduleNames.includes(dependency)) {
        errors.push(`Module \`${moduleEntity.manifest.name}\` requires module \`${dependency}\`.`);
      }
    }
    for (const conflict of moduleEntity.manifest.conflictsWith || []) {
      if (moduleNames.includes(conflict)) {
        errors.push(`Module \`${moduleEntity.manifest.name}\` conflicts with module \`${conflict}\`.`);
      }
    }
  }

  const ruleContext = {
    profile: profile?.manifest.name || null,
    runtime: runtime.manifest.name,
    modules: moduleNames
  };
  const entitiesWithRules = [
    ...(profile?.manifest.rules ? [{ label: `profile:${profile.manifest.name}`, rules: profile.manifest.rules }] : []),
    ...(runtime.manifest.rules ? [{ label: `runtime:${runtime.manifest.name}`, rules: runtime.manifest.rules }] : []),
    ...modules
      .filter((entry) => Array.isArray(entry.manifest.rules))
      .map((entry) => ({ label: `module:${entry.manifest.name}`, rules: entry.manifest.rules }))
  ];
  for (const entity of entitiesWithRules) {
    for (const rule of entity.rules) {
      if (!evaluateRuleWhen(ruleContext, rule.when)) {
        continue;
      }
      const bucket = rule.level === "error" ? errors : rule.level === "warning" ? warnings : info;
      bucket.push(`${entity.label}: ${rule.message}`);
    }
  }

  return {
    profile,
    runtime,
    modules,
    policies,
    errors,
    warnings,
    info
  };
}

function collectTemplateOperations(templateRoot, variables, targetDir) {
  if (!fs.existsSync(templateRoot)) {
    return [];
  }
  return walkTemplateFiles(templateRoot).map((filePath) => {
    const relativeTarget = resolveTemplateTarget(templateRoot, filePath, variables);
    return {
      type: "write",
      target: path.join(targetDir, relativeTarget),
      content: renderString(fs.readFileSync(filePath, "utf8"), variables)
    };
  });
}

function collectDirectoryOperations(directories, variables, targetDir) {
  return (directories || []).map((directory) => ({
    type: "mkdir",
    target: path.join(targetDir, renderString(directory, variables))
  }));
}

function formatCommands(commandTemplates, variables) {
  if (!commandTemplates || commandTemplates.length === 0) {
    return "- None defined.";
  }
  return commandTemplates
    .map((command) => {
      const [label, template] = command.split(": ");
      return `- \`${label}\`: \`${renderString(template, variables)}\``;
    })
    .join("\n");
}

function buildVariables(options) {
  const projectSlug = slugify(options.projectName);
  return {
    PROJECT_NAME: options.projectName,
    PROJECT_SLUG: projectSlug,
    VARIANT: options.runtimeName,
    RUNTIME: options.runtimeName,
    PACKAGE_MANAGER: options.packageManager,
    PYTHON_PACKAGE: toPythonPackage(options.projectName),
    PROFILE_NAME: options.profileName || "none",
    RUNTIME_NAME: options.runtimeName,
    MODULES_JSON: JSON.stringify(options.moduleNames),
    POLICIES_JSON: JSON.stringify(options.policyNames),
    SELECTED_STACKS: options.moduleNames.length > 0 ? options.moduleNames.join(", ") : "none selected"
  };
}

function buildCompositionAgentsContent(repoRoot, composition, variables) {
  const baseTemplate = fs.readFileSync(
    path.join(repoRoot, "templates", "base", "agents", "base.md"),
    "utf8"
  );
  const overlay = [
    composition.profile?.overlay,
    composition.runtime.overlay,
    ...composition.modules.map((entry) => entry.overlay),
    ...composition.policies.map((entry) => entry.overlay)
  ].filter(Boolean).join("\n\n");
  return renderString(baseTemplate, {
    ...variables,
    VARIANT: variables.RUNTIME_NAME,
    RUNTIME: composition.runtime.manifest.language,
    COMMANDS_BLOCK: formatCommands(composition.runtime.manifest.commands, variables),
    STACK_COMMANDS_BLOCK: formatCommands(
      [
        ...composition.modules.flatMap((entry) => entry.manifest.commands || []),
        ...composition.policies.flatMap((entry) => entry.manifest.commands || [])
      ],
      variables
    ),
    STACK_OVERLAY: overlay
  });
}

function buildCompositionMetadata(composition, variables, options) {
  return JSON.stringify(
    {
      generator: "agentum",
      projectName: options.projectName,
      profile: composition.profile?.manifest.name || null,
      runtime: composition.runtime.manifest.name,
      modules: composition.modules.map((entry) => entry.manifest.name),
      policies: composition.policies.map((entry) => entry.manifest.name),
      packageManager: options.packageManager,
      withCi: composition.policies.some((entry) => entry.manifest.name === "ci"),
      withMirrorFiles: composition.policies.some((entry) => entry.manifest.name === "mirror-instructions")
    },
    null,
    2
  );
}

function describeComposition(composition) {
  const lines = [
    `Profile: ${composition.profile?.manifest.name || "none"}`,
    `Runtime: ${composition.runtime.manifest.name}`,
    `Modules: ${composition.modules.map((entry) => entry.manifest.name).join(", ") || "none"}`,
    `Policies: ${composition.policies.map((entry) => entry.manifest.name).join(", ") || "none"}`
  ];
  if (composition.errors.length > 0) {
    lines.push(`Errors: ${composition.errors.join(" | ")}`);
  }
  if (composition.warnings.length > 0) {
    lines.push(`Warnings: ${composition.warnings.join(" | ")}`);
  }
  if (composition.info.length > 0) {
    lines.push(`Info: ${composition.info.join(" | ")}`);
  }
  return lines.join("\n");
}

function collectCompositionOperations(repoRoot, options) {
  const manifest = loadManifest(repoRoot);
  const composition = resolveComposition(repoRoot, options);
  if (composition.errors.length > 0) {
    throw new Error(composition.errors.join(" "));
  }

  const projectName = options.projectName || path.basename(options.targetDir);
  const packageManager = options.packageManager || composition.runtime.manifest.packageManagers[0];
  const variables = buildVariables({
    projectName,
    packageManager,
    profileName: composition.profile?.manifest.name || "none",
    runtimeName: composition.runtime.manifest.name,
    moduleNames: composition.modules.map((entry) => entry.manifest.name),
    policyNames: composition.policies.map((entry) => entry.manifest.name)
  });

  const operations = [
    ...collectTemplateOperations(path.join(repoRoot, "templates", "base", "files"), variables, options.targetDir)
      .filter((entry) => !entry.target.endsWith(`${path.sep}.agentum-template.json`) && !entry.target.endsWith(`${path.sep}ci.yml`)),
    ...collectDirectoryOperations(composition.runtime.manifest.directories, variables, options.targetDir),
    ...collectTemplateOperations(path.join(composition.runtime.dir, "files"), variables, options.targetDir),
    ...composition.modules.flatMap((entry) => [
      ...collectDirectoryOperations(entry.manifest.directories, variables, options.targetDir),
      ...collectTemplateOperations(path.join(entry.dir, "files"), variables, options.targetDir)
    ]),
    {
      type: "write",
      target: path.join(options.targetDir, "AGENTS.md"),
      content: buildCompositionAgentsContent(repoRoot, composition, variables)
    },
    {
      type: "write",
      target: path.join(options.targetDir, manifest.metadataFile),
      content: buildCompositionMetadata(composition, variables, { projectName, packageManager })
    }
  ];

  const envLines = composition.modules.flatMap((entry) =>
    (entry.manifest.env || []).map((line) => renderString(line, variables))
  );
  if (envLines.length > 0) {
    const envTarget = path.join(options.targetDir, ".env.example");
    const baseEnv = operations.find((entry) => entry.target === envTarget)?.content || "";
    operations.push({
      type: "write",
      target: envTarget,
      content: `${baseEnv.trimEnd()}\n${envLines.join("\n")}\n`
    });
  }

  if (composition.policies.some((entry) => entry.manifest.name === "ci")) {
    const ciTemplate = path.join(repoRoot, "templates", "base", "files", ".github", "workflows", "ci.yml.tmpl");
    const installCommand = composition.runtime.manifest.commands.find((item) => item.startsWith("install: "));
    const testCommand = composition.runtime.manifest.commands.find((item) => item.startsWith("test: "));
    operations.push({
      type: "write",
      target: path.join(options.targetDir, ".github", "workflows", "ci.yml"),
      content: renderString(fs.readFileSync(ciTemplate, "utf8"), {
        ...variables,
        CI_SETUP_COMMAND: renderString((installCommand || "install: true").slice(9), variables),
        CI_TEST_COMMAND: renderString((testCommand || "test: true").slice(6), variables)
      })
    });
  }

  if (composition.policies.some((entry) => entry.manifest.name === "mirror-instructions")) {
    const agentsContent = operations.find((entry) => entry.target.endsWith(`${path.sep}AGENTS.md`)).content;
    for (const mirror of manifest.mirrorFiles) {
      operations.push({
        type: "write",
        target: path.join(options.targetDir, mirror.path),
        content: `${mirror.header}${agentsContent}`
      });
    }
  }

  return {
    composition,
    projectName,
    packageManager,
    variables,
    operations
  };
}

function compositionDoctor(repoRoot, targetDir) {
  const manifest = loadManifest(repoRoot);
  const metadataPath = path.join(targetDir, manifest.metadataFile);
  if (!fs.existsSync(metadataPath)) {
    return null;
  }

  const metadata = readJson(metadataPath);
  if (!metadata.runtime) {
    return null;
  }

  const composition = resolveComposition(repoRoot, {
    profile: metadata.profile || undefined,
    runtime: metadata.runtime,
    modules: metadata.modules || [],
    policies: metadata.policies || []
  });
  const variables = {
    PYTHON_PACKAGE: toPythonPackage(metadata.projectName || path.basename(targetDir))
  };
  const results = [];
  for (const file of manifest.requiredBaseFiles) {
    results.push({ file, ok: fs.existsSync(path.join(targetDir, file)) });
  }
  for (const file of composition.runtime.manifest.requiredFiles || []) {
    const rendered = renderString(file, variables);
    results.push({ file: rendered, ok: fs.existsSync(path.join(targetDir, rendered)) });
  }
  for (const moduleEntity of composition.modules) {
    for (const file of moduleEntity.manifest.requiredFiles || []) {
      const rendered = renderString(file, variables);
      results.push({ file: rendered, ok: fs.existsSync(path.join(targetDir, rendered)) });
    }
  }
  if (composition.policies.some((entry) => entry.manifest.name === "ci")) {
    results.push({
      file: ".github/workflows/ci.yml",
      ok: fs.existsSync(path.join(targetDir, ".github", "workflows", "ci.yml"))
    });
  }
  if (composition.policies.some((entry) => entry.manifest.name === "mirror-instructions")) {
    for (const mirror of manifest.mirrorFiles) {
      results.push({ file: mirror.path, ok: fs.existsSync(path.join(targetDir, mirror.path)) });
    }
  }

  return {
    ok: results.every((entry) => entry.ok),
    profile: composition.profile?.manifest.name || null,
    runtime: composition.runtime.manifest.name,
    modules: composition.modules.map((entry) => entry.manifest.name),
    policies: composition.policies.map((entry) => entry.manifest.name),
    results
  };
}

module.exports = {
  collectCompositionOperations,
  compositionDoctor,
  describeComposition,
  listModules,
  listPolicies,
  listProfiles,
  listRuntimes,
  normalizeSelection,
  resolveComposition
};
