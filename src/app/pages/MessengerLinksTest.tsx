import { MessengerLinkDemo } from '../components/MessengerLinkDemo';

/**
 * Страница для тестирования функциональности генерации ссылок на мессенджеры
 * Доступна по адресу: /messenger-test
 */
export default function MessengerLinksTest() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FFF4E5' }}>
      <MessengerLinkDemo />
    </div>
  );
}
