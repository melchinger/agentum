const fs = require("node:fs");
const path = require("node:path");
const {
  collectDirectoryOperations,
  collectTemplateOperations,
  ensureDirectory,
  formatCommands,
  loadManifest,
  readJson,
  renderString,
  slugify,
  toPythonPackage
} = require("./template-utils");

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
  // Handle both single runtime (backward compat) and multiple runtimes
  const runtimes = context.runtimes || [context.runtime];

  if (when.runtimeIn) {
    const hasMatch = runtimes.some((rt) => when.runtimeIn.includes(rt));
    if (!hasMatch) {
      return false;
    }
  }
  if (when.runtimeNotIn) {
    const hasMatch = runtimes.some((rt) => when.runtimeNotIn.includes(rt));
    if (hasMatch) {
      return false;
    }
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

  // Support both single runtime and multiple runtimes
  let runtimes = [];
  if (options.runtimes) {
    // Multiple runtimes
    runtimes = Array.isArray(options.runtimes)
      ? options.runtimes
      : normalizeSelection(options.runtimes);
  } else if (options.runtime) {
    // Single runtime
    runtimes = [options.runtime];
  } else if (profile?.manifest.runtimes) {
    // Profile specifies multiple runtimes
    runtimes = Array.isArray(profile.manifest.runtimes)
      ? profile.manifest.runtimes
      : normalizeSelection(profile.manifest.runtimes);
  } else if (profile?.manifest.recommendedRuntime) {
    // Profile specifies single runtime
    runtimes = [profile.manifest.recommendedRuntime];
  }

  if (runtimes.length === 0) {
    throw new Error("Composition requires a runtime or a profile with runtimes/recommendedRuntime.");
  }

  const runtimeEntities = runtimes.map((name) => loadRuntime(repoRoot, name));

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
    const compatibleRuntimes = moduleEntity.manifest.compatibleRuntimes || [];
    const isCompatible = runtimes.every((rt) => compatibleRuntimes.includes(rt)) ||
                         runtimes.some((rt) => compatibleRuntimes.includes(rt));

    if (!isCompatible && compatibleRuntimes.length > 0) {
      errors.push(`Module \`${moduleEntity.manifest.name}\` is not compatible with runtimes \`${runtimes.join(", ")}\`.`);
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
    runtimes: runtimes,
    runtime: runtimes[0], // For backward compatibility
    modules: moduleNames
  };
  const entitiesWithRules = [
    ...(profile?.manifest.rules ? [{ label: `profile:${profile.manifest.name}`, rules: profile.manifest.rules }] : []),
    ...runtimeEntities
      .filter((entry) => entry.manifest.rules)
      .map((entry) => ({ label: `runtime:${entry.manifest.name}`, rules: entry.manifest.rules })),
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
    runtimes: runtimeEntities,
    runtime: runtimeEntities[0], // For backward compatibility
    modules,
    policies,
    errors,
    warnings,
    info
  };
}

function buildVariables(options) {
  const projectSlug = slugify(options.projectName);
  // For backward compatibility, use first runtime as primary
  const primaryRuntimeName = Array.isArray(options.runtimeNames)
    ? options.runtimeNames[0]
    : options.runtimeName;

  return {
    PROJECT_NAME: options.projectName,
    PROJECT_SLUG: projectSlug,
    VARIANT: primaryRuntimeName,
    RUNTIME: primaryRuntimeName,
    PACKAGE_MANAGER: options.packageManager,
    PYTHON_PACKAGE: toPythonPackage(options.projectName),
    PROFILE_NAME: options.profileName || "none",
    RUNTIME_NAME: primaryRuntimeName,
    RUNTIMES_JSON: JSON.stringify(Array.isArray(options.runtimeNames) ? options.runtimeNames : [primaryRuntimeName]),
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
  const runtimes = Array.isArray(composition.runtimes)
    ? composition.runtimes
    : [composition.runtime];

  const overlay = [
    composition.profile?.overlay,
    ...runtimes.map((r) => r.overlay),
    ...composition.modules.map((entry) => entry.overlay),
    ...composition.policies.map((entry) => entry.overlay)
  ].filter(Boolean).join("\n\n");

  // For multi-runtime, generate commands for each runtime
  const runtimeCommandsBlocks = runtimes.length > 1
    ? runtimes.map((runtime) =>
        `### ${runtime.manifest.language}\n${formatCommands(runtime.manifest.commands, variables)}`
      ).join("\n\n")
    : formatCommands(runtimes[0].manifest.commands, variables);

  return renderString(baseTemplate, {
    ...variables,
    VARIANT: variables.RUNTIME_NAME,
    RUNTIME: runtimes[0].manifest.language,
    COMMANDS_BLOCK: runtimeCommandsBlocks,
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
  const runtimes = Array.isArray(composition.runtimes)
    ? composition.runtimes.map((r) => r.manifest.name)
    : [composition.runtime.manifest.name];

  return JSON.stringify(
    {
      generator: "agentum",
      projectName: options.projectName,
      profile: composition.profile?.manifest.name || null,
      runtimes: runtimes.length > 1 ? runtimes : undefined,
      runtime: runtimes[0],
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
  const runtimes = Array.isArray(composition.runtimes)
    ? composition.runtimes.map((r) => r.manifest.name).join(", ")
    : composition.runtime.manifest.name;

  const lines = [
    `Profile: ${composition.profile?.manifest.name || "none"}`,
    `Runtime(s): ${runtimes}`,
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
  const runtimes = Array.isArray(composition.runtimes)
    ? composition.runtimes
    : [composition.runtime];
  const packageManager = options.packageManager || runtimes[0].manifest.packageManagers[0];

  const variables = buildVariables({
    projectName,
    packageManager,
    profileName: composition.profile?.manifest.name || "none",
    runtimeName: runtimes[0].manifest.name,
    runtimeNames: runtimes.map((r) => r.manifest.name),
    moduleNames: composition.modules.map((entry) => entry.manifest.name),
    policyNames: composition.policies.map((entry) => entry.manifest.name)
  });

  const operations = [
    ...collectTemplateOperations(path.join(repoRoot, "templates", "base", "files"), variables, options.targetDir)
      .filter((entry) => !entry.target.endsWith(`${path.sep}.agentum-template.json`) && !entry.target.endsWith(`${path.sep}ci.yml`)),
    ...runtimes.flatMap((runtime) => [
      ...collectDirectoryOperations(runtime.manifest.directories, variables, options.targetDir),
      ...collectTemplateOperations(path.join(runtime.dir, "files"), variables, options.targetDir)
    ]),
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
    // For multi-runtime, use first runtime commands as primary
    const installCommand = runtimes[0].manifest.commands.find((item) => item.startsWith("install: "));
    const testCommand = runtimes[0].manifest.commands.find((item) => item.startsWith("test: "));
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
  if (!metadata.runtime && !metadata.runtimes) {
    return null;
  }

  const composition = resolveComposition(repoRoot, {
    profile: metadata.profile || undefined,
    runtimes: metadata.runtimes || [metadata.runtime],
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

  const runtimes = Array.isArray(composition.runtimes)
    ? composition.runtimes
    : [composition.runtime];
  for (const runtime of runtimes) {
    for (const file of runtime.manifest.requiredFiles || []) {
      const rendered = renderString(file, variables);
      results.push({ file: rendered, ok: fs.existsSync(path.join(targetDir, rendered)) });
    }
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

  const runtimeNames = Array.isArray(metadata.runtimes)
    ? metadata.runtimes
    : [metadata.runtime];

  return {
    ok: results.every((entry) => entry.ok),
    profile: composition.profile?.manifest.name || null,
    runtimes: runtimeNames.length > 1 ? runtimeNames : undefined,
    runtime: runtimeNames[0],
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
