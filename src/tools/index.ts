/**
 * Export some dependencies of scaffold from this directory to make it easier for the user to invoke
 *
 */
import fse from "fs-extra";
import { replaceInFile, replaceInFileSync } from "replace-in-file";

export { replaceInFile, replaceInFileSync, fse };
