const fs = require("node:fs");
const path = require("node:path");
const {
  collectDirectoryOperations,
  collectTemplateOperations,
  ensureDirectory,
  formatCommands,
  isDirectoryEmpty,
  loadManifest,
  readJson,
  renderString,
  slugify,
  toPythonPackage
} = require("./template-utils");
const { compositionDoctor } = require("./composition-catalog");

function loadStacksManifest(repoRoot) {
  return readJson(path.join(repoRoot, "stacks", "manifest.json"));
}

function loadVariant(repoRoot, variantName) {
  const variantDir = path.join(repoRoot, "variants", variantName);
  if (!fs.existsSync(variantDir)) {
    throw new Error(`Unknown variant: ${variantName}`);
  }

  return {
    dir: variantDir,
    manifest: readJson(path.join(variantDir, "variant.json")),
    overlay: fs.readFileSync(path.join(variantDir, "agents.md"), "utf8").trim()
  };
}

function loadStack(repoRoot, stackName) {
  const stackDir = path.join(repoRoot, "stacks", stackName);
  if (!fs.existsSync(stackDir)) {
    throw new Error(`Unknown stack module: ${stackName}`);
  }

  return {
    dir: stackDir,
    manifest: readJson(path.join(stackDir, "stack.json")),
    overlay: fs.readFileSync(path.join(stackDir, "agents.md"), "utf8").trim()
  };
}

