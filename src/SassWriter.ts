import {
  ObjectLiteralExpression,
  PropertyAssignment,
  SyntaxKind,
} from "ts-morph";

function toKebab(text: string) {
  return text
    .trim()
    .split("")
    .map((letter, idx) => {
      return letter.toUpperCase() === letter
        ? `${idx !== 0 ? "-" : ""}${letter.toLowerCase()}`
        : letter;
    })
    .join("");
}

export function SassWriter() {
  let indent = 0;

  const lines: string[] = [];

  function addLine(text: string) {
    lines.push("  ".repeat(indent) + text + "\n");
  }

  function addEmptyLine() {
    lines.push("\n");
  }

  return {
    convertMakeStyles(jssObject: ObjectLiteralExpression) {
      // Special first layer where identifiers are object keys, and not CSS properties.

      const styleClauses = jssObject.getChildrenOfKind(
        SyntaxKind.PropertyAssignment
      );

      for (const styleClause of styleClauses) {
        const cssSelector = styleClause.getChildAtIndex(0);

        if (cssSelector.isKind(SyntaxKind.Identifier)) {
          addLine("." + cssSelector.getText());
        } else if (cssSelector.isKind(SyntaxKind.StringLiteral)) {
          addLine(cssSelector.getText().slice(1, -1));
        }

        indent++;

        const styleProperties = styleClause.getChildAtIndex(2);
        if (styleProperties.isKind(SyntaxKind.ObjectLiteralExpression)) {
          this.convertJSSStyles(styleProperties);
        }

        indent--;
        addEmptyLine();
      }
    },

    convertJSSStyles(jssObject: ObjectLiteralExpression) {
      const properties = jssObject.getChildrenOfKind(
        SyntaxKind.PropertyAssignment
      );

      for (const prop of properties) {
        const key = prop.getChildAtIndex(0);

        // When CSS property
        if (key.isKind(SyntaxKind.Identifier)) {
          this.convertProperty(prop);

          // When subselector
        } else if (key.isKind(SyntaxKind.StringLiteral)) {
          const value = prop.getChildAtIndex(2);
          if (value.isKind(SyntaxKind.ObjectLiteralExpression)) {
            addEmptyLine();
            addLine(key.getText().slice(1, -1));
            indent++;
            this.convertJSSStyles(value);
            indent--;
          }
        }
      }
    },

    convertProperty(styleProperty: PropertyAssignment) {
      const propName = styleProperty.getChildAtIndex(0);
      const propValue = styleProperty.getChildAtIndex(2);

      const key = toKebab(propName.getText());

      if (
        propValue.isKind(SyntaxKind.StringLiteral) ||
        propValue.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)
      ) {
        let value = propValue.getText().slice(1, -1);

        if (key.startsWith("animation")) {
          value = value.replace("$", "");
          //console.info("Unhandled $ prefix in animation name");
        }

        addLine(`${key}: ${value}`);
      } else if (
        propValue.isKind(SyntaxKind.PrefixUnaryExpression) ||
        propValue.isKind(SyntaxKind.NumericLiteral)
      ) {
        addLine(`${key}: ${propValue.getText()}`);
      } else {
        console.warn("Unknown prop value", key, propValue.getText());
      }
    },

    getOutput() {
      return lines.join("");
    },
  };
}