
import fs from 'fs';
import path from 'path';
import { settleAllDeliveredOrdersAction, remindActiveCrmSchedulesAction } from '../app/(app)/dashboard/actions';

let isRunning = false;
let isScheduleCronRunning = false;

let lastTriggeredDate: string | null = null;
let lastTriggeredHour: number | null = null;

let scheduledRandomMinuteForToday: number | null = null;
let currentDayForRandomMinute: string | null = null;

function getLastScheduleCronDateFromFile(): string | null {
    try {
        const filePath = path.join(process.cwd(), 'storage', 'last_schedule_cron_date.txt');
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8').trim();
        }
    } catch (e) {
        console.error('Error reading last schedule cron date file:', e);
    }
    return null;
}

function setLastScheduleCronDateToFile(dateStr: string) {
    try {
        const dirPath = path.join(process.cwd(), 'storage');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        const filePath = path.join(dirPath, 'last_schedule_cron_date.txt');
        fs.writeFileSync(filePath, dateStr, 'utf8');
    } catch (e) {
        console.error('Error writing last schedule cron date file:', e);
    }
}

function getRandomTargetMinute(todayDateStr: string): number {
    if (currentDayForRandomMinute !== todayDateStr || scheduledRandomMinuteForToday === null) {
        currentDayForRandomMinute = todayDateStr;
        // Pick a random minute between 0 and 59 for the 9-10 AM window
        scheduledRandomMinuteForToday = Math.floor(Math.random() * 60);
        console.log(`[Cron Service] Scheduled random schedule reminder trigger for today (${todayDateStr}): 09:${String(scheduledRandomMinuteForToday).padStart(2, '0')} AM BD Time`);
    }
    return scheduledRandomMinuteForToday;
}

export function startCronService() {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return;

    console.log('[Cron Service] Initializing internal scheduler for Courier Sync & CR Schedule Reminders...');

    // Check every 30 seconds to be precise
    setInterval(async () => {
        try {
            // Get current time in Bangladesh (UTC+6)
            const now = new Date();
            const bdTimeStr = now.toLocaleString("en-US", {
                timeZone: "Asia/Dhaka",
                hour12: false
            });

            // format: "MM/DD/YYYY, HH:mm:ss"
            const [datePart, timePart] = bdTimeStr.split(', ');
            const [hour, minute] = timePart.split(':').map(Number);

            // 1. Automated Courier Status Sync at 2:00 PM and 10:00 PM
            const targetHours = [14, 22]; // 2:00 PM and 10:00 PM

            if (targetHours.includes(hour) && minute === 0) {
                if (lastTriggeredDate !== datePart || lastTriggeredHour !== hour) {
                    if (!isRunning) {
                        isRunning = true;
                        lastTriggeredDate = datePart;
                        lastTriggeredHour = hour;

                        console.log(`[Cron Service] Triggering automated courier sync at ${hour}:00 BD Time...`);
                        const result = await settleAllDeliveredOrdersAction();
                        console.log(`[Cron Service] Sync status: ${result.success ? 'Success' : 'Failed'}. Settled: ${result.settledCount}`);

                        isRunning = false;
                    }
                }
            }

            // 2. Automated Active CR Schedule Reminders (STRICTLY ONCE DAILY at a random BD time between 9:00 AM and 10:00 AM)
            if (hour === 9) {
                const targetMinute = getRandomTargetMinute(datePart);
                const lastRunDate = getLastScheduleCronDateFromFile();

                if (minute === targetMinute && lastRunDate !== datePart) {
                    if (!isScheduleCronRunning) {
                        isScheduleCronRunning = true;
                        setLastScheduleCronDateToFile(datePart); // Write persistent daily lock immediately

                        console.log(`[Cron Service] Triggering single daily CR schedule reminders at random time 09:${String(minute).padStart(2, '0')} AM BD Time...`);
                        const reminderResult = await remindActiveCrmSchedulesAction();
                        console.log(`[Cron Service] Reminder status: ${reminderResult.success ? 'Success' : 'Failed'}. Reminders sent: ${reminderResult.totalRemindersSent}`);

                        isScheduleCronRunning = false;
                    }
                }
            }
        } catch (error) {
            console.error('[Cron Service] Error in scheduler:', error);
            isRunning = false;
            isScheduleCronRunning = false;
        }
    }, 30000); // Check every 30 seconds
}
