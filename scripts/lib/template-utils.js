const fs = require("node:fs");
const path = require("node:path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "app";
}

function toPythonPackage(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "app";
}

function walkTemplateFiles(rootDir) {
  const entries = [];

  function visit(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolute = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolute);
      } else {
        entries.push(absolute);
      }
    }
  }

  visit(rootDir);
  return entries;
}

function renderString(input, variables) {
  return input.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key) => {
    return key in variables ? String(variables[key]) : "";
  });
}

function resolveTemplateTarget(rootDir, filePath, variables) {
  const relative = path.relative(rootDir, filePath);
  const rendered = renderString(relative, variables);
  return rendered.endsWith(".tmpl") ? rendered.slice(0, -5) : rendered;
}

function ensureDirectory(targetPath) {
  fs.mkdirSync(targetPath, { recursive: true });
}

function isDirectoryEmpty(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return true;
  }

  return fs.readdirSync(targetPath).length === 0;
}

function loadManifest(repoRoot) {
  return readJson(path.join(repoRoot, "templates", "manifest.json"));
}

function collectTemplateOperations(templateRoot, variables, targetDir, options = {}) {
  if (!fs.existsSync(templateRoot)) {
    return [];
  }
  return walkTemplateFiles(templateRoot)
    .filter((filePath) => !options.exclude?.includes(path.relative(templateRoot, filePath)))
    .map((filePath) => {
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

module.exports = {
  collectDirectoryOperations,
  collectTemplateOperations,
  ensureDirectory,
  formatCommands,
  isDirectoryEmpty,
  loadManifest,
  readJson,
  renderString,
  resolveTemplateTarget,
  slugify,
  toPythonPackage,
  walkTemplateFiles
};
