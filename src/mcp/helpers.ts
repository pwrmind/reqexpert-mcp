import { AppError } from '../core/errors.js';

export const toJson = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
});

export const toError = (err: unknown) => {
  const payload =
    err instanceof AppError
      ? { code: err.code, message: err.message }
      : { code: 'INTERNAL', message: err instanceof Error ? err.message : String(err) };
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  };
};

export async function runTool<T>(fn: () => Promise<T>) {
  try {
    return toJson(await fn());
  } catch (err) {
    return toError(err);
  }
}
