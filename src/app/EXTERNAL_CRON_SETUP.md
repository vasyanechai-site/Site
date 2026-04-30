name: Check Payment Statuses

on:
  schedule:
    # Запускать каждые 5 минут
    - cron: '*/5 * * * *'
  
  # Возможность запустить вручную
  workflow_dispatch:

jobs:
  check-payments:
    runs-on: ubuntu-latest
    
    steps:
      - name: Check pending payments
        run: |
          curl -X POST \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json" \
            https://${{ secrets.SUPABASE_PROJECT_ID }}.supabase.co/functions/v1/make-server-aa167a09/retail/check-pending-payments
