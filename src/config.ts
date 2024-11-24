import dotenv from 'dotenv';

dotenv.config();

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

function validateConfig() {
    const required = [
        'GITLAB_REPO_URL',
        'GITLAB_USERNAME',
        'GITLAB_TOKEN'
    ];

    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
}

validateConfig();

const config: Config = {
    port: parseInt(process.env.PORT || '3000', 10),
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || '*',
    gitlab: {
        repoUrl: process.env.GITLAB_REPO_URL!,
        username: process.env.GITLAB_USERNAME!,
        token: process.env.GITLAB_TOKEN!
    },
    webhook: process.env.WEBHOOK_URL ? {
        url: process.env.WEBHOOK_URL
    } : undefined
};

export default config;
