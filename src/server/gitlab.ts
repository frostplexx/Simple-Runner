import simpleGit, { SimpleGit } from 'simple-git';
import path from 'path';
import config from '../config';

const git: SimpleGit = simpleGit();

export async function cloneRepo(): Promise<string> {
    const repoUrl = `https://${config.gitlab.username}:${config.gitlab.password}@${config.gitlab.url}/${config.gitlab.repo}`;
    const clonePath = path.join(__dirname, '../../repos', Date.now().toString());

    try {
        await git.clone(repoUrl, clonePath);
        return clonePath;
    } catch (error) {
        console.error('Clone failed:', error);
        throw error;
    }
}
