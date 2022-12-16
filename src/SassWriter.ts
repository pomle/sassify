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

  const classes: string[] = [];

  function addLine(text: string) {
    lines.push("  ".repeat(indent) + text + "\n");
  }

  function addComment(title: string, text: string) {
    addLine("/* " + title);

    text.split("\n").forEach((line) => {
      addLine(" * " + line);
    });

    addLine(" */");
  }

  function addEmptyLine() {
    lines.push("\n");
  }

  return {
    convertMakeStyles(jssObject: ObjectLiteralExpression) {
      // Special first layer where identifiers are object keys, and not CSS properties.

      jssObject.forEachChild((child) => {
        if (child.isKind(SyntaxKind.PropertyAssignment)) {
          const styleClause = child;

          const cssSelector = styleClause.getChildAtIndex(0);
          if (cssSelector.isKind(SyntaxKind.Identifier)) {
            addLine("." + cssSelector.getText());
          } else if (cssSelector.isKind(SyntaxKind.StringLiteral)) {
            addLine(cssSelector.getLiteralValue());
          }

          indent++;
          const definition = styleClause.getChildAtIndex(2);
          if (definition.isKind(SyntaxKind.ObjectLiteralExpression)) {
            this.convertStyleBlock(definition);
          }

          indent--;
          addEmptyLine();
        } else {
          addComment("FIXME: Unhandled directive", child.getText());
        }
      });

      const styleClauses = jssObject.getChildrenOfKind(
        SyntaxKind.PropertyAssignment
      );

      for (const styleClause of styleClauses) {
        const cssSelector = styleClause.getChildAtIndex(0);
        const styleProperties = styleClause.getChildAtIndex(2);

        if (cssSelector.isKind(SyntaxKind.Identifier)) {
          addLine("." + cssSelector.getText());
        } else if (cssSelector.isKind(SyntaxKind.StringLiteral)) {
          addLine(cssSelector.getLiteralValue());
        }

        indent++;

        if (styleProperties.isKind(SyntaxKind.ObjectLiteralExpression)) {
          this.convertStyleBlock(styleProperties);
        }

        indent--;
        addEmptyLine();
      }
    },

    convertStyleBlock(jssObject: ObjectLiteralExpression) {
      const propertyAssignments = jssObject.getChildrenOfKind(
        SyntaxKind.PropertyAssignment
      );

      jssObject.forEachChild((node) => {
        if (node.isKind(SyntaxKind.PropertyAssignment)) {
          const propertyAssignment = node;
          const key = propertyAssignment.getChildAtIndex(0);

          // When CSS property
          if (key.isKind(SyntaxKind.Identifier)) {
            this.convertProperty(propertyAssignment);

            // When subselector
          } else if (key.isKind(SyntaxKind.StringLiteral)) {
            const value = propertyAssignment.getChildAtIndex(2);
            if (value.isKind(SyntaxKind.ObjectLiteralExpression)) {
              const selector = key.getLiteralValue();
              const classMatches = selector.matchAll(/\.(\w+)/g);
              for (const match of classMatches) {
                if (classMatches) {
                  classes.push(match[1]);
                }
              }

              addEmptyLine();
              addLine(selector);
              indent++;
              this.convertStyleBlock(value);
              indent--;
            }
          }
        } else {
          addComment("FIXME: Unhandled directive", node.getText());
        }
      });
    },

    convertProperty(styleProperty: PropertyAssignment) {
      const propName = styleProperty.getChildAtIndex(0);
      const propValue = styleProperty.getChildAtIndex(2);

      const key = toKebab(propName.getText());

      if (
        propValue.isKind(SyntaxKind.StringLiteral) ||
        propValue.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)
      ) {
        let value = propValue.getLiteralText();

        if (key.startsWith("animation")) {
          value = value.replace("$", "");
          //console.info("Unhandled $ prefix in animation name");
        }

        // Sass needs newlines escaped
        value = value
          .split("\n")
          .map((t) => t.trim())
          .join(" ");

        addLine(`${key}: ${value}`);
      } else if (
        propValue.isKind(SyntaxKind.PrefixUnaryExpression) ||
        propValue.isKind(SyntaxKind.NumericLiteral)
      ) {
        addLine(`${key}: ${propValue.getText()}`);
      } else if (propValue.isKind(SyntaxKind.ObjectLiteralExpression)) {
        addLine(key);
        indent++;
        this.convertStyleBlock(propValue);
        indent--;
      } else {
        addComment("FIXME: Unhandled directive", styleProperty.getText());
      }
    },

    getOutput() {
      return lines.join("");
    },

    getClasses() {
      return classes;
    },
  };
}
