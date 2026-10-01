function isNodeProject(runtimeName) {
  return ["node", "react", "nextjs"].includes(runtimeName);
}

function nodeSetupStep(runtimeName) {
  if (!isNodeProject(runtimeName)) {
    return "";
  }

  return [
    "      - name: Setup Node.js",
    "        uses: actions/setup-node@v5",
    "        with:",
    "          node-version: 24"
  ].join("\n");
}

function buildCiCommands({ runtimeName, packageManager, installCommand, testCommand }) {
  if (isNodeProject(runtimeName) && packageManager === "npm") {
    return {
      setup: "if [ -f package-lock.json ]; then npm ci; else npm install; fi",
      test: "npm test"
    };
  }

  if (isNodeProject(runtimeName) && ["pnpm", "yarn"].includes(packageManager)) {
    return {
      setup: `corepack enable && ${installCommand}`,
      test: testCommand
    };
  }

  return {
    setup: installCommand,
    test: testCommand
  };
}

module.exports = {
  buildCiCommands,
  isNodeProject,
  nodeSetupStep
};
