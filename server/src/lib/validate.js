import { z } from 'zod';
import { badRequest } from './errors.js';

export { z };

export function parse(schema, data) {
  const r = schema.safeParse(data);
  if (!r.success) {
    const details = r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    throw badRequest(`Invalid input: ${details.map((d) => `${d.path || 'body'} ${d.message}`).join('; ')}`, details);
  }
  return r.data;
}

export const uuid = z.string().uuid();
