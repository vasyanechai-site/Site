import { useState, useEffect } from 'react';
import { Logo } from './Logo';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { LogOut } from 'lucide-react';
import { AdminDashboard } from './AdminDashboard';
import { AdminPromoCodes } from './AdminPromoCodes';
import { UserManagement } from './UserManagement';
import { OrdersManagement } from './OrdersManagement';
import { PriceManagement } from './PriceManagement';
import { DataExport } from './DataExport';
import { DataImport } from './DataImport';
import { DatabaseHealthCheck } from './DatabaseHealthCheck';
import { TickerManagement } from './TickerManagement';
import { RetailProductsManagement } from './RetailProductsManagement';
import { RetailOrdersManagement } from './RetailOrdersManagement';
import { RetailDashboard } from './RetailDashboard';
import { DeleteSpecificOrdersButton } from './DeleteSpecificOrdersButton';
import { DiagnosticOrdersButton } from './DiagnosticOrdersButton';
import { DatabaseKeysViewer } from './DatabaseKeysViewer';
import { RegistrationRequests } from './RegistrationRequests';
import { TelegramBroadcast } from './TelegramBroadcast';
import { EncodingLogsViewer } from './EncodingLogsViewer';
import { RetailUsersPage } from './admin/RetailUsersPage';
import { RetailCoverConstructor } from './admin/RetailCoverConstructor';
import { RetailLocationsManagement } from './admin/RetailLocationsManagement';
import { PricePdfExport } from './admin/PricePdfExport';
import { AgentsManagement, AgentTopWidget } from './admin/AgentsManagement';
import type { CoffeeItem } from '../types';
import { fetchCoffeeItems } from '../lib/api';
import { FadeIn } from './ui/fade-in';

interface AdminPanelProps {
  onLogout: () => void;
  onNavigateToRetail?: () => void;
}

export function AdminPanel({ onLogout, onNavigateToRetail }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [section, setSection] = useState<'wholesale' | 'retail'>('wholesale');
  const [coffeeItems, setCoffeeItems] = useState<CoffeeItem[]>([]);

  useEffect(() => {
    loadCoffeeItems();
  }, []);

  const loadCoffeeItems = async () => {
    try {
      const items = await fetchCoffeeItems();
      setCoffeeItems(items);
    } catch (error) {
      console.error('Failed to load coffee items:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        <FadeIn duration={0.4} yOffset={10}>
          <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between">
            <Logo onClick={() => {
              setSection('wholesale');
              setActiveTab('dashboard');
            }} />
            <div className="flex items-center gap-2">
              <PricePdfExport />
              {onNavigateToRetail && (
                <Button 
                  variant="ghost"
                  onClick={onNavigateToRetail}
                  className="text-sm"
                >
                  Розница
                </Button>
              )}
              <Button 
                variant="outline"
                onClick={onLogout}
                className="flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Выйти</span>
              </Button>
            </div>
          </div>
        </FadeIn>
      </header>

      {/* Content */}
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-8">
        {/* Section Selector */}
        <FadeIn delay={0.1} yOffset={10}>
          <div className="mb-6 flex gap-2">
            <Button 
              variant={section === 'wholesale' ? 'default' : 'outline'}
              onClick={() => setSection('wholesale')}
            >
              Опт
            </Button>
            <Button 
              variant={section === 'retail' ? 'default' : 'outline'}
              onClick={() => setSection('retail')}
            >
              Розница
            </Button>
          </div>
        </FadeIn>

        {section === 'wholesale' ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <FadeIn delay={0.2} yOffset={10}>
              <div className="mb-8 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <TabsList className="w-max sm:w-auto">
                  <TabsTrigger value="dashboard">Дашборд</TabsTrigger>
                  <TabsTrigger value="agents">Агенты</TabsTrigger>
                  <TabsTrigger value="price">Прайс</TabsTrigger>
                  <TabsTrigger value="orders">Заказы</TabsTrigger>
                  <TabsTrigger value="users">Пользователи</TabsTrigger>
                  <TabsTrigger value="promo">Промокоды</TabsTrigger>
                  <TabsTrigger value="ticker">Бегущая строка</TabsTrigger>
                  <TabsTrigger value="broadcast">Рассылка</TabsTrigger>
                  <TabsTrigger value="export">Экспорт</TabsTrigger>
                  <TabsTrigger value="import">Импорт</TabsTrigger>
                  <TabsTrigger value="health">Здоровье БД</TabsTrigger>
                  <TabsTrigger value="encoding">Кодировка</TabsTrigger>
                </TabsList>
              </div>
            </FadeIn>

            <div key={activeTab}>
              <TabsContent value="dashboard">
                <AdminDashboard />
                <div className="mt-6">
                  <AgentTopWidget />
                </div>
              </TabsContent>

              <TabsContent value="agents">
                <AgentsManagement />
              </TabsContent>

              <TabsContent value="price">
                <PriceManagement />
              </TabsContent>

              <TabsContent value="orders">
                <OrdersManagement coffeeItems={coffeeItems} />
              </TabsContent>

              <TabsContent value="users">
                <UserManagement />
              </TabsContent>

              <TabsContent value="promo">
                <AdminPromoCodes />
              </TabsContent>

              <TabsContent value="ticker">
                <TickerManagement />
              </TabsContent>

              <TabsContent value="broadcast">
                <TelegramBroadcast />
              </TabsContent>

              <TabsContent value="export">
                <DataExport />
              </TabsContent>

              <TabsContent value="import">
                <DataImport />
              </TabsContent>

              <TabsContent value="health">
                <DatabaseHealthCheck />
              </TabsContent>

              <TabsContent value="encoding">
                <EncodingLogsViewer />
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <FadeIn delay={0.2} yOffset={10}>
              <div className="mb-8 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                <TabsList className="w-max sm:w-auto">
                  <TabsTrigger value="dashboard">Статистика</TabsTrigger>
                  <TabsTrigger value="products">Товары</TabsTrigger>
                  <TabsTrigger value="orders">Заказы</TabsTrigger>
                  <TabsTrigger value="users">Пользователи</TabsTrigger>
                  <TabsTrigger value="covers">Обложки</TabsTrigger>
                  <TabsTrigger value="locations">Карта</TabsTrigger>
                  <TabsTrigger value="ticker">Бегущая строка</TabsTrigger>
                </TabsList>
              </div>
            </FadeIn>

            <div key={activeTab}>
              <TabsContent value="dashboard">
                <RetailDashboard />
              </TabsContent>
              
              <TabsContent value="products">
                <RetailProductsManagement />
              </TabsContent>

              <TabsContent value="orders">
                <RetailOrdersManagement />
              </TabsContent>

              <TabsContent value="users">
                <RetailUsersPage />
              </TabsContent>

              <TabsContent value="covers">
                <RetailCoverConstructor />
              </TabsContent>

              <TabsContent value="locations">
                <RetailLocationsManagement />
              </TabsContent>

              <TabsContent value="ticker">
                <TickerManagement variant="retail" />
              </TabsContent>
            </div>
          </Tabs>
        )}
      </div>
    </div>
  );
}