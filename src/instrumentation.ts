
export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        const { startCronService } = await import('./lib/cron-runner');
        startCronService();
    }
}
