import fs from 'fs/promises';
import path from 'path';

async function cleanup() {
    const projectRoot = process.cwd();

    // Clean up database
    try {
        await fs.unlink(path.join(projectRoot, 'data', 'runs.db'));
        console.log('Deleted existing database');
    } catch (error) {
        // Ignore error if file doesn't exist
    }

    // Clean up repos directory
    try {
        await fs.rm(path.join(projectRoot, 'repos'), { recursive: true, force: true });
        console.log('Cleaned up repos directory');
    } catch (error) {
        // Ignore error if directory doesn't exist
    }

    // Recreate necessary directories
    const directories = ['data', 'repos'];
    for (const dir of directories) {
        await fs.mkdir(path.join(projectRoot, dir), { recursive: true });
        console.log(`Created ${dir} directory`);
    }
}

cleanup().catch(console.error);
