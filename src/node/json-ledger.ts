import { AppendedFrame } from "../frame";

const required = <T>(name: string, fn: (value: any) => T) => {
  return (value: any): T => {
    const result = fn(value);
    if (!result) {
      throw new Error(`Expected to find value for '${name}'`);
    }
    return result;
  };
};

const parserForUint8Array = (name: string) => {
  const stringParser = parserForString(name);
  return (value: any): Uint8Array => {
    if (value === undefined) {
      return undefined;
    }
    const string = stringParser(value);
    return Buffer.from(string, "base64");
  };
};

const serialiserForUint8Array = (name: string) => {
  return (value: any): string => {
    if (value === undefined) {
      return undefined;
    }
    if (!(value instanceof Uint8Array)) {
      throw new RangeError(`Invalid Uint8Array for '${name}'`);
    }
    return Buffer.from(value).toString("base64");
  };
};

const parserForNumber = (name: string) => {
  return (value: any): number => {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== "number" || isNaN(value)) {
      throw new RangeError(`Invalid number for '${name}'`);
    }
    return value;
  };
};

const parserForString = (name: string) => {
  return (value: any): string => {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== "string") {
      throw new RangeError(`Invalid string for '${name}'`);
    }
    return value;
  };
};

const expectOneOf = <T>(name: string, ...values: T[]) => {
  return (value: any): T => {
    if (value === undefined) {
      return undefined;
    }
    if (values.indexOf(value) === -1) {
      throw new RangeError(`Invalid value '${value}' for '${name}', expected one of ${values.map(value => `'${value}'`).join(", ")}`);
    }
    return value;
  };
};

export function getRepresentationForFrame(value: AppendedFrame): any {
  const expectedKeys = [
    ["payload", serialiserForUint8Array("payload")],
    ["hash", required("hash", serialiserForUint8Array("hash"))],
    ["nonce", serialiserForUint8Array("nonce")],
    ["timestamp", parserForNumber("timestamp")],
    ["type", expectOneOf("type", "payload", "trust-exchange", "trust-acceptance", "public-key-acceptance", "hash")],
    ["targetIdentifier", parserForString("targetIdentifier")],
    ["sourceHash", serialiserForUint8Array("sourceHash")],
    ["sourceIdentifier", parserForString("sourceIdentifier")]
  ];
  const result: any = {};
  expectedKeys.forEach(
    ([key, fn]: [string, (value: any) => any]) => {
      const newValue = fn((value as any)[key]);
      if (newValue === undefined) {
        return;
      }
      result[key] = newValue;
    }
  );
  return result as AppendedFrame;
}

export function getFrameFromRepresentation(value: any): AppendedFrame {
  const expectedKeys = [
    ["payload", parserForUint8Array("payload")],
    ["hash", required("hash", parserForUint8Array("hash"))],
    ["nonce", parserForUint8Array("nonce")],
    ["timestamp", parserForNumber("timestamp")],
    ["type", expectOneOf("type", "payload", "trust-exchange", "trust-acceptance", "public-key-acceptance", "hash")],
    ["targetIdentifier", parserForString("targetIdentifier")],
    ["sourceHash", parserForUint8Array("sourceHash")],
    ["sourceIdentifier", parserForString("sourceIdentifier")]
  ];

  const result: any = {};

  expectedKeys.forEach(
    ([key, fn]: [string, (value: any) => any]) => {
      const newValue = fn(value[key]);
      if (newValue === undefined) {
        return;
      }
      result[key] = newValue;
    }
  );

  return result as AppendedFrame;
}
