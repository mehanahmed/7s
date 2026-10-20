"use client";

import { useEffect, useState, type ReactNode } from 'react';
import { Bell, BellRing, CheckCheck, CircleAlert, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { subscribeToNotifications } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type NotificationItem = {
  id: string;
  title?: ReactNode;
  description?: ReactNode;
  createdAt: Date;
  read: boolean;
  destructive: boolean;
};

export function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);

  useEffect(() => subscribeToNotifications((notification) => {
    if (!notification.title && !notification.description) return;
    setNotifications((items) => {
      const previous = items.find((item) => item.id === notification.id);
      const updated: NotificationItem = {
        id: notification.id,
        title: notification.title,
        description: notification.description,
        destructive: notification.variant === 'destructive',
        createdAt: previous?.createdAt ?? new Date(),
        read: false,
      };
      return [updated, ...items.filter((item) => item.id !== updated.id)].slice(0, 50);
    });
  }), []);

  const unreadCount = notifications.filter((item) => !item.read).length;
  const visibleNotifications = unreadOnly ? notifications.filter((item) => !item.read) : notifications;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8 shrink-0 rounded-xl text-foreground hover:bg-accent sm:h-9 sm:w-9 md:h-10 md:w-10" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`} title="Notifications">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground ring-2 ring-background">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={12} collisionPadding={12} className="w-[380px] max-w-[calc(100vw-24px)] overflow-hidden rounded-2xl border-border/70 p-0 shadow-xl" role="dialog" aria-label="Notifications">
        <div className="border-b border-border/60 bg-primary/5 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><BellRing className="h-4 w-4 text-primary" /> Notifications</h2>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{unreadCount} unread</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Your recent app alerts from this session.</p>
        </div>
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
          <div className="flex gap-1" role="group" aria-label="Filter notifications">
            <Button size="sm" variant={unreadOnly ? 'ghost' : 'secondary'} className="h-8 rounded-lg text-xs" aria-pressed={!unreadOnly} onClick={() => setUnreadOnly(false)}>All</Button>
            <Button size="sm" variant={unreadOnly ? 'secondary' : 'ghost'} className="h-8 rounded-lg text-xs" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(true)}>Unread</Button>
          </div>
          <Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs" disabled={!unreadCount} onClick={() => setNotifications((items) => items.map((item) => ({ ...item, read: true })))}><CheckCheck className="h-3.5 w-3.5" /> Mark all read</Button>
        </div>
        <div className="max-h-[min(360px,50vh)] overflow-y-auto overscroll-contain">
          {visibleNotifications.length ? (
            <ul className="divide-y divide-border/50">
              {visibleNotifications.map((item) => (
                <li key={item.id} className={cn('flex gap-3 px-4 py-4', !item.read && 'bg-primary/[0.04]')}>
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', item.destructive ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary')}>{item.destructive ? <CircleAlert className="h-4 w-4" /> : <Bell className="h-4 w-4" />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="break-words text-sm font-semibold text-foreground">{item.title || 'App update'}</div>
                    {item.description && <div className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">{item.description}</div>}
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <time dateTime={item.createdAt.toISOString()} className="text-[11px] text-muted-foreground">{item.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                      {!item.read && <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-primary" aria-label={`Mark notification from ${item.createdAt.toLocaleTimeString()} as read`} onClick={() => setNotifications((items) => items.map((entry) => entry.id === item.id ? { ...entry, read: true } : entry))}>Mark as read</Button>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Bell className="h-6 w-6" /></div>
              <p className="text-sm font-semibold text-foreground">{unreadOnly ? "You're all caught up" : 'No notifications yet'}</p>
              <p className="mt-1.5 max-w-64 text-xs leading-relaxed text-muted-foreground">{unreadOnly ? 'You have no unread alerts.' : 'Updates and alerts will appear here as you use the app.'}</p>
            </div>
          )}
        </div>
        <div className="flex justify-end border-t border-border/60 px-4 py-2"><Button size="sm" variant="ghost" className="h-8 gap-1.5 text-xs text-muted-foreground" disabled={!notifications.length} onClick={() => setNotifications([])}><Trash2 className="h-3.5 w-3.5" /> Clear all</Button></div>
      </PopoverContent>
    </Popover>
  );
}
