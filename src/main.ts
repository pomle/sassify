import { ImportDeclaration, Project, SyntaxKind } from "ts-morph";
import { processMakeStyles } from "./sassify";

function upgradeSourceFile(makeStylesImportDeclaration: ImportDeclaration) {
  const sourceFile = makeStylesImportDeclaration.getSourceFile();
  console.log("Processing", sourceFile.getFilePath());

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
            if (stylesVaribles.length > 0) {
              const stylesRefs = identifier.findReferencesAsNodes();
              for (const styleRef of stylesRefs) {
                styleRef.replaceWithText(stylesVaribles[0]);
              }
            }

            styleVariableStatement.remove();
          }
        }
      }
    }

    makeStylesDefinition.remove();
  }

  makeStylesImportDeclaration.remove();

  if (buffer.length > 0) {
    if (stylesVaribles.length === 0) {
      throw new Error("Found not hook calls");
    }
    const stylesVariable = stylesVaribles[0];

    const stylesheetFilename = "styles.module.sass";

    const sourceDir = sourceFile.getDirectory();

    const stylesheetFile =
      sourceDir.getSourceFile(stylesheetFilename) ??
      sourceDir.createSourceFile(stylesheetFilename);
    stylesheetFile.replaceWithText(stylesheetFile.getText() + buffer);

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

    console.log("Sass -- ", stylesheetFilename);
    process.stdout.write(buffer);

    console.log("TS -- ", sourceFile.getBaseName());
    process.stdout.write(sourceFile.getText());
  }
}

type Config = {
  write: boolean;
};

function main(
  sourceDir: string,
  pattern: string,
  { write = false }: Partial<Config> = {}
) {
  process.chdir(sourceDir);

  const project = new Project({
    tsConfigFilePath: "./tsconfig.json",
  });

  const sourceFiles = project.getSourceFiles(pattern);

  for (const sourceFile of sourceFiles) {
    const importDeclaration = sourceFile.getImportDeclaration(
      "@material-ui/styles"
    );

    if (!importDeclaration) {
      continue;
    }

    try {
      upgradeSourceFile(importDeclaration);
    } catch (error) {
      console.warn("Could not upgrade %s", sourceFile.getFilePath(), error);
    }
  }

  if (write) {
    project.saveSync();
  }
}

let path = process.cwd();
let pattern = "src/**/*.tsx";

let config: Partial<Config> = {};

let positional = 0;
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("-")) {
    if (arg === "-w") {
      config.write = true;
    }
  } else {
    if (positional === 0) {
      path = arg;
    } else if (positional === 1) {
      pattern = arg;
    }
    positional++;
  }
}

console.debug("Path: %s, Pattern: %s", path, pattern, config);

main(path, pattern, config);
