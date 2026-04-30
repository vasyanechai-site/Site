import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { Logo } from '../Logo';
import { Loader2 } from 'lucide-react';

export function ConfirmPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase automatically handles the hash in the URL when the client is initialized.
    // We just need to check if we have a session.
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (session) {
          toast.success('Email успешно подтвержден!');
          // Redirect to dashboard or login
        } else {
          // Sometimes the session isn't immediately available if the hash is consumed but not yet set
          // Or if the link is invalid/expired.
          // We can listen for the auth state change.
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    // Listen for auth state changes (this is where the email link verification happens)
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setLoading(false);
      }
    });

    checkSession();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#FFF4E5] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-[420px] bg-white p-8 md:p-12 shadow-none text-center">
        <div className="mb-8">
          <Logo className="h-10 w-auto mx-auto mb-6 cursor-pointer" onClick={() => navigate('/')} />
          <h1 className="text-2xl font-normal text-[#222222] tracking-tight">Подтверждение почты</h1>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF90A1] mb-4" />
            <p className="text-gray-500">Проверка ссылки...</p>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="bg-red-50 text-red-500 p-4 text-sm font-medium border border-red-100 rounded-md">
              Ошибка: {error}
            </div>
            <Button 
              onClick={() => navigate('/login')} 
              variant="outline"
              className="w-full h-12 border-2 border-[#E5E5E5] text-gray-700 hover:bg-gray-50 font-medium"
            >
              Вернуться ко входу
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-green-50 text-green-700 p-4 text-sm font-medium border border-green-100 rounded-md">
              Ваша почта успешно подтверждена!
            </div>
            <Button 
              className="w-full bg-[#FF90A1] hover:bg-[#FF8095] text-white h-12 text-base font-medium shadow-none transition-colors"
              onClick={() => navigate('/dashboard')}
            >
              Перейти в личный кабинет
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
