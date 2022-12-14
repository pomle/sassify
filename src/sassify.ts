import { CallExpression, ObjectLiteralExpression, SyntaxKind } from "ts-morph";
import { SassWriter } from "./SassWriter";

function createSass(jssObject: ObjectLiteralExpression) {
  const writer = SassWriter();
  writer.convertMakeStyles(jssObject);
  return {
    stylesheet: writer.getOutput(),
    classNames: writer.getClasses(),
  };
}

export function processMakeStyles(makeStylesCall: CallExpression) {
  const callArguments = makeStylesCall.getArguments();
  for (const callArg of callArguments) {
    const jssObject = callArg.asKind(SyntaxKind.ObjectLiteralExpression);
    if (jssObject) {
      return createSass(jssObject);
    }
  }
}
