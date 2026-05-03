import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { Logo } from '../Logo';

/** Раньше: подтверждение email через Supabase. Регистрация розницы теперь сразу активна на сервере. */
export function ConfirmPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-[#FFF4E5] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-[420px] bg-white p-8 md:p-12 shadow-none text-center">
        <div className="mb-8">
          <Logo className="h-10 w-auto mx-auto mb-6 cursor-pointer" onClick={() => navigate('/')} />
          <h1 className="text-2xl font-normal text-[#222222] tracking-tight">Аккаунт</h1>
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm">Загрузка…</p>
        ) : (
          <div className="space-y-6">
            <div className="bg-[#FFF4E5] text-[#222222] p-4 text-sm border border-[#222222]/10 rounded-md">
              Регистрация на сайте подтверждается автоматически. Войдите с email и паролем.
            </div>
            <Button
              className="w-full bg-[#FF90A1] hover:bg-[#FF8095] text-white h-12 text-base font-medium shadow-none transition-colors"
              onClick={() => navigate('/login')}
            >
              Перейти ко входу
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
