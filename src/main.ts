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
  console.log("Processing", sourceFile.getBaseName());

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

    const makeStylesDefinition = callExpression.getFirstAncestorByKind(
      SyntaxKind.VariableStatement
    );

    if (!makeStylesDefinition) {
      continue;
    }

    const stylesheet = processMakeStyles(callExpression);

    process.stdout.write(stylesheet);

    buffer += stylesheet;

    const styleHookIdentifier = callExpression
      .getFirstAncestorByKind(SyntaxKind.VariableDeclaration)
      ?.getFirstChildByKind(SyntaxKind.Identifier);

    if (styleHookIdentifier) {
      const styleHookReferences = styleHookIdentifier.findReferencesAsNodes();
      for (const hookCall of styleHookReferences) {
        if (hookCall.isKind(SyntaxKind.Identifier)) {
          hookCall
            .getFirstAncestorByKind(SyntaxKind.VariableStatement)
            ?.remove();
        }
      }
    }

    makeStylesDefinition.remove();
  }

  makeStylesImportDeclaration.remove();

  if (buffer.length > 0) {
    process.stdout.write(buffer);

    const styleSheetFile = sourceFile
      .getDirectory()
      .createSourceFile("styles.sass", buffer, { overwrite: true });

    sourceFile.addImportDeclaration({
      moduleSpecifier: "./" + styleSheetFile.getBaseName(),
    });
  }
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

    upgradeSourceFile(importDeclaration);
  }

  project.saveSync();
}

const path = process.argv.at(2) ?? process.cwd();
process.chdir(path);

main();
