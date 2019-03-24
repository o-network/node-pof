type FramePayload = {
  payload: Uint8Array
};

type FrameBase = {
  hash: Uint8Array,
  nonce?: Uint8Array,
  timestamp?: number;
};

type FrameWithPayload = (
  FrameBase &
  FramePayload &
  {
    type: "payload"
  }
);

type FrameTrustExchange = (
  FrameBase &
  {
    type: "trust-exchange",
    targetIdentifier: string
  }
);

type FrameTrustAcceptance = (
  FrameBase &
  {
    type: "trust-acceptance",
    sourceHash: Uint8Array,
    sourceIdentifier: string
  }
);

type FramePublicKey = (
  FrameBase &
  FramePayload &
  {
    type: "public-key-acceptance"
  }
);

type FrameHash = (
  FrameBase &
  {
    type: "hash"
  }
);

export type Frame = (
  FrameWithPayload |
  FrameTrustExchange |
  FrameTrustAcceptance |
  FramePublicKey |
  FrameHash
);

export type AppendedFrame = (
  Frame &
  {
    index: number,
    previousHash: Uint8Array
  }
);
