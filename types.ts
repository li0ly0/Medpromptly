
export type UserRole = 'Patient' | 'Guardian';

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  patientCode?: string; // Generated for Patients
  linkedPatientId?: string; // Used by Guardians to follow a patient
  avatar?: string;
}

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dosage: string;
  times: string[]; // Format "HH:mm"
  frequency: 'daily' | 'weekly' | 'as_needed';
  isHighPriority: boolean;
  imageUrl?: string; // Base64 or URL for the pill photo
}

export interface MedLog {
  id: string;
  medId: string;
  patientId: string;
  scheduledTime: string;
  takenAt?: string;
  takenBy?: string; // User ID
  takenByName?: string; // User Name
  date: string; // YYYY-MM-DD
}

export enum MedState {
  LOCKED = 'LOCKED',
  UPCOMING = 'UPCOMING',
  ACTIVE = 'ACTIVE',
  OVERDUE = 'OVERDUE',
  COMPLETED = 'COMPLETED'
}
