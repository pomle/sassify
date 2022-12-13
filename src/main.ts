import {
  CallExpression,
  Identifier,
  ImportDeclaration,
  Project,
  SyntaxKind,
} from "ts-morph";
import { createSass } from "./sassify";

function processMakeStyles(makeStylesCall: CallExpression) {
  const callArguments = makeStylesCall.getArguments();
  for (const callArg of callArguments) {
    const jssObject = callArg.asKind(SyntaxKind.ObjectLiteralExpression);
    if (jssObject) {
      return createSass(jssObject);
    }
  }

  return "";
}

function upgradeSourceFile(makeStylesImportDeclaration: ImportDeclaration) {
  const sourceFile = makeStylesImportDeclaration.getSourceFile();

  const makeStylesIdentifier =
    makeStylesImportDeclaration.getFirstDescendantByKindOrThrow(
      SyntaxKind.Identifier
    );

  const makeStylesReferences = makeStylesIdentifier
    .findReferencesAsNodes()
    .filter((n) => n.getSourceFile() === sourceFile);

  let buffer = "";

  for (const ref of makeStylesReferences) {
    const callExpression = ref.getParentIfKind(SyntaxKind.CallExpression);
    if (!callExpression) {
      continue;
    }

    const variableExpression = callExpression.getFirstAncestorByKind(
      SyntaxKind.VariableStatement
    );

    if (!variableExpression) {
      continue;
    }

    const stylesheetCSS = processMakeStyles(callExpression);
    console.log("Stylesheet", sourceFile.getBaseName());

    process.stdout.write(stylesheetCSS);

    buffer += stylesheetCSS;

    variableExpression.remove();
  }

  if (buffer.length > 0) {
    const styleSheetFile = sourceFile
      .getDirectory()
      .createSourceFile("styles.sass", buffer, { overwrite: true });

    sourceFile.addImportDeclaration({
      moduleSpecifier: "./" + styleSheetFile.getBaseName(),
    });
  }

  makeStylesImportDeclaration.remove();
}

function main() {
  const project = new Project({
    tsConfigFilePath: "./tsconfig.json",
  });

  const sourceFiles = project.getSourceFiles("src/**/*.tsx");
  for (const sourceFile of sourceFiles) {
    const importDeclaration = sourceFile.getImportDeclaration(
      "@material-ui/styles"
    );

    if (!importDeclaration) {
      continue;
    }

    console.log("Fixing:", sourceFile.getBaseName());
    upgradeSourceFile(importDeclaration);
  }

  project.saveSync();
}

const path = process.argv.at(2) ?? process.cwd();
process.chdir(path);

main();
