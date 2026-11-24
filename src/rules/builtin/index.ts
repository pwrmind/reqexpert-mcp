import type { Rule } from '../types.js';
import { d25Atomicity } from './d25-atomicity.js';
import { d26Ambiguity } from './d26-ambiguity.js';
import { d27DuplicatesLevenshtein } from './d27-duplicates-levenshtein.js';
import { d28DuplicatesDice } from './d28-duplicates-dice.js';
import { h78AcceptanceCriteria } from './h78-acceptance-criteria.js';
import { t01Traceability } from './t01-traceability.js';

export const BUILTIN_RULES: readonly Rule<any>[] = [
  d25Atomicity,
  d26Ambiguity,
  d27DuplicatesLevenshtein,
  d28DuplicatesDice,
  h78AcceptanceCriteria,
  t01Traceability,
];