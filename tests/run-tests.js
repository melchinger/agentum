const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const {
  applyOperations,
  collectOperations,
  doctor,
  listVariants
} = require("../scripts/lib/repo-generator");
const {
  applyRetrofitPlan,
  buildRefactorPlan,
  buildRetrofitPlan,
  scanRepository,
  writeRefactorPlan,
  writeRetrofitPlan
} = require("../scripts/lib/retrofit-engine");
const { run: runCli } = require("../scripts/init-repo");

const repoRoot = path.resolve(__dirname, "..");
const pendingAsyncTests = [];

function withTempDir(callback) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "agentum-"));
  const cleanup = () => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  };

  try {
    const result = callback(tempDir);
    if (result && typeof result.then === "function") {
      return result.finally(cleanup);
    }
    cleanup();
    return result;
  } catch (error) {
    cleanup();
    throw error;
  }
}

function runTest(name, callback) {
  try {
    callback();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error.stack);
    process.exitCode = 1;
  }
}

function runAsyncTest(name, callback) {
  const promise = (async () => {
    try {
      await callback();
      console.log(`PASS ${name}`);
    } catch (error) {
      console.error(`FAIL ${name}`);
      console.error(error.stack);
      process.exitCode = 1;
    }
  })();
  pendingAsyncTests.push(promise);
}

function createIoCapture() {
  let buffer = "";
  return {
    stdin: { isTTY: false },
    stdout: {
      write(chunk) {
        buffer += String(chunk);
      }
    },
    read() {
      return buffer;
    }
  };
}

runTest("lists all supported variants", () => {
  const variants = listVariants(repoRoot).map((entry) => entry.name);
  assert.deepEqual(variants, ["nextjs", "node", "php", "python", "react", "wordpress-plugin"]);
});

runTest("generates a react repository with agents metadata mirrors and ci", () => {
  withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "react-app");
    const result = collectOperations(repoRoot, {
      targetDir,
      variant: "react",
      projectName: "React App",
      withCi: true,
      withMirrorFiles: true,
      packageManager: "pnpm"
    });

    applyOperations(targetDir, result.operations);

    assert.equal(fs.existsSync(path.join(targetDir, "AGENTS.md")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "CLAUDE.md")), true);
    assert.equal(
      fs.existsSync(path.join(targetDir, ".github", "copilot-instructions.md")),
      true
    );
    assert.equal(
      fs.existsSync(path.join(targetDir, ".github", "workflows", "ci.yml")),
      true
    );

    const agents = fs.readFileSync(path.join(targetDir, "AGENTS.md"), "utf8");
    assert.match(agents, /Repository type: `react`/);
    assert.match(agents, /React Overlay/);
    assert.match(agents, /`dev`: `pnpm run dev`/);

    const doctorResult = doctor(repoRoot, targetDir);
    assert.equal(doctorResult.ok, true);
  });
});

runTest("generates variant specific python package paths", () => {
  withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "python-app");
    const result = collectOperations(repoRoot, {
      targetDir,
      variant: "python",
      projectName: "Data Tools",
      withCi: false,
      withMirrorFiles: false,
      packageManager: "uv"
    });

    applyOperations(targetDir, result.operations);

    assert.equal(
      fs.existsSync(path.join(targetDir, "src", "data_tools", "__init__.py")),
      true
    );
    assert.equal(
      fs.existsSync(path.join(targetDir, "src", "data_tools", "main.py")),
      true
    );
    assert.equal(
      fs.existsSync(path.join(targetDir, ".github", "workflows", "ci.yml")),
      false
    );
    assert.equal(fs.existsSync(path.join(targetDir, "CLAUDE.md")), false);

    const agents = fs.readFileSync(path.join(targetDir, "AGENTS.md"), "utf8");
    assert.match(agents, /Repository type: `python`/);
    assert.match(agents, /Python Overlay/);
  });
});

runTest("doctor reports missing files", () => {
  withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "broken");
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, ".agentum-template.json"),
      JSON.stringify({
        projectName: "Broken",
        variant: "node",
        packageManager: "pnpm",
        withCi: false,
        withMirrorFiles: false
      }),
      "utf8"
    );

    const result = doctor(repoRoot, targetDir);
    assert.equal(result.ok, false);
    assert.ok(result.results.some((entry) => entry.ok === false));
  });
});

