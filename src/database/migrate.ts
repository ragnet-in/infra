import path from 'path';
import fs from 'fs/promises';
import { db } from './client';

interface MigrationFiles {
  name: string;
  up(): Promise<void>;
  down?(): Promise<void>; // for rollbacks
}

export class Migrator {
  private static MIGRATION_TABLE = `
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  static async migrateToLatest() {
    console.log("Starting Migration ");
    await db.query(this.MIGRATION_TABLE);
    console.log("Migration table queried");
    const executedMigrations = await this.getExecutedMigrations();
    const migrationFiles = await this.getMigrationFiles();

    console.log("Found files: ", executedMigrations.length, migrationFiles.length);

    for (const file of migrationFiles) {
      if (!executedMigrations.includes(file.name)) {
        console.log(`Running migration: ${file.name}`);
        try {
          await file.up();
          await this.recordMigration(file.name);
          console.log(`Migration successful: ${file.name}`);
        } catch (error) {
          console.log(`Migration failed: ${file.name}`, error);
          throw error; // Critical failure - stop the app
        }
      }
    }
  }

  private static async getMigrationFiles(): Promise<MigrationFiles[]> {
    const migrationsDir = path.join(__dirname, '../../migrations');
    const files = await fs.readdir(migrationsDir);
    
    return Promise.all(
      files
        .sort()
        .filter(file => file.endsWith('.ts') || file.endsWith('.js'))
        .map(async (file) => {
          const migration = await import(path.join(migrationsDir, file));
          return {
            name: file,
            up: migration.up,
            down: migration.down
          };
        })
    );
  }

  private static async getExecutedMigrations(): Promise<string[]> {
    const result = await db.query(
        'SELECT name FROM _migrations ORDER BY name'
    ) as { rows: { name: string }[] };
    
    return result.rows.map(row => row.name);
  }

  private static async recordMigration(name: string): Promise<void> {
    await db.query('INSERT INTO _migrations (name) VALUES ($1)', [name]);
  }
}