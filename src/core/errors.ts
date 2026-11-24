export type AppErrorCode =
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'WORKSPACE'
  | 'RULE_EXECUTION'
  | 'INTERNAL';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string | number) {
    super('NOT_FOUND', `${entity} ${id} не найден(а)`);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super('CONFLICT', message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super('VALIDATION', message);
  }
}

export class WorkspaceError extends AppError {
  constructor(message: string) {
    super('WORKSPACE', message);
  }
}
