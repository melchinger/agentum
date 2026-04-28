const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const {
  applyOperations,
  collectOperations,
  doctor,
  listStacks,
  listVariants
} = require("../scripts/lib/repo-generator");
const {
  collectCompositionOperations,
  compositionDoctor,
  listModules,
  listPolicies,
  listProfiles,
  listRuntimes,
  resolveComposition
} = require("../scripts/lib/composition-catalog");
const {
  applyRetrofitPlan,
  buildRefactorPlan,
  buildRetrofitPlan,
  scanRepository,
  writeRefactorPlan,
  writeRetrofitPlan
} = require("../scripts/lib/retrofit-engine");
const { run: runCli } = require("../scripts/init-repo");
const { validateManifestCollection } = require("../scripts/validate-manifests");

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

function createInteractiveIoCapture(answers) {
  let buffer = "";
  return {
    stdin: { isTTY: true },
    stdout: {
      write(chunk) {
        buffer += String(chunk);
      }
    },
    promptAnswers: answers,
    read() {
      return buffer;
    }
  };
}

runTest("lists all supported variants", () => {
  const variants = listVariants(repoRoot).map((entry) => entry.name);
  assert.deepEqual(variants, ["nextjs", "node", "php", "python", "react", "wordpress-plugin"]);
});

runTest("validates manifest collections", () => {
  const errors = validateManifestCollection(repoRoot);
  assert.deepEqual(errors, []);
});

runTest("lists composition catalog entries", () => {
  assert.ok(listProfiles(repoRoot).some((entry) => entry.name === "saas-web-app"));
  assert.ok(listRuntimes(repoRoot).some((entry) => entry.name === "python"));
  assert.ok(listModules(repoRoot, { runtime: "rust" }).some((entry) => entry.name === "tauri"));
  assert.ok(listPolicies(repoRoot).some((entry) => entry.name === "security-baseline"));
});

runTest("resolves composition defaults and rules", () => {
  const composition = resolveComposition(repoRoot, {
    profile: "desktop-app"
  });

  assert.equal(composition.runtime.manifest.name, "rust");
  assert.deepEqual(
    composition.modules.map((entry) => entry.manifest.name),
    ["tauri", "react", "sqlite"]
  );
  assert.ok(composition.errors.length === 0);
});

runTest("lists stack modules for the python variant", () => {
  const stacks = listStacks(repoRoot, "python").map((entry) => entry.name);
  assert.deepEqual(stacks, [
    "fastapi",
    "single-container",
    "playwright-pdf",
    "htmx",
    "mcp-python",
    "alembic",
    "liquibase",
    "postgres",
    "sqlite"
  ]);
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

runTest("generates a composed python repository from profile runtime modules and policies", () => {
  withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "saas-python");
    const result = collectCompositionOperations(repoRoot, {
      targetDir,
      projectName: "SaaS Python",
      profile: "saas-web-app",
      runtime: "python",
      modules: ["htmx", "mcp-python", "playwright-pdf", "single-container"],
      policies: ["mirror-instructions"],
      withCi: true
    });

    applyOperations(targetDir, result.operations);

    assert.equal(fs.existsSync(path.join(targetDir, "src", "saas_python", "interfaces", "http", "app.py")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "src", "saas_python", "interfaces", "mcp", "__init__.py")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "templates", "index.html")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "templates", "pdf", "README.md")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "migrations", "README.md")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "Dockerfile")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "CLAUDE.md")), true);
    assert.equal(fs.existsSync(path.join(targetDir, ".github", "workflows", "ci.yml")), true);

    const metadata = JSON.parse(fs.readFileSync(path.join(targetDir, ".agentum-template.json"), "utf8"));
    assert.equal(metadata.profile, "saas-web-app");
    assert.equal(metadata.runtime, "python");
    assert.deepEqual(metadata.policies, ["security-baseline", "ci", "mirror-instructions"]);

    const envExample = fs.readFileSync(path.join(targetDir, ".env.example"), "utf8");
    assert.match(envExample, /DATABASE_URL=postgresql:\/\/app:app@localhost:5432\/saas-python/);

    const doctorResult = compositionDoctor(repoRoot, targetDir);
    assert.equal(doctorResult.ok, true);
    assert.equal(doctorResult.profile, "saas-web-app");
    assert.equal(doctorResult.runtime, "python");
  });
});

