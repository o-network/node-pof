export function concatUint8Array(...args: Uint8Array[]): Uint8Array {
  const length = args.reduce((sum, child) => sum + child.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const child of args) {
    result.set(child, offset);
    offset += child.length;
  }
  return result;
}
