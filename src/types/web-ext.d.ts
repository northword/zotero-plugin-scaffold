declare module "web-ext" {
  export default webext = {
    cmd,
    main,
  };
  export const cmd: {
    build(
      params: {
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
      },
      options?: any,
    ): Promise<any>;

    lint(params: LintParams, options?: any): Promise<any>;
    run(params: any, options?: any): Promise<any>;
    sign(params: any, options?: any): Promise<any>;
    docs(params: any, options?: any): Promise<any>;
  };
  export const main: any;
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
