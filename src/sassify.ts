import { ObjectLiteralExpression, SyntaxKind } from "ts-morph";
import { SassWriter } from "./SassWriter";

export function createSass(jssObject: ObjectLiteralExpression) {
  const writer = SassWriter();
  writer.convertMakeStyles(jssObject);
  return writer.getOutput();
}
