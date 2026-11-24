export interface Config {
  workspace: string;
  activityLimit: number;
  customRulesPath?: string;
}

export function loadConfig(): Config {
  return {
    workspace: process.env.REQEXPERT_WORKSPACE || process.cwd(),
    activityLimit: Number(process.env.REQEXPERT_ACTIVITY_LIMIT ?? 50),
    customRulesPath: process.env.REQEXPERT_CUSTOM_RULES || undefined,
  };
}