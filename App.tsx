
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Medication, MedLog, User } from './types';
import { storage } from './services/storage';
import { MedicationCard } from './components/MedicationCard';
import { AddMedicationForm } from './components/AddMedicationForm';
import { Auth } from './components/Auth';
import { hashPassword } from './services/crypto';

type ViewMode = 'dashboard' | 'settings';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [patientUser, setPatientUser] = useState<User | null>(null);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<MedLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [view, setView] = useState<ViewMode>('dashboard');
  const [lastSync, setLastSync] = useState(new Date());
  const [showScrollTop, setShowScrollTop] = useState(false);

  // Settings State
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [newAvatar, setNewAvatar] = useState('');
  const [settingsError, setSettingsError] = useState('');
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  
  // Delete Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const fetchData = async () => {
    const currentUser = await storage.getCurrentUser();
    setUser(currentUser);
    
    if (currentUser) {
      if (view === 'settings') {
        setNewEmail(currentUser.email);
        setNewName(currentUser.name);
        setNewAvatar(currentUser.avatar || '');
      }
      const patientId = currentUser.role === 'Patient' ? currentUser.id : currentUser.linkedPatientId;
      
      if (patientId) {
        if (currentUser.role === 'Guardian') {
          const allUsers = await storage.getUsers();
          const p = allUsers.find(u => u.id === patientId);
          if (p) setPatientUser(p);
        }

        const [fetchedMeds, fetchedLogs] = await Promise.all([
          storage.getMeds(patientId),
          storage.getLogsForToday(patientId)
        ]);
        setMeds(fetchedMeds);
        setLogs(fetchedLogs);
        setLastSync(new Date());
      }
    } else {
      setMeds([]);
      setLogs([]);
      setPatientUser(null);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
    window.addEventListener('storage-update', fetchData);
    
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('storage-update', fetchData);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [view]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // 2MB limit for base64 storage
        setSettingsError("Photo too large. Please use an image under 2MB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const checklist = useMemo(() => {
    const items: { med: Medication; time: string }[] = [];
    meds.forEach(med => {
      med.times.forEach(time => {
        items.push({ med, time });
      });
    });
    return items.sort((a, b) => a.time.localeCompare(b.time));
  }, [meds]);

  const stats = useMemo(() => {
    const total = checklist.length;
    const completed = logs.filter(l => l.takenAt).length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    
    let message = "";
    if (total === 0) {
      message = "No medicine for today.";
    } else if (completed === 0) {
      message = `${total} doses to take today.`;
    } else if (completed < total) {
      message = `${total - completed} doses remaining.`;
    } else {
      message = "You've taken all your doses!";
    }

    return { total, completed, progress, message };
  }, [checklist, logs]);

  const [linkedGuardians, setLinkedGuardians] = useState<User[]>([]);

  useEffect(() => {
    if (user && user.role === 'Patient') {
      storage.getUsers().then(users => {
        setLinkedGuardians(users.filter(u => u.linkedPatientId === user.id));
      });
    }
  }, [user, meds, logs]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSettingsError('');
    setSettingsSuccess('');
    setIsSavingSettings(true);

    try {
      const hashedCurrent = await hashPassword(currentPass);
      if (hashedCurrent !== user.password) {
        setSettingsError('Identity verification failed (Wrong password)');
        setIsSavingSettings(false);
        return;
      }

      const updates: Partial<User> = {
        email: newEmail,
        name: newName,
        avatar: newAvatar
      };
      if (newPass) updates.password = await hashPassword(newPass);

      await storage.updateUser(user.id, updates);
      setSettingsSuccess('Profile updated successfully!');
      setCurrentPass('');
      setNewPass('');
      const updatedUser = await storage.getCurrentUser();
      setUser(updatedUser);
    } catch (err) {
      setSettingsError('System update failed. Please try again.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const confirmDeleteAccount = async () => {
    if (!user || deleteInput !== user.name) return;
    
    setIsSavingSettings(true);
    setShowDeleteModal(false);
    try {
      await storage.deleteUser(user.id);
      handleSignOut();
    } catch (err) {
      setSettingsError("System failed to process deletion. Please check connection.");
      setIsSavingSettings(false);
    }
  };

  const handleEdit = (med: Medication) => setEditingMed(med);
  const handleCloseForm = () => { setIsAdding(false); setEditingMed(null); };

  const copyToClipboard = () => {
    if (user?.patientCode) {
      navigator.clipboard.writeText(user.patientCode);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  const getTimeAgo = (date: Date) => {
    const diff = (new Date().getTime() - date.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    return `${Math.floor(diff / 60)}m ago`;
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignOut = () => {
    storage.setCurrentUser(null);
    setView('dashboard'); // Ensure next login starts on dashboard
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="relative mb-10">
          <div className="w-24 h-24 border-4 border-blue-100 rounded-[2rem] animate-spin-slow"></div>
          <div className="absolute inset-0 flex items-center justify-center text-blue-600 animate-pulse">
            <i className="fa-solid fa-staff-snake text-4xl"></i>
          </div>
        </div>
        <p className="text-[#1e3a8a] text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Syncing Health Core</p>
      </div>
    );
  }

  if (!user) return <Auth />;

  return (
    <div className="max-w-4xl mx-auto px-6 py-12 relative">
      {/* Premium Navbar */}
      <nav className="flex justify-between items-center mb-12 bg-white/60 p-4 rounded-[2.5rem] border border-white/50 shadow-sm sticky top-4 z-40 glass">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setView('dashboard')}>
          <div className="bg-blue-600 w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
            <i className="fa-solid fa-staff-snake text-2xl"></i>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-extrabold text-[#1e3a8a] tracking-tight">MedPromptly</h1>
            <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5 opacity-60">Precision Care, Shared with Family</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right hidden xs:block">
            <p className="text-[#1e3a8a] text-sm font-black truncate max-w-[120px]">{user.name}</p>
            <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">{user.role}</p>
          </div>
          
          <button 
            onClick={() => setView('settings')}
            className={`hit-area w-11 h-11 rounded-2xl flex items-center justify-center transition-all border shadow-sm active:scale-95 ${
              view === 'settings' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-100 hover:bg-slate-50'
            }`}
          >
            {user.avatar ? <img src={user.avatar} className="w-8 h-8 rounded-xl object-cover" /> : <i className="fa-solid fa-user-gear"></i>}
          </button>
        </div>
      </nav>

      {view === 'dashboard' ? (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
          {/* Dashboard Summary Section */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
            {/* Actionable Greeting & Stats */}
            <div className="md:col-span-8 bg-blue-600 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between min-h-[260px]">
              <div className="relative z-10">
                <p className="text-white/60 font-black text-[10px] uppercase tracking-[0.3em] mb-3">Intake Progress</p>
                <h2 className="text-3xl font-black tracking-tight mb-2">
                  Good {new Date().getHours() < 12 ? 'Morning' : 'Day'}, {user.name.split(' ')[0]}
                </h2>
                <p className="text-blue-100 font-bold text-lg opacity-90">{stats.message}</p>
              </div>

              <div className="relative z-10">
                <div className="flex justify-between items-end mb-4">
                   <span className="text-5xl font-black tabular-nums">{Math.round(stats.progress)}<span className="text-xl opacity-60 ml-1">%</span></span>
                   <div className="text-right">
                      <p className="text-[10px] font-black uppercase opacity-60 mb-1">Doses Done</p>
                      <p className="text-sm font-black">{stats.completed} / {stats.total}</p>
                   </div>
                </div>
                <div className="w-full bg-white/20 h-4 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className="bg-white h-full rounded-full progress-bar-transition shadow-[0_0_20px_rgba(255,255,255,0.4)]" 
                    style={{ width: `${stats.progress}%` }}
                  ></div>
                </div>
              </div>

              <div className="absolute right-[-2rem] top-[-2rem] w-48 h-48 bg-white/5 rounded-full blur-3xl pointer-events-none"></div>
              <div className="absolute right-4 bottom-4 opacity-10 pointer-events-none">
                 <i className="fa-solid fa-heart-pulse text-8xl"></i>
              </div>
            </div>

            <div className="md:col-span-4 flex flex-col gap-6">
              {user.role === 'Patient' ? (
                <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 h-full flex flex-col justify-between group">
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                        <i className="fa-solid fa-link"></i>
                      </div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Current Guardians</h3>
                    </div>
                    
                    {linkedGuardians.length > 0 ? (
                      <div className="space-y-4 max-h-[140px] overflow-y-auto pr-2 custom-scrollbar">
                        {linkedGuardians.map(g => (
                          <div key={g.id} className="flex items-center gap-4 bg-slate-50 p-3 rounded-[1.5rem] border border-slate-100">
                            <div className="w-10 h-10 bg-white text-blue-600 rounded-xl flex items-center justify-center text-xs font-black shadow-sm border border-slate-100">
                              {g.avatar ? <img src={g.avatar} className="w-full h-full rounded-xl object-cover" /> : g.name.charAt(0)}
                            </div>
                            <div className="text-left overflow-hidden">
                              <p className="text-xs font-black text-[#1e3a8a] truncate">{g.name}</p>
                              <p className="text-[8px] text-emerald-600 font-black uppercase tracking-widest flex items-center gap-1">
                                <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                                Guardian Active
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <button 
                        onClick={copyToClipboard}
                        className="w-full bg-blue-50 border-2 border-dashed border-blue-200 rounded-[2rem] p-6 flex flex-col items-center justify-center hover:bg-blue-100 hover:border-blue-300 transition-all active:scale-95"
                      >
                        <p className="text-3xl font-mono font-black tracking-widest text-blue-600">{user.patientCode}</p>
                        <span className="text-[9px] font-black text-blue-400 uppercase mt-2 tracking-widest">
                          {copyFeedback ? 'Care Code Copied' : 'Click to Invite Family'}
                        </span>
                      </button>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 leading-relaxed mt-4">
                    {linkedGuardians.length > 0 ? "Family is monitoring your intake." : "Invite family to monitor and remind you of your progress."}
                  </p>
                </div>
              ) : (
                <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                        <i className="fa-solid fa-user-shield"></i>
                      </div>
                      <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Monitoring</h3>
                    </div>
                    
                    {patientUser && (
                      <div className="flex items-center gap-4 mb-6">
                        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-3xl flex items-center justify-center text-xl font-black shadow-inner border border-blue-100">
                          {patientUser.avatar ? <img src={patientUser.avatar} className="w-full h-full rounded-3xl object-cover" /> : patientUser.name.charAt(0)}
                        </div>
                        <div className="text-left">
                           <p className="text-lg font-black text-[#1e3a8a]">{patientUser.name}</p>
                           <p className="text-xs font-bold text-slate-400">Patient Active</p>
                        </div>
                      </div>
                    )}
                    
                    <p className="text-slate-600 text-xs font-bold leading-relaxed mb-6">
                      You are monitoring {patientUser?.name || 'the patient'}'s medicine intake. 
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3 bg-slate-50 text-slate-500 px-4 py-3 rounded-2xl border border-slate-100 w-full shadow-sm text-[10px] font-black uppercase tracking-wider">
                      <i className="fa-solid fa-sync animate-spin-slow"></i>
                      Last Sync: {getTimeAgo(lastSync)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between items-center mb-10">
            <h2 className="text-2xl font-black text-[#1e3a8a] flex items-center gap-4">
              <i className="fa-solid fa-clipboard-check text-blue-600"></i>
              Medicine Schedules
            </h2>
            {user.role === 'Guardian' && (
              <button 
                onClick={() => setIsAdding(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-black p-4 sm:py-4 sm:px-8 rounded-2xl shadow-xl shadow-blue-100 transition transform active:scale-95 text-[11px] uppercase tracking-widest flex items-center gap-2"
              >
                <i className="fa-solid fa-plus-circle text-lg sm:text-base"></i>
                <span className="hidden sm:inline">Add Medication</span>
              </button>
            )}
          </div>

          <div className="space-y-6">
            {checklist.length > 0 ? (
              checklist.map(({ med, time }, index) => (
                <MedicationCard 
                  key={`${med.id}-${time}-${index}`}
                  med={med}
                  scheduledTime={time}
                  log={logs.find(l => l.medId === med.id && l.scheduledTime === time)}
                  userRole={user.role}
                  userName={user.name}
                  currentUser={user}
                  onEdit={() => handleEdit(med)}
                />
              ))
            ) : (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-[3rem] py-24 text-center shadow-inner">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 text-6xl mx-auto mb-8">
                   <i className="fa-solid fa-prescription-bottle-medical"></i>
                </div>
                <p className="text-slate-500 font-black text-2xl tracking-tight mb-2">Your schedule is clear</p>
                <p className="text-slate-400 font-bold max-w-xs mx-auto text-sm leading-relaxed">No medications scheduled for today. Add a new prescription to start tracking.</p>
                {user.role === 'Guardian' && (
                  <button onClick={() => setIsAdding(true)} className="mt-8 text-blue-600 font-black uppercase text-[10px] tracking-widest hover:text-blue-800 transition-colors">
                     + Let's add the first dose
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Enhanced Settings View */
        <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
          <div className="flex items-center gap-5 mb-10">
            <button onClick={() => setView('dashboard')} className="hit-area w-12 h-12 bg-white rounded-2xl border border-slate-100 flex items-center justify-center text-slate-400 hover:text-[#1e3a8a] transition-all active:scale-90">
               <i className="fa-solid fa-arrow-left"></i>
            </button>
            <h2 className="text-3xl font-black text-[#1e3a8a]">Account Settings</h2>
          </div>

          <form onSubmit={handleUpdateSettings} className="space-y-6">
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8 sm:p-10 space-y-8">
              {settingsError && (
                <div className="p-4 bg-rose-50 text-rose-600 text-xs font-black rounded-2xl border border-rose-100 text-center uppercase tracking-widest">
                  {settingsError}
                </div>
              )}
              {settingsSuccess && (
                <div className="p-4 bg-emerald-50 text-emerald-600 text-xs font-black rounded-2xl border border-emerald-100 text-center uppercase tracking-widest">
                  {settingsSuccess}
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-8 pb-4">
                 <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
                    <div className="w-24 h-24 bg-slate-50 rounded-[2rem] border-2 border-slate-100 flex items-center justify-center text-slate-300 text-4xl overflow-hidden shadow-inner transition-all group-hover:border-blue-400 group-hover:bg-slate-100">
                       {newAvatar ? <img src={newAvatar} className="w-full h-full object-cover" /> : <i className="fa-solid fa-user"></i>}
                       <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <i className="fa-solid fa-plus text-white text-sm"></i>
                       </div>
                    </div>
                    <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-xl text-white flex items-center justify-center shadow-lg border-2 border-white">
                       <i className="fa-solid fa-camera text-xs"></i>
                    </div>
                    <input 
                      type="file" 
                      ref={avatarInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleAvatarChange} 
                    />
                 </div>
                 <div className="flex-grow space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Profile Picture</label>
                    <p className="text-[11px] font-bold text-slate-600 leading-tight">Tap the icon to upload a personal photo. This helps family recognize you in logs.</p>
                    {newAvatar && (
                      <button type="button" onClick={() => setNewAvatar('')} className="text-rose-500 text-[10px] font-black uppercase tracking-widest hover:text-rose-600 transition-colors mt-1">Reset to Default</button>
                    )}
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Username</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-900 placeholder-slate-300"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                  <input
                    type="email"
                    required
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-900 placeholder-slate-300"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-8 border-t border-slate-50 space-y-6">
                <p className="text-[11px] font-black text-[#1e3a8a] uppercase tracking-[0.2em]">Changes Configuration</p>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Current Password</label>
                    <input
                      type="password"
                      required
                      className="w-full bg-slate-50 border border-rose-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-rose-300 transition-all text-slate-900 placeholder-slate-300"
                      placeholder="Required to authorize changes"
                      value={currentPass}
                      onChange={(e) => setCurrentPass(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password (Optional)</label>
                    <input
                      type="password"
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-900 placeholder-slate-300"
                      placeholder="Leave blank to keep current password"
                      value={newPass}
                      onChange={(e) => setNewPass(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingSettings}
                className={`w-full bg-blue-600 text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-blue-100 transition transform active:scale-95 uppercase tracking-widest text-[11px] flex items-center justify-center gap-3 ${isSavingSettings ? 'opacity-70' : ''}`}
              >
                {isSavingSettings && <i className="fa-solid fa-circle-notch animate-spin"></i>}
                {isSavingSettings ? 'Securing Changes...' : 'Save Changes'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
               <button 
                  type="button"
                  onClick={handleSignOut}
                  className="flex-1 bg-white border border-slate-100 text-slate-500 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-sm hover:bg-slate-50 transition-all active:scale-95"
               >
                  Sign Out
               </button>
               <button 
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all active:scale-95 text-slate-400 hover:text-rose-600 bg-transparent border-none"
               >
                  Delete Account
               </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Account Safety Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-[#1e3a8a]/60 backdrop-blur-md flex items-center justify-center p-6 z-[100] animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-300 border border-slate-200">
            <div className="p-8 text-center">
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6 shadow-sm border border-rose-100">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Permanent Deletion</h2>
              <p className="text-slate-500 text-xs font-bold leading-relaxed mb-8">
                This will permanently erase your medication history, family links, and care logs. 
                This action <span className="text-rose-600">cannot be undone</span>.
              </p>
              
              <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 mb-8">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">
                  Type your name to confirm: <br/>
                  <span className="text-[#1e3a8a] text-xs lowercase opacity-100 font-black">{user?.name}</span>
                </p>
                <input
                  type="text"
                  autoFocus
                  className="w-full bg-white border border-slate-200 rounded-xl p-4 text-center font-black text-[#1e3a8a] outline-none focus:border-rose-600 transition-all shadow-inner"
                  placeholder="Enter Name"
                  value={deleteInput}
                  onChange={(e) => setDeleteInput(e.target.value)}
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={() => { setShowDeleteModal(false); setDeleteInput(''); }}
                  className="flex-1 py-4 rounded-2xl font-black text-[10px] text-slate-400 uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  Go Back
                </button>
                <button
                  disabled={deleteInput !== user?.name}
                  onClick={confirmDeleteAccount}
                  className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                    deleteInput === user?.name 
                      ? 'bg-rose-600 text-white shadow-xl shadow-rose-100 hover:bg-rose-700 active:scale-95' 
                      : 'bg-slate-100 text-slate-300 cursor-not-allowed opacity-50'
                  }`}
                >
                  Delete Forever
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showScrollTop && (
        <button 
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 w-14 h-14 bg-[#1e3a8a] text-white rounded-[1.25rem] shadow-2xl flex items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-300 z-50 hover:bg-blue-600 transition-all transform active:scale-90 border-4 border-white"
          aria-label="Back to top"
        >
          <i className="fa-solid fa-arrow-up text-xl"></i>
        </button>
      )}

      <footer className="mt-24 pb-24 text-center">
        <div className="flex items-center justify-center gap-3 text-slate-300 mb-4 opacity-40">
           <div className="h-[1px] w-8 bg-slate-200"></div>
           <i className="fa-solid fa-staff-snake"></i>
           <div className="h-[1px] w-8 bg-slate-200"></div>
        </div>
        <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.5em] opacity-40">
          MedPromptly @2026
        </p>
        <p className="text-slate-300 text-[9px] font-bold mt-2 uppercase opacity-40 tracking-widest">
          Version 1.0 &middot; Created by Beverly
        </p>
      </footer>

      {(isAdding || editingMed) && (
        <AddMedicationForm 
          onClose={handleCloseForm} 
          user={user} 
          initialMed={editingMed || undefined} 
        />
      )}
    </div>
  );
};

export default App;