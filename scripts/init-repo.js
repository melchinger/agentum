#!/usr/bin/env node

const path = require("node:path");
const fs = require("node:fs");
const readline = require("node:readline/promises");
const { stdin: processStdin, stdout: processStdout } = require("node:process");
const {
  applyOperations,
  assertTargetState,
  collectOperations,
  describeOperations,
  doctor,
  listStacks,
  listVariants,
  loadManifest,
  normalizeStackSelection
} = require("./lib/repo-generator");
const {
  collectCompositionOperations,
  describeComposition,
  listModules,
  listPolicies,
  listProfiles,
  listRuntimes,
  normalizeSelection,
  resolveComposition
} = require("./lib/composition-catalog");
const {
  applyRetrofitPlan,
  buildRefactorPlan,
  buildRetrofitPlan,
  scanRepository,
  writeRefactorPlan,
  writeRetrofitPlan
} = require("./lib/retrofit-engine");

const repoRoot = path.resolve(__dirname, "..");

function joinNames(entries) {
  return entries.map((entry) => entry.name).join(", ");
}

function findByName(entries, name, label) {
  const match = entries.find((entry) => entry.name === name);
  if (!match) {
    throw new Error(`Unknown ${label}: ${name}`);
  }
  return match;
}

async function askWithDefault(rl, label, defaultValue) {
  const suffix = defaultValue ? ` (${defaultValue})` : "";
  const answer = (await rl.question(`${label}${suffix}: `)).trim();
  return answer || defaultValue || "";
}

async function askYesNo(rl, label, defaultValue) {
  const answer = (
    await rl.question(`${label} (${defaultValue ? "Y/n" : "y/N"}): `)
  )
    .trim()
    .toLowerCase();

  if (!answer) {
    return defaultValue;
  }

  if (["y", "yes"].includes(answer)) {
    return true;
  }

  if (["n", "no"].includes(answer)) {
    return false;
  }

  throw new Error(`Please answer yes or no for "${label}".`);
}

function createPromptInterface(io) {
  if (Array.isArray(io.promptAnswers)) {
    let index = 0;
    return {
      async question(message) {
        io.stdout.write(message);
        const answer = io.promptAnswers[index];
        index += 1;
        return `${answer ?? ""}`;
      },
      close() {}
    };
  }

  return readline.createInterface({ input: io.stdin, output: io.stdout });
}

