const path = require("node:path");

function isNodeProject(runtimeName) {
  return ["node", "react", "nextjs"].includes(runtimeName);
}

function renderDependabot(operations, targetDir, { includeGitHubActions = false } = {}) {
  const directories = new Map([
    ["docker", new Set()],
    ["github-actions", new Set()],
    ["npm", new Set()],
    ["pip", new Set()],
    ["cargo", new Set()],
    ["composer", new Set()]
  ]);
  const add = (ecosystem, target) => {
    const relative = path.relative(targetDir, target).replaceAll(path.sep, "/");
    const directory = path.posix.dirname(relative);
    directories.get(ecosystem).add(directory === "." ? "/" : `/${directory}`);
  };

  for (const operation of operations) {
    if (operation.type !== "write") continue;
    const relative = path.relative(targetDir, operation.target).replaceAll(path.sep, "/");
    if (relative === "Dockerfile") add("docker", operation.target);
    if (relative.endsWith("package.json")) add("npm", operation.target);
    if (relative.endsWith("pyproject.toml")) add("pip", operation.target);
    if (relative.endsWith("Cargo.toml")) add("cargo", operation.target);
    if (relative.endsWith("composer.json")) add("composer", operation.target);
  }
  if (includeGitHubActions) directories.get("github-actions").add("/");

  const order = ["docker", "github-actions", "npm", "pip", "cargo", "composer"];
  const blocks = ["version: 2", "updates:"];
  for (const ecosystem of order) {
    for (const directory of [...directories.get(ecosystem)].sort()) {
      blocks.push(`  - package-ecosystem: ${ecosystem}`);
      blocks.push(`    directory: \"${directory}\"`);
      blocks.push("    schedule:");
      blocks.push("      interval: weekly");
    }
  }
  return `${blocks.join("\n")}\n`;
}

function nodeSetupStep(runtimeName) {
  if (!isNodeProject(runtimeName)) {
    return "";
  }

  return [
    "      - name: Setup Node.js",
    "        uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5",
    "        with:",
    "          node-version: 24"
  ].join("\n");
}

function buildCiCommands({ runtimeName, packageManager, installCommand, testCommand, ciScripts = [] }) {
  const runCommand = (script) => `${packageManager} run ${script}`;
  const extraChecks = ciScripts.map(runCommand);
  const testWithChecks = (base) => [base, ...extraChecks].join(" && ");

  if (isNodeProject(runtimeName) && packageManager === "npm") {
    return {
      setup: "if [ -f package-lock.json ]; then npm ci; else npm install; fi",
      test: testWithChecks("npm test")
    };
  }

  if (isNodeProject(runtimeName) && ["pnpm", "yarn"].includes(packageManager)) {
    const dependencyInstall = installCommand === "corepack enable"
      ? `${packageManager} install`
      : installCommand;
    return {
      setup: `corepack enable && ${dependencyInstall}`,
      test: testWithChecks(testCommand)
    };
  }

  return {
    setup: installCommand,
    test: testWithChecks(testCommand)
  };
}

module.exports = {
  buildCiCommands,
  isNodeProject,
  nodeSetupStep,
  renderDependabot
};
