export type Serializable = string | Uint8Array;

function serializeString(string: string): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(string);
}

export function serialize(serializable: Serializable): Uint8Array {
  if (typeof serializable === "string") {
    return serializeString(serializable);
  }
  if ((serializable as any) instanceof Uint8Array) {
    return serializable;
  }
  throw new Error("Invalid value provided as serializable, must be a string or Uint8Array");
}
