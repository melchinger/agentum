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
  listVariants,
  loadManifest
} = require("./lib/repo-generator");
const {
  applyRetrofitPlan,
  buildRefactorPlan,
  buildRetrofitPlan,
  scanRepository,
  writeRefactorPlan,
  writeRetrofitPlan
} = require("./lib/retrofit-engine");

const repoRoot = path.resolve(__dirname, "..");

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
  const rl = readline.createInterface({ input: io.stdin, output: io.stdout });

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
  init-repo new <target-dir> [--variant <name>] [--project-name <name>] [--package-manager <pm>] [--with-ci] [--with-mirror-files] [--dry-run] [--force]
  init-repo apply <target-dir> --variant <name> [--project-name <name>] [--package-manager <pm>] [--with-ci] [--with-mirror-files] [--dry-run] [--force]
  init-repo scan <target-dir> [--variant <name>] [--package-manager <pm>]
  init-repo retrofit-plan <target-dir> [--variant <name>] [--project-name <name>] [--package-manager <pm>] [--with-ci] [--with-mirror-files]
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

  if (!["new", "apply"].includes(command)) {
    throw new Error(`Unknown command: ${command}`);
  }

  const shouldPrompt = stdin.isTTY && (!positionals[0] || !flags.variant);
  const options = shouldPrompt
    ? await promptForMissing(command, positionals, flags, io)
    : {
        command,
        targetDir: path.resolve(positionals[0]),
        variant: flags.variant,
        projectName: flags["project-name"] || path.basename(path.resolve(positionals[0])),
        packageManager: flags["package-manager"],
        withCi: Boolean(flags["with-ci"]),
        withMirrorFiles: Boolean(flags["with-mirror-files"]),
        dryRun: Boolean(flags["dry-run"]),
        force: Boolean(flags.force)
      };

  assertTargetState(options.targetDir, command, options.force);
  const result = collectOperations(repoRoot, options);
  const summary = describeOperations(result.operations, process.cwd());

  stdout.write(
    `Preparing ${result.projectName} (${result.variant.manifest.name}) with ${result.packageManager}\n`
  );
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
