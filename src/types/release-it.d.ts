declare module "release-it" {
  export default function runTasks(
    opts: ReleaseItConfig,
    di?: any,
  ): Promise<ReleaseItRunTaskResult>;
  export const Config: any;
  export const Plugin: any;
}

interface ReleaseItRunTaskResult {
  name: string;
  changelog: any;
  lastestVersion: any;
  version: any;
}

/**
 * Release it
 * @see https://github.com/release-it/release-it/blob/main/README.md
 */
interface ReleaseItConfigBase {
  hooks?: Record<string, string | string[]>;
  git?: {
    changelog?: string;
    requireCleanWorkingDir?: boolean;
    requireBranch?: boolean;
    requireUpstream?: boolean;
    requireCommits?: boolean;
    requireCommitsFail?: boolean;
    commitsPath?: string;
    addUntrackedFiles?: boolean;
    commit?: boolean;
    commitMessage?: string;
    commitArgs?: [];
    tag?: boolean;
    tagExclude?: null;
    tagName?: string;
    tagMatch?: string;
    getLatestTagFromAllRefs?: boolean;
    tagAnnotation?: string;
    tagArgs?: string[];
    push?: boolean;
    pushArgs?: string[];
    pushRepo?: string;
  };
  npm?: {
    publish?: boolean;
    publishPath?: string;
    publishArgs?: string[];
    tag?: null;
    otp?: null;
    ignoreVersion?: boolean;
    allowSameVersion?: boolean;
    versionArgs?: string[];
    skipChecks?: boolean;
    timeout?: number;
  };
  github?: {
    release?: boolean;
    releaseName?: string;
    releaseNotes?: null;
    autoGenerate?: boolean;
    preRelease?: boolean;
    draft?: boolean;
    tokenRef?: string;
    assets?: string[];
    host?: string;
    timeout?: number;
    proxy?: null;
    skipChecks?: false;
    web?: boolean;
    comments?: {
      submit?: boolean;
      issue?: string;
      pr?: string;
    };
  };
  gitlab?: {
    release?: boolean;
    releaseName?: string;
    releaseNotes?: null;
    milestones?: [];
    tokenRef?: string;
    tokenHeader?: string;
    certificateAuthorityFile?: null;
    assets?: string[];
    origin?: null;
    skipChecks?: boolean;
  };
}

interface ReleaseItConfigConstructor {
  "dry-run"?: boolean;
  "only-version"?: boolean;
  increment?: boolean;
  preReleaseId?: "alpha" | "beta" | "next" | "rc" | string;
  ci?: boolean;
  changelog?: boolean;
  verbose?: boolean | number;
}

interface ReleaseItConfig
  extends ReleaseItConfigConstructor,
    ReleaseItConfigBase {}
