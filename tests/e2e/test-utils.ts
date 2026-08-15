import Database from 'better-sqlite3';
import path from 'path';

export function getTestDb() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('SECURITY HALT: E2E Test execution attempted outside of test environment.');
  }
  const dbPath = path.join(process.cwd(), 'forge_test.db');
  if (!dbPath.includes('_test')) {
    throw new Error('SECURITY HALT: E2E Test DB path does not contain "_test". Preventing contamination of production DB.');
  }
  const db = new Database(dbPath);
  // Las pruebas corren en paralelo y varias escriben en este mismo archivo, a
  // la vez que lo hace el servidor. Sin esto, encontrarse la base bloqueada
  // lanza en el acto, y el fallo sale en una prueba cualquiera —la que tuvo
  // mala suerte— en vez de en la que estaba escribiendo. La aplicación ya lo
  // tiene puesto; esta conexión también.
  db.pragma('busy_timeout = 5000');
  return db;
}
