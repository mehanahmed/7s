
"use server";

import { toast } from '@/hooks/use-toast';
import { getGlobalSettings } from './settings-service';
import fs from 'fs';
import path from 'path';
import { guard } from '@/lib/guard';

function writeTelegramLog(message: string) {
  try {
    const logDir = path.join(process.cwd(), 'storage');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logPath = path.join(logDir, 'telegram-error.log');
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch (e) {
    console.error("Failed to write to telegram log:", e);
  }
}

export async function sendTelegramMessage(
  message: string,
  replyMarkup?: any,
  customChatId?: string | string[]
): Promise<boolean> {
  await guard();
  try {
    const settings = await getGlobalSettings();
    const token = settings.telegramBotToken;
    const chatIds = customChatId
      ? (Array.isArray(customChatId) ? customChatId : [customChatId])
      : settings.telegramChatIds;

    if (!token || !chatIds || chatIds.length === 0) {
      const warningMsg = `Telegram settings are not configured. Bot Token: ${token ? 'Configured' : 'Missing'}, Chat IDs: ${chatIds ? chatIds.length : 0}`;
      console.warn(warningMsg);
      writeTelegramLog(warningMsg);
      return false;
    }

    const apiProxy = process.env.TELEGRAM_API_PROXY || '';
    const mainUrl = apiProxy 
      ? `${apiProxy.replace(/\/+$/, '')}/bot${token}/sendMessage`
      : `https://telegram.colorhut-official.workers.dev/bot${token}/sendMessage`;

    const redirectDomain = settings.telegramRedirectDomain || 'https://app.colorhutbd.xyz';

    // Sanitize localhost/127.0.0.1 URLs since Telegram API rejects non-public URLs
    let sanitizedMessage = message;
    if (message) {
      sanitizedMessage = message.replace(
        /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/g,
        redirectDomain
      );
    }

    let sanitizedReplyMarkup = replyMarkup;
    if (replyMarkup) {
      try {
        const jsonStr = JSON.stringify(replyMarkup);
        const sanitizedJsonStr = jsonStr.replace(
          /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/g,
          redirectDomain
        );
        sanitizedReplyMarkup = JSON.parse(sanitizedJsonStr);
      } catch (e) {
        console.error("Error sanitizing Telegram reply markup:", e);
      }
    }

    let allSuccessful = true;
    for (const chatId of chatIds) {
      let attemptSuccessful = false;
      let lastError = '';

      // 1. Try primary request (either direct or configured proxy)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout

        const response = await fetch(mainUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text: sanitizedMessage,
            parse_mode: 'HTML',
            reply_markup: sanitizedReplyMarkup,
          }),
          cache: 'no-store',
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const responseData = await response.json();
        if (responseData.ok) {
          attemptSuccessful = true;
          console.log(`Telegram message sent successfully to chat ID: ${chatId}.`);
        } else {
          lastError = responseData.description || 'Unknown error';
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.warn(`Primary Telegram request failed for chat ID ${chatId}: ${lastError}`);
      }

      // 2. If primary failed and NO custom proxy was configured, fallback to direct Telegram API
      if (!attemptSuccessful && !apiProxy) {
        const fallbackUrl = `https://api.telegram.org/bot${token}/sendMessage`;
        try {
          console.log(`Retrying Telegram message via direct API for chat ID: ${chatId}...`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 seconds timeout

          const response = await fetch(fallbackUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: chatId,
              text: sanitizedMessage,
              parse_mode: 'HTML',
              reply_markup: sanitizedReplyMarkup,
            }),
            cache: 'no-store',
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          const responseData = await response.json();
          if (responseData.ok) {
            attemptSuccessful = true;
            console.log(`Telegram message sent successfully via direct API to chat ID: ${chatId}.`);
          } else {
            lastError = `Direct API failed: ${responseData.description || 'Unknown error'}`;
          }
        } catch (error) {
          lastError = `Direct API failed with error: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      if (!attemptSuccessful) {
        allSuccessful = false;
        const errorMsg = `Failed to send Telegram message to chat ID: ${chatId}. Last error: ${lastError}`;
        console.error(errorMsg);
        writeTelegramLog(errorMsg);
      }
    }
    return allSuccessful;
  } catch (error) {
    const errorMsg = `Error sending Telegram messages: ${error instanceof Error ? error.stack : error}`;
    console.error(errorMsg);
    writeTelegramLog(errorMsg);
    return false;
  }
}

export async function sendTelegramPhoto(
  photoUrl: string,
  caption: string,
  replyMarkup?: any,
  customChatId?: string | string[]
): Promise<boolean> {
  await guard();
  try {
    const settings = await getGlobalSettings();
    const token = settings.telegramBotToken;
    const chatIds = customChatId
      ? (Array.isArray(customChatId) ? customChatId : [customChatId])
      : settings.telegramChatIds;

    if (!token || !chatIds || chatIds.length === 0) {
      const warningMsg = `Telegram settings are not configured for photo. Bot Token: ${token ? 'Configured' : 'Missing'}, Chat IDs: ${chatIds ? chatIds.length : 0}`;
      console.warn(warningMsg);
      writeTelegramLog(warningMsg);
      return false;
    }

    const apiProxy = process.env.TELEGRAM_API_PROXY || '';
    const mainUrl = apiProxy 
      ? `${apiProxy.replace(/\/+$/, '')}/bot${token}/sendPhoto`
      : `https://telegram.colorhut-official.workers.dev/bot${token}/sendPhoto`;

    const redirectDomain = settings.telegramRedirectDomain || 'https://app.colorhutbd.xyz';

    let sanitizedCaption = caption;
    if (caption) {
      sanitizedCaption = caption.replace(
        /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/g,
        redirectDomain
      );
    }

    let sanitizedPhotoUrl = photoUrl;
    if (photoUrl) {
      if (photoUrl.startsWith('/')) {
        sanitizedPhotoUrl = `${redirectDomain}${photoUrl}`;
      } else {
        sanitizedPhotoUrl = photoUrl.replace(
          /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/g,
          redirectDomain
        );
      }
    }

    let sanitizedReplyMarkup = replyMarkup;
    if (replyMarkup) {
      try {
        const jsonStr = JSON.stringify(replyMarkup);
        const sanitizedJsonStr = jsonStr.replace(
          /https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/g,
          redirectDomain
        );
        sanitizedReplyMarkup = JSON.parse(sanitizedJsonStr);
      } catch (e) {
        console.error("Error sanitizing Telegram reply markup:", e);
      }
    }

    let allSuccessful = true;
    for (const chatId of chatIds) {
      let attemptSuccessful = false;
      let lastError = '';

      // 1. Try primary request (either direct or configured proxy)
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout

        const response = await fetch(mainUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chat_id: chatId,
            photo: sanitizedPhotoUrl,
            caption: sanitizedCaption,
            parse_mode: 'HTML',
            reply_markup: sanitizedReplyMarkup,
          }),
          cache: 'no-store',
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        const responseData = await response.json();
        if (responseData.ok) {
          attemptSuccessful = true;
          console.log(`Telegram photo sent successfully to chat ID: ${chatId}.`);
        } else {
          lastError = responseData.description || 'Unknown error';
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.warn(`Primary Telegram sendPhoto request failed for chat ID ${chatId}: ${lastError}`);
      }

      // 2. If primary failed and NO custom proxy was configured, fallback to direct Telegram API
      if (!attemptSuccessful && !apiProxy) {
        const fallbackUrl = `https://api.telegram.org/bot${token}/sendPhoto`;
        try {
          console.log(`Retrying Telegram sendPhoto via direct API for chat ID: ${chatId}...`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000);

          const response = await fetch(fallbackUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              chat_id: chatId,
              photo: sanitizedPhotoUrl,
              caption: sanitizedCaption,
              parse_mode: 'HTML',
              reply_markup: sanitizedReplyMarkup,
            }),
            cache: 'no-store',
            signal: controller.signal
          });

          clearTimeout(timeoutId);
          const responseData = await response.json();
          if (responseData.ok) {
            attemptSuccessful = true;
            console.log(`Telegram photo sent successfully via direct API to chat ID: ${chatId}.`);
          } else {
            lastError = `Direct API failed: ${responseData.description || 'Unknown error'}`;
          }
        } catch (error) {
          lastError = `Direct API failed with error: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      // 3. Fallback to normal text message for this chat ID if sendPhoto failed
      if (!attemptSuccessful) {
        console.warn(`sendPhoto failed for chat ID ${chatId}. Falling back to sendMessage...`);
        const fallbackText = `${sanitizedCaption}\n\n<b>Receipt Link:</b> ${sanitizedPhotoUrl}`;
        const fallbackSent = await sendTelegramMessage(fallbackText, sanitizedReplyMarkup, chatId);
        if (!fallbackSent) {
          allSuccessful = false;
          const errorMsg = `Failed to send fallback Telegram message to chat ID: ${chatId}. Last error: ${lastError}`;
          console.error(errorMsg);
          writeTelegramLog(errorMsg);
        }
      }
    }
    return allSuccessful;
  } catch (error) {
    const errorMsg = `Error sending Telegram photos: ${error instanceof Error ? error.stack : error}`;
    console.error(errorMsg);
    writeTelegramLog(errorMsg);
    return false;
  }
}

export const initializeFCM = async (): Promise<string | null> => {
  await guard();
  console.log("[NotificationUtils] initializeFCM placeholder called");
  return null;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission | null> => {
  await guard();
  console.log("[NotificationUtils] requestNotificationPermission called");
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn("[NotificationUtils] Notifications not supported by this browser.");
    toast({ title: "Notifications Not Supported", description: "This browser does not support desktop notifications.", variant: "destructive" });
    return null;
  }
  try {
    console.log("[NotificationUtils] Requesting permission via Notification.requestPermission()...");
    const permission = await Notification.requestPermission();
    console.log("[NotificationUtils] Permission result -", permission);
    if (permission === 'granted') {
      toast({ title: "Notifications Enabled!", description: "You will now receive updates." });
    } else if (permission === 'denied') {
      toast({ title: "Notifications Blocked", description: "Please enable notifications in browser settings if you wish to receive them.", variant: "destructive", duration: 7000 });
    } else {
      toast({ title: "Notifications Dismissed", description: "You can enable notifications later if you change your mind." });
    }
    return permission;
  } catch (error) {
    console.error('[NotificationUtils] Error requesting notification permission:', error);
    toast({ title: "Permission Error", description: "Could not request notification permission.", variant: "destructive" });
    return null;
  }
};