function emitOutput(output, flags, payload, renderText) {
  if (flags.json) {
    output.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  renderText();
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();
  const positionals = [];
  const flags = {};

  while (args.length > 0) {
    const current = args.shift();
    if (!current.startsWith("--")) {
      positionals.push(current);
      continue;
    }

    const key = current.slice(2);
    if (key.includes("=")) {
      const [name, value] = key.split("=");
      flags[name] = value;
      continue;
    }

    if (args[0] && !args[0].startsWith("--")) {
      flags[key] = args.shift();
    } else {
      flags[key] = true;
    }
  }

  return { command, positionals, flags };
}

async function promptForMissing(command, positionals, flags, io) {
  const variants = listVariants(repoRoot);
  const manifest = loadManifest(repoRoot);
  const rl = createPromptInterface(io);

  try {
    const targetDir =
      positionals[0] ||
      (await rl.question("Target directory: ")).trim();
    let variant = flags.variant;
    if (!variant) {
      io.stdout.write(
        `Available variants: ${variants.map((entry) => entry.name).join(", ")}\n`
      );
      variant = (await rl.question("Variant: ")).trim();
    }

    const projectName =
      flags["project-name"] ||
      (await rl.question(
        `Project name (${path.basename(path.resolve(targetDir))}): `
      )).trim() ||
      path.basename(path.resolve(targetDir));

    let packageManager = flags["package-manager"];
    if (!packageManager) {
      const suggested =
        ["node", "react", "nextjs"].includes(variant)
          ? manifest.defaultJsPackageManager
          : "";
      packageManager =
        (await rl.question(
          suggested
            ? `Package manager (${suggested}): `
            : "Package manager (optional): "
        )).trim() || suggested;
    }

    const stacksInput =
      flags.stacks ||
      (await rl.question("Stack modules (comma-separated, optional): ")).trim();
    const stacks = normalizeStackSelection(stacksInput);

    const withCi =
      typeof flags["with-ci"] === "boolean"
        ? flags["with-ci"]
        : ["y", "yes"].includes(
            (
              await rl.question(
                `Include CI workflow (${manifest.interactiveDefaults.withCi ? "Y/n" : "y/N"}): `
              )
            )
              .trim()
              .toLowerCase()
          );
    const withMirrorFiles =
      typeof flags["with-mirror-files"] === "boolean"
        ? flags["with-mirror-files"]
        : ["y", "yes"].includes(
            (
              await rl.question(
                `Generate mirror files (${manifest.interactiveDefaults.withMirrorFiles ? "Y/n" : "y/N"}): `
              )
            )
              .trim()
              .toLowerCase()
          );

    return {
      command,
      targetDir: path.resolve(targetDir),
      variant,
      projectName,
      packageManager,
      stacks,
      withCi,
      withMirrorFiles,
      dryRun: Boolean(flags["dry-run"]),
      force: Boolean(flags.force)
    };
  } finally {
    rl.close();
  }
}

async function promptForWizard(positionals, flags, io) {
  const variants = listVariants(repoRoot);
  const profiles = listProfiles(repoRoot);
  const runtimes = listRuntimes(repoRoot);
  const policies = listPolicies(repoRoot);
  const manifest = loadManifest(repoRoot);
  const rl = createPromptInterface(io);

  try {
    const targetDir = path.resolve(
      positionals[0] || (await askWithDefault(rl, "Target directory", ""))
    );
    const projectName = await askWithDefault(
      rl,
      "Project name",
      flags["project-name"] || path.basename(targetDir)
    );
    const setupType = await askWithDefault(
      rl,
      "Setup type (composition or variant)",
      flags.variant ? "variant" : "composition"
    );

    if (!["composition", "variant"].includes(setupType)) {
      throw new Error(`Unknown setup type: ${setupType}`);
    }

    if (setupType === "variant") {
      io.stdout.write(`Available variants: ${joinNames(variants)}\n`);
      const variant = await askWithDefault(rl, "Variant", flags.variant || "");
      const variantManifest = findByName(variants, variant, "variant");
      const packageManagerDefault =
        flags["package-manager"] ||
        (["node", "react", "nextjs"].includes(variantManifest.name)
          ? manifest.defaultJsPackageManager
          : "");
      const packageManager = await askWithDefault(
        rl,
        "Package manager",
        packageManagerDefault
      );
      const availableStacks = listStacks(repoRoot, variantManifest.name);
      if (availableStacks.length > 0) {
        io.stdout.write(
          `Available stack modules: ${availableStacks.map((entry) => entry.name).join(", ")}\n`
        );
      }
      const stacks = normalizeStackSelection(
        await askWithDefault(rl, "Stack modules (comma-separated, optional)", flags.stacks || "")
      );
      const withCi =
        typeof flags["with-ci"] === "boolean"
          ? flags["with-ci"]
          : await askYesNo(rl, "Include CI workflow", manifest.interactiveDefaults.withCi);
      const withMirrorFiles =
        typeof flags["with-mirror-files"] === "boolean"
          ? flags["with-mirror-files"]
          : await askYesNo(
              rl,
              "Generate mirror files",
              manifest.interactiveDefaults.withMirrorFiles
            );

      return {
        mode: "variant",
        targetDir,
        projectName,
        variant,
        packageManager,
        stacks,
        withCi,
        withMirrorFiles,
        dryRun: Boolean(flags["dry-run"]),
        force: Boolean(flags.force)
      };
    }

    io.stdout.write(`Available profiles: ${joinNames(profiles)}\n`);
    const profile = await askWithDefault(rl, "Profile (optional)", flags.profile || "");
    const profileManifest = profile ? findByName(profiles, profile, "profile") : null;

    // Handle both single-runtime and multi-runtime profiles
    let selectedRuntimes = [];
    if (profileManifest?.runtimes) {
      // Profile specifies multiple runtimes
      selectedRuntimes = Array.isArray(profileManifest.runtimes)
        ? profileManifest.runtimes
        : [profileManifest.runtimes];
      io.stdout.write(
        `Profile specifies runtimes: ${selectedRuntimes.join(", ")}\n`
      );
    } else {
      io.stdout.write(`Available runtimes: ${joinNames(runtimes)}\n`);
      const runtime = await askWithDefault(
        rl,
        "Runtime",
        flags.runtime || profileManifest?.recommendedRuntime || ""
      );
      selectedRuntimes = [runtime];
    }

    // For single runtime, show compatible modules
    const moduleFilters = selectedRuntimes.length === 1
      ? { runtime: selectedRuntimes[0] }
      : {};
    const modulesForRuntimes = listModules(repoRoot, moduleFilters);
    io.stdout.write(
      `Available modules: ${joinNames(modulesForRuntimes)}\n`
    );
    const modulesPrompt = profileManifest?.defaultModules?.length
      ? `Additional modules (defaults from profile: ${profileManifest.defaultModules.join(", ")})`
      : "Modules (comma-separated, optional)";
    const modules = normalizeSelection(
      await askWithDefault(rl, modulesPrompt, flags.modules || "")
    );

    io.stdout.write(`Available policies: ${joinNames(policies)}\n`);
    const policiesPrompt = profileManifest?.requiredPolicies?.length
      ? `Additional policies (defaults from profile: ${profileManifest.requiredPolicies.join(", ")})`
      : "Policies (comma-separated, optional)";
    const selectedPolicies = normalizeSelection(
      await askWithDefault(rl, policiesPrompt, flags.policies || "")
    );

    const primaryRuntime = findByName(runtimes, selectedRuntimes[0], "runtime");
    const packageManager = await askWithDefault(
      rl,
      "Package manager",
      flags["package-manager"] || primaryRuntime.packageManagers[0] || ""
    );
    const withCi =
      typeof flags["with-ci"] === "boolean"
        ? flags["with-ci"]
        : await askYesNo(rl, "Include CI workflow", manifest.interactiveDefaults.withCi);
    const withMirrorFiles =
      typeof flags["with-mirror-files"] === "boolean"
        ? flags["with-mirror-files"]
        : await askYesNo(
            rl,
            "Generate mirror files",
            manifest.interactiveDefaults.withMirrorFiles
          );

    return {
      mode: "composition",
      targetDir,
      projectName,
      profile: profile || undefined,
      runtimes: selectedRuntimes.length > 1 ? selectedRuntimes : undefined,
      runtime: selectedRuntimes[0],
      modules,
      policies: selectedPolicies,
      packageManager,
      withCi,
      withMirrorFiles,
      dryRun: Boolean(flags["dry-run"]),
      force: Boolean(flags.force)
    };
  } finally {
    rl.close();
  }
}

function printUsage() {
  processStdout.write(`Usage:
  init-repo list-variants
  init-repo list-stacks [--variant <name>]
  init-repo list-profiles
  init-repo list-runtimes
  init-repo list-modules [--category <name>] [--runtime <name>]
  init-repo list-policies
  init-repo validate-stack [--profile <name>] [--runtime <name>] [--modules <a,b>] [--policies <a,b>]
  init-repo explain-stack [--profile <name>] [--runtime <name>] [--modules <a,b>] [--policies <a,b>]
  init-repo wizard [<target-dir>] [--project-name <name>] [--profile <name>] [--runtime <name>] [--modules <a,b>] [--policies <a,b>] [--variant <name>] [--package-manager <pm>] [--with-ci] [--with-mirror-files] [--dry-run] [--force]
  init-repo new <target-dir> [--variant <name>] [--project-name <name>] [--package-manager <pm>] [--stacks <a,b>] [--with-ci] [--with-mirror-files] [--dry-run] [--force]
  init-repo apply <target-dir> --variant <name> [--project-name <name>] [--package-manager <pm>] [--stacks <a,b>] [--with-ci] [--with-mirror-files] [--dry-run] [--force]
  init-repo scan <target-dir> [--variant <name>] [--package-manager <pm>]
  init-repo retrofit-plan <target-dir> [--variant <name>] [--project-name <name>] [--package-manager <pm>] [--stacks <a,b>] [--with-ci] [--with-mirror-files]
  init-repo retrofit-apply <target-dir>
  init-repo refactor-plan <target-dir> [--variant <name>] [--project-name <name>]
  init-repo doctor <target-dir>
`);
}

async function run(argv = process.argv.slice(2), io = { stdin: processStdin, stdout: processStdout }) {
  const { command, positionals, flags } = parseArgs(argv);
  const { stdin, stdout } = io;

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    process.exitCode = command ? 0 : 1;
    return;
  }

  if (command === "list-variants") {
    for (const variant of listVariants(repoRoot)) {
      stdout.write(`${variant.name}\t${variant.description}\n`);
    }
    return;
  }

  if (command === "list-stacks") {
    for (const stack of listStacks(repoRoot, flags.variant)) {
      stdout.write(`${stack.category}\t${stack.name}\t${stack.description}\n`);
    }
    return;
  }

  if (command === "list-profiles") {
    for (const profile of listProfiles(repoRoot)) {
      stdout.write(`${profile.name}\t${profile.description}\n`);
    }
    return;
  }

  if (command === "list-runtimes") {
    for (const runtime of listRuntimes(repoRoot)) {
      stdout.write(`${runtime.name}\t${runtime.description}\n`);
    }
    return;
  }

  if (command === "list-modules") {
    for (const moduleEntry of listModules(repoRoot, {
      category: flags.category,
      runtime: flags.runtime
    })) {
      stdout.write(`${moduleEntry.category}\t${moduleEntry.name}\t${moduleEntry.description}\n`);
    }
    return;
  }

  if (command === "list-policies") {
    for (const policy of listPolicies(repoRoot)) {
      stdout.write(`${policy.name}\t${policy.description}\n`);
    }
    return;
  }

  if (command === "validate-stack" || command === "explain-stack") {
    const composition = resolveComposition(repoRoot, {
      profile: flags.profile,
      runtime: flags.runtime,
      modules: normalizeSelection(flags.modules),
      policies: normalizeSelection(flags.policies),
      withCi: Boolean(flags["with-ci"]),
      withMirrorFiles: Boolean(flags["with-mirror-files"])
    });
    if (command === "validate-stack") {
      emitOutput(stdout, flags, {
        ok: composition.errors.length === 0,
        profile: composition.profile?.manifest.name || null,
        runtime: composition.runtime.manifest.name,
        modules: composition.modules.map((entry) => entry.manifest.name),
        policies: composition.policies.map((entry) => entry.manifest.name),
        warnings: composition.warnings,
        info: composition.info,
        errors: composition.errors
      }, () => {
        stdout.write(`${composition.errors.length === 0 ? "VALID" : "INVALID"}\n`);
        stdout.write(`${describeComposition(composition)}\n`);
      });
      if (composition.errors.length > 0) {
        process.exitCode = 1;
      }
      return;
    }

    emitOutput(stdout, flags, {
      profile: composition.profile?.manifest.name || null,
      runtime: composition.runtime.manifest.name,
      modules: composition.modules.map((entry) => entry.manifest.name),
      policies: composition.policies.map((entry) => entry.manifest.name),
      warnings: composition.warnings,
      info: composition.info,
      errors: composition.errors
    }, () => {
      stdout.write(`${describeComposition(composition)}\n`);
    });
    return;
  }

  if (command === "doctor") {
    const targetDir = positionals[0];
    if (!targetDir) {
      throw new Error("doctor requires <target-dir>");
    }

    const result = doctor(repoRoot, path.resolve(targetDir));
    if (result.error) {
      emitOutput(stdout, flags, { ok: false, ...result }, () => {
        stdout.write(`Doctor failed: ${result.error}\n`);
      });
      process.exitCode = 1;
      return;
    }

    emitOutput(stdout, flags, result, () => {
      stdout.write(`Variant: ${result.variant}\n`);
      stdout.write(`Selected stacks: ${(result.stacks || []).join(", ") || "none"}\n`);
      for (const entry of result.results) {
        stdout.write(`${entry.ok ? "OK" : "MISSING"}\t${entry.file}\n`);
      }
    });
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (command === "scan") {
    const targetDir = positionals[0];
    if (!targetDir) {
      throw new Error("scan requires <target-dir>");
    }

    const result = scanRepository(repoRoot, path.resolve(targetDir), {
      variant: flags.variant,
      packageManager: flags["package-manager"]
    });
    emitOutput(stdout, flags, result, () => {
      stdout.write(`Detected variant: ${result.detectedVariant || "unknown"}\n`);
      stdout.write(`Selected variant: ${result.selectedVariant || "none"}\n`);
      stdout.write(`Confidence: ${result.confidence}\n`);
      stdout.write(`Package manager: ${result.packageManager || "unknown"}\n`);
      stdout.write(`Selected profile: ${result.selectedProfile || "none"}\n`);
      stdout.write(`Selected runtime: ${result.selectedRuntime || "none"}\n`);
      stdout.write(`Selected modules: ${result.selectedModules.join(", ") || "none"}\n`);
      stdout.write(`Selected policies: ${result.selectedPolicies.join(", ") || "none"}\n`);
      stdout.write(`Selected stacks: ${(result.selectedStacks || []).join(", ") || "none"}\n`);
      stdout.write(`Markers: ${result.repoMarkers.join(", ") || "none"}\n`);
      stdout.write(
        `Missing governance: ${result.missingGovernance.join(", ") || "none"}\n`
      );
      if (result.conflicts.length > 0) {
        stdout.write("Conflicts:\n");
        for (const conflict of result.conflicts) {
          stdout.write(`- ${conflict.file}: ${conflict.reason}\n`);
        }
      }
      stdout.write(`Recommended next action: ${result.recommendedNextAction}\n`);
    });
    return;
  }

  if (command === "retrofit-plan") {
    const targetDir = positionals[0];
    if (!targetDir) {
      throw new Error("retrofit-plan requires <target-dir>");
    }

    const absoluteTarget = path.resolve(targetDir);
    const plan = buildRetrofitPlan(repoRoot, absoluteTarget, {
      variant: flags.variant,
      projectName: flags["project-name"],
      packageManager: flags["package-manager"],
      stacks: normalizeStackSelection(flags.stacks),
      withCi: Boolean(flags["with-ci"]),
      withMirrorFiles: Boolean(flags["with-mirror-files"])
    });
    writeRetrofitPlan(repoRoot, absoluteTarget, plan);
    emitOutput(
      stdout,
      flags,
      {
        status: "written",
        planPath: path.join(absoluteTarget, ".agentum", "retrofit-plan.json"),
        markdownPath: path.join(absoluteTarget, ".agentum", "retrofit-plan.md"),
        ...plan
      },
      () => {
        stdout.write(
          `Retrofit plan written for ${plan.projectName} (${plan.variant}) with ${plan.proposedOperations.length} proposed operations and ${plan.manualReviewItems.length} manual review items.\n`
        );
      }
    );
    return;
  }

  if (command === "retrofit-apply") {
    const targetDir = positionals[0];
    if (!targetDir) {
      throw new Error("retrofit-apply requires <target-dir>");
    }

    const plan = applyRetrofitPlan(repoRoot, path.resolve(targetDir));
    stdout.write(
      `Applied ${plan.proposedOperations.length} retrofit operations for ${plan.projectName}.\n`
    );
    if (plan.manualReviewItems.length > 0) {
      stdout.write(
        `Manual review remaining: ${plan.manualReviewItems.length} item(s).\n`
      );
    }
    return;
  }

  if (command === "refactor-plan") {
    const targetDir = positionals[0];
    if (!targetDir) {
      throw new Error("refactor-plan requires <target-dir>");
    }

    const absoluteTarget = path.resolve(targetDir);
    const plan = buildRefactorPlan(repoRoot, absoluteTarget, {
      variant: flags.variant,
      projectName: flags["project-name"]
    });
    writeRefactorPlan(repoRoot, absoluteTarget, plan);
    emitOutput(
      stdout,
      flags,
      {
        status: "written",
        markdownPath: path.join(absoluteTarget, ".agentum", "refactor-plan.md"),
        jsonPath: path.join(absoluteTarget, ".agentum", "refactor-plan.json"),
        ...plan
      },
      () => {
        stdout.write(
          `Refactor plan written for ${path.basename(absoluteTarget)} with ${plan.steps.length} prioritized step(s).\n`
        );
      }
    );
    return;
  }

  if (command === "wizard") {
    if (!stdin.isTTY) {
      throw new Error("wizard requires an interactive terminal.");
    }

    const options = await promptForWizard(positionals, flags, io);
    assertTargetState(options.targetDir, "new", options.force);
    const result = options.mode === "composition"
      ? collectCompositionOperations(repoRoot, {
          targetDir: options.targetDir,
          projectName: options.projectName,
          profile: options.profile,
          runtimes: options.runtimes,
          runtime: options.runtime,
          modules: options.modules,
          policies: options.policies,
          packageManager: options.packageManager,
          withCi: options.withCi,
          withMirrorFiles: options.withMirrorFiles
        })
      : collectOperations(repoRoot, {
          targetDir: options.targetDir,
          variant: options.variant,
          projectName: options.projectName,
          packageManager: options.packageManager,
          stacks: options.stacks,
          withCi: options.withCi,
          withMirrorFiles: options.withMirrorFiles,
          dryRun: options.dryRun,
          force: options.force
        });
    const summary = describeOperations(result.operations, process.cwd());

    if (options.mode === "composition") {
      const runtimes = Array.isArray(result.composition.runtimes)
        ? result.composition.runtimes.map((r) => r.manifest.name).join(" + ")
        : result.composition.runtime.manifest.name;
      stdout.write(
        `Preparing ${result.projectName} (${runtimes}) with ${result.packageManager}\n`
      );
    } else {
      stdout.write(
        `Preparing ${result.projectName} (${result.variant.manifest.name}) with ${result.packageManager}\n`
      );
    }
    stdout.write(`${summary}\n`);

    if (options.dryRun) {
      return;
    }

    applyOperations(options.targetDir, result.operations);
    stdout.write(`Done: ${options.targetDir}\n`);
    return;
  }

  if (!["new", "apply"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  const shouldPrompt = stdin.isTTY && (!positionals[0] || !flags.variant);
  const useComposition = Boolean(flags.runtime || flags.profile || flags.modules || flags.policies);
  const options = shouldPrompt
    ? await promptForMissing(command, positionals, flags, io)
    : {
        command,
        targetDir: path.resolve(positionals[0]),
        variant: flags.variant,
        projectName: flags["project-name"] || path.basename(path.resolve(positionals[0])),
        packageManager: flags["package-manager"],
        stacks: normalizeStackSelection(flags.stacks),
        withCi: Boolean(flags["with-ci"]),
        withMirrorFiles: Boolean(flags["with-mirror-files"]),
        dryRun: Boolean(flags["dry-run"]),
        force: Boolean(flags.force)
      };

  assertTargetState(options.targetDir, command, options.force);
  const result = useComposition
    ? collectCompositionOperations(repoRoot, {
        targetDir: options.targetDir,
        projectName: options.projectName,
        profile: flags.profile,
        runtime: flags.runtime,
        modules: normalizeSelection(flags.modules),
        policies: normalizeSelection(flags.policies),
        packageManager: flags["package-manager"],
        withCi: Boolean(flags["with-ci"]),
        withMirrorFiles: Boolean(flags["with-mirror-files"])
      })
    : collectOperations(repoRoot, options);
  const summary = useComposition
    ? describeOperations(result.operations, process.cwd())
    : describeOperations(result.operations, process.cwd());

  if (useComposition) {
    const runtimes = Array.isArray(result.composition.runtimes)
      ? result.composition.runtimes.map((r) => r.manifest.name).join(" + ")
      : result.composition.runtime.manifest.name;
    stdout.write(
      `Preparing ${result.projectName} (${runtimes}) with ${result.packageManager}\n`
    );
  } else {
    stdout.write(
      `Preparing ${result.projectName} (${result.variant.manifest.name}) with ${result.packageManager}\n`
    );
  }
  stdout.write(`${summary}\n`);

  if (options.dryRun) {
    return;
  }

  applyOperations(options.targetDir, result.operations);
  stdout.write(`Done: ${options.targetDir}\n`);
}

if (require.main === module) {
  run().catch((error) => {
    process.exitCode = 1;
    processStdout.write(`${error.message}\n`);
  });
}

module.exports = {
  run
};
