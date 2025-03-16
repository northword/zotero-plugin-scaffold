import http from "node:http";
import { logger } from "../../utils/logger.js";
import { findFreeTcpPort } from "../../utils/zotero/remote-zotero.js";

interface TestResult {
  type: "start" | "suite" | "suite end" | "pending" | "pass" | "fail" | "end" | "debug";
  data?: { title: string; str: string; duration?: number; stack?: string };
}

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

  async onData(body: TestResult) {
    if (body.type === "debug" && body.data?.str) {
      for (const line of body.data?.str.split("\n")) {
        logger.log(line);
        logger.newLine();
      }
    }
    const str = body.data?.str.replaceAll("\n", "");
    if (body.type === "start") {
      logger.newLine();
    }
    else if (body.type === "suite" && !!str) {
      logger.tip(str);
    }
    if (body.type === "pass" && !!str) {
      logger.log(str);
    }
    else if (body.type === "fail") {
      logger.error(str);
      if (this.onFailed)
        this.onFailed();
    }
    else if (body.type === "suite end") {
      logger.newLine();
    }
    else if (body.type === "end") {
      logger.success("Test run completed");
      if (this.onEnd)
        this.onEnd();
    }
  }

  stop() {
    this._server?.close();
  }
}
