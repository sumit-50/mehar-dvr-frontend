/**
 * Database client bridge.
 * In production, all persistence is routed to PostgreSQL via the backend API.
 */
export const pool: any = null;

export async function dbQuery<T = any>(_text: string, _params?: any[]): Promise<{ rows: T[]; rowCount: number }> {
  return { rows: [], rowCount: 0 };
}
