// src/server/gitlab.ts
import simpleGit, { SimpleGit } from 'simple-git';
import path from 'path';
import config from '../config';

export class GitLabService {
    private git: SimpleGit;

    constructor() {
        this.git = simpleGit();
    }

    private formatGitLabUrl(repoUrl: string, username: string, token: string): string {
        try {
            // Remove any existing protocol and authentication
            const cleanUrl = repoUrl
                .replace(/^https?:\/\//, '')
                .replace(/^.*@/, '')
                .replace(/\.git$/, '');

            // Format: https://username:token@gitlab.com/username/repo.git
            return `https://${username}:${token}@${cleanUrl}.git`;
        } catch (error) {
            console.error('Error formatting GitLab URL:', error);
            throw new Error('Failed to format GitLab URL');
        }
    }

    async cloneRepo(repoUrl: string, username: string, token: string, targetDir: string): Promise<string> {
        try {
            // Generate the authenticated URL
            const authenticatedUrl = this.formatGitLabUrl(repoUrl, username, token);
            console.log('Cloning from:', authenticatedUrl.replace(token, '****'));

            // Ensure target directory exists
            const fullPath = path.resolve(targetDir);

            // Clone the repository
            await this.git.clone(authenticatedUrl, fullPath, [
                '--depth', '1',
                '--single-branch'
            ]);

            console.log('Repository cloned successfully to:', fullPath);
            return fullPath;
        } catch (error) {
            console.error('Clone failed:', error);
            throw new Error(`Failed to clone repository: ${(error as Error).message}`);
        }
    }
}

export const gitLabService = new GitLabService();
