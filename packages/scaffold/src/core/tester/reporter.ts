import http from "node:http";
import styleText from "node-style-text";
import { logger } from "../../utils/logger.js";
import { findFreeTcpPort } from "../../utils/zotero/remote-zotero.js";

interface ResultS {
  type: "start" | "pending" | "end" | "debug";
  data?: any;
}

interface ResultSuite {
  type: "suite" | "suite end";
  data: {
    title: string;
    root: boolean;
  };
}

interface ResultTestData {
  title: string;
  fullTitle: string;
  duration: number;
}

interface ResultTestPass {
  type: "pass";
  data: ResultTestData;
}

interface ResultTestFail {
  type: "fail";
  data: ResultTestData & {
    error: {
      message: string;
      actual: unknown;
      exprct: unknown;
      operator: string;
      stack: string;
    };
  };
}

type Result = ResultS | ResultSuite | ResultTestPass | ResultTestFail;

export class HttpReporter {
  private _server?: http.Server;
  private _port?: number;
  private indent: number = 0;

  constructor(
    private onFailed?: () => void,
    private onEnd?: () => void,
  ) {}

  async getPort() {
    this._port = await findFreeTcpPort();
  }

  get port() {
    return this._port!;
  }

  async start() {
    if (!this._port)
      await this.getPort();

    this._server = http.createServer(this.handleRequest.bind(this));
    this._server.listen(this._port, () => {
      logger.debug(`Server is listening on http://localhost:${this.port}`);
    });
    return this;
  }

  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("Zotero Plugin Test Server is running");
    }
    else
      if (req.method === "POST" && req.url === "/update") {
        let body = "";

        // Collect data chunks
        req.on("data", (chunk) => {
          body += chunk;
        });

        // Parse and handle the complete data
        req.on("end", async () => {
          try {
            const jsonData = JSON.parse(body);
            await this.onData(jsonData);

            // Send a response to the client
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ message: "Results received successfully" }));
          }
          catch (error) {
            logger.error(`Error parsing JSON:, ${error}`);
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid JSON" }));
          }
        });
      }
      else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found" }));
      }
  }

  async onData(body: Result) {
    const { type, data } = body;

    switch (type) {
      case "debug":
        logger.log(data);
        break;
      case "start":
        logger.newLine();
        break;
      case "suite":
        if (data.title)
          logger.tip(data.title, { space: this.indent });
        this.indent++;
        break;
      case "pass":
        logger.success(`${data.title} ${styleText.gray(`${data.duration}ms`)}`, { space: this.indent });
        break;
      case "fail":
        logger.fail(styleText.red(`${data.title}, ${body.data?.error?.message}`), { space: this.indent });
        // if (this.onFailed)
        //   this.onFailed();
        break;
      case "pending":
        logger.info(`${data.title} pending`, { space: this.indent });
        break;
      case "suite end":
        this.indent--;
        break;
      case "end":
        logger.newLine();
        logger.success("Test run completed");
        //   if (this.onEnd)
        //     this.onEnd();
        break;
      default:
        logger.log(data);
        break;
    }
  }

  stop() {
    this._server?.close();
  }
}
