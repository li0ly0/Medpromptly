
import React, { useState } from 'react';
import { storage } from '../services/storage';
import { User, UserRole } from '../types';
import { hashPassword } from '../services/crypto';

type AuthMode = 'login' | 'signup' | 'forgot';

export const Auth: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [role, setRole] = useState<UserRole>('Patient');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [patientCode, setPatientCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generatePatientCode = () => {
    return 'MG-' + Math.floor(100000 + Math.random() * 900000);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    
    try {
      const hashedPassword = await hashPassword(password);
      const users = await storage.getUsers();

      if (mode === 'login') {
        const user = users.find(u => u.email === email && u.password === hashedPassword);
        if (user) {
          storage.setCurrentUser(user.id);
        } else {
          setError('Incorrect email or password');
        }
      } else if (mode === 'signup') {
        if (users.find(u => u.email === email)) {
          setError('Email is already in use');
          return;
        }

        let newUser: User = {
          id: Math.random().toString(36).substr(2, 9),
          name,
          email,
          password: hashedPassword,
          role,
        };

        if (role === 'Patient') {
          newUser.patientCode = generatePatientCode();
        } else {
          const patient = users.find(u => u.role === 'Patient' && u.patientCode === patientCode);
          if (!patient) {
            setError('Invalid Care Code. Please check with the patient.');
            return;
          }
          newUser.linkedPatientId = patient.id;
        }

        await storage.saveUser(newUser);
        storage.setCurrentUser(newUser.id);
      } else if (mode === 'forgot') {
        const user = users.find(u => u.email === email);
        if (!user) {
          setError('Account not found');
          return;
        }
        
        await storage.updateUser(user.id, { password: hashedPassword });
        setSuccess('Password updated successfully! Sign in now.');
        setMode('login');
      }
    } catch (err) {
      setError('Connection failed. Please check your internet.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#f1f5f9]">
      <div className="bg-white p-8 sm:p-10 rounded-[2.5rem] shadow-2xl w-full max-w-lg border border-slate-100">
        <div className="text-center mb-8">
          <div className="bg-blue-600 w-16 h-16 rounded-3xl flex items-center justify-center text-white shadow-xl mx-auto mb-4">
            <i className="fa-solid fa-staff-snake text-3xl"></i>
          </div>
          <h1 className="text-3xl font-black text-[#1e3a8a] tracking-tight">MedPromptly</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.2em] mt-2">
            {mode === 'login' ? 'Sign in to your care' : mode === 'signup' ? 'Create a family account' : 'Reset password'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 text-rose-600 text-xs font-bold rounded-2xl border border-rose-100 text-center uppercase tracking-widest animate-in fade-in duration-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-2xl border border-emerald-100 text-center uppercase tracking-widest">
            {success}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-6">
          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-4 mb-8">
              <button
                type="button"
                onClick={() => setRole('Patient')}
                className={`flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all ${role === 'Patient' ? 'bg-blue-50 border-blue-600 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
              >
                <i className="fa-solid fa-user-injured text-2xl mb-2"></i>
                <span className="text-[10px] font-black uppercase tracking-widest">Patient</span>
              </button>
              <button
                type="button"
                onClick={() => setRole('Guardian')}
                className={`flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all ${role === 'Guardian' ? 'bg-blue-50 border-blue-600 text-blue-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
              >
                <i className="fa-solid fa-user-shield text-2xl mb-2"></i>
                <span className="text-[10px] font-black uppercase tracking-widest">Guardian</span>
              </button>
            </div>
          )}

          <div className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Username</label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-900 placeholder-slate-300"
                  placeholder="beverly_care"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Email Address</label>
              <input
                type="email"
                required
                disabled={isSubmitting}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-900 placeholder-slate-300"
                placeholder="beverly@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={isSubmitting}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-blue-600 focus:bg-white transition-all text-slate-900 placeholder-slate-300"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 bottom-4 text-slate-400 hover:text-blue-600 transition-colors"
              >
                <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>

            {mode === 'signup' && role === 'Guardian' && (
              <div>
                <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest ml-2 mb-1 block">Patient's Care Code</label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  className="w-full bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm font-mono font-black text-blue-600 outline-none placeholder-blue-200"
                  placeholder="MG-123456"
                  value={patientCode}
                  onChange={(e) => setPatientCode(e.target.value.toUpperCase())}
                />
                <p className="text-[9px] text-blue-400 mt-2 ml-2 font-medium italic">Ask the patient for their 6-digit MG code.</p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-blue-100 transition transform active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-3 ${isSubmitting ? 'opacity-70' : ''}`}
          >
            {isSubmitting ? <i className="fa-solid fa-circle-notch animate-spin text-lg"></i> : null}
            {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Update Password'}
          </button>
        </form>

        <div className="mt-8 flex flex-col items-center gap-4 border-t border-slate-50 pt-8">
          <button
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
              setSuccess('');
            }}
            disabled={isSubmitting}
            className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] hover:text-blue-600 transition-colors"
          >
            {mode === 'login' ? "New to MedPromptly? Create account" : 'Already have an account? Sign In'}
          </button>
          {mode === 'login' && (
            <button
              onClick={() => setMode('forgot')}
              className="text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-rose-500 transition-colors"
            >
              Forgot Password?
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
