import chokidar from "chokidar";
import { debounce } from "es-toolkit";
import { logger } from "./logger.js";

export function watch(
  source: string | string[],
  event: {
    onReady?: () => any;
    onChange: (path: string) => any | Promise<any>;
    onError?: (err: unknown) => any;
  },
) {
  const watcher = chokidar.watch(source, {
    ignored: /(^|[/\\])\../, // ignore dotfiles
    persistent: true,
  });

  const onChangeDebounced = debounce(event.onChange, 500);

  watcher
    .on("ready", async () => {
      logger.clear();
      logger.ready("Server Ready!");
      if (event.onReady)
        await debounce(event.onReady, 500)();
    })
    .on("change", async (path) => {
      logger.clear();
      logger.info(`${path} changed`);
      try {
        await onChangeDebounced(path);
      }
      catch (err) {
        // Do not abort the watcher when errors occur
        // in builds triggered by the watcher.
        logger.error(err);
      }
    })
    .on("error", async (err) => {
      if (event.onError)
        await event.onError(err);
      logger.fail("Server start failed!");
      logger.error(err);
    });

  // return watcher;
}