runTest("generates a composed tauri desktop repository", () => {
  withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "tauri-desktop");
    const result = collectCompositionOperations(repoRoot, {
      targetDir,
      projectName: "Desktop Hub",
      profile: "desktop-app",
      policies: []
    });

    applyOperations(targetDir, result.operations);

    assert.equal(fs.existsSync(path.join(targetDir, "Cargo.toml")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "src", "main.rs")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "src", "ui", "App.tsx")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "src-tauri", "tauri.conf.json")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "src-tauri", "src", "commands", "mod.rs")), true);

    const metadata = JSON.parse(fs.readFileSync(path.join(targetDir, ".agentum-template.json"), "utf8"));
    assert.equal(metadata.runtime, "rust");
    assert.deepEqual(metadata.modules, ["tauri", "react", "sqlite"]);
  });
});

runTest("generates a composed tauri+svelte desktop repository", () => {
  withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "tauri-svelte");
    const result = collectCompositionOperations(repoRoot, {
      targetDir,
      projectName: "Svelte Desktop",
      profile: "desktop-app-svelte",
      policies: []
    });

    applyOperations(targetDir, result.operations);

    assert.equal(fs.existsSync(path.join(targetDir, "Cargo.toml")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "src", "ui", "App.svelte")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "src-tauri", "tauri.conf.json")), true);

    const metadata = JSON.parse(fs.readFileSync(path.join(targetDir, ".agentum-template.json"), "utf8"));
    assert.equal(metadata.runtime, "rust");
    assert.deepEqual(metadata.modules, ["tauri", "svelte", "sqlite"]);
  });
});

runTest("generates a composed tauri+sveltekit desktop repository", () => {
  withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "tauri-sveltekit");
    const result = collectCompositionOperations(repoRoot, {
      targetDir,
      projectName: "SvelteKit Desktop",
      profile: "desktop-app-sveltekit",
      policies: []
    });

    applyOperations(targetDir, result.operations);

    assert.equal(fs.existsSync(path.join(targetDir, "Cargo.toml")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "svelte.config.js")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "src", "app.html")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "src", "routes", "+page.svelte")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "src", "routes", "+layout.ts")), true);
    assert.equal(fs.existsSync(path.join(targetDir, "src-tauri", "tauri.conf.json")), true);

    const svelteConfig = fs.readFileSync(path.join(targetDir, "svelte.config.js"), "utf8");
    assert.match(svelteConfig, /pages: "dist"/);
    assert.match(svelteConfig, /adapter-static/);

    const tauriConfig = JSON.parse(fs.readFileSync(path.join(targetDir, "src-tauri", "tauri.conf.json"), "utf8"));
    assert.equal(tauriConfig.build.frontendDist, "../dist");

    const metadata = JSON.parse(fs.readFileSync(path.join(targetDir, ".agentum-template.json"), "utf8"));
    assert.deepEqual(metadata.modules, ["tauri", "sveltekit-static", "sqlite"]);
  });
});

runTest("desktop-app-svelte profile resolves with rust runtime", () => {
  const composition = resolveComposition(repoRoot, { profile: "desktop-app-svelte" });
  assert.equal(composition.runtime.manifest.name, "rust");
  assert.deepEqual(
    composition.modules.map((entry) => entry.manifest.name),
    ["tauri", "svelte", "sqlite"]
  );
  assert.deepEqual(composition.errors, []);
});

