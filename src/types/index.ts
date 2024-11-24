export type RunStatus = 'running' | 'completed' | 'failed';

export interface Run {
    id: string;
    timestamp: string;
    status: RunStatus;
    success: boolean | null;
    output: string | null;
}

export interface RunUpdate {
    success: boolean;
    output: string;
}

export interface Config {
    port: number;
    corsOrigins: string | string[];
    gitlab: {
        repoUrl: string;
        username: string;
        token: string;
    };
    webhook?: {
        url?: string;
    };
}

export interface DBRun {
    id: string;
    timestamp: string;
    status: RunStatus;
    success: number;  // SQLite stores booleans as 0/1
    output: string | null;
}
