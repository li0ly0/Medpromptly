
import React, { useState, useEffect } from 'react';
import { Medication, MedLog, MedState, UserRole, User } from '../types';
import { formatTime, BUFFER_MINUTES, UPCOMING_WINDOW_MINUTES } from '../constants';
import { storage } from '../services/storage';

interface MedicationCardProps {
  med: Medication;
  scheduledTime: string;
  log?: MedLog;
  userRole: UserRole;
  userName: string;
  currentUser: User;
  onEdit?: () => void;
}

export const MedicationCard: React.FC<MedicationCardProps> = ({ 
  med, 
  scheduledTime, 
  log, 
  userRole, 
  userName, 
  currentUser,
  onEdit
}) => {
  const [state, setState] = useState<MedState>(MedState.LOCKED);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [timeRemainingText, setTimeRemainingText] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 10000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (log?.takenAt) {
      setState(MedState.COMPLETED);
      return;
    }

    const [h, m] = scheduledTime.split(':').map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    
    const now = currentTime.getTime();
    const targetTime = target.getTime();
    const diffMins = (now - targetTime) / (1000 * 60);

    if (diffMins < -UPCOMING_WINDOW_MINUTES) {
      setState(MedState.LOCKED);
      const absDiffMins = Math.abs(diffMins);
      if (absDiffMins >= 60) {
        const hours = Math.floor(absDiffMins / 60);
        setTimeRemainingText(`Ready in ${hours}h`);
      } else {
        setTimeRemainingText(`Ready in ${Math.ceil(absDiffMins)}m`);
      }
    } else if (diffMins < 0) {
      setState(MedState.UPCOMING);
      setTimeRemainingText('Almost ready');
    } else if (diffMins <= BUFFER_MINUTES) {
      setState(MedState.ACTIVE);
      setTimeRemainingText('');
    } else {
      setState(MedState.OVERDUE);
      setTimeRemainingText('');
    }
  }, [scheduledTime, log, currentTime]);

  const handleDone = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await storage.markAsTaken(med.id, scheduledTime, currentUser);
    } catch (err) {
      alert("Error syncing data. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await storage.deleteMed(med.id);
    } catch (err) {
      alert("Failed to delete.");
      setIsSubmitting(false);
    }
  };

  const isCompleted = state === MedState.COMPLETED;
  const isOverdue = state === MedState.OVERDUE;
  const isActive = state === MedState.ACTIVE;
  const completionTime = log?.takenAt ? new Date(log.takenAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';

  return (
    <div className={`relative flex flex-col sm:flex-row items-center p-6 border rounded-[2.5rem] transition-all duration-300 group ${
      isCompleted 
        ? 'bg-emerald-50/30 border-emerald-100 opacity-80' 
        : isOverdue
        ? 'bg-rose-50 border-rose-100 shadow-md shadow-rose-100/50'
        : 'bg-white border-slate-100 hover:border-blue-200'
    } ${isSubmitting ? 'grayscale pointer-events-none opacity-50' : ''}`}>
      
      {/* High Priority Visual Indicator */}
      {med.isHighPriority && !isCompleted && (
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-rose-600 text-white text-[9px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-lg shadow-rose-200 z-10">
          High Priority
        </div>
      )}

      {/* Status Bar */}
      <div className={`absolute left-0 top-8 bottom-8 w-1 rounded-r-full transition-all ${
        isCompleted ? 'bg-emerald-500' : isOverdue ? 'bg-rose-600' : isActive ? 'bg-blue-600' : 'bg-slate-200'
      }`}></div>

      {/* Pill Icon Area */}
      <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-3xl flex items-center justify-center border shrink-0 transition-all overflow-hidden ${
        isCompleted ? 'bg-emerald-100 border-emerald-200' : isOverdue ? 'bg-rose-100 border-rose-200' : 'bg-slate-50 border-slate-100'
      }`}>
        <div className={`text-3xl sm:text-4xl transition-colors ${
          isCompleted ? 'text-emerald-600' : isOverdue ? 'text-rose-600' : 'text-[#1e3a8a]'
        }`}>
          <i className="fa-solid fa-prescription-bottle-medical"></i>
        </div>
      </div>

      {/* Details Area */}
      <div className="flex-grow sm:ml-8 mt-6 sm:mt-0 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-2">
          <h3 className={`text-xl sm:text-2xl font-black tracking-tight ${
            isCompleted ? 'text-slate-400' : isOverdue ? 'text-rose-900' : 'text-[#1e3a8a]'
          }`}>
            {med.name}
          </h3>
          <span className="text-slate-500 font-bold text-xs bg-slate-50 px-3 py-1 rounded-xl border border-slate-200">{med.dosage}</span>
          
          {isOverdue && !isCompleted && (
            <span className="text-[9px] font-black uppercase bg-rose-600 text-white px-3 py-1 rounded-full animate-pulse tracking-widest">Missed</span>
          )}
        </div>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className={`${isCompleted ? 'text-emerald-600' : isOverdue ? 'text-rose-600' : 'text-slate-600'} text-sm font-bold flex items-center justify-center sm:justify-start gap-2`}>
            <i className={`fa-solid ${isCompleted ? 'fa-check-circle' : 'fa-clock opacity-40'}`}></i>
            Scheduled for {formatTime(scheduledTime)}
          </div>
          
          {log?.takenAt && (
            <div className="flex items-center justify-center sm:justify-start gap-2 bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-left-2">
              Taken at {completionTime}
            </div>
          )}
        </div>

        {log?.takenAt && (
          <p className="text-[10px] text-emerald-600 font-bold mt-2 ml-1 opacity-70">
            Confirmed by {log.takenByName}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 sm:mt-0 sm:ml-6 flex flex-col sm:flex-row items-center gap-4 shrink-0">
        {userRole === 'Guardian' && !isCompleted && (
          <div className="flex gap-2">
            <button onClick={onEdit} className="hit-area w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition-colors">
              <i className="fa-solid fa-pen text-sm"></i>
            </button>
            <button 
              onClick={handleDelete} 
              className="hit-area w-11 h-11 rounded-2xl bg-rose-50 text-rose-300 hover:text-rose-600 transition-colors"
              title="Delete Medication"
            >
              <i className="fa-solid fa-trash-can text-sm"></i>
            </button>
          </div>
        )}

        <div className="min-w-[150px] flex flex-col items-center">
          {isCompleted ? (
            <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100">
              <i className="fa-solid fa-check text-xl"></i>
            </div>
          ) : (
            <>
              <button
                onClick={handleDone}
                disabled={state === MedState.LOCKED || state === MedState.UPCOMING || isSubmitting}
                className={`w-full py-4 px-8 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl active:scale-95 ${
                  isOverdue 
                    ? 'bg-rose-600 text-white animate-pulse-urgent shadow-rose-200'
                    : isActive 
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-100'
                    : 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200 shadow-none'
                }`}
              >
                {isSubmitting ? '...' : isOverdue ? 'TAKE NOW' : isActive ? 'DONE' : 'NOT READY'}
              </button>
              {timeRemainingText && (
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-3">
                  {timeRemainingText}
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
