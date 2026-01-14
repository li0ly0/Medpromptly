
export const BUFFER_MINUTES = 30;
export const UPCOMING_WINDOW_MINUTES = 30;

export const formatTime = (time: string) => {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 || 12;
  return `${displayH}:${minutes} ${ampm}`;
};

export const getTodayDateString = () => {
  return new Date().toISOString().split('T')[0];
};

export const STORAGE_KEYS = {
  MEDS: 'medsguardian_medications',
  LOGS: 'medsguardian_logs',
  SETTINGS: 'medsguardian_settings',
  USER_ROLE: 'medsguardian_user_role'
};
