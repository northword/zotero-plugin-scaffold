import http from "node:http";
import styleText from "node-style-text";
import { logger } from "../../utils/logger.js";
import { findFreeTcpPort } from "../../utils/zotero/remote-zotero.js";

interface ResultDataBase {
  title: string;
  indents: number;
}

interface ResultS {
  type: "start" | "pending" | "end" | "debug";
  data?: ResultDataBase | any;
}

interface ResultSuite {
  type: "suite" | "suite end";
  data: ResultDataBase & {
    root: boolean;
  };
}

interface ResultTestPass {
  type: "pass";
  data: ResultDataBase & {
    fullTitle: string;
    duration: number;
  };
}

interface ResultTestFail {
  type: "fail";
  data: ResultTestPass["data"] & {
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
    const logger_option = { space: data.indents - 1 };

    switch (type) {
      case "debug":
        logger.log(data);
        break;
      case "start":
        logger.newLine();
        break;
      case "suite":
        if (data.title)
          logger.tip(data.title, logger_option);
        break;
      case "pass":
        logger.success(`${data.title} ${styleText.gray(`${data.duration}ms`)}`, logger_option);
        break;
      case "fail":
        logger.fail(styleText.red(`${data.title}, ${body.data?.error?.message}`), logger_option);
        // if (this.onFailed)
        //   this.onFailed();
        break;
      case "pending":
        logger.info(`${data.title} pending`, logger_option);
        break;
      case "suite end":
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
