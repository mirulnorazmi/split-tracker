import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email address...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid or missing verification token.');
      return;
    }

    const verify = async () => {
      try {
        const res = await api.verifyEmail(token);
        setStatus('success');
        setMessage(res.message || 'Your email address has been verified successfully!');
      } catch (err: any) {
        setStatus('error');
        setMessage(err?.message || 'Failed to verify email address. The link may have expired.');
      }
    };

    verify();
  }, [token]);

  return (
    <div className="max-w-md mx-auto mt-20 p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl text-center animate-in fade-in zoom-in duration-500">
      {status === 'loading' && (
        <div className="flex flex-col items-center">
          <Loader2 className="w-16 h-16 text-accent animate-spin mb-6" />
          <h2 className="text-xl font-medium text-white mb-2">Verifying...</h2>
          <p className="text-zinc-400">{message}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-6">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-medium text-white mb-2">Verification Complete</h2>
          <p className="text-zinc-400 mb-8">{message}</p>
          <Link
            to="/dashboard"
            className="w-full flex items-center justify-center gap-2 py-3 bg-accent text-accent-text font-bold rounded-lg hover:opacity-90 transition-opacity"
          >
            Go to Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-6">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-medium text-white mb-2">Verification Failed</h2>
          <p className="text-zinc-400 mb-8">{message}</p>
          <Link
            to="/profile"
            className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-800 text-white font-medium rounded-lg hover:bg-zinc-700 transition-colors"
          >
            Return to Profile
          </Link>
        </div>
      )}
    </div>
  );
}
