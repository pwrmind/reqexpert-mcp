import { NotFoundError } from '../core/errors.js';
import type { Store } from '../persistence/store.js';

export class ImpactService {
  constructor(private readonly store: Store) {}

  async analyzeImpact(id: string) {
    const snap = await this.store.load();
    const target = snap.requirements.find((r) => r.id === id);
    if (!target) throw new NotFoundError('Требование', id);

    const directDependents = snap.requirements.filter((r) => r.dependencies.includes(id));
    const sameSource = target.source
      ? snap.requirements.filter((r) => r.id !== id && r.source === target.source)
      : [];
    const codeOverlaps = snap.requirements.filter(
      (r) => r.id !== id && r.codeRefs.some((ref) => target.codeRefs.includes(ref)),
    );

    const risk =
      target.priority === 'Must' || directDependents.length >= 3 || codeOverlaps.length >= 2
        ? 'Высокий'
        : directDependents.length > 0 || codeOverlaps.length > 0
          ? 'Средний'
          : 'Низкий';

    return {
      requirementId: id,
      priority: target.priority,
      directDependents: directDependents.map((r) => ({ id: r.id, title: r.title })),
      relatedBySource: sameSource.map((r) => ({ id: r.id, title: r.title })),
      codeRefs: target.codeRefs,
      testsCovering: target.verifiedBy,
      requirementsSharingCode: codeOverlaps.map((r) => ({ id: r.id, title: r.title })),
      risk,
    };
  }
}
