import { Party } from "./party";
import { Serializable, serialize } from "./serializable";
import { Frame, AppendedFrame } from "./frame";
import { concatUint8Array } from "./util";
import { URLLike } from "./url-like";

export type LedgerReadMode = "read";
export type LedgerWriteMode = "read-write";

export type LedgerMode = LedgerReadMode | LedgerWriteMode;

export type GetLedgerFrames = (party: Party, identifier: URLLike) => AppendedFrame[];
export type AppendToLedger = (ledger: Ledger, frame: AppendedFrame) => Promise<AppendedFrame>;
export type GetValueForLedger = (ledger: Ledger) => Promise<Uint8Array>;
export type GetValueForLedgerWithSource = (ledger: Ledger, value: Serializable) => Promise<Uint8Array>;

export type LedgerReadOptions = {
  mode: LedgerReadMode,
  getLedgerFrames: GetLedgerFrames;
};

export type LedgerWriteOptions = {
  mode: LedgerWriteMode,
  getLedgerFrames: GetLedgerFrames;
  appendToLedger: AppendToLedger,
  getPrivateKey: GetValueForLedger;
  getPublicKey: GetValueForLedger;
  getRandomBytes: GetValueForLedger;
  hash: GetValueForLedgerWithSource;
  sign: GetValueForLedgerWithSource;
};

export type LedgerTypeOptions = LedgerWriteOptions | LedgerReadOptions;

export type LedgerOptions = {
  party: Party,
  identifier: URLLike
} & LedgerTypeOptions;

export class Ledger {

  private options: LedgerOptions;

  constructor(options: LedgerOptions) {
    this.options = options;
  }

  get party(): Party {
    return this.options.party;
  }

  get identifier(): URLLike {
    return this.options.identifier;
  }

  get mode(): LedgerMode {
    return this.options.mode;
  }

  async getFrames(identifier: URLLike = this.options.identifier): Promise<AppendedFrame[]> {
    return this.options.getLedgerFrames(
      this.options.party,
      identifier
    );
  }

  async findFrame(filter: (frame: AppendedFrame, index: number, array: AppendedFrame[]) => boolean, identifier: URLLike = this.options.identifier): Promise<AppendedFrame> {
    const frames = await this.getFrames(identifier);
    return frames.find(filter);
  }

  async getFrame(index: number, identifier: URLLike = this.options.identifier): Promise<AppendedFrame> {
    return this.findFrame(
      (frame: AppendedFrame, frameIndex) => frameIndex === index,
      identifier
    );
  }

  async getHead(identifier: URLLike = this.options.identifier): Promise<AppendedFrame> {
    const frames = await this.getFrames(identifier);
    return frames[frames.length - 1];
  }

  private guard(mode: LedgerMode) {
    if (this.options.mode !== mode) {
      throw new TypeError(`Invalid mode, expected '${mode}', received '${this.options.mode}'`);
    }
  }

  async getPrivateKey(): Promise<Uint8Array> {
    this.guard("read-write");
    return (this.options as LedgerWriteOptions).getPrivateKey(this);
  }

  async getPublicKey(): Promise<Uint8Array> {
    this.guard("read-write");
    return (this.options as LedgerWriteOptions).getPublicKey(this);
  }

  async nonce() {
    this.guard("read-write");
    const randomBytes = await (this.options as LedgerWriteOptions).getRandomBytes(this);
    return this.hash(randomBytes);
  }

  async hash(...args: Serializable[]) {
    this.guard("read-write");
    const serialisedArguments = args.map(arg => serialize(arg));
    const array = concatUint8Array(...serialisedArguments);
    return (this.options as LedgerWriteOptions).hash(this, array);
  }

  async sign(...args: Serializable[]) {
    this.guard("read-write");
    const serialisedArguments = args.map(arg => serialize(arg));
    const array = concatUint8Array(...serialisedArguments);
    return (this.options as LedgerWriteOptions).sign(this, array);
  }

  async append(frame: Frame): Promise<AppendedFrame> {
    this.guard("read-write");
    const head = await this.getHead();
    const newFrame = {
      ...frame,
      index: head.index + 1,
      previousHash: head.hash
    };
    return (this.options as LedgerWriteOptions).appendToLedger(this, newFrame);
  }

}
