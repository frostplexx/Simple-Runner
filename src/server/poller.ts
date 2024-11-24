// src/server/poller.ts
import { Server } from 'socket.io';
import { startRunner } from './runner';
import config from '../config';

interface GitLabCommit {
    id: string;
    short_id: string;
    title: string;
    message: string;
    author_name: string;
    created_at: string;
}

export class RepositoryPoller {
    private io: Server;
    private lastCommitId: string | null = null;
    private pollInterval: ReturnType<typeof setInterval> | null = null;
    private isFirstPoll = true;

    constructor(io: Server) {
        this.io = io;
    }

    async getLatestCommit(): Promise<GitLabCommit | null> {
        try {
            // Extract project path from repo URL
            const repoPath = config.gitlab.repoUrl.replace('gitlab.com/', '').replace('.git', '');
            const encodedPath = encodeURIComponent(repoPath);

            const response = await fetch(
                `https://gitlab.com/api/v4/projects/${encodedPath}/repository/commits?ref_name=main`,
                {
                    headers: {
                        'PRIVATE-TOKEN': config.gitlab.token
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`GitLab API error: ${response.statusText}`);
            }

            const commits = await response.json() as GitLabCommit[];
            return commits.length > 0 ? commits[0] : null;

        } catch (error) {
            console.error('Failed to fetch latest commit:', error);
            return null;
        }
    }

    private async checkForChanges() {
        try {
            const latestCommit = await this.getLatestCommit();

            if (!latestCommit) {
                return;
            }

            // On first poll, just store the commit ID
            if (this.isFirstPoll) {
                this.lastCommitId = latestCommit.id;
                this.isFirstPoll = false;
                console.log('Initial commit ID:', this.lastCommitId);
                return;
            }

            // Check if we have a new commit
            if (latestCommit.id !== this.lastCommitId) {
                console.log('New commit detected:', {
                    previousCommit: this.lastCommitId,
                    newCommit: latestCommit.id,
                    message: latestCommit.message,
                    author: latestCommit.author_name
                });

                // Update last commit ID
                this.lastCommitId = latestCommit.id;

                // Start a new run
                const runId = await startRunner(this.io);

                // Notify connected clients
                this.io.emit('commit-detected', {
                    runId,
                    commit: {
                        id: latestCommit.short_id,
                        message: latestCommit.title,
                        author: latestCommit.author_name,
                        timestamp: latestCommit.created_at
                    }
                });
            }
        } catch (error) {
            console.error('Error checking for changes:', error);
        }
    }

    start(intervalSeconds: number = 30) {
        // Initial check
        this.checkForChanges();

        // Set up periodic polling
        this.pollInterval = setInterval(() => {
            this.checkForChanges();
        }, intervalSeconds * 1000);

        console.log(`Started polling repository every ${intervalSeconds} seconds`);
    }

    stop() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
            console.log('Stopped repository polling');
        }
    }
}
