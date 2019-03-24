import FSBase from "fs";
import Crypto from "crypto";
import { AppendedFrame } from "../frame";
import { Party } from "../party";
import { URLLike } from "../url-like";
import { Ledger, LedgerMode, LedgerTypeOptions } from "../ledger";
import { join } from "path";
import { getFrameFromRepresentation, getRepresentationForFrame } from "./json-ledger";
import { mkdirp } from "fs-extra";
export * from "../index";

export type FSLike = typeof FSBase;

function simpleHash(options: FSOptions, value: Uint8Array): Uint8Array {
  const hash = Crypto.createHash(options.hashAlgorithm || "SHA256");
  hash.update(value);
  return hash.digest();
}

export function getPath(options: FSOptions, identifier: URLLike): string {
  if (options.getPath) {
    return options.getPath(options, identifier);
  }
  const identifierBuffer = Buffer.from(identifier.toString(), "utf-8");
  const identifierHash = simpleHash(options, identifierBuffer).toString();
  // We must ignore the origin and scheme, we only care about the path here
  return join(options.rootPath, identifierHash);
}

export async function getLedgerFrames(options: FSOptions, party: Party, identifier: URLLike): Promise<AppendedFrame[]> {
  const path = join(getPath(options, identifier), "/ledger");
  const content = await new Promise<string>(
    (resolve, reject) => options.fs.readFile(
      path,
      {
        encoding: "utf-8"
      },
      (error, data) => error ? reject(error) : resolve(data)
    )
  )
    .catch((): undefined => undefined);
  if (!content) {
    return [];
  }
  const parsed = content.split('\n');
  const fn = options.getFrameFromRepresentation ? options.getFrameFromRepresentation.bind(undefined, options, party) : getFrameFromRepresentation;
  return parsed.map(value => fn(JSON.parse(value)));
}

async function ensurePathIsDirectory(options: FSOptions, path: string) {
  const stat = await new Promise<FSBase.Stats>(
    (resolve, reject) => options.fs.stat(
      path,
      (error, stat) => error ? reject(undefined) : resolve(stat)
    )
  );
  if (stat && stat.isDirectory()) {
    return;
  }
  await new Promise(
    (resolve, reject) => (mkdirp as any)(
      path,
      {
        fs: options.fs
      },
      (error: Error) => error ? reject(error) : resolve()
    )
  );
}

export async function appendToLedger(options: FSOptions, ledger: Ledger, frame: AppendedFrame): Promise<AppendedFrame> {
  const representation = options.getRepresentationForFrame ? options.getRepresentationForFrame(options, ledger, frame) : getRepresentationForFrame(frame);
  const json = JSON.stringify(representation);
  const basePath = getPath(options, ledger.identifier);
  await ensurePathIsDirectory(options, basePath);
  const path = join(basePath, "/ledger");
  await new Promise(
    (resolve, reject) => options.fs.appendFile(
      path,
      `${json}\n`,
      {
        encoding: "utf-8",
        flag: "a+"
      },
      (error) => error ? reject(error) : resolve()
    )
  );
  return frame;
}

export async function ensurePrivateKeyExists(options: FSOptions, ledger: Ledger) {
  const ledgerPath = getPath(options, ledger.identifier);
  const basePath = join(ledgerPath, "/private-keys");
  await ensurePathIsDirectory(options, basePath);
  const path = join(basePath, "/default");

  const stat = await new Promise<FSBase.Stats>(
    (resolve, reject) => options.fs.stat(
      path,
      (error, stat) => error ? reject(undefined) : resolve(stat)
    )
  );
  if (stat && stat.isFile()) {
    return path;
  }
  const diffieHellman = Crypto.createDiffieHellman(Math.abs(options.primeLengthForKeyPair || 2048));

  diffieHellman.generateKeys();

  const privateKey = diffieHellman.getPrivateKey();
  const publicKey = diffieHellman.getPublicKey();

  const privateKeyPromise = new Promise(
    (resolve, reject) => options.fs.writeFile(
      path,
      privateKey,
      (error) => error ? reject(error) : resolve()
    )
  );
  const publicKeyPromise = new Promise(
    (resolve, reject) => options.fs.writeFile(
      join(ledgerPath, "/public-keys/default"),
      publicKey,
      (error) => error ? reject(error) : resolve()
    )
  );

  await Promise.all([
    privateKeyPromise,
    publicKeyPromise
  ]);

  return path;
}

export async function getPrivateKey(options: FSOptions, ledger: Ledger): Promise<Uint8Array> {
  const path = await ensurePrivateKeyExists(options, ledger);
  return new Promise<Uint8Array>(
    (resolve, reject) => options.fs.readFile(
      path,
      (error, data) => error ? reject(error) : resolve(data)
    )
  );
}

export async function getPublicKey(options: FSOptions, ledger: Ledger): Promise<Uint8Array> {
  const path = join(getPath(options, ledger.identifier), "/public-keys/default");
  return new Promise<Uint8Array>(
    (resolve, reject) => options.fs.readFile(
      path,
      (error, data) => error ? reject(error) : resolve(data)
    )
  );
}

export async function getRandomBytes(options: FSOptions): Promise<Uint8Array> {
  return new Promise<Uint8Array>(
    (resolve, reject) => Crypto.randomBytes(
      Math.abs(options.randomBytesSize || 256),
      (error, bytes) => error ? reject(error) : resolve(bytes)
    )
  );
}

export async function hash(options: FSOptions, ledger: Ledger, value: Uint8Array): Promise<Uint8Array> {
  return simpleHash(options, value);
}

export async function sign(options: FSOptions, ledger: Ledger, value: Uint8Array): Promise<Uint8Array> {
  const privateKeyPromise = await getPrivateKey(options, ledger);
  const sign = Crypto.createSign(options.signAlgorithm || "SHA256");
  sign.update(Buffer.from(value));
  sign.end();
  const privateKey = Crypto.createPrivateKey(privateKeyPromise as Buffer);
  return sign.sign(privateKey);
}

export type FSOptions = {
  fs: FSLike,
  rootPath: string,
  randomBytesSize?: number;
  hashAlgorithm?: string;
  signAlgorithm?: string;
  primeLengthForKeyPair?: number;
  getPath?: (options: FSOptions, identifier: URLLike) => string,
  getRepresentationForFrame?: (options: FSOptions, ledger: Ledger, value: AppendedFrame) => any,
  getFrameFromRepresentation?: (options: FSOptions, party: Party, value: any) => AppendedFrame
};

export function createOptions(options: FSOptions, mode: LedgerMode): LedgerTypeOptions {
  if (mode !== "read-write" && mode !== "read") {
    throw new RangeError(`Unknown mode '${mode}', expected 'read-write' or 'read'`);
  }
  const getLedgerFramesFn = getLedgerFrames.bind(undefined, options);
  if (mode === "read") {
    return {
      mode,
      getLedgerFrames: getLedgerFramesFn,
      getPublicKey: getPublicKey.bind(undefined, options)
    };
  }
  return {
    mode,
    getLedgerFrames: getLedgerFramesFn,
    appendToLedger: appendToLedger.bind(undefined, options),
    getPrivateKey: getPrivateKey.bind(undefined, options),
    getPublicKey: getPublicKey.bind(undefined, options),
    getRandomBytes: getRandomBytes.bind(undefined, options),
    hash: hash.bind(undefined, options),
    sign: sign.bind(undefined, options)
  };
}