runTest("desktop-app-sveltekit profile resolves with rust runtime", () => {
  const composition = resolveComposition(repoRoot, { profile: "desktop-app-sveltekit" });
  assert.equal(composition.runtime.manifest.name, "rust");
  assert.deepEqual(
    composition.modules.map((entry) => entry.manifest.name),
    ["tauri", "sveltekit-static", "sqlite"]
  );
  assert.deepEqual(composition.errors, []);
});

runTest("tauri module accepts non-react frontends without errors", () => {
  const composition = resolveComposition(repoRoot, {
    runtime: "rust",
    modules: ["tauri", "svelte"]
  });
  assert.deepEqual(composition.errors, []);
});

runTest("generates variant specific python package paths", () => {
  withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "python-app");
    const result = collectOperations(repoRoot, {
      targetDir,
      variant: "python",
      projectName: "Data Tools",
      stacks: ["fastapi", "postgres", "alembic", "mcp-python", "playwright-pdf", "single-container"],
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
      fs.existsSync(path.join(targetDir, "src", "data_tools", "interfaces", "http", "app.py")),
      true
    );
    assert.equal(
      fs.existsSync(path.join(targetDir, "src", "data_tools", "interfaces", "mcp", "__init__.py")),
      true
    );
    assert.equal(
      fs.existsSync(path.join(targetDir, "migrations", "README.md")),
      true
    );
    assert.equal(
      fs.existsSync(path.join(targetDir, "templates", "pdf", "README.md")),
      true
    );
    assert.equal(fs.existsSync(path.join(targetDir, "Dockerfile")), true);
    assert.equal(
      fs.existsSync(path.join(targetDir, ".github", "workflows", "ci.yml")),
      false
    );
    assert.equal(fs.existsSync(path.join(targetDir, "CLAUDE.md")), false);

    const agents = fs.readFileSync(path.join(targetDir, "AGENTS.md"), "utf8");
    assert.match(agents, /Repository type: `python`/);
    assert.match(agents, /Selected stack modules:/);
    assert.match(agents, /Python Overlay/);
    assert.match(agents, /Stack Module: FastAPI/);
    assert.match(agents, /`serve`: `uv run fastapi dev src\/data_tools\/interfaces\/http\/app.py`/);

    const metadata = JSON.parse(
      fs.readFileSync(path.join(targetDir, ".agentum-template.json"), "utf8")
    );
    assert.deepEqual(metadata.stacks, [
      "fastapi",
      "single-container",
      "playwright-pdf",
      "mcp-python",
      "alembic",
      "postgres"
    ]);

    const envExample = fs.readFileSync(path.join(targetDir, ".env.example"), "utf8");
    assert.match(envExample, /DATABASE_URL=postgresql:\/\/app:app@localhost:5432\/data-tools/);

    const readme = fs.readFileSync(path.join(targetDir, "README.md"), "utf8");
    assert.match(readme, /Selected stack modules:/);

    const doctorResult = doctor(repoRoot, targetDir);
    assert.equal(doctorResult.ok, true);
    assert.deepEqual(doctorResult.stacks, [
      "fastapi",
      "single-container",
      "playwright-pdf",
      "mcp-python",
      "alembic",
      "postgres"
    ]);
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
        stacks: [],
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
        assert.deepEqual(scanJson.selectedStacks, []);
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
        assert.deepEqual(doctorJson.stacks, []);
      });
  });
});

runAsyncTest("cli lists stacks and generates python stack composition", async () => {
  return withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "stacked-python");
    const listIo = createIoCapture();
    const newIo = createIoCapture();
    const doctorIo = createIoCapture();

    return Promise.resolve()
      .then(() => runCli(["list-stacks", "--variant", "python"], listIo))
      .then(() => {
        const output = listIo.read();
        assert.match(output, /backend\tfastapi\t/);
        assert.match(output, /storage\tpostgres\t/);
      })
      .then(() =>
        runCli(
          [
            "new",
            targetDir,
            "--variant",
            "python",
            "--project-name",
            "Stacked Python",
            "--package-manager",
            "uv",
            "--stacks",
            "fastapi,htmx,postgres,alembic,mcp-python"
          ],
          newIo
        )
      )
      .then(() => {
        assert.equal(fs.existsSync(path.join(targetDir, "templates", "index.html")), true);
      })
      .then(() => runCli(["doctor", targetDir, "--json"], doctorIo))
      .then(() => {
        const doctorJson = JSON.parse(doctorIo.read());
        assert.deepEqual(doctorJson.stacks, ["fastapi", "htmx", "mcp-python", "alembic", "postgres"]);
      });
  });
});

