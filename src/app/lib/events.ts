// Простая система событий для коммуникации между компонентами
type EventCallback = () => void;

class EventBus {
  private events: Map<string, EventCallback[]> = new Map();

  on(event: string, callback: EventCallback) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event)!.push(callback);
  }

  off(event: string, callback: EventCallback) {
    const callbacks = this.events.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event: string) {
    const callbacks = this.events.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback());
    }
  }
}

export const eventBus = new EventBus();

// События
export const EVENTS = {
  ORDERS_UPDATED: 'orders:updated',
  RETAIL_ORDERS_UPDATED: 'retail_orders:updated',
  REGISTRATIONS_UPDATED: 'registrations:updated',
};
