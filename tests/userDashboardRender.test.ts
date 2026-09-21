import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { UserDashboard } from '../src/app/components/UserDashboard';

describe('UserDashboard render', () => {
  it('opens the statistics screen instead of crashing', () => {
    const html = renderToString(
      React.createElement(UserDashboard, { userId: 'user-test', currentDiscount: 0 }),
    );
    expect(html).toContain('Загрузка статистики');
  });
});
