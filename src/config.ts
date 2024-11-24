import dotenv from 'dotenv';
import { Config } from './types';

dotenv.config();

const config: Config = {
    port: parseInt(process.env.PORT || '3000', 10),
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
