import fs from 'node:fs/promises';
import path from 'node:path';
import { ProjectState, ProjectStateSchema } from './schema.js';
import { DEFAULT_EXPERT_RULES } from '../domain/presets.js';

export class ProjectStore {
  private filePath: string;

  constructor(workspaceDir = process.cwd()) {
    this.filePath = path.join(workspaceDir, '.reqexpert', 'project.json');
  }

  async load(): Promise<ProjectState> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return ProjectStateSchema.parse(JSON.parse(raw));
    } catch {
      const initial = ProjectStateSchema.parse({
        projectName: path.basename(path.dirname(path.dirname(this.filePath))),
        expertRules: DEFAULT_EXPERT_RULES,
      });
      await this.save(initial);
      return initial;
    }
  }

  async save(state: ProjectState): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    const tmpPath = `${this.filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(state, null, 2), 'utf-8');
    await fs.rename(tmpPath, this.filePath);
  }
}