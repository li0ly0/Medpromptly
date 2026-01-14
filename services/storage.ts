
import { neon } from '@neondatabase/serverless';
import { Medication, MedLog, User } from '../types';
import { getTodayDateString } from '../constants';

const CURRENT_USER_KEY = 'medsguardian_current_user_id';
const DB_URL_STORAGE_KEY = 'medsguardian_db_url';

const FALLBACK_DB_URL = "postgresql://neondb_owner:npg_gK57QEqFoRVD@ep-damp-grass-a1g4o7id-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const getDatabaseUrl = () => {
  return (process.env as any).DATABASE_URL || localStorage.getItem(DB_URL_STORAGE_KEY) || FALLBACK_DB_URL;
};

const getSql = () => {
  const url = getDatabaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL_MISSING");
  }
  return neon(url);
};

export const storage = {
  isConfigured: (): boolean => {
    return !!getDatabaseUrl();
  },

  setDatabaseUrl: (url: string) => {
    localStorage.setItem(DB_URL_STORAGE_KEY, url);
    window.dispatchEvent(new Event('storage-update'));
  },

  // --- USER AUTH ---
  getUsers: async (): Promise<User[]> => {
    try {
      const sql = getSql();
      const result = await sql`SELECT * FROM users`;
      return result.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        password: u.password,
        role: u.role,
        patientCode: u.patient_code,
        linkedPatientId: u.linked_patient_id,
        avatar: u.avatar
      }));
    } catch (e) {
      if (e instanceof Error && e.message === "DATABASE_URL_MISSING") throw e;
      console.error("DB Error (getUsers):", e);
      return [];
    }
  },

  saveUser: async (user: User): Promise<void> => {
    try {
      const sql = getSql();
      await sql`
        INSERT INTO users (id, name, email, password, role, patient_code, linked_patient_id, avatar)
        VALUES (${user.id}, ${user.name}, ${user.email}, ${user.password || ''}, ${user.role}, ${user.patientCode || null}, ${user.linkedPatientId || null}, ${user.avatar || null})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          password = EXCLUDED.password,
          role = EXCLUDED.role,
          patient_code = EXCLUDED.patient_code,
          linked_patient_id = EXCLUDED.linked_patient_id,
          avatar = EXCLUDED.avatar
      `;
      window.dispatchEvent(new Event('storage-update'));
    } catch (e) {
      console.error("DB Error (saveUser):", e);
      throw e;
    }
  },

  updateUser: async (userId: string, updates: Partial<User>): Promise<void> => {
    try {
      const sql = getSql();
      if (updates.email) await sql`UPDATE users SET email = ${updates.email} WHERE id = ${userId}`;
      if (updates.password) await sql`UPDATE users SET password = ${updates.password} WHERE id = ${userId}`;
      if (updates.name) await sql`UPDATE users SET name = ${updates.name} WHERE id = ${userId}`;
      if (updates.avatar !== undefined) await sql`UPDATE users SET avatar = ${updates.avatar} WHERE id = ${userId}`;
      
      window.dispatchEvent(new Event('storage-update'));
    } catch (e) {
      console.error("DB Error (updateUser):", e);
      throw e;
    }
  },

  deleteUser: async (userId: string): Promise<void> => {
    try {
      const sql = getSql();
      // Delete associated data first
      await sql`DELETE FROM med_logs WHERE patient_id = ${userId} OR taken_by = ${userId}`;
      await sql`DELETE FROM medications WHERE patient_id = ${userId}`;
      // Finally delete the user
      await sql`DELETE FROM users WHERE id = ${userId}`;
      window.dispatchEvent(new Event('storage-update'));
    } catch (e) {
      console.error("DB Error (deleteUser):", e);
      throw e;
    }
  },

  getCurrentUser: async (): Promise<User | null> => {
    const userId = localStorage.getItem(CURRENT_USER_KEY);
    if (!userId) return null;
    try {
      const sql = getSql();
      const result = await sql`SELECT * FROM users WHERE id = ${userId} LIMIT 1`;
      if (result.length === 0) return null;
      const u = result[0];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        password: u.password,
        role: u.role,
        patientCode: u.patient_code,
        linkedPatientId: u.linked_patient_id,
        avatar: u.avatar
      };
    } catch (e) {
      if (e instanceof Error && e.message === "DATABASE_URL_MISSING") return null;
      console.error("DB Error (getCurrentUser):", e);
      return null;
    }
  },

  setCurrentUser: (userId: string | null) => {
    if (userId) {
      localStorage.setItem(CURRENT_USER_KEY, userId);
    } else {
      localStorage.removeItem(CURRENT_USER_KEY);
    }
    window.dispatchEvent(new Event('storage-update'));
  },

  // --- MEDS ---
  getMeds: async (patientId: string): Promise<Medication[]> => {
    try {
      const sql = getSql();
      const result = await sql`SELECT * FROM medications WHERE patient_id = ${patientId}`;
      return result.map(m => ({
        id: m.id,
        patientId: m.patient_id,
        name: m.name,
        dosage: m.dosage,
        times: m.times,
        frequency: m.frequency,
        isHighPriority: m.is_high_priority,
        imageUrl: m.image_url
      }));
    } catch (e) {
      console.error("DB Error (getMeds):", e);
      return [];
    }
  },
  
  saveMed: async (med: Medication): Promise<void> => {
    try {
      const sql = getSql();
      await sql`
        INSERT INTO medications (id, patient_id, name, dosage, times, frequency, is_high_priority, image_url)
        VALUES (${med.id}, ${med.patientId}, ${med.name}, ${med.dosage}, ${med.times}, ${med.frequency}, ${med.isHighPriority}, ${med.imageUrl || null})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          dosage = EXCLUDED.dosage,
          times = EXCLUDED.times,
          frequency = EXCLUDED.frequency,
          is_high_priority = EXCLUDED.is_high_priority,
          image_url = EXCLUDED.image_url
      `;
      window.dispatchEvent(new Event('storage-update'));
    } catch (e) {
      console.error("DB Error (saveMed):", e);
      throw e;
    }
  },

  deleteMed: async (medId: string): Promise<void> => {
    try {
      const sql = getSql();
      await sql`DELETE FROM medications WHERE id = ${medId}`;
      await sql`DELETE FROM med_logs WHERE med_id = ${medId}`;
      window.dispatchEvent(new Event('storage-update'));
    } catch (e) {
      console.error("DB Error (deleteMed):", e);
      throw e;
    }
  },

  // --- LOGS ---
  getLogsForToday: async (patientId: string): Promise<MedLog[]> => {
    const today = getTodayDateString();
    try {
      const sql = getSql();
      const result = await sql`SELECT * FROM med_logs WHERE patient_id = ${patientId} AND date = ${today}`;
      return result.map(l => ({
        id: l.id,
        medId: l.med_id,
        patientId: l.patient_id,
        scheduledTime: l.scheduled_time,
        takenAt: l.taken_at,
        takenBy: l.taken_by,
        takenByName: l.taken_by_name,
        date: l.date
      }));
    } catch (e) {
      console.error("DB Error (getLogsForToday):", e);
      return [];
    }
  },

  markAsTaken: async (medId: string, scheduledTime: string, user: User): Promise<void> => {
    const today = getTodayDateString();
    const patientId = user.role === 'Patient' ? user.id : user.linkedPatientId;
    if (!patientId) return;

    const logId = Math.random().toString(36).substr(2, 9);
    try {
      const sql = getSql();
      await sql`
        INSERT INTO med_logs (id, med_id, patient_id, scheduled_time, date, taken_at, taken_by, taken_by_name)
        VALUES (${logId}, ${medId}, ${patientId}, ${scheduledTime}, ${today}, ${new Date().toISOString()}, ${user.id}, ${user.name})
      `;
      window.dispatchEvent(new Event('storage-update'));
    } catch (e) {
      console.error("DB Error (markAsTaken):", e);
      throw e;
    }
  }
};
