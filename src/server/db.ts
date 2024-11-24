import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { Run, RunUpdate, DBRun, RunStatus } from '../types';

// Enable verbose mode for better debugging
sqlite3.verbose();

class Database {
    private db: sqlite3.Database;
    private initialized: boolean = false;

    constructor() {
        const dbPath = path.join(process.cwd(), 'data', 'runs.db');
        this.db = new sqlite3.Database(dbPath);
        this.db.on('error', (err) => {
            console.error('Database error:', err);
        });
    }

    async init(): Promise<void> {
        if (this.initialized) return;

        // Ensure data directory exists
        const dataDir = path.join(process.cwd(), 'data');
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Enable foreign keys
                this.db.run('PRAGMA foreign_keys = ON');

                // Create runs table if it doesn't exist
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS runs (
                        id TEXT PRIMARY KEY,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        status TEXT DEFAULT 'running',
                        success INTEGER,
                        output TEXT
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating table:', err);
                        reject(err);
                        return;
                    }

                    console.log('Database initialized successfully');
                    this.initialized = true;
                    resolve();
                });
            });
        });
    }

    async createRun(runId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = 'INSERT INTO runs (id, status) VALUES (?, ?)';
            this.db.run(sql, [runId, 'running'], function(err) {
                if (err) {
                    console.error('Error creating run:', err);
                    reject(err);
                    return;
                }
                console.log(`Run created with ID: ${runId}`);
                resolve();
            });
        });
    }

    async updateRun(runId: string, update: RunUpdate): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE runs 
                SET success = ?, 
                    output = ?, 
                    status = ? 
                WHERE id = ?
            `;
            const status: RunStatus = update.success ? 'completed' : 'failed';

            this.db.run(sql, [
                update.success ? 1 : 0,
                update.output,
                status,
                runId
            ], function(err) {
                if (err) {
                    console.error('Error updating run:', err);
                    reject(err);
                    return;
                }
                if (this.changes === 0) {
                    console.warn(`No run found with ID: ${runId}`);
                }
                console.log(`Run ${runId} updated successfully`);
                resolve();
            });
        });
    }

    private convertDbRunToRun(dbRun: DBRun): Run {
        return {
            id: dbRun.id,
            timestamp: dbRun.timestamp,
            status: dbRun.status,
            success: dbRun.success === 1,
            output: dbRun.output
        };
    }

    async getRun(runId: string): Promise<Run | null> {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM runs WHERE id = ?';
            this.db.get(sql, [runId], (err, row: DBRun | undefined) => {
                if (err) {
                    console.error('Error getting run:', err);
                    reject(err);
                    return;
                }
                if (!row) {
                    resolve(null);
                    return;
                }
                resolve(this.convertDbRunToRun(row));
            });
        });
    }

    async getAllRuns(): Promise<Run[]> {
        return new Promise((resolve, reject) => {
            const sql = 'SELECT * FROM runs ORDER BY timestamp DESC';
            this.db.all(sql, [], (err, rows: DBRun[]) => {
                if (err) {
                    console.error('Error getting all runs:', err);
                    reject(err);
                    return;
                }
                const runs = rows.map(row => this.convertDbRunToRun(row));
                resolve(runs);
            });
        });
    }

    async appendOutput(runId: string, chunk: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const sql = `
                UPDATE runs 
                SET output = COALESCE(output, '') || ?
                WHERE id = ?
            `;
            this.db.run(sql, [chunk, runId], function(err) {
                if (err) {
                    console.error('Error appending output:', err);
                    reject(err);
                    return;
                }
                if (this.changes === 0) {
                    console.warn(`No run found with ID: ${runId}`);
                }
                resolve();
            });
        });
    }

    async close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.close((err) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve();
            });
        });
    }
}

// Create a single instance
const database = new Database();

// Export methods
export const initializeDb = () => database.init();
export const db = {
    createRun: (runId: string) => database.createRun(runId),
    updateRun: (runId: string, update: RunUpdate) => database.updateRun(runId, update),
    getRun: (runId: string) => database.getRun(runId),
    getAllRuns: () => database.getAllRuns(),
    appendOutput: (runId: string, chunk: string) => database.appendOutput(runId, chunk),
    close: () => database.close()
};
