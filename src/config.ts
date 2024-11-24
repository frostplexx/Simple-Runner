import dotenv from 'dotenv';

dotenv.config();

interface Config {
    port: number;
    corsOrigins: string | string[];
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

const config: Config = {
    port: parseInt(process.env.PORT || '3000', 10),
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || '*',
    gitlab: {
        url: process.env.GITLAB_URL || '',
        username: process.env.GITLAB_USERNAME || '',
        password: process.env.GITLAB_PASSWORD || '',
        repo: process.env.GITLAB_REPO || ''
    },
    webhook: {
        url: process.env.WEBHOOK_URL
    }
};

export default config;
