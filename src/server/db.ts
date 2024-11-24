import sqlite3 from 'sqlite3';
import path from 'path';
import { Run, RunUpdate } from '../types';

const dbPath = path.join(__dirname, '../../data/runs.db');
const _db = new sqlite3.Database(dbPath);

export function initializeDb(): void {
    _db.run(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      success BOOLEAN,
      output TEXT
    )
  `);
}

export const dbMethods = {
    createRun: (runId: string): Promise<void> => {
        return new Promise((resolve, reject) => {
            _db.run(
                'INSERT INTO runs (id) VALUES (?)',
                [runId],
                (err) => err ? reject(err) : resolve()
            );
        });
    },

    updateRun: (runId: string, update: RunUpdate): Promise<void> => {
        return new Promise((resolve, reject) => {
            _db.run(
                'UPDATE runs SET success = ?, output = ? WHERE id = ?',
                [update.success, update.output, runId],
                (err) => err ? reject(err) : resolve()
            );
        });
    },

    getRun: (runId: string): Promise<Run | null> => {
        return new Promise((resolve, reject) => {
            _db.get(
                'SELECT * FROM runs WHERE id = ?',
                [runId],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row as Run : null);
                }
            );
        });
    },

    getAllRuns: (): Promise<Run[]> => {
        return new Promise((resolve, reject) => {
            _db.all(
                'SELECT * FROM runs ORDER BY timestamp DESC',
                (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows as Run[]);
                }
            );
        });
    }
};

export const db = dbMethods;