runTest("scan detects major variants", () => {
  withTempDir((tempDir) => {
    const nextDir = path.join(tempDir, "next-app");
    fs.mkdirSync(nextDir, { recursive: true });
    fs.writeFileSync(
      path.join(nextDir, "package.json"),
      JSON.stringify({ dependencies: { next: "15.0.0", react: "19.0.0" } }),
      "utf8"
    );
    fs.writeFileSync(path.join(nextDir, "next.config.ts"), "export default {};\n", "utf8");

    const pythonDir = path.join(tempDir, "python-app");
    fs.mkdirSync(pythonDir, { recursive: true });
    fs.writeFileSync(path.join(pythonDir, "pyproject.toml"), "[project]\nname='demo'\n", "utf8");

    const wpDir = path.join(tempDir, "wp-plugin");
    fs.mkdirSync(path.join(wpDir, "includes"), { recursive: true });
    fs.writeFileSync(
      path.join(wpDir, "wordpress-plugin.php"),
      "<?php\n/**\n * Plugin Name: Demo Plugin\n */\n",
      "utf8"
    );
    fs.writeFileSync(path.join(wpDir, "composer.json"), "{\"autoload\":{\"psr-4\":{\"App\\\\\":\"src/\"}}}", "utf8");
    fs.writeFileSync(path.join(wpDir, "includes", "bootstrap.php"), "<?php\nadd_action('init', static function(){});\n", "utf8");

    const nextScan = scanRepository(repoRoot, nextDir);
    const pythonScan = scanRepository(repoRoot, pythonDir);
    const wpScan = scanRepository(repoRoot, wpDir);

    assert.equal(nextScan.detectedVariant, "nextjs");
    assert.equal(pythonScan.detectedVariant, "python");
    assert.equal(wpScan.detectedVariant, "wordpress-plugin");
    assert.equal(wpScan.projectStyle, "wordpress-plugin");
  });
});

runTest("retrofit plan classifies add merge manual and present files", () => {
  withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "existing-react");
    fs.mkdirSync(path.join(targetDir, ".github", "workflows"), { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, "package.json"),
      JSON.stringify({ dependencies: { react: "19.0.0", vite: "6.0.0" } }),
      "utf8"
    );
    fs.writeFileSync(path.join(targetDir, "vite.config.ts"), "export default {};\n", "utf8");
    fs.writeFileSync(path.join(targetDir, "README.md"), "# Existing App\n", "utf8");
    fs.writeFileSync(path.join(targetDir, ".gitignore"), "node_modules/\n", "utf8");
    fs.writeFileSync(path.join(targetDir, ".env.example"), "APP_ENV=development\n", "utf8");
    fs.writeFileSync(path.join(targetDir, "AGENTS.md"), "# Custom Rules\n", "utf8");
    fs.writeFileSync(path.join(targetDir, ".github", "workflows", "ci.yml"), "name: Existing CI\n", "utf8");

    const plan = buildRetrofitPlan(repoRoot, targetDir, {
      withCi: true,
      withMirrorFiles: true
    });

    assert.equal(plan.variant, "react");
    assert.ok(plan.presentGovernance.includes(".gitignore"));
    assert.ok(plan.presentGovernance.includes(".env.example"));
    assert.ok(plan.missingFiles.includes("docs/security-checklist.md"));
    assert.ok(plan.proposedOperations.some((item) => item.kind === "merge" && item.file === "README.md"));
    assert.ok(plan.proposedOperations.some((item) => item.kind === "merge" && item.file === ".gitignore"));
    assert.ok(plan.proposedOperations.some((item) => item.kind === "add" && item.file === ".agentum-template.json"));
    assert.ok(plan.manualReviewItems.some((item) => item.file === "AGENTS.md"));
    assert.ok(plan.manualReviewItems.some((item) => item.file === ".github/workflows/ci.yml"));
  });
});

runTest("retrofit apply adds and merges without overwriting manual files", () => {
  withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "legacy-node");
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, "package.json"),
      JSON.stringify({ dependencies: { typescript: "5.0.0" } }),
      "utf8"
    );
    fs.writeFileSync(path.join(targetDir, "tsconfig.json"), "{ }\n", "utf8");
    fs.writeFileSync(path.join(targetDir, "README.md"), "# Legacy Node\n", "utf8");
    fs.writeFileSync(path.join(targetDir, ".gitignore"), "dist/\n", "utf8");
    fs.writeFileSync(path.join(targetDir, "AGENTS.md"), "# Keep me\n", "utf8");

    const plan = buildRetrofitPlan(repoRoot, targetDir);
    writeRetrofitPlan(repoRoot, targetDir, plan);
    applyRetrofitPlan(repoRoot, targetDir);

    const readme = fs.readFileSync(path.join(targetDir, "README.md"), "utf8");
    const gitignore = fs.readFileSync(path.join(targetDir, ".gitignore"), "utf8");
    const agents = fs.readFileSync(path.join(targetDir, "AGENTS.md"), "utf8");

    assert.match(readme, /Agentum Governance/);
    assert.match(gitignore, /node_modules\//);
    assert.equal(agents, "# Keep me\n");
    assert.equal(fs.existsSync(path.join(targetDir, ".agentum", "retrofit-plan.json")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "docs", "security-checklist.md")), true);
  });
});

runTest("retrofit apply rejects stale plans", () => {
  withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "stale-node");
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, "package.json"),
      JSON.stringify({ dependencies: { typescript: "5.0.0" }, scripts: { test: "node --test" } }),
      "utf8"
    );
    fs.writeFileSync(path.join(targetDir, "tsconfig.json"), "{ }\n", "utf8");

    const plan = buildRetrofitPlan(repoRoot, targetDir);
    writeRetrofitPlan(repoRoot, targetDir, plan);
    fs.writeFileSync(path.join(targetDir, "README.md"), "# changed after plan\n", "utf8");

    assert.throws(() => applyRetrofitPlan(repoRoot, targetDir), /stale/i);
  });
});

runTest("refactor plan identifies hotspots and writes markdown and json", () => {
  withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "messy-react");
    fs.mkdirSync(path.join(targetDir, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, "package.json"),
      JSON.stringify({ dependencies: { react: "19.0.0", vite: "6.0.0" } }),
      "utf8"
    );
    fs.writeFileSync(path.join(targetDir, "vite.config.ts"), "export default {};\n", "utf8");
    fs.writeFileSync(
      path.join(targetDir, "src", "Dashboard.tsx"),
      `import React, { useState } from "react";\n${"const a = 1;\n".repeat(260)}fetch("/api/data");\nexport function Dashboard(){return <div />;}\n`,
      "utf8"
    );

    const plan = buildRefactorPlan(repoRoot, targetDir);
    writeRefactorPlan(repoRoot, targetDir, plan);

    assert.ok(plan.hotspots.some((item) => item.file === "src/Dashboard.tsx"));
    assert.ok(plan.steps.length >= 2);
    assert.equal(fs.existsSync(path.join(targetDir, ".agentum", "refactor-plan.md")), true);
    assert.equal(fs.existsSync(path.join(targetDir, ".agentum", "refactor-plan.json")), true);
  });
});

runTest("wordpress refactor plan recommends adapter separation", () => {
  withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "wp-plugin");
    fs.mkdirSync(path.join(targetDir, "includes"), { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, "wordpress-plugin.php"),
      "<?php\n/**\n * Plugin Name: Demo Plugin\n */\n",
      "utf8"
    );
    fs.writeFileSync(
      path.join(targetDir, "composer.json"),
      JSON.stringify({ description: "Generated PHP project skeleton", autoload: { "psr-4": { App: "src/" } } }),
      "utf8"
    );
    fs.writeFileSync(
      path.join(targetDir, "includes", "class-api.php"),
      `<?php\nadd_action('init', static function(){});\n${"// line\n".repeat(260)}`,
      "utf8"
    );

    const plan = buildRefactorPlan(repoRoot, targetDir);
    assert.equal(plan.projectStyle, "wordpress-plugin");
    assert.ok(plan.architectureTarget.description.includes("includes/"));
    assert.ok(plan.adapterFiles.some((file) => file === "includes/class-api.php"));
    assert.ok(plan.serviceExtractionCandidates.length > 0);
  });
});

runAsyncTest("scan doctor and retrofit-plan support json output", async () => {
  return withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "json-react");
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, "package.json"),
      JSON.stringify({ dependencies: { react: "19.0.0", vite: "6.0.0" } }),
      "utf8"
    );
    fs.writeFileSync(path.join(targetDir, "vite.config.ts"), "export default {};\n", "utf8");

    const scanIo = createIoCapture();
    const retrofitIo = createIoCapture();
    const applyIo = createIoCapture();
    const doctorIo = createIoCapture();

    return Promise.resolve()
      .then(() => runCli(["scan", targetDir, "--json"], scanIo))
      .then(() => {
        const scanJson = JSON.parse(scanIo.read());
        assert.equal(scanJson.detectedVariant, "react");
        assert.ok(Array.isArray(scanJson.presentFiles));
        assert.ok(scanJson.repoFingerprint);
      })
      .then(() => runCli(["retrofit-plan", targetDir, "--json"], retrofitIo))
      .then(() => {
        const retrofitJson = JSON.parse(retrofitIo.read());
        assert.equal(retrofitJson.status, "written");
        assert.equal(retrofitJson.variant, "react");
        assert.ok(Array.isArray(retrofitJson.proposedOperations));
        assert.equal(retrofitJson.version, 2);
        assert.equal(retrofitJson.freshness.status, "fresh");
      })
      .then(() => runCli(["retrofit-apply", targetDir], applyIo))
      .then(() => runCli(["doctor", targetDir, "--json"], doctorIo))
      .then(() => {
        const doctorJson = JSON.parse(doctorIo.read());
        assert.equal(doctorJson.ok, true);
        assert.equal(doctorJson.variant, "react");
        assert.ok(Array.isArray(doctorJson.results));
      });
  });
});

Promise.all(pendingAsyncTests).then(() => {
  if (!process.exitCode) {
    console.log("All tests passed.");
  }
});
