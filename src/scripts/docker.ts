import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runCommand(command: string): Promise<void> {
    try {
        const { stdout, stderr } = await execAsync(command);
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
    } catch (error) {
        console.error('Error executing command:', error);
        process.exit(1);
    }
}

async function main() {
    const command = process.argv[2];

    switch (command) {
        case 'build':
            await runCommand('docker-compose build --no-cache');
            break;

        case 'start':
            await runCommand('docker-compose up -d');
            console.log('Container started! Logs available with: npm run docker:logs');
            break;

        case 'stop':
            await runCommand('docker-compose down');
            break;

        case 'logs':
            // Follow logs
            await runCommand('docker-compose logs -f');
            break;

        case 'clean':
            console.log('Cleaning up Docker resources...');
            await runCommand('docker-compose down -v');
            // Clean up any leftover volumes
            await runCommand('docker volume prune -f');
            break;

        case 'restart':
            await runCommand('docker-compose restart');
            break;

        default:
            console.log(`
Available commands:
  build   - Build the Docker image
  start   - Start the container
  stop    - Stop the container
  logs    - View container logs
  clean   - Remove container and volumes
  restart - Restart the container
            `);
    }
}

main().catch(console.error);
