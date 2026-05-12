#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { Node, Project, SyntaxKind } from "ts-morph";

const sourceRoots = ["src", "electron", "utils.ts", "stateGraph.ts", "vite.config.ts"];
const sourceExtensions = new Set([".ts", ".tsx", ".cts", ".mts"]);
const dbMethodNames = new Set(["exec", "prepare", "run"]);
const collectionMethodNames = new Set(["concat", "filter", "map", "push", "reduce", "splice"]);
const businessUtilityNames = new Set(["createId", "nowIso", "replaceById"]);
const businessFileNamePatterns = [/\/factory(?:\.[cm]?tsx?)?$/, /\/flow(?:\.[cm]?tsx?)?$/, /Machine(?:\.[cm]?tsx?)?$/];
const schemaSqlPattern = /\b(CREATE|ALTER|DROP)\s+(TABLE|INDEX|TRIGGER|VIEW)\b/i;
const baselineMigrationPath = "src/main/internal/lib/store/sqlite/migrations/0001_initial_schema.ts";
const routeConstructorForbiddenDependencyPattern =
  /\b(db|database|repository|repo|readDatabase|mutateDatabase|AppDatabase|AppStoreDatabase|SqliteDatabase|SQLBaseRepository)\b/i;
const serviceConstructorForbiddenDependencyPattern = /\b(db|database|AppDatabase|AppStoreDatabase|SqliteDatabase)\b/i;
const rendererForbiddenWorkflowRoutes = new Set(["session:end", "stimulation-set:log"]);
const genericPersistenceRoutePrefixes = ["db:", "store:"];

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
  const filePath = normalizePath(sourceFile.getFilePath());
  if (isRendererLayer(filePath)) return;

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

    if (!isPersistenceImportAllowedLayer(filePath) && importsPersistence(specifier, resolved)) {
      report({
        node: importDeclaration,
        rule: "architecture/db-in-repository-only",
        message: `Database access is only allowed in table repositories, store infrastructure, migrations, and modules.ts composition: ${specifier}`
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

    if (isAgentLayer(filePath) && importsAgentForbiddenDependency(resolved)) {
      report({
        node: importDeclaration,
        rule: "architecture/agent-boundary",
        message: `Agent infrastructure cannot import renderer, Electron IPC, repositories, or store internals: ${specifier}`
      });
    }

    if (importsAppDomain(resolved)) {
      report({
        node: importDeclaration,
        rule: "architecture/no-app-domain",
        message: `App-wide orchestration is not a domain. Remove app domain imports: ${specifier}`
      });
    }

    if (importsMigrations(resolved) && !isMigrationLayer(filePath)) {
      report({
        node: importDeclaration,
        rule: "architecture/no-runtime-migrations",
        message: `Application runtime code must not import migrations: ${specifier}`
      });
    }
  }
}

function analyzeDbTouches(sourceFile) {
  const filePath = normalizePath(sourceFile.getFilePath());
  const dbMethodsAllowed = isDbMethodAllowedLayer(filePath);

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
      if (!dbMethodsAllowed && Node.isPropertyAccessExpression(expression) && databaseMethodAccessLooksLikeDb(expression)) {
        report({
          node: expression,
          rule: "architecture/db-in-repository-only",
          message: `Database method "${expression.getName()}" is only allowed in repositories, store infrastructure, and migrations.`
        });
      }

      const firstArgument = node.getArguments()[0];
      if (Node.isStringLiteral(firstArgument) && isGenericPersistenceRoute(firstArgument.getLiteralText())) {
        report({
          node,
          rule: "architecture/db-in-repository-only",
          message: "Generic database/store IPC channels must be replaced with domain routes backed by repositories."
        });
      }
    }

    if (!isPersistenceImportAllowedLayer(filePath) && Node.isNewExpression(node)) {
      const expression = node.getExpression();
      if (expression.getText() === "AppStoreDatabase") {
        report({
          node,
          rule: "architecture/db-in-repository-only",
          message: "AppStoreDatabase must only be instantiated in modules.ts, then passed into repositories or narrow function ports."
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

function analyzeRendererWorkflowRoutes(sourceFile) {
  const filePath = normalizePath(sourceFile.getFilePath());
  if (!isRendererLayer(filePath)) return;

  sourceFile.forEachDescendant((node) => {
    if (!Node.isStringLiteral(node)) return;
    const route = node.getLiteralText();
    if (!rendererForbiddenWorkflowRoutes.has(route)) return;

    report({
      node,
      rule: "architecture/renderer-workflow-routes",
      message: `Renderer code must not call graph-bypassing workflow route "${route}". Use graph-validated workflow or guide routes.`
    });
  });
}

function analyzeSchemaBoundary(sourceFile) {
  const filePath = normalizePath(sourceFile.getFilePath());

  sourceFile.forEachDescendant((node) => {
    if (!isStringLikeNode(node)) return;
    if (!schemaSqlPattern.test(node.getText())) return;

    if (!isMigrationFile(filePath)) {
      report({
        node,
        rule: "architecture/schema-in-migrations-only",
        message: "Schema DDL must live only in migration files."
      });
    }
  });
}

function analyzeAppDomain(sourceFile) {
  const filePath = normalizePath(sourceFile.getFilePath());
  if (!filePath.startsWith("src/main/internal/domain/app/")) return;

  report({
    node: sourceFile,
    rule: "architecture/no-app-domain",
    fingerprint: "app-domain-file",
    message: "There is no app domain. App-wide orchestration belongs outside src/main/internal/domain."
  });
}

function analyzeDomainRepositoryFormula(sourceFile) {
  const filePath = normalizePath(sourceFile.getFilePath());
  if (!isDomainRepositoryFile(filePath)) return;

  for (const statement of sourceFile.getStatements()) {
    if (Node.isFunctionDeclaration(statement) || Node.isClassDeclaration(statement)) {
      report({
        node: statement,
        rule: "architecture/domain-repository-formula",
        message: "Domain repositories must stay formulaic: export a repository factory only, with no custom functions/classes."
      });
    }
  }

  sourceFile.forEachDescendant((node) => {
    if (Node.isCallExpression(node)) {
      const expression = node.getExpression();
      if (Node.isPropertyAccessExpression(expression) && expression.getExpression().getText() === "db") {
        report({
          node: expression,
          rule: "architecture/domain-repository-formula",
          message: "Domain repositories must not run SQL directly; use SQLBaseRepository with the existing formula."
        });
      }
    }

    if (isStringLikeNode(node) && schemaSqlPattern.test(node.getText())) {
      report({
        node,
        rule: "architecture/domain-repository-formula",
        message: "Repositories must not define, destroy, or modify table schemas."
      });
    }
  });
}

function analyzeRepositoryFactoryInputs(sourceFile) {
  const filePath = normalizePath(sourceFile.getFilePath());
  if (!isDomainRepositoryFile(filePath)) return;

  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const resolved = resolveImport(filePath, importDeclaration.getModuleSpecifierValue());
    if (isServiceLayer(resolved)) {
      report({
        node: importDeclaration,
        rule: "architecture/repository-db-only",
        message: "Repositories may not depend on services. A repository factory may only take the database."
      });
    }
  }

  for (const statement of sourceFile.getStatements()) {
    if (!Node.isVariableStatement(statement)) continue;

    for (const declaration of statement.getDeclarations()) {
      if (!/^new[A-Z]\w*Repository$/.test(declaration.getName())) continue;

      const initializer = declaration.getInitializer();
      if (!initializer || !Node.isArrowFunction(initializer)) {
        report({
          node: declaration,
          rule: "architecture/repository-db-only",
          message: "Repository exports must be factory arrow functions that take only db."
        });
        continue;
      }

      const parameters = initializer.getParameters();
      if (parameters.length !== 1) {
        report({
          node: declaration,
          rule: "architecture/repository-db-only",
          message: "Repository factories may take exactly one argument: db."
        });
        continue;
      }

      const [parameter] = parameters;
      const typeNode = parameter.getTypeNode();
      if (parameter.getName() !== "db" || !typeNode || typeNode.getText() !== "SqliteDatabase") {
        report({
          node: parameter,
          rule: "architecture/repository-db-only",
          message: "Repository factories must be shaped as (db: SqliteDatabase)."
        });
      }
    }
  }
}

function analyzeRouteDependencyFlow(sourceFile) {
  const routeClasses = sourceFile.getClasses().filter((classDeclaration) => classDeclaration.getName()?.endsWith("Routes"));
  if (routeClasses.length === 0) return;

  for (const importDeclaration of sourceFile.getImportDeclarations()) {
    const specifier = importDeclaration.getModuleSpecifierValue();
    const resolved = resolveImport(normalizePath(sourceFile.getFilePath()), specifier);

    if (importsRouteForbiddenDependency(resolved)) {
      report({
        node: importDeclaration,
        rule: "architecture/route-service-boundary",
        message: "Routes must receive services only. Build db -> repo -> service before constructing the route."
      });
    }
  }

  for (const routeClass of routeClasses) {
    for (const constructorDeclaration of routeClass.getConstructors()) {
      for (const parameter of constructorDeclaration.getParameters()) {
        if (routeParameterUsesForbiddenDependency(parameter)) {
          report({
            node: parameter,
            rule: "architecture/route-service-boundary",
            message: "Route constructors must not take db, repository, or database accessor dependencies. Pass services into routes."
          });
        }
      }
    }

    routeClass.forEachDescendant((node) => {
      if (Node.isCallExpression(node) && routeCallUsesForbiddenDependency(node)) {
        report({
          node,
          rule: "architecture/route-service-boundary",
          message: "Routes must not create repositories or open databases. Compose db -> repo -> service before route construction."
        });
      }

      if (Node.isNewExpression(node) && routeNewExpressionUsesForbiddenDependency(node)) {
        report({
          node,
          rule: "architecture/route-service-boundary",
          message: "Routes must not instantiate repositories. Compose db -> repo -> service before route construction."
        });
      }
    });
  }
}

function analyzeModuleCompositionRoot(sourceFile) {
  const filePath = normalizePath(sourceFile.getFilePath());
  if (filePath !== "src/main/api/modules.ts") return;

  sourceFile.forEachDescendant((node) => {
    if (Node.isIdentifier(node) && /^(readFromAppDatabase|mutateAppDatabase)$/.test(node.getText())) {
      report({
        node,
        rule: "architecture/modules-linear-composition",
        message: "modules.ts must compose db -> repo -> service -> route directly, not wrap services in database callbacks."
      });
    }

    if (Node.isIdentifier(node) && /\w+IpcService$/.test(node.getText())) {
      report({
        node,
        rule: "architecture/modules-linear-composition",
        message: "modules.ts must instantiate concrete services, not redefine route-facing IpcService objects."
      });
    }

    if (!Node.isVariableDeclaration(node)) return;
    const initializer = node.getInitializer();
    if (!initializer || !Node.isObjectLiteralExpression(initializer)) return;
    if (!node.getName().endsWith("Service")) return;

    report({
      node,
      rule: "architecture/modules-linear-composition",
      message: "modules.ts service variables must be constructed with classes/functions, not object literals."
    });
  });
}

function analyzeServiceDependencyFlow(sourceFile) {
  const filePath = normalizePath(sourceFile.getFilePath());
  if (!isServiceLayer(filePath)) return;

  for (const serviceClass of sourceFile.getClasses()) {
    for (const constructorDeclaration of serviceClass.getConstructors()) {
      for (const parameter of constructorDeclaration.getParameters()) {
        if (serviceParameterUsesForbiddenDependency(parameter)) {
          report({
            node: parameter,
            rule: "architecture/service-repository-boundary",
            message: "Services must depend on repositories or service interfaces, not database handles."
          });
        }
      }
    }
  }
}

function analyzeMigrationFileSet(sourceFiles) {
  const migrationFiles = sourceFiles.filter((sourceFile) => isMigrationFile(normalizePath(sourceFile.getFilePath())));
  const baseline = migrationFiles.find((sourceFile) => normalizePath(sourceFile.getFilePath()) === baselineMigrationPath);

  if (migrationFiles.length === 1 && baseline) return;

  for (const sourceFile of migrationFiles) {
    if (normalizePath(sourceFile.getFilePath()) === baselineMigrationPath) continue;
    report({
      node: sourceFile,
      rule: "architecture/single-baseline-migration",
      fingerprint: "extra-migration-file",
      message: "This pre-live codebase must have exactly one baseline migration file. Fold schema changes into 0001."
    });
  }

  if (!baseline && sourceFiles.length > 0) {
    report({
      node: sourceFiles[0],
      rule: "architecture/single-baseline-migration",
      fingerprint: "missing-baseline-migration",
      message: `Missing required baseline migration file: ${baselineMigrationPath}`
    });
  }
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
  return (
    specifier === "sql.js" ||
    resolved.startsWith("src/main/internal/lib/store/sqlite/")
  );
}

function importsBusinessImplementation(resolved) {
  if (isRendererLayer(resolved)) return false;
  return businessFileNamePatterns.some((pattern) => pattern.test(resolved));
}

function importsAgentForbiddenDependency(resolved) {
  return (
    isRendererLayer(resolved) ||
    resolved.startsWith("electron/") ||
    resolved.startsWith("src/main/api/") ||
    resolved.includes("/repository") ||
    resolved.startsWith("src/main/internal/lib/store/")
  );
}

function importsAppDomain(resolved) {
  return resolved.startsWith("src/main/internal/domain/app/");
}

function importsMigrations(resolved) {
  return resolved.startsWith("src/main/internal/lib/store/sqlite/migrations/");
}

function isGenericPersistenceRoute(route) {
  return genericPersistenceRoutePrefixes.some((prefix) => route.startsWith(prefix));
}

function databaseMethodAccessLooksLikeDb(expression) {
  const methodName = expression.getName();
  if (dbMethodNames.has(methodName)) return true;
  if (methodName !== "export") return false;

  return /\b(db|database|sqlite|store)\b/i.test(expression.getExpression().getText());
}

function importsRouteForbiddenDependency(resolved) {
  return resolved.includes("/repository") || resolved.startsWith("src/main/internal/lib/store/");
}

function routeParameterUsesForbiddenDependency(parameter) {
  const name = parameter.getName();
  const typeNode = parameter.getTypeNode();
  return routeConstructorForbiddenDependencyPattern.test(name) || (
    typeNode ? routeConstructorForbiddenDependencyPattern.test(typeNode.getText()) : false
  );
}

function routeCallUsesForbiddenDependency(callExpression) {
  const expression = callExpression.getExpression();
  if (Node.isIdentifier(expression)) {
    return /^(readFromAppDatabase|mutateAppDatabase|new[A-Z].*Repository)$/.test(expression.getText());
  }

  return false;
}

function routeNewExpressionUsesForbiddenDependency(newExpression) {
  const expression = newExpression.getExpression();
  return /\b[A-Z]\w*Repository\b/.test(expression.getText());
}

function serviceParameterUsesForbiddenDependency(parameter) {
  const name = parameter.getName();
  const typeNode = parameter.getTypeNode();
  return serviceConstructorForbiddenDependencyPattern.test(name) || (
    typeNode ? serviceConstructorForbiddenDependencyPattern.test(typeNode.getText()) : false
  );
}

function isServiceLayer(filePath) {
  return (
    /^domain\/[^/]+\/service\.[cm]?tsx?$/.test(filePath) ||
    /^src\/main\/internal\/domain\/[^/]+\/service\.[cm]?tsx?$/.test(filePath)
  );
}

function isRepositoryLayer(filePath) {
  return (
    /^domain\/[^/]+\/repository\.[cm]?tsx?$/.test(filePath) ||
    /^src\/main\/internal\/domain\/[^/]+\/repository\.[cm]?tsx?$/.test(filePath)
  );
}

function isPersistenceImportAllowedLayer(filePath) {
  return (
    isRepositoryLayer(filePath) ||
    isRepositoryCompositionFile(filePath) ||
    isDatabaseImplementationLayer(filePath) ||
    isMigrationLayer(filePath)
  );
}

function isDbMethodAllowedLayer(filePath) {
  return (
    isRepositoryLayer(filePath) ||
    isDatabaseImplementationLayer(filePath) ||
    isMigrationLayer(filePath)
  );
}

function isRepositoryCompositionFile(filePath) {
  return filePath === "src/main/api/modules.ts";
}

function isDatabaseImplementationLayer(filePath) {
  return (
    filePath.startsWith("src/main/internal/lib/store/sqlite/") ||
    filePath.startsWith("src/main/internal/lib/store/repository/")
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

function isRendererLayer(filePath) {
  return filePath.startsWith("src/renderer/") || filePath === "src/main.tsx";
}

function isAgentLayer(filePath) {
  return filePath.startsWith("src/main/internal/lib/agent/");
}

function isMigrationLayer(filePath) {
  return filePath.startsWith("src/main/internal/lib/store/sqlite/migrations/");
}

function isMigrationFile(filePath) {
  return /^src\/main\/internal\/lib\/store\/sqlite\/migrations\/\d{4}_.+\.[cm]?ts$/.test(filePath);
}

function isDomainRepositoryFile(filePath) {
  return /^src\/main\/internal\/domain\/[^/]+\/repository\.[cm]?ts$/.test(filePath);
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
    const sourceFiles = [];
    for (const file of files) {
      const sourceFile = project.createSourceFile(file.path, file.text, { overwrite: true });
      sourceFiles.push(sourceFile);
      analyzeTypeRuntimeBoundary(sourceFile);
      analyzeImports(sourceFile);
      analyzeDbTouches(sourceFile);
      analyzeBusinessLogic(sourceFile);
      analyzeUiBusinessLogic(sourceFile);
      analyzeRendererWorkflowRoutes(sourceFile);
      analyzeSchemaBoundary(sourceFile);
      analyzeAppDomain(sourceFile);
      analyzeDomainRepositoryFormula(sourceFile);
      analyzeRepositoryFactoryInputs(sourceFile);
      analyzeRouteDependencyFlow(sourceFile);
      analyzeModuleCompositionRoot(sourceFile);
      analyzeServiceDependencyFlow(sourceFile);
    }
    analyzeMigrationFileSet(sourceFiles);
  });

  return results;
}

function isStringLikeNode(node) {
  return Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node) || Node.isTemplateExpression(node);
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
