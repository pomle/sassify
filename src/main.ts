import {
  CallExpression,
  Identifier,
  ImportDeclaration,
  Project,
  StructureKind,
  SyntaxKind,
} from "ts-morph";
import fs from "fs";
import { processMakeStyles } from "./sassify";

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
  const classNames: string[] = [];

  console.log("Processing %s makeStyles references", makeStylesCalls.length);

  for (const callExpression of makeStylesCalls) {
    const makeStylesDefinition = callExpression.getFirstAncestorByKind(
      SyntaxKind.VariableStatement
    );

    if (!makeStylesDefinition) {
      continue;
    }

    const result = processMakeStyles(callExpression);
    if (result) {
      buffer += result.stylesheet;
      classNames.push(...result.classNames);
    }

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

    const stylesheetFilename = "styles.module.sass";

    const sourceDir = sourceFile.getDirectory();

    fs.appendFileSync(sourceDir.getPath() + "/" + stylesheetFilename, buffer);

    if (stylesVaribles.length !== 1) {
      throw new Error("Wrong usage of style hook found");
    }

    const stylesVariable = stylesVaribles[0];

    sourceFile.addImportDeclaration({
      defaultImport: stylesVariable,
      moduleSpecifier: "./" + stylesheetFilename,
    });

    const classNamesAttributes = sourceFile
      .getDescendantsOfKind(SyntaxKind.JsxAttribute)
      .filter((attr) => {
        return (
          attr.getFirstChildByKind(SyntaxKind.Identifier)?.getText() ===
          "className"
        );
      });

    for (const classNamesAttribute of classNamesAttributes) {
      const attributeValue = classNamesAttribute.getFirstChildByKind(
        SyntaxKind.StringLiteral
      );

      if (attributeValue) {
        const className = attributeValue.getLiteralText();
        if (classNames.includes(className)) {
          attributeValue.replaceWithText(`{${stylesVariable}.${className}}`);
        }
      }
    }
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
