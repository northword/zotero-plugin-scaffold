/* eslint-disable ts/method-signature-style */
declare module "web-ext" {

  export interface WebExtRunInstance {
    reloadAllExtensions(): Promise<void>;
    registerCleanup(fn): void;
    exit(): Promise<void>;
  }

  export const cmd: {
    build: (params: BuildParams, options?: any) => Promise<any>;
    lint: (params: LintParams, options?: any) => Promise<any>;
    run(config: any, executeOptions: any): Promise<WebExtRunInstance>;
    sign: (params: any, options?: any) => Promise<any>;
    docs: (params: any, options?: any) => Promise<any>;
  };
  export const main: any;

  export default webext = {
    cmd,
    main,
  };
}

interface BuildParams {
  sourceDir: string;
  artifactsDir: string;
  /**
   * @default false
   */
  asNeeded?: boolean;
  /**
   * @default false
   */
  overwriteDest?: boolean;
  /**
   * @default []
   */
  ignoreFiles?: string[];
  /**
   * @default '{name}-{version}.zip'
   */
  filename?: string;
}

interface LintParams {
  artifactsDir: string;
  boring: string;
  firefoxPreview?: any[];
  ignoreFiles: any;
  metadata: any;
  output: any;
  pretty: any;
  privileged: any;
  sourceDir: any;
  selfHosted: any;
  verbose: any;
  warningsAsErrors: any;
}

declare module "web-ext/util/logger" {
  // https://github.com/mozilla/web-ext/blob/e37e60a2738478f512f1255c537133321f301771/src/util/logger.js#L43
  export interface IConsoleStream {
    stopCapturing(): void;
    startCapturing(): void;
    write(packet: Packet, options: unknown): void;
    flushCapturedLogs(options: unknown): void;
  }
  export interface Packet {
    name: string;
    msg: string;
    level: number;
  }
  export class ConsoleStream implements IConsoleStream {
    constructor(options?: { verbose: false });
  }
  export const consoleStream: IConsoleStream;
}
