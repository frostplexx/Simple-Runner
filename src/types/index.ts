
export interface Config {
    port: number;
    gitlab: {
        url: string;
        username: string;
        password: string;
        repo: string;
    };
    webhook: {
        url?: string;
    };
}

export interface Run {
    id: string;
    timestamp: string;
    success: boolean | null;
    output: string;
}

export interface RunUpdate {
    success: boolean;
    output: string;
}

export interface WebhookPayload {
    runId: string;
    success: boolean;
    timestamp: string;
}
