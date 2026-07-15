// Merges the `cargoDependencies` each runtime and module contributes into a single
// Cargo.toml [dependencies] table.
//
// Rust has no equivalent of the "module owns the whole manifest" pattern the Node
// modules use for package.json: an Axum service and the OIDC integration layered on
// top of it must both add crates to the *same* Cargo.toml. Declaring dependencies as
// data and merging them here keeps modules additive and composable.

function normalizeDependency(spec) {
  return typeof spec === "string" ? { version: spec } : { ...spec };
}

function formatValue(value) {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => JSON.stringify(entry)).join(", ")}]`;
  }
  if (typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

function formatDependency(name, spec) {
  const normalized = normalizeDependency(spec);
  const keys = Object.keys(normalized);
  if (keys.length === 1 && keys[0] === "version") {
    return `${name} = ${JSON.stringify(normalized.version)}`;
  }

  // Cargo expects `version` first, then the remaining keys in a stable order.
  const ordered = ["version", "default-features", "features", "optional"].filter((key) => key in normalized);
  const body = ordered.map((key) => `${key} = ${formatValue(normalized[key])}`).join(", ");
  return `${name} = { ${body} }`;
}

function isSameRequirement(left, right) {
  const a = normalizeDependency(left);
  const b = normalizeDependency(right);
  return a.version === b.version &&
    a["default-features"] === b["default-features"] &&
    a.optional === b.optional;
}

function mergeFeatures(left, right) {
  return [...new Set([...(left.features || []), ...(right.features || [])])].sort();
}

// Contributors are `{ label, cargoDependencies }`; label is only used for error text.
function mergeCargoDependencies(contributors) {
  const merged = new Map();
  const sources = new Map();
  const errors = [];

  for (const contributor of contributors) {
    for (const [name, spec] of Object.entries(contributor.cargoDependencies || {})) {
      if (!merged.has(name)) {
        merged.set(name, normalizeDependency(spec));
        sources.set(name, contributor.label);
        continue;
      }

      const existing = merged.get(name);
      if (!isSameRequirement(existing, spec)) {
        errors.push(
          `Crate \`${name}\` is requested with conflicting requirements by \`${sources.get(name)}\` and \`${contributor.label}\`.`
        );
        continue;
      }

      // Same requirement: union the features so neither contributor loses one.
      const features = mergeFeatures(existing, normalizeDependency(spec));
      if (features.length > 0) {
        existing.features = features;
      }
    }
  }

  return { dependencies: merged, errors };
}

function renderCargoDependencies(dependencies) {
  return [...dependencies.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, spec]) => formatDependency(name, spec))
    .join("\n");
}

module.exports = {
  formatDependency,
  mergeCargoDependencies,
  renderCargoDependencies
};
