import { URLLike } from "./url-like";
import { Ledger, LedgerWriteOptions, LedgerReadOptions, LedgerOptions, LedgerTypeOptions } from "./ledger";
import { AppendedFrame } from "./frame";

export type PartyBaseOptions = {
  mode?: string;
  identifier: URLLike;
  trustedParties: URLLike[],
  exchange: (party: Party, frame: AppendedFrame) => Promise<AppendedFrame>;
};

export type PartyPrivateOptions = PartyBaseOptions & {
  mode: "private",
  privateKey: string,
  ledger: LedgerWriteOptions
};

export type PartyPublicOptions = PartyBaseOptions & {
  mode: "public",
  ledger: LedgerReadOptions
};

export type PartyOptions = (
  PartyBaseOptions |
  PartyPrivateOptions |
  PartyPublicOptions
);

export class Party {

  private options: PartyOptions;

  private ledgers: Map<URLLike, Ledger> = new Map();

  constructor(options: PartyOptions) {
    this.options = options;
  }

  private getLedgerTypeOptions(): LedgerTypeOptions {
    if (typeof this.options.mode !== "string") {
      throw new RangeError("Expected mode provided when creating party if ledger is in use");
    }
    if (this.options.mode === "private") {
      return (this.options as PartyPrivateOptions).ledger;
    }
    if (this.options.mode === "public") {
      return (this.options as PartyPublicOptions).ledger;
    }
    throw new RangeError(`Unknown mode '${this.options.mode}', expected 'private' or 'public'`);
  }

  getLedger(identifier: URLLike = "file://ledgers/default"): Ledger {
    if (this.ledgers.has(identifier)) {
      return this.ledgers.get(identifier);
    }
    const options: LedgerOptions = {
      party: this,
      identifier,
      ...this.getLedgerTypeOptions()
    };
    const ledger = new Ledger(options);
    this.ledgers.set(identifier, ledger);
    return ledger;
  }

  async exchange(frame: AppendedFrame): Promise<AppendedFrame> {
    return this.options.exchange(this, frame);
  }

}
