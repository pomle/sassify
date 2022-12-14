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

  const makeStylesCalls = sourceFile
    .getDescendantsOfKind(SyntaxKind.CallExpression)
    .filter((callExpression) => {
      const identifier = callExpression.getFirstChildIfKind(
        SyntaxKind.Identifier
      );
      return identifier?.getText() === makeStylesIdentifier.getText();
    });

  let buffer = "";

  const stylesVaribles: string[] = [];

  console.log("Processing %s makeStyles references", makeStylesCalls.length);

  for (const callExpression of makeStylesCalls) {
    const makeStylesDefinition = callExpression.getFirstAncestorByKind(
      SyntaxKind.VariableStatement
    );

    if (!makeStylesDefinition) {
      continue;
    }

    const stylesheet = processMakeStyles(callExpression);
    buffer += stylesheet;

    const styleHookIdentifier = callExpression
      .getFirstAncestorByKind(SyntaxKind.VariableDeclaration)
      ?.getFirstChildByKind(SyntaxKind.Identifier);

    if (styleHookIdentifier) {
      const styleHookReferences = styleHookIdentifier.findReferencesAsNodes();
      for (const hookCall of styleHookReferences) {
        if (hookCall.isKind(SyntaxKind.Identifier)) {
          const styleVariableStatement = hookCall.getFirstAncestorByKind(
            SyntaxKind.VariableStatement
          );

          if (styleVariableStatement) {
            const identifier =
              styleVariableStatement.getFirstDescendantByKindOrThrow(
                SyntaxKind.Identifier
              );
            stylesVaribles.push(identifier.getText());

            styleVariableStatement.remove();
          }
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
      .createSourceFile("styles.module.sass", buffer, { overwrite: true });

    if (stylesVaribles.length !== 1) {
      throw new Error("Wrong usage of style hook found");
    }

    sourceFile.addImportDeclaration({
      defaultImport: stylesVaribles[0],
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