runAsyncTest("cli validates explains and generates composed projects", async () => {
  return withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "composed-cli");
    const validateIo = createIoCapture();
    const explainIo = createIoCapture();
    const newIo = createIoCapture();
    const doctorIo = createIoCapture();

    return Promise.resolve()
      .then(() =>
        runCli(
          [
            "validate-stack",
            "--profile",
            "saas-web-app",
            "--runtime",
            "python",
            "--modules",
            "htmx,mcp-python,playwright-pdf,single-container",
            "--policies",
            "mirror-instructions",
            "--with-ci",
            "--json"
          ],
          validateIo
        )
      )
      .then(() => {
        const payload = JSON.parse(validateIo.read());
        assert.equal(payload.ok, true);
        assert.equal(payload.runtime, "python");
        assert.ok(payload.modules.includes("postgres"));
      })
      .then(() =>
        runCli(
          [
            "explain-stack",
            "--profile",
            "desktop-app",
            "--json"
          ],
          explainIo
        )
      )
      .then(() => {
        const payload = JSON.parse(explainIo.read());
        assert.equal(payload.runtime, "rust");
        assert.deepEqual(payload.modules, ["tauri", "react", "sqlite"]);
      })
      .then(() =>
        runCli(
          [
            "new",
            targetDir,
            "--profile",
            "saas-web-app",
            "--runtime",
            "python",
            "--project-name",
            "Composed CLI",
            "--modules",
            "htmx,mcp-python,playwright-pdf,single-container",
            "--policies",
            "mirror-instructions",
            "--with-ci"
          ],
          newIo
        )
      )
      .then(() => runCli(["doctor", targetDir, "--json"], doctorIo))
      .then(() => {
        const payload = JSON.parse(doctorIo.read());
        assert.equal(payload.profile, "saas-web-app");
        assert.equal(payload.runtime, "python");
        assert.ok(payload.modules.includes("fastapi"));
      });
  });
});

runAsyncTest("wizard guides through a desktop app setup", async () => {
  return withTempDir((tempDir) => {
    const targetDir = path.join(tempDir, "soliCalc");
    const wizardIo = createInteractiveIoCapture([
      "",
      "",
      "desktop-app",
      "",
      "",
      "",
      "",
      "n",
      "n"
    ]);

    return Promise.resolve()
      .then(() => runCli(["wizard", targetDir], wizardIo))
      .then(() => {
        assert.equal(fs.existsSync(path.join(targetDir, "Cargo.toml")), true);
        assert.equal(fs.existsSync(path.join(targetDir, "src-tauri", "tauri.conf.json")), true);
        assert.equal(fs.existsSync(path.join(targetDir, ".env.example")), true);

        const metadata = JSON.parse(fs.readFileSync(path.join(targetDir, ".agentum-template.json"), "utf8"));
        assert.equal(metadata.profile, "desktop-app");
        assert.equal(metadata.runtime, "rust");
        assert.deepEqual(metadata.modules, ["tauri", "react", "sqlite"]);

        const envExample = fs.readFileSync(path.join(targetDir, ".env.example"), "utf8");
        assert.match(envExample, /DATABASE_URL=sqlite:\/\/\/\.\/data\/app\.db/);
        assert.match(wizardIo.read(), /Available profiles:/);
        assert.match(wizardIo.read(), /Preparing soliCalc \(rust\) with cargo/);
      });
  });
});

Promise.all(pendingAsyncTests).then(() => {
  if (!process.exitCode) {
    console.log("All tests passed.");
  }
});
