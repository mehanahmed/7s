"use server";

import { v4 as uuidv4 } from 'uuid';
import { query } from './mysql';
import { guard, getActionScope, requireRole } from '@/lib/guard';
import type { Meeting, MeetingInput, MeetingStatus } from '@/types';

const TABLE = 'meetings';

let tableReady = false;
const ensureTable = async () => {
  if (tableReady) return;
  await query(`CREATE TABLE IF NOT EXISTS ${TABLE} (
    id VARCHAR(36) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) DEFAULT NULL,
    company_name VARCHAR(255) DEFAULT NULL,
    phone VARCHAR(30) DEFAULT NULL,
    meeting_at DATETIME NOT NULL,
    duration_min INT NOT NULL DEFAULT 30,
    type VARCHAR(20) NOT NULL DEFAULT 'Online',
    location VARCHAR(500) DEFAULT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Scheduled',
    notes TEXT DEFAULT NULL,
    owner_id VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_meetings_at (meeting_at),
    KEY idx_meetings_owner (owner_id)
  )`);
  tableReady = true;
};

const pad = (n: number) => String(n).padStart(2, '0');
// DATETIME comes back as a local Date; keep it as "YYYY-MM-DDTHH:mm" so the browser shows the same wall clock time.
const toLocalIso = (v: any): string => {
  const d = v instanceof Date ? v : new Date(v);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const map = (r: any): Meeting => ({
  id: r.id,
  title: r.title,
  contactName: r.contact_name,
  companyName: r.company_name,
  phone: r.phone,
  meetingAt: toLocalIso(r.meeting_at),
  durationMin: Number(r.duration_min) || 30,
  type: r.type,
  location: r.location,
  status: r.status,
  notes: r.notes,
  ownerId: r.owner_id,
  ownerName: r.user_name ?? r.owner_name,
  ownerAvatar: r.user_avatar ?? null,
});

const TYPES = ['Online', 'In-person', 'Phone'];
const STATUSES: MeetingStatus[] = ['Scheduled', 'Completed', 'Cancelled'];

const toSqlDateTime = (iso: string): string => {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(iso || '');
  if (!m) throw new Error('Meeting date and time is required.');
  return `${m[1]} ${m[2]}:00`;
};

/** CR users only ever see/change their own meetings; admins see everything. */
async function ownerScope(): Promise<string | null> {
  const scope = await getActionScope();
  return scope && scope.role === 'CR' ? scope.userId : null;
}

export async function getMeetings(): Promise<Meeting[]> {
  await guard();
  await requireRole(['SYSTEM_ADMIN', 'ADMIN', 'CR']);
  await ensureTable();
  const owner = await ownerScope();
  const rows = await query<any[]>(
    `SELECT m.*, u.name AS user_name, u.avatar_url AS user_avatar FROM ${TABLE} m LEFT JOIN users u ON u.id = m.owner_id ${owner ? 'WHERE m.owner_id = ?' : ''} ORDER BY m.meeting_at DESC`,
    owner ? [owner] : [],
  );
  return rows.map(map);
}

export async function addMeeting(input: MeetingInput): Promise<Meeting> {
  await guard();
  await requireRole(['SYSTEM_ADMIN', 'ADMIN', 'CR']);
  await ensureTable();
  const scope = await getActionScope();
  if (!scope) throw new Error('Unauthorized');
  const who = await query<any[]>('SELECT name FROM users WHERE id = ?', [scope.userId]);
  const owner = { id: scope.userId, name: who[0]?.name ?? 'Unknown' };
  if (!input.title?.trim()) throw new Error('Title is required.');
  if (!TYPES.includes(input.type)) throw new Error('Invalid meeting type.');
  const id = uuidv4();
  await query(
    `INSERT INTO ${TABLE} (id, title, contact_name, company_name, phone, meeting_at, duration_min, type, location, status, notes, owner_id, owner_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id, input.title.trim(), input.contactName?.trim() || null, input.companyName?.trim() || null, input.phone?.trim() || null,
      toSqlDateTime(input.meetingAt), Math.max(5, Number(input.durationMin) || 30), input.type, input.location?.trim() || null,
      STATUSES.includes(input.status) ? input.status : 'Scheduled', input.notes?.trim() || null, owner.id, owner.name,
    ],
  );
  const rows = await query<any[]>(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
  return map(rows[0]);
}

export async function updateMeeting(id: string, input: Partial<MeetingInput>): Promise<boolean> {
  await guard();
  await requireRole(['SYSTEM_ADMIN', 'ADMIN', 'CR']);
  await ensureTable();
  const own = await ownerScope();
  const current = await query<any[]>(`SELECT owner_id FROM ${TABLE} WHERE id = ?`, [id]);
  if (!current[0]) throw new Error('Meeting not found.');
  if (own && current[0].owner_id !== own) throw new Error('You can only change your own meetings.');

  const fields: string[] = [];
  const values: any[] = [];
  const set = (col: string, val: any) => { fields.push(`${col} = ?`); values.push(val); };
  if (input.title !== undefined) { if (!input.title.trim()) throw new Error('Title is required.'); set('title', input.title.trim()); }
  if (input.contactName !== undefined) set('contact_name', input.contactName?.trim() || null);
  if (input.companyName !== undefined) set('company_name', input.companyName?.trim() || null);
  if (input.phone !== undefined) set('phone', input.phone?.trim() || null);
  if (input.clientWebsite !== undefined) set('client_website', input.clientWebsite?.trim() || null);
  if (input.serviceRequirement !== undefined) set('service_requirement', input.serviceRequirement?.trim() || null);
  if (input.meetingAt !== undefined) set('meeting_at', toSqlDateTime(input.meetingAt));
  if (input.durationMin !== undefined) set('duration_min', Math.max(5, Number(input.durationMin) || 30));
  if (input.type !== undefined) { if (!TYPES.includes(input.type)) throw new Error('Invalid meeting type.'); set('type', input.type); }
  if (input.location !== undefined) set('location', input.location?.trim() || null);
  if (input.status !== undefined) { if (!STATUSES.includes(input.status)) throw new Error('Invalid status.'); set('status', input.status); }
  if (input.notes !== undefined) set('notes', input.notes?.trim() || null);
  if (!fields.length) return true;
  values.push(id);
  await query(`UPDATE ${TABLE} SET ${fields.join(', ')} WHERE id = ?`, values);
  return true;
}

export async function deleteMeeting(id: string): Promise<boolean> {
  await guard();
  await requireRole(['SYSTEM_ADMIN', 'ADMIN', 'CR']);
  await ensureTable();
  const own = await ownerScope();
  const current = await query<any[]>(`SELECT owner_id FROM ${TABLE} WHERE id = ?`, [id]);
  if (!current[0]) return true;
  if (own && current[0].owner_id !== own) throw new Error('You can only delete your own meetings.');
  await query(`DELETE FROM ${TABLE} WHERE id = ?`, [id]);
  return true;
}
