declare module "ebml" {
  export class Decoder {
    on(event: string, listener: (...args: any[]) => void): this;
    write(value: Uint8Array): boolean;
    end(): void;
  }
}

declare module "ebml/lib/ebml.esm.js" {
  export class Decoder {
    on(event: string, listener: (...args: any[]) => void): this;
    write(value: Uint8Array): boolean;
    end(): void;
  }
}
