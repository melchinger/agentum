#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listJsonFiles(rootDir, fileName) {
  if (!fs.existsSync(rootDir)) {
    return [];
  }

  const results = [];
  function visit(currentDir) {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
      } else if (entry.name === fileName) {
        results.push(absolutePath);
      }
    }
  }

  visit(rootDir);
  return results.sort();
}

function assertCondition(condition, message, errors) {
  if (!condition) {
    errors.push(message);
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isSlug(value) {
  return typeof value === "string" && /^[a-z0-9-]+$/.test(value);
}

function hasUniqueStrings(values) {
  return Array.isArray(values) && new Set(values).size === values.length;
}

function validateStringArray(values, label, errors, { minItems = 0, pattern = null } = {}) {
  assertCondition(Array.isArray(values), `${label} must be an array`, errors);
  if (!Array.isArray(values)) {
    return;
  }
  assertCondition(values.length >= minItems, `${label} must have at least ${minItems} item(s)`, errors);
  assertCondition(hasUniqueStrings(values), `${label} must not contain duplicates`, errors);
  for (const value of values) {
    assertCondition(isNonEmptyString(value), `${label} entries must be non-empty strings`, errors);
    if (pattern && typeof value === "string") {
      assertCondition(pattern.test(value), `${label} entry "${value}" does not match ${pattern}`, errors);
    }
  }
}

function validateRule(rule, label, errors) {
  assertCondition(isPlainObject(rule), `${label} must be an object`, errors);
  if (!isPlainObject(rule)) {
    return;
  }

  const allowedKeys = new Set(["level", "message", "when"]);
  for (const key of Object.keys(rule)) {
    assertCondition(allowedKeys.has(key), `${label} contains unknown key "${key}"`, errors);
  }

  assertCondition(["info", "warning", "error"].includes(rule.level), `${label}.level must be info, warning, or error`, errors);
  assertCondition(isNonEmptyString(rule.message), `${label}.message must be a non-empty string`, errors);

  if (!("when" in rule)) {
    return;
  }

  assertCondition(isPlainObject(rule.when), `${label}.when must be an object`, errors);
  if (!isPlainObject(rule.when)) {
    return;
  }

  const allowedWhenKeys = [
    "runtimeIn",
    "runtimeNotIn",
    "profileIn",
    "profileNotIn",
    "modulesAll",
    "modulesAny",
    "modulesMissing"
  ];
  for (const key of Object.keys(rule.when)) {
    assertCondition(allowedWhenKeys.includes(key), `${label}.when contains unknown key "${key}"`, errors);
    validateStringArray(rule.when[key], `${label}.when.${key}`, errors);
  }
}

function validateDetect(detect, label, errors) {
  assertCondition(isPlainObject(detect), `${label} must be an object`, errors);
  if (!isPlainObject(detect)) {
    return;
  }

  const allowedKeys = ["files", "anyFiles", "contentPatterns", "packageIndicators"];
  for (const key of Object.keys(detect)) {
    assertCondition(allowedKeys.includes(key), `${label} contains unknown key "${key}"`, errors);
    validateStringArray(detect[key], `${label}.${key}`, errors);
  }
}

function validateRuntimeManifest(manifest, filePath) {
  const errors = [];
  assertCondition(isSlug(manifest.name), `${filePath}: name must be a slug`, errors);
  assertCondition(isNonEmptyString(manifest.description), `${filePath}: description is required`, errors);
  assertCondition(isSlug(manifest.language), `${filePath}: language must be a slug`, errors);
  validateStringArray(manifest.packageManagers, `${filePath}: packageManagers`, errors, { minItems: 1 });
  validateStringArray(manifest.directories, `${filePath}: directories`, errors);
  validateStringArray(manifest.requiredFiles, `${filePath}: requiredFiles`, errors);
  validateStringArray(manifest.commands, `${filePath}: commands`, errors, {
    pattern: /^[a-z0-9-]+: .+/
  });
  if ("variables" in manifest) {
    validateStringArray(manifest.variables, `${filePath}: variables`, errors, {
      pattern: /^[A-Z0-9_]+$/
    });
  }
  if ("detect" in manifest) {
    validateDetect(manifest.detect, `${filePath}: detect`, errors);
  }
  if ("rules" in manifest) {
    assertCondition(Array.isArray(manifest.rules), `${filePath}: rules must be an array`, errors);
    for (const [index, rule] of (manifest.rules || []).entries()) {
      validateRule(rule, `${filePath}: rules[${index}]`, errors);
    }
  }
  return errors;
}

function validateModuleManifest(manifest, filePath) {
  const errors = [];
  assertCondition(isSlug(manifest.name), `${filePath}: name must be a slug`, errors);
  assertCondition(isSlug(manifest.category), `${filePath}: category must be a slug`, errors);
  assertCondition(isNonEmptyString(manifest.description), `${filePath}: description is required`, errors);
  validateStringArray(manifest.compatibleRuntimes, `${filePath}: compatibleRuntimes`, errors, {
    minItems: 1
  });
  for (const field of ["requiresModules", "conflictsWith", "implies", "directories", "requiredFiles", "commands", "env"]) {
    if (field in manifest) {
      validateStringArray(manifest[field], `${filePath}: ${field}`, errors, {
        pattern: field === "commands" ? /^[a-z0-9-]+: .+/ : null
      });
    }
  }
  if ("detect" in manifest) {
    validateDetect(manifest.detect, `${filePath}: detect`, errors);
  }
  if ("rules" in manifest) {
    assertCondition(Array.isArray(manifest.rules), `${filePath}: rules must be an array`, errors);
    for (const [index, rule] of (manifest.rules || []).entries()) {
      validateRule(rule, `${filePath}: rules[${index}]`, errors);
    }
  }
  const requires = new Set(manifest.requiresModules || []);
  const conflicts = new Set(manifest.conflictsWith || []);
  for (const name of requires) {
    assertCondition(!conflicts.has(name), `${filePath}: module "${name}" cannot be both required and conflicting`, errors);
  }
  return errors;
}

function validateProfileManifest(manifest, filePath) {
  const errors = [];
  assertCondition(isSlug(manifest.name), `${filePath}: name must be a slug`, errors);
  assertCondition(isNonEmptyString(manifest.description), `${filePath}: description is required`, errors);
  if ("recommendedRuntime" in manifest) {
    assertCondition(isNonEmptyString(manifest.recommendedRuntime), `${filePath}: recommendedRuntime must be a non-empty string`, errors);
  }
  for (const field of ["defaultModules", "recommendedModules", "requiredPolicies"]) {
    if (field in manifest) {
      validateStringArray(manifest[field], `${filePath}: ${field}`, errors);
    }
  }
  if ("rules" in manifest) {
    assertCondition(Array.isArray(manifest.rules), `${filePath}: rules must be an array`, errors);
    for (const [index, rule] of (manifest.rules || []).entries()) {
      validateRule(rule, `${filePath}: rules[${index}]`, errors);
    }
  }
  if ("questions" in manifest) {
    assertCondition(Array.isArray(manifest.questions), `${filePath}: questions must be an array`, errors);
    for (const [index, question] of (manifest.questions || []).entries()) {
      const label = `${filePath}: questions[${index}]`;
      assertCondition(isPlainObject(question), `${label} must be an object`, errors);
      if (!isPlainObject(question)) {
        continue;
      }
      assertCondition(/^[a-z0-9_]+$/.test(question.id || ""), `${label}.id must match ^[a-z0-9_]+$`, errors);
      assertCondition(isNonEmptyString(question.prompt), `${label}.prompt must be a non-empty string`, errors);
      if ("suggestModules" in question) {
        validateStringArray(question.suggestModules, `${label}.suggestModules`, errors);
      }
    }
  }
  return errors;
}

function validatePolicyManifest(manifest, filePath) {
  const errors = [];
  assertCondition(isSlug(manifest.name), `${filePath}: name must be a slug`, errors);
  assertCondition(isNonEmptyString(manifest.description), `${filePath}: description is required`, errors);
  if ("required" in manifest) {
    assertCondition(typeof manifest.required === "boolean", `${filePath}: required must be a boolean`, errors);
  }
  if ("files" in manifest) {
    validateStringArray(manifest.files, `${filePath}: files`, errors);
  }
  if ("commands" in manifest) {
    validateStringArray(manifest.commands, `${filePath}: commands`, errors, {
      pattern: /^[a-z0-9-]+: .+/
    });
  }
  if ("detect" in manifest) {
    validateDetect(manifest.detect, `${filePath}: detect`, errors);
  }
  return errors;
}

function validateStacksManifest(manifest, filePath) {
  const errors = [];
  assertCondition(Array.isArray(manifest.categories), `${filePath}: categories must be an array`, errors);
  for (const [index, category] of (manifest.categories || []).entries()) {
    const label = `${filePath}: categories[${index}]`;
    assertCondition(isPlainObject(category), `${label} must be an object`, errors);
    if (!isPlainObject(category)) {
      continue;
    }
    assertCondition(isSlug(category.name), `${label}.name must be a slug`, errors);
    assertCondition(isNonEmptyString(category.description), `${label}.description must be a non-empty string`, errors);
  }
  return errors;
}

function validateManifestCollection(repoRoot) {
  const errors = [];
  const stacksManifestPath = path.join(repoRoot, "stacks", "manifest.json");
  errors.push(...validateStacksManifest(readJson(stacksManifestPath), stacksManifestPath));

  const runtimeItems = listJsonFiles(path.join(repoRoot, "runtimes"), "runtime.json")
    .map((filePath) => ({ filePath, manifest: readJson(filePath) }));
  const moduleItems = listJsonFiles(path.join(repoRoot, "modules"), "module.json")
    .map((filePath) => ({ filePath, manifest: readJson(filePath) }));
  const profileItems = listJsonFiles(path.join(repoRoot, "profiles"), "profile.json")
    .map((filePath) => ({ filePath, manifest: readJson(filePath) }));
  const policyItems = listJsonFiles(path.join(repoRoot, "policies"), "policy.json")
    .map((filePath) => ({ filePath, manifest: readJson(filePath) }));

  for (const item of runtimeItems) {
    errors.push(...validateRuntimeManifest(item.manifest, item.filePath));
  }
  for (const item of moduleItems) {
    errors.push(...validateModuleManifest(item.manifest, item.filePath));
  }
  for (const item of profileItems) {
    errors.push(...validateProfileManifest(item.manifest, item.filePath));
  }
  for (const item of policyItems) {
    errors.push(...validatePolicyManifest(item.manifest, item.filePath));
  }

  const runtimeNames = new Set(runtimeItems.map((item) => item.manifest.name));
  const moduleNames = new Set(moduleItems.map((item) => item.manifest.name));
  const policyNames = new Set(policyItems.map((item) => item.manifest.name));

  for (const item of moduleItems) {
    for (const runtimeName of item.manifest.compatibleRuntimes || []) {
      assertCondition(runtimeNames.has(runtimeName), `${item.filePath}: compatible runtime "${runtimeName}" does not exist`, errors);
    }
    for (const name of [
      ...(item.manifest.requiresModules || []),
      ...(item.manifest.conflictsWith || []),
      ...(item.manifest.implies || [])
    ]) {
      assertCondition(moduleNames.has(name), `${item.filePath}: referenced module "${name}" does not exist`, errors);
    }
  }

  for (const item of profileItems) {
    if (item.manifest.recommendedRuntime) {
      assertCondition(runtimeNames.has(item.manifest.recommendedRuntime), `${item.filePath}: recommended runtime "${item.manifest.recommendedRuntime}" does not exist`, errors);
    }
    for (const name of [
      ...(item.manifest.defaultModules || []),
      ...(item.manifest.recommendedModules || [])
    ]) {
      assertCondition(moduleNames.has(name), `${item.filePath}: referenced module "${name}" does not exist`, errors);
    }
    for (const name of item.manifest.requiredPolicies || []) {
      assertCondition(policyNames.has(name), `${item.filePath}: referenced policy "${name}" does not exist`, errors);
    }
  }

  for (const filePath of listJsonFiles(path.join(repoRoot, "stacks"), "stack.json")) {
    const manifest = readJson(filePath);
    const normalized = {
      ...manifest,
      compatibleRuntimes: manifest.compatibleVariants
    };
    errors.push(...validateModuleManifest(normalized, filePath));
  }

  return errors;
}

function run() {
  const repoRoot = path.resolve(__dirname, "..");
  const errors = validateManifestCollection(repoRoot);
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`ERROR ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Manifest validation passed.");
}

if (require.main === module) {
  run();
}

module.exports = {
  run,
  validateManifestCollection
};
