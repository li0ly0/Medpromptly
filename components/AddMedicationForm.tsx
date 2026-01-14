
import React, { useState } from 'react';
import { Medication, User } from '../types';
import { storage } from '../services/storage';

interface AddMedicationFormProps {
  onClose: () => void;
  user: User;
  initialMed?: Medication;
}

export const AddMedicationForm: React.FC<AddMedicationFormProps> = ({ onClose, user, initialMed }) => {
  const [name, setName] = useState(initialMed?.name || '');
  const [dosage, setDosage] = useState(initialMed?.dosage || '');
  const [time, setTime] = useState('08:00');
  const [times, setTimes] = useState<string[]>(initialMed?.times || []);
  const [frequency, setFrequency] = useState<Medication['frequency']>(initialMed?.frequency || 'daily');
  const [isHighPriority, setIsHighPriority] = useState(initialMed?.isHighPriority || false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!name || !dosage || (times.length === 0 && !time)) {
      alert("Please fill in all required fields.");
      return;
    }

    const patientId = user.role === 'Patient' ? user.id : user.linkedPatientId;
    if (!patientId) return;

    setIsSubmitting(true);
    const finalTimes = times.length > 0 ? times : [time];

    const medData: Medication = {
      id: initialMed?.id || Math.random().toString(36).substr(2, 9),
      patientId,
      name,
      dosage,
      times: finalTimes.sort(),
      frequency,
      isHighPriority
    };

    try {
      await storage.saveMed(medData);
      onClose();
    } catch (err) {
      alert("System error. Changes were not saved.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const addTimeSlot = () => {
    if (time && !times.includes(time)) {
      setTimes([...times, time].sort());
    }
  };

  return (
    <div className="fixed inset-0 bg-[#1e3a8a]/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-[1.5rem] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[95vh] flex flex-col border border-slate-200">
        
        {/* Compact Header Section */}
        <div className="p-5 bg-[#2563eb] text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-black tracking-tight leading-none">{initialMed ? 'Edit Medication' : 'New Medicine'}</h2>
            <p className="text-blue-100 text-[9px] font-black uppercase tracking-widest mt-1 opacity-60">Add dosage and schedule intake</p>
          </div>
          <button onClick={onClose} disabled={isSubmitting} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-all active:scale-95">
            <i className="fa-solid fa-times text-sm"></i>
          </button>
        </div>

        {/* Streamlined Form Content */}
        <form onSubmit={handleAddMed} className="p-6 space-y-5 overflow-y-auto">
          
          {/* Medication Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
            <div className="sm:col-span-3 space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Medication Name</label>
              <input
                type="text"
                required
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-600 focus:bg-white transition-all text-[#1e293b] placeholder-slate-300"
                placeholder="e.g. Advil"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Dosage</label>
              <input
                type="text"
                required
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-600 focus:bg-white transition-all text-[#1e293b] placeholder-slate-300"
                placeholder="e.g. 200mg"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
              />
            </div>
          </div>

          {/* Timing Config */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Frequency</label>
              <select
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-600 appearance-none text-[#1e293b]"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="as_needed">As Needed</option>
              </select>
            </div>

            {frequency !== 'as_needed' && (
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Reminder Time</label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    className="flex-grow bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm font-bold outline-none focus:border-blue-600 text-[#1e293b]"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                  <button type="button" onClick={addTimeSlot} className="bg-blue-600 text-white w-10 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center active:scale-95 shadow-sm">
                    <i className="fa-solid fa-plus text-xs"></i>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Selected Times Display */}
          {frequency !== 'as_needed' && times.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {times.map(t => (
                <span key={t} className="bg-blue-50 text-[#2563eb] text-[9px] font-black px-3 py-1.5 rounded-lg flex items-center gap-2 border border-blue-100">
                  {t}
                  <button type="button" onClick={() => setTimes(times.filter(x => x !== t))} className="text-blue-300 hover:text-blue-500 transition-colors">
                    <i className="fa-solid fa-xmark"></i>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Compact Priority Toggle */}
          <label className={`flex items-center p-4 rounded-2xl border transition-all cursor-pointer ${isHighPriority ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
            <input
              type="checkbox"
              className="w-5 h-5 rounded-md text-rose-600 border-rose-200 focus:ring-rose-500"
              checked={isHighPriority}
              onChange={(e) => setIsHighPriority(e.target.checked)}
            />
            <div className="ml-4">
              <span className="block text-[10px] font-black uppercase tracking-widest leading-none">High Priority</span>
              <span className="block text-[8px] opacity-60 font-bold mt-1">Critical life-saving medication alert.</span>
            </div>
          </label>

          {/* Compact Actions */}
          <div className="flex gap-3 pt-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 rounded-xl border border-slate-100 font-black text-slate-400 hover:bg-slate-50 transition-all uppercase tracking-widest text-[9px] active:scale-95"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-[2] py-4 rounded-xl bg-blue-600 font-black text-white hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all transform active:scale-95 uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-70' : ''}`}
            >
              {isSubmitting ? <i className="fa-solid fa-circle-notch animate-spin"></i> : null}
              {initialMed ? 'Save Changes' : 'Schedule Medication'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
