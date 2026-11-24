import { NotFoundError, ValidationError } from '../core/errors.js';
import { normalizePath } from '../core/paths.js';
import type { Requirement, ProjectSnapshot } from '../core/schema.js';
import type { Store } from '../persistence/store.js';

export class TraceabilityService {
  constructor(private readonly store: Store) {}

  async linkCodeRef(
    requirementId: string,
    rawPath: string,
    options: { validate?: boolean } = {},
  ) {
    const snap = await this.store.load();
    const req = snap.requirements.find((r) => r.id === requirementId);
    if (!req) throw new NotFoundError('Требование', requirementId);

    const normalized = normalizePath(rawPath);
    if (!normalized) throw new ValidationError('Путь codeRef не может быть пустым');

    if (req.codeRefs.includes(normalized)) {
      return { requirement: req, added: false, reason: 'already-linked' as const };
    }

    if (options.validate !== false && !(await this.store.fileExists(normalized))) {
      throw new ValidationError(
        `Файл ${normalized} не найден в workspace. Передайте validate=false, если файл будет создан позже.`,
      );
    }

    const updated = await this.patch(snap, requirementId, {
      codeRefs: [...req.codeRefs, normalized],
    });
    await this.store.appendActivity({
      type: 'requirement.codeLinked',
      message: `Требование ${requirementId}: +codeRef ${normalized}`,
      timestamp: Date.now(),
      requirementId,
    });
    return { requirement: updated, added: true };
  }

  async unlinkCodeRef(requirementId: string, rawPath: string) {
    const snap = await this.store.load();
    const req = snap.requirements.find((r) => r.id === requirementId);
    if (!req) throw new NotFoundError('Требование', requirementId);

    const normalized = normalizePath(rawPath);
    const nextRefs = req.codeRefs.filter((p) => p !== normalized);
    if (nextRefs.length === req.codeRefs.length) {
      return { requirementId, removed: false, remaining: req.codeRefs };
    }

    await this.patch(snap, requirementId, { codeRefs: nextRefs });
    await this.store.appendActivity({
      type: 'requirement.codeUnlinked',
      message: `Требование ${requirementId}: −codeRef ${normalized}`,
      timestamp: Date.now(),
      requirementId,
    });
    return { requirementId, removed: true, remaining: nextRefs };
  }

  async linkTestRef(requirementId: string, rawTestId: string) {
    const snap = await this.store.load();
    const req = snap.requirements.find((r) => r.id === requirementId);
    if (!req) throw new NotFoundError('Требование', requirementId);

    const testId = rawTestId.trim();
    if (!testId) throw new ValidationError('testId не может быть пустым');
    if (req.verifiedBy.includes(testId)) {
      return { requirement: req, added: false, reason: 'already-linked' as const };
    }

    const updated = await this.patch(snap, requirementId, {
      verifiedBy: [...req.verifiedBy, testId],
    });
    await this.store.appendActivity({
      type: 'requirement.testLinked',
      message: `Требование ${requirementId}: +test ${testId}`,
      timestamp: Date.now(),
      requirementId,
    });
    return { requirement: updated, added: true };
  }

  async unlinkTestRef(requirementId: string, rawTestId: string) {
    const snap = await this.store.load();
    const req = snap.requirements.find((r) => r.id === requirementId);
    if (!req) throw new NotFoundError('Требование', requirementId);

    const testId = rawTestId.trim();
    const nextTests = req.verifiedBy.filter((t) => t !== testId);
    if (nextTests.length === req.verifiedBy.length) {
      return { requirementId, removed: false, remaining: req.verifiedBy };
    }

    await this.patch(snap, requirementId, { verifiedBy: nextTests });
    await this.store.appendActivity({
      type: 'requirement.testUnlinked',
      message: `Требование ${requirementId}: −test ${testId}`,
      timestamp: Date.now(),
      requirementId,
    });
    return { requirementId, removed: true, remaining: nextTests };
  }

  private async patch(
    snap: ProjectSnapshot,
    id: string,
    patch: Partial<Requirement>,
  ): Promise<Requirement> {
    const idx = snap.requirements.findIndex((r) => r.id === id);
    const current = snap.requirements[idx];
    if (!current) throw new NotFoundError('Требование', id);

    const merged: Requirement = { ...current, ...patch, id };
    const next = snap.requirements.slice();
    next[idx] = merged;
    await this.store.saveRequirements(next);
    return merged;
  }
}
