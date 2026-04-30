// Backup management service
import * as kv from './kv_store.tsx';

const BACKUP_PREFIX = 'backup:';
const BACKUP_SCHEDULE_KEY = 'backup_schedule';
const COFFEE_ITEMS_KEY = 'nechai_coffee_items';
const ORDERS_PREFIX = 'nechai_order_';
const USERS_PREFIX = 'nechai_user_';
const PROMO_PREFIX = 'nechai_promo_';
const EXCHANGE_RATE_KEY = 'nechai_exchange_rate';
const USER_SETTINGS_PREFIX = 'nechai_user_settings_';

export interface BackupData {
  timestamp: string;
  version: string;
  coffeeItems: any[];
  orders: any[];
  users: any[];
  promoCodes: any[];
  exchangeRate: any;
  userSettings: any[];
}

export interface BackupSchedule {
  lastBackup: string;
  nextBackup: string;
  intervalDays: number;
}

// Создать полный бэкап всех данных
export async function createFullBackup(): Promise<BackupData> {
  console.log('Creating full backup...');

  // Получаем все данные
  const [coffeeItems, orders, users, promoCodes, exchangeRate, userSettings] = await Promise.all([
    kv.get(COFFEE_ITEMS_KEY),
    kv.getByPrefix(ORDERS_PREFIX),
    kv.getByPrefix(USERS_PREFIX),
    kv.getByPrefix(PROMO_PREFIX),
    kv.get(EXCHANGE_RATE_KEY),
    kv.getByPrefix(USER_SETTINGS_PREFIX),
  ]);

  const backup: BackupData = {
    timestamp: new Date().toISOString(),
    version: '1.0',
    coffeeItems: coffeeItems || [],
    orders: orders || [],
    users: (users || []).map((user: any) => {
      // Удаляем пароли из бэкапа по соображениям безопасности
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }),
    promoCodes: promoCodes || [],
    exchangeRate: exchangeRate || null,
    userSettings: userSettings || [],
  };

  console.log('Backup created:', {
    coffeeItems: backup.coffeeItems.length,
    orders: backup.orders.length,
    users: backup.users.length,
    promoCodes: backup.promoCodes.length,
    userSettings: backup.userSettings.length,
  });

  return backup;
}

// Сохранить бэкап в базу данных
export async function saveBackup(backup: BackupData): Promise<string> {
  const backupId = `${BACKUP_PREFIX}${Date.now()}`;
  await kv.set(backupId, backup);
  console.log('Backup saved to database:', backupId);
  return backupId;
}

// Получить все бэкапы
export async function getAllBackups(): Promise<Array<{ id: string; data: BackupData }>> {
  const backups = await kv.getByPrefix(BACKUP_PREFIX);
  return backups.map((backup: any) => ({
    id: backup.key || backup.id || 'unknown',
    data: backup,
  }));
}

// Получить последний бэкап
export async function getLatestBackup(): Promise<BackupData | null> {
  const backups = await getAllBackups();
  if (backups.length === 0) return null;
  
  // Сортируем по timestamp
  backups.sort((a, b) => 
    new Date(b.data.timestamp).getTime() - new Date(a.data.timestamp).getTime()
  );
  
  return backups[0].data;
}

// Восстановить данные из бэкапа
export async function restoreFromBackup(backup: BackupData): Promise<void> {
  console.log('Restoring from backup...');

  // Восстанавливаем курс
  if (backup.exchangeRate) {
    await kv.set(EXCHANGE_RATE_KEY, backup.exchangeRate);
  }

  // Восстанавливаем товары
  if (backup.coffeeItems && backup.coffeeItems.length > 0) {
    await kv.set(COFFEE_ITEMS_KEY, backup.coffeeItems);
  }

  // Восстанавливаем заказы
  if (backup.orders && backup.orders.length > 0) {
    for (const order of backup.orders) {
      const orderId = order.id || order.orderId;
      if (orderId) {
        await kv.set(`${ORDERS_PREFIX}${orderId}`, order);
      }
    }
  }

  // Восстанавливаем пользователей (без паролей - они не сохранялись)
  if (backup.users && backup.users.length > 0) {
    for (const user of backup.users) {
      const userId = user.id || user.userId;
      if (userId) {
        // Устанавливаем временный пароль для восстановленных пользователей
        const userWithPassword = {
          ...user,
          password: 'changeme123', // Пользователю нужно будет сменить пароль
        };
        await kv.set(`${USERS_PREFIX}${userId}`, userWithPassword);
      }
    }
  }

  // Восстанавливаем промокоды
  if (backup.promoCodes && backup.promoCodes.length > 0) {
    for (const promo of backup.promoCodes) {
      const code = promo.code;
      if (code) {
        await kv.set(`${PROMO_PREFIX}${code.toUpperCase()}`, promo);
      }
    }
  }

  // Восстанавливаем настройки пользователей
  if (backup.userSettings && backup.userSettings.length > 0) {
    for (const settings of backup.userSettings) {
      // Ключ должен быть в формате user_settings:userId
      const key = settings.key || `${USER_SETTINGS_PREFIX}${settings.userId}`;
      if (key.startsWith(USER_SETTINGS_PREFIX)) {
        await kv.set(key, settings);
      }
    }
  }

  console.log('Backup restored successfully');
}

// Получить расписание бэкапов
export async function getBackupSchedule(): Promise<BackupSchedule | null> {
  return await kv.get(BACKUP_SCHEDULE_KEY);
}

// Обновить расписание бэкапов
export async function updateBackupSchedule(intervalDays: number = 3): Promise<BackupSchedule> {
  const now = new Date();
  const nextBackup = new Date(now.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  
  const schedule: BackupSchedule = {
    lastBackup: now.toISOString(),
    nextBackup: nextBackup.toISOString(),
    intervalDays,
  };
  
  await kv.set(BACKUP_SCHEDULE_KEY, schedule);
  return schedule;
}

// Проверить, нужно ли выполнить автоматический бэкап
export async function shouldRunScheduledBackup(): Promise<boolean> {
  const schedule = await getBackupSchedule();
  
  if (!schedule) {
    // Если расписание не установлено, создаем первый бэкап
    return true;
  }
  
  const now = new Date();
  const nextBackupDate = new Date(schedule.nextBackup);
  
  return now >= nextBackupDate;
}

// Очистить старые бэкапы (оставить только последние N)
export async function cleanOldBackups(keepCount: number = 30): Promise<void> {
  const backups = await getAllBackups();
  
  if (backups.length <= keepCount) {
    return; // Не нужно ничего удалять
  }
  
  // Сортируем по дате (новые первыми)
  backups.sort((a, b) => 
    new Date(b.data.timestamp).getTime() - new Date(a.data.timestamp).getTime()
  );
  
  // Удаляем старые бэкапы
  const toDelete = backups.slice(keepCount);
  const keysToDelete = toDelete.map(b => b.id);
  
  if (keysToDelete.length > 0) {
    await kv.mdel(keysToDelete);
    console.log(`Cleaned ${keysToDelete.length} old backups`);
  }
}