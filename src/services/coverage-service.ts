import type { Requirement } from '../core/schema.js';
import type { Store } from '../persistence/store.js';
import { normalizePath } from '../core/paths.js';

export interface CoverageReportOptions {
  priority?: Requirement['priority'] | 'all';
}

export interface FindOrphanCodeOptions {
  dir?: string;
  extensions?: string[];
  limit?: number;
}

const DEFAULT_CODE_EXTENSIONS = [
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.java', '.go', '.cs', '.rb', '.php', '.kt', '.rs',
];

export class CoverageService {
  constructor(private readonly store: Store) {}

  async coverageReport(options: CoverageReportOptions = {}) {
    const snap = await this.store.load();
    const scope = options.priority ?? 'Must';
    const scoped =
      scope === 'all'
        ? snap.requirements
        : snap.requirements.filter((r) => r.priority === scope);

    const withCode = scoped.filter((r) => r.codeRefs.length > 0);
    const withTests = scoped.filter((r) => r.verifiedBy.length > 0);
    const fullyCovered = scoped.filter(
      (r) => r.codeRefs.length > 0 && r.verifiedBy.length > 0,
    );

    const uncovered = scoped
      .filter((r) => r.codeRefs.length === 0 || r.verifiedBy.length === 0)
      .map((r) => ({
        id: r.id,
        title: r.title,
        priority: r.priority,
        missing:
          r.codeRefs.length === 0 && r.verifiedBy.length === 0
            ? ('both' as const)
            : r.codeRefs.length === 0
              ? ('code' as const)
              : ('tests' as const),
      }));

    const pct = (n: number) =>
      scoped.length === 0 ? 100 : Math.round((n / scoped.length) * 100);

    return {
      scope,
      total: scoped.length,
      withCode: withCode.length,
      withTests: withTests.length,
      fullyCovered: fullyCovered.length,
      codeCoveragePercent: pct(withCode.length),
      testCoveragePercent: pct(withTests.length),
      fullCoveragePercent: pct(fullyCovered.length),
      uncovered,
    };
  }

  async findOrphanCode(options: FindOrphanCodeOptions = {}) {
    const snap = await this.store.load();
    const dir = options.dir ?? 'src';
    const extensions = options.extensions ?? DEFAULT_CODE_EXTENSIONS;
    const limit = options.limit ?? 500;

    const referenced = new Set<string>();
    for (const r of snap.requirements) {
      for (const ref of r.codeRefs) referenced.add(normalizePath(ref));
    }

    const files = await this.store.walkFiles(dir, extensions, limit);
    const orphans = files.filter((f) => !referenced.has(f));

    return {
      scannedDir: dir,
      scannedFiles: files.length,
      referencedTotal: referenced.size,
      orphanCount: orphans.length,
      truncated: files.length >= limit,
      orphans,
    };
  }
}
