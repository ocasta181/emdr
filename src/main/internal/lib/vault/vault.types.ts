export type WrappedKey = {
  salt?: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

export type VaultFile = {
  format: "emdr-local-vault";
  version: 1;
  cipher: "aes-256-gcm";
  kdf: {
    name: "scrypt";
    params: { N: number; r: number; p: number; maxmem: number };
  };
  password: WrappedKey;
  recovery: WrappedKey;
  data: {
    type: "sqlite";
    iv: string;
    tag: string;
    ciphertext: string;
  };
};
