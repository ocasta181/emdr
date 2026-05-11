#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Node, Project, SyntaxKind } from "ts-morph";

const sourceRoots = ["domain", "src", "core", "infrastructure", "electron", "utils.ts", "stateGraph.ts", "vite.config.ts"];
const sourceExtensions = new Set([".ts", ".tsx", ".cts", ".mts"]);
const dbMethodNames = new Set(["exec", "export", "prepare", "run"]);
const collectionMethodNames = new Set(["concat", "filter", "map", "push", "reduce", "splice"]);
const businessUtilityNames = new Set(["createId", "nowIso", "replaceById"]);
const businessFileNamePatterns = [/\/factory(?:\.[cm]?tsx?)?$/, /\/flow(?:\.[cm]?tsx?)?$/, /Machine(?:\.[cm]?tsx?)?$/];

const args = process.argv.slice(2);
const stagedOnly = args.includes("--staged");
let activeFindings = [];

const files = stagedOnly ? stagedFiles() : allSourceFiles();
const analyzedFiles = files.filter((file) => sourceExtensions.has(path.extname(file.path)));
const findings = stagedOnly ? introducedFindings(analyzedFiles) : analyzeFiles(analyzedFiles);

if (findings.length > 0) {
  console.error("Architecture static analysis failed:");
  console.error("");
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line}:${finding.column} ${finding.rule}`);
    console.error(`  ${finding.message}`);
  }
  console.error("");
  console.error(`${findings.length} architecture violation${findings.length === 1 ? "" : "s"} found.`);
  process.exit(1);
}

if (stagedOnly) {
  console.log(`Architecture static analysis passed for ${analyzedFiles.length} staged TypeScript file${analyzedFiles.length === 1 ? "" : "s"}.`);
} else {
  console.log(`Architecture static analysis passed for ${analyzedFiles.length} TypeScript file${analyzedFiles.length === 1 ? "" : "s"}.`);
}

function analyzeTypeRuntimeBoundary(sourceFile) {
  const typeDeclarations = [];
  const runtimeDeclarations = [];

  for (const statement of sourceFile.getStatements()) {
    if (Node.isTypeAliasDeclaration(statement) || Node.isInterfaceDeclaration(statement) || Node.isEnumDeclaration(statement)) {
      typeDeclarations.push(statement);
      continue;
    }

    if (Node.isFunctionDeclaration(statement) || Node.isClassDeclaration(statement)) {
      runtimeDeclarations.push(statement);
      continue;
    }

    if (Node.isVariableStatement(statement)) {
      runtimeDeclarations.push(statement);
      continue;
    }
  }

  if (typeDeclarations.length > 0 && runtimeDeclarations.length > 0) {
    report({
      node: typeDeclarations[0],
      rule: "architecture/types-runtime-boundary",
      fingerprint: "mixed-type-runtime-file",
      message: "Files must define either types or runtime values/functions, not both. Move the types into a sibling types/entity file."
    });
  }
}

function analyzeImports(sourceFile) {
  const filePath = normalizePath(sourceFile.getFilePath());

  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const specifier = importDeclaration.getModuleSpecifierValue();
    const resolved = resolveImport(filePath, specifier);

    if (isServiceLayer(filePath) && importsUi(specifier, resolved)) {
      report({
        node: importDeclaration,
        rule: "architecture/service-no-ui",
        message: `Service files cannot depend on UI code: ${specifier}`
      });
    }

    if (!isStoreAllowedLayer(filePath) && importsPersistence(specifier, resolved)) {
      report({
        node: importDeclaration,
        rule: "architecture/db-in-repository-only",
        message: `Persistence access is only allowed in repository files: ${specifier}`
      });
    }

    if (isUiLayer(filePath) && importsBusinessImplementation(resolved)) {
      report({
        node: importDeclaration,
        rule: "architecture/ui-no-business-logic",
        message: `UI files must call service functions instead of importing business implementation files: ${specifier}`
      });
    }

    if (!isServiceLayer(filePath) && importsBusinessImplementation(resolved)) {
      report({
        node: importDeclaration,
        rule: "architecture/business-in-service-only",
        message: `Business implementation dependencies are only allowed in service files: ${specifier}`
      });
    }
  }
}

function analyzeDbTouches(sourceFile) {
  const filePath = normalizePath(sourceFile.getFilePath());
  if (isStoreAllowedLayer(filePath)) return;

  sourceFile.forEachDescendant((node) => {
    if (Node.isIdentifier(node) && ["indexedDB", "localStorage"].includes(node.getText())) {
      report({
        node,
        rule: "architecture/db-in-repository-only",
        message: `${node.getText()} is persistence access and must live behind a repository.`
      });
      return;
    }

    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();
      if (Node.isPropertyAccessExpression(expression) && dbMethodNames.has(expression.getName())) {
        report({
          node: expression,
          rule: "architecture/db-in-repository-only",
          message: `Database method "${expression.getName()}" is only allowed in repository files.`
        });
      }

      const firstArgument = node.getArguments()[0];
      if (firstArgument?.getKind() === SyntaxKind.StringLiteral && firstArgument.getText().startsWith('"db:')) {
        report({
          node,
          rule: "architecture/db-in-repository-only",
          message: "Database IPC channels must be wrapped by a repository."
        });
      }
    }
  });
}

function analyzeBusinessLogic(sourceFile) {
  const filePath = normalizePath(sourceFile.getFilePath());
  if (isServiceLayer(filePath) || isTypeOnlyLayer(filePath) || isRepositoryLayer(filePath) || isUiLayer(filePath)) return;
  if (!isDomainFile(filePath)) return;

  if (businessFileNamePatterns.some((pattern) => pattern.test(filePath))) {
    report({
      node: sourceFile,
      rule: "architecture/business-in-service-only",
      message: "Business behavior files must live in the service layer."
    });
  }

  for (const statement of sourceFile.getStatements()) {
    if (Node.isFunctionDeclaration(statement) || Node.isClassDeclaration(statement) || Node.isVariableStatement(statement)) {
      report({
        node: statement,
        rule: "architecture/business-in-service-only",
        message: "Runtime behavior outside repositories, UI adapters, and type files belongs in a service file."
      });
      return;
    }
  }
}

function analyzeUiBusinessLogic(sourceFile) {
  const filePath = normalizePath(sourceFile.getFilePath());
  if (!isUiLayer(filePath)) return;

  sourceFile.forEachDescendant((node) => {
    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();

      if (Node.isIdentifier(expression) && businessUtilityNames.has(expression.getText())) {
        report({
          node: expression,
          rule: "architecture/ui-no-business-logic",
          message: `UI code cannot call domain business utility "${expression.getText()}". Move the operation into a service.`
        });
        return;
      }

      if (
        Node.isPropertyAccessExpression(expression) &&
        collectionMethodNames.has(expression.getName()) &&
        expression.getExpression().getText().startsWith("database.")
      ) {
        report({
          node: expression,
          rule: "architecture/ui-no-business-logic",
          message: "UI code cannot transform domain database collections directly. Call a service method instead."
        });
      }
    }

    if (Node.isSpreadAssignment(node) && node.getExpression().getText() === "database") {
      report({
        node,
        rule: "architecture/ui-no-business-logic",
        message: "UI code cannot construct domain database objects directly. Call a service method instead."
      });
    }
  });
}

function importsUi(specifier, resolved) {
  return (
    specifier === "react" ||
    specifier === "react-dom" ||
    resolved.endsWith(".tsx") ||
    resolved.includes("/components/") ||
    (resolved.startsWith("src/") && !resolved.startsWith("src/main/"))
  );
}

function importsPersistence(specifier, resolved) {
  return specifier === "sql.js" || resolved.startsWith("core/internal/sqlite/") || resolved === "src/db";
}

function importsBusinessImplementation(resolved) {
  return businessFileNamePatterns.some((pattern) => pattern.test(resolved));
}

function isServiceLayer(filePath) {
  return /^domain\/[^/]+\/service\.[cm]?tsx?$/.test(filePath);
}

function isRepositoryLayer(filePath) {
  return (
    /^domain\/[^/]+\/repository\.[cm]?tsx?$/.test(filePath) ||
    /^src\/main\/internal\/domain\/[^/]+\/repository\.[cm]?tsx?$/.test(filePath) ||
    filePath.startsWith("core/internal/") ||
    filePath.startsWith("electron/")
  );
}

function isStoreAllowedLayer(filePath) {
  return (
    isRepositoryLayer(filePath) ||
    filePath.startsWith("src/main/api/") ||
    filePath.startsWith("src/main/internal/lib/")
  );
}

function isTypeOnlyLayer(filePath) {
  return (
    filePath.endsWith(".d.ts") ||
    /^domain\/[^/]+\/(types|entity)\.[cm]?tsx?$/.test(filePath) ||
    filePath === "src/types.ts" ||
    filePath === "stateGraph.ts"
  );
}

function isUiLayer(filePath) {
  return filePath.endsWith(".tsx") || filePath.includes("/components/") || filePath === "src/main.tsx";
}

function isDomainFile(filePath) {
  return filePath.startsWith("domain/");
}

function introducedFindings(files) {
  const baseFindingsByKey = countFindings(analyzeFiles(headFiles(files)));
  const currentFindings = analyzeFiles(files);

  return currentFindings.filter((finding) => {
    const count = baseFindingsByKey.get(finding.key) ?? 0;
    if (count > 0) {
      baseFindingsByKey.set(finding.key, count - 1);
      return false;
    }

    return true;
  });
}

function analyzeFiles(files) {
  const project = new Project({ skipAddingFilesFromTsConfig: true });
  const results = [];

  withFindings(results, () => {
    for (const file of files) {
      const sourceFile = project.createSourceFile(file.path, file.text, { overwrite: true });
      analyzeTypeRuntimeBoundary(sourceFile);
      analyzeImports(sourceFile);
      analyzeDbTouches(sourceFile);
      analyzeBusinessLogic(sourceFile);
      analyzeUiBusinessLogic(sourceFile);
    }
  });

  return results;
}

function withFindings(findings, callback) {
  const previousFindings = activeFindings;
  activeFindings = findings;
  try {
    callback();
  } finally {
    activeFindings = previousFindings;
  }
}

function countFindings(findings) {
  const counts = new Map();
  for (const finding of findings) {
    counts.set(finding.key, (counts.get(finding.key) ?? 0) + 1);
  }

  return counts;
}

function resolveImport(filePath, specifier) {
  if (!specifier.startsWith(".")) return specifier;
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(filePath), specifier));
  return stripKnownExtension(resolved);
}

function stripKnownExtension(filePath) {
  return filePath.replace(/\.(d\.)?[cm]?tsx?$/, "");
}

function report({ node, rule, fingerprint, message }) {
  const sourceFile = node.getSourceFile();
  const position = sourceFile.getLineAndColumnAtPos(node.getStart());
  const file = normalizePath(sourceFile.getFilePath());
  activeFindings.push({
    file,
    line: position.line,
    column: position.column,
    rule,
    key: [file, rule, message, fingerprint ?? findingNodeText(node)].join("\0"),
    message
  });
}

function findingNodeText(node) {
  if (Node.isSourceFile(node)) return "source-file";
  return node.getText().replace(/\s+/g, " ").trim();
}

function stagedFiles() {
  const output = git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]);
  if (!output) return [];

  return output
    .split("\n")
    .filter(Boolean)
    .filter((filePath) => sourceExtensions.has(path.extname(filePath)))
    .map((filePath) => ({
      path: normalizePath(filePath),
      text: git(["show", `:${filePath}`])
    }));
}

function headFiles(files) {
  return files.flatMap((file) => {
    try {
      return [{ path: file.path, text: git(["show", `HEAD:${file.path}`]) }];
    } catch {
      return [];
    }
  });
}

function allSourceFiles() {
  return sourceRoots.flatMap((root) => {
    if (!fs.existsSync(root)) return [];
    const stats = fs.statSync(root);
    if (stats.isFile()) {
      return [{ path: normalizePath(root), text: fs.readFileSync(root, "utf8") }];
    }

    return walk(root)
      .filter((filePath) => sourceExtensions.has(path.extname(filePath)))
      .map((filePath) => ({ path: normalizePath(filePath), text: fs.readFileSync(filePath, "utf8") }));
  });
}

function walk(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (["dist", "dist-electron", "node_modules"].includes(entry.name)) return [];
      return walk(filePath);
    }

    return entry.isFile() ? [filePath] : [];
  });
}

function normalizePath(filePath) {
  const repoRelativePath = path.isAbsolute(filePath) ? path.relative(process.cwd(), filePath) : filePath;
  return repoRelativePath.split(path.sep).join("/").replace(/^\.\//, "");
}

function git(gitArgs) {
  return execFileSync("git", gitArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