function listVariants(repoRoot) {
  const variantsRoot = path.join(repoRoot, "variants");
  return fs
    .readdirSync(variantsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadVariant(repoRoot, entry.name).manifest)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function listStacks(repoRoot, variantName) {
  const stacksRoot = path.join(repoRoot, "stacks");
  return fs
    .readdirSync(stacksRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadStack(repoRoot, entry.name).manifest)
    .filter((entry) => !variantName || (entry.compatibleVariants || []).includes(variantName))
    .sort((left, right) => {
      const categoryCompare = left.category.localeCompare(right.category);
      return categoryCompare !== 0 ? categoryCompare : left.name.localeCompare(right.name);
    });
}

function normalizeStackSelection(stackInput) {
  if (!stackInput) {
    return [];
  }

  const values = Array.isArray(stackInput) ? stackInput : [stackInput];
  return [...new Set(
    values
      .flatMap((value) => String(value).split(","))
      .map((value) => value.trim())
      .filter(Boolean)
  )];
}

function resolveStacks(repoRoot, variantName, stackInput) {
  const selectedNames = normalizeStackSelection(stackInput);
  const stacks = selectedNames.map((name) => loadStack(repoRoot, name));

  for (const stack of stacks) {
    if (!(stack.manifest.compatibleVariants || []).includes(variantName)) {
      throw new Error(
        `Stack module \`${stack.manifest.name}\` is not compatible with variant \`${variantName}\`.`
      );
    }
  }

  return stacks.sort((left, right) => {
    const categoryCompare = left.manifest.category.localeCompare(right.manifest.category);
    return categoryCompare !== 0
      ? categoryCompare
      : left.manifest.name.localeCompare(right.manifest.name);
  });
}

function renderStackSummary(stacks) {
  return stacks.length > 0
    ? stacks.map((stack) => `\`${stack.manifest.name}\` (${stack.manifest.category})`).join(", ")
    : "none selected";
}

function buildVariables({ projectName, variant, packageManager, withCi, withMirrorFiles, stacks }) {
  const projectSlug = slugify(projectName);
  return {
    PROJECT_NAME: projectName,
    PROJECT_SLUG: projectSlug,
    VARIANT: variant.manifest.name,
    RUNTIME: variant.manifest.runtime,
    PACKAGE_MANAGER: packageManager,
    WITH_CI: String(Boolean(withCi)),
    WITH_MIRRORS: String(Boolean(withMirrorFiles)),
    PYTHON_PACKAGE: toPythonPackage(projectName),
    STACKS_JSON: JSON.stringify(stacks.map((stack) => stack.manifest.name)),
    SELECTED_STACKS: renderStackSummary(stacks)
  };
}

function buildStackCommands(stacks, variables) {
  const commandTemplates = stacks.flatMap((stack) => stack.manifest.commands || []);
  return formatCommands(commandTemplates, variables);
}

function buildAgentsContent(repoRoot, variant, stacks, variables) {
  const baseTemplate = fs.readFileSync(
    path.join(repoRoot, "templates", "base", "agents", "base.md"),
    "utf8"
  );
  const commandsBlock = formatCommands(variant.manifest.commands, variables);
  const stackOverlay = stacks.map((stack) => stack.overlay).join("\n\n").trim();
  return renderString(baseTemplate, {
    ...variables,
    COMMANDS_BLOCK: commandsBlock,
    STACK_COMMANDS_BLOCK: buildStackCommands(stacks, variables),
    STACK_OVERLAY: [variant.overlay, stackOverlay].filter(Boolean).join("\n\n")
  });
}

function collectOperations(repoRoot, options) {
  const manifest = loadManifest(repoRoot);
  const variant = loadVariant(repoRoot, options.variant);
  const stacks = resolveStacks(repoRoot, variant.manifest.name, options.stacks);
  const packageManager =
    options.packageManager ||
    (["node", "react", "nextjs"].includes(variant.manifest.name)
      ? manifest.defaultJsPackageManager
      : variant.manifest.packageManagers[0]);
  const projectName = options.projectName || path.basename(options.targetDir);
  const variables = buildVariables({
    projectName,
    variant,
    packageManager,
    withCi: options.withCi,
    withMirrorFiles: options.withMirrorFiles,
    stacks
  });

  const operations = [
    ...collectDirectoryOperations(variant.manifest.directories, variables, options.targetDir),
    ...collectDirectoryOperations(
      stacks.flatMap((stack) => stack.manifest.directories || []),
      variables,
      options.targetDir
    ),
    ...collectTemplateOperations(
      path.join(repoRoot, "templates", "base", "files"),
      variables,
      options.targetDir,
      { exclude: [path.join(".github", "workflows", "ci.yml.tmpl")] }
    ),
    ...collectTemplateOperations(path.join(variant.dir, "files"), variables, options.targetDir),
    ...stacks.flatMap((stack) =>
      collectTemplateOperations(path.join(stack.dir, "files"), variables, options.targetDir)
    ),
    {
      type: "write",
      target: path.join(options.targetDir, "AGENTS.md"),
      content: buildAgentsContent(repoRoot, variant, stacks, variables)
    }
  ];

  if (options.withCi) {
    const ciTemplate = path.join(
      repoRoot,
      "templates",
      "base",
      "files",
      ".github",
      "workflows",
      "ci.yml.tmpl"
    );
    operations.push({
      type: "write",
      target: path.join(options.targetDir, ".github", "workflows", "ci.yml"),
      content: renderString(fs.readFileSync(ciTemplate, "utf8"), {
        ...variables,
        CI_SETUP_COMMAND: renderString(variant.manifest.ciSetupCommand, variables),
        CI_TEST_COMMAND: renderString(variant.manifest.ciTestCommand, variables)
      })
    });
  }

  if (options.withMirrorFiles) {
    const agentsContent = operations.find((entry) => entry.target.endsWith(`${path.sep}AGENTS.md`)).content;
    for (const mirror of manifest.mirrorFiles) {
      operations.push({
        type: "write",
        target: path.join(options.targetDir, mirror.path),
        content: `${mirror.header}${agentsContent}`
      });
    }
  }

  const envLines = stacks.flatMap((stack) =>
    (stack.manifest.env || []).map((line) => renderString(line, variables))
  );
  if (envLines.length > 0) {
    operations.push({
      type: "write",
      target: path.join(options.targetDir, ".env.example"),
      content: `${operations.find((entry) => entry.target.endsWith(`${path.sep}.env.example`)).content.trimEnd()}\n${envLines.join("\n")}\n`
    });
  }

  return { manifest, variant, stacks, variables, operations, packageManager, projectName };
}

function assertTargetState(targetDir, mode, force) {
  if (!fs.existsSync(targetDir)) {
    if (mode === "apply") {
      throw new Error(`Target directory does not exist: ${targetDir}`);
    }
    return;
  }

  if (!isDirectoryEmpty(targetDir) && !force) {
    throw new Error(`Target directory is not empty: ${targetDir}. Use --force to continue.`);
  }
}

function applyOperations(targetDir, operations) {
  ensureDirectory(targetDir);

  for (const operation of operations) {
    if (operation.type === "mkdir") {
      ensureDirectory(operation.target);
      continue;
    }

    ensureDirectory(path.dirname(operation.target));
    fs.writeFileSync(operation.target, operation.content, "utf8");
  }
}

function describeOperations(operations, cwd) {
  return operations
    .map((operation) => {
      const relativeTarget = path.relative(cwd, operation.target) || ".";
      return `${operation.type.toUpperCase()} ${relativeTarget}`;
    })
    .join("\n");
}

function doctor(repoRoot, targetDir) {
  const compositionResult = compositionDoctor(repoRoot, targetDir);
  if (compositionResult) {
    return compositionResult;
  }

  const manifest = loadManifest(repoRoot);
  const metadataPath = path.join(targetDir, manifest.metadataFile);
  const results = [];

  for (const file of manifest.requiredBaseFiles) {
    results.push({
      file,
      ok: fs.existsSync(path.join(targetDir, file))
    });
  }

  if (!fs.existsSync(metadataPath)) {
    return {
      ok: false,
      variant: null,
      results,
      error: `Missing metadata file: ${manifest.metadataFile}`
    };
  }

  const metadata = readJson(metadataPath);
  let variant;
  try {
    variant = loadVariant(repoRoot, metadata.variant);
  } catch (error) {
    return {
      ok: false,
      variant: metadata.variant,
      results,
      error: error.message
    };
  }

  const variables = {
    PYTHON_PACKAGE: toPythonPackage(metadata.projectName)
  };

  for (const file of variant.manifest.requiredFiles) {
    const rendered = renderString(file, variables);
    results.push({
      file: rendered,
      ok: fs.existsSync(path.join(targetDir, rendered))
    });
  }

  const selectedStacks = resolveStacks(repoRoot, variant.manifest.name, metadata.stacks || []);
  for (const stack of selectedStacks) {
    for (const file of stack.manifest.requiredFiles || []) {
      const rendered = renderString(file, variables);
      results.push({
        file: rendered,
        ok: fs.existsSync(path.join(targetDir, rendered))
      });
    }
  }

  if (metadata.withMirrorFiles) {
    for (const mirror of manifest.mirrorFiles) {
      results.push({
        file: mirror.path,
        ok: fs.existsSync(path.join(targetDir, mirror.path))
      });
    }
  }

  if (metadata.withCi) {
    results.push({
      file: ".github/workflows/ci.yml",
      ok: fs.existsSync(path.join(targetDir, ".github", "workflows", "ci.yml"))
    });
  }

  return {
    ok: results.every((entry) => entry.ok),
    variant: variant.manifest.name,
    stacks: selectedStacks.map((stack) => stack.manifest.name),
    results
  };
}

module.exports = {
  applyOperations,
  assertTargetState,
  buildAgentsContent,
  collectOperations,
  describeOperations,
  doctor,
  listStacks,
  listVariants,
  loadManifest,
  loadStack,
  loadStacksManifest,
  loadVariant,
  normalizeStackSelection,
  resolveStacks
};
