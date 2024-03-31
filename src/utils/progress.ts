import { ProgressEvent, VersionBumpProgress } from "bumpp";
import consola from "consola";

/**
 * bumpp 显示进度的回调
 *
 * @see https://github.com/antfu/bumpp/blob/main/src/cli/index.ts
 */
export function progress({
  event,
  script,
  updatedFiles,
  skippedFiles,
  newVersion,
}: VersionBumpProgress): void {
  switch (event) {
    case ProgressEvent.FileUpdated:
      consola.success(`Updated ${updatedFiles.pop()} to ${newVersion}`);
      break;

    case ProgressEvent.FileSkipped:
      consola.info(`${skippedFiles.pop()} did not need to be updated`);
      break;

    case ProgressEvent.GitCommit:
      consola.success("Git commit");
      break;

    case ProgressEvent.GitTag:
      consola.success("Git tag");
      break;

    case ProgressEvent.GitPush:
      consola.success("Git push");
      break;

    case ProgressEvent.NpmScript:
      consola.success(`Npm run ${script}`);
      break;
  }
}
