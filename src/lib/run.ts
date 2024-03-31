import { Context } from "../types";
import Server from "./serve";

const ctx = process.argv[0] as unknown as Context;

new Server(ctx).startZoteroWebExt();
