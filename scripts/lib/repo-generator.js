const fs = require("node:fs");
const path = require("node:path");
const {
  ensureDirectory,
  isDirectoryEmpty,
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

function listVariants(repoRoot) {
  const variantsRoot = path.join(repoRoot, "variants");
  return fs
    .readdirSync(variantsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => loadVariant(repoRoot, entry.name).manifest)
    .sort((left, right) => left.name.localeCompare(right.name));
}

function buildVariables({ projectName, variant, packageManager, withCi, withMirrorFiles }) {
  const projectSlug = slugify(projectName);
  return {
    PROJECT_NAME: projectName,
    PROJECT_SLUG: projectSlug,
    VARIANT: variant.manifest.name,
    RUNTIME: variant.manifest.runtime,
    PACKAGE_MANAGER: packageManager,
    WITH_CI: String(Boolean(withCi)),
    WITH_MIRRORS: String(Boolean(withMirrorFiles)),
    PYTHON_PACKAGE: toPythonPackage(projectName)
  };
}

function formatCommands(commandTemplates, variables) {
  return commandTemplates
    .map((command) => {
      const [label, template] = command.split(": ");
      return `- \`${label}\`: \`${renderString(template, variables)}\``;
    })
    .join("\n");
}

function buildAgentsContent(repoRoot, variant, variables) {
  const baseTemplate = fs.readFileSync(
    path.join(repoRoot, "templates", "base", "agents", "base.md"),
    "utf8"
  );
  const commandsBlock = formatCommands(variant.manifest.commands, variables);
  return renderString(baseTemplate, {
    ...variables,
    COMMANDS_BLOCK: commandsBlock,
    STACK_OVERLAY: variant.overlay
  });
}

function collectTemplateOperations(templateRoot, variables, targetDir, options = {}) {
  return walkTemplateFiles(templateRoot)
    .filter((filePath) => !options.exclude?.includes(path.relative(templateRoot, filePath)))
    .map((filePath) => {
    const relativeTarget = resolveTemplateTarget(templateRoot, filePath, variables);
    const absoluteTarget = path.join(targetDir, relativeTarget);
    const content = renderString(fs.readFileSync(filePath, "utf8"), variables);
    return { type: "write", target: absoluteTarget, content };
  });
}

function collectDirectoryOperations(directories, variables, targetDir) {
  return directories.map((directory) => ({
    type: "mkdir",
    target: path.join(targetDir, renderString(directory, variables))
  }));
}

function collectOperations(repoRoot, options) {
  const manifest = loadManifest(repoRoot);
  const variant = loadVariant(repoRoot, options.variant);
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
    withMirrorFiles: options.withMirrorFiles
  });

  const operations = [
    ...collectDirectoryOperations(variant.manifest.directories, variables, options.targetDir),
    ...collectTemplateOperations(
      path.join(repoRoot, "templates", "base", "files"),
      variables,
      options.targetDir,
      { exclude: [path.join(".github", "workflows", "ci.yml.tmpl")] }
    ),
    ...collectTemplateOperations(path.join(variant.dir, "files"), variables, options.targetDir),
    {
      type: "write",
      target: path.join(options.targetDir, "AGENTS.md"),
      content: buildAgentsContent(repoRoot, variant, variables)
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

  return { manifest, variant, variables, operations, packageManager, projectName };
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
  listVariants,
  loadManifest,
  loadVariant
};
