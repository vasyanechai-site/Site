# 🚀 Пошаговая инструкция: Как подключить GitHub репозиторий

Эта инструкция поможет вам с нуля создать Git репозиторий и загрузить ваш проект на GitHub.

---

## Часть 1: Установка Git (если еще не установлен)

### Windows:
1. Скачайте Git с https://git-scm.com/download/win
2. Запустите установщик и нажимайте "Next" (настройки по умолчанию подходят)
3. После установки откройте **Git Bash** (появится в меню Пуск)

### macOS:
```bash
# Установка через Homebrew (если есть)
brew install git

# Или через Xcode Command Line Tools
xcode-select --install
```

### Linux:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install git

# Fedora
sudo dnf install git
```

### Проверка установки:
```bash
git --version
# Должно вывести: git version 2.x.x
```

---

## Часть 2: Настройка Git (первый раз)

Откройте терминал (Git Bash на Windows) и выполните:

```bash
# Укажите ваше имя (будет видно в истории коммитов)
git config --global user.name "Ваше Имя"

# Укажите email (желательно тот же, что на GitHub)
git config --global user.email "your.email@example.com"

# Проверка настроек
git config --list
```

---

## Часть 3: Создание аккаунта на GitHub

1. Перейдите на https://github.com/signup
2. Зарегистрируйтесь (бесплатно):
   - Укажите email
   - Придумайте пароль
   - Выберите username (например: `nechai-coffee`)
3. Подтвердите email адрес (письмо придет на почту)
4. Войдите в аккаунт: https://github.com/login

---

## Часть 4: Создание репозитория на GitHub

### Способ 1: Через веб-интерфейс (рекомендуется для новичков)

1. **Войдите на GitHub.com**

2. **Создайте новый репозиторий:**
   - Нажмите **"+"** в правом верхнем углу → **"New repository"**
   - Или перейдите напрямую: https://github.com/new

3. **Заполните форму:**
   - **Repository name:** `nechai-coffee` (или любое другое имя)
   - **Description:** `Современный B2B сервис для оптовых заказов кофе`
   - **Public/Private:** Выберите **Private** (рекомендуется для бизнеса)
   - ❌ **НЕ ставьте галочки** на "Add README", "Add .gitignore", "Choose a license"
     (у нас уже есть эти файлы!)

4. **Нажмите "Create repository"**

5. **Скопируйте URL репозитория:**
   - После создания увидите страницу с инструкциями
   - Скопируйте URL типа: `https://github.com/ваш-username/nechai-coffee.git`

---

## Часть 5: Подключение локального проекта к GitHub

### Откройте терминал в папке с вашим проектом

**Windows (Git Bash):**
```bash
cd /c/Users/ВашеИмя/путь/к/проекту/nechai-coffee
```

**macOS/Linux:**
```bash
cd ~/путь/к/проекту/nechai-coffee
```

**Или в VS Code:**
- Откройте папку проекта в VS Code
- Нажмите `Ctrl + ` (или `View → Terminal`)
- Терминал откроется сразу в нужной папке

---

### Шаг 1: Инициализация Git репозитория

```bash
# Инициализировать Git в текущей папке
git init

# Должно вывести: Initialized empty Git repository in ...
```

---

### Шаг 2: Добавление всех файлов в Git

```bash
# Добавить все файлы проекта
git add .

# Точка означает "все файлы в текущей папке и подпапках"
```

---

### Шаг 3: Первый коммит

```bash
# Создать первый коммит (сохранение всех изменений)
git commit -m "Initial commit: Nechai Coffee B2B сервис с keep-alive"

# Должно показать количество добавленных файлов
```

---

### Шаг 4: Переименование ветки в main (если нужно)

```bash
# Современный стандарт - ветка называется "main", а не "master"
git branch -M main
```

---

### Шаг 5: Подключение к GitHub

```bash
# Замените URL на ваш (скопированный из GitHub)
git remote add origin https://github.com/ваш-username/nechai-coffee.git

# Проверка подключения
git remote -v
# Должно показать URL вашего репозитория
```

---

### Шаг 6: Загрузка кода на GitHub

```bash
# Загрузить все файлы на GitHub
git push -u origin main
```

**Если попросит авторизацию:**

#### Современный способ (Personal Access Token):

1. На GitHub: **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**
2. Нажмите **"Generate new token (classic)"**
3. Выберите срок действия: **"No expiration"** (или 1 год)
4. Поставьте галочку: **✓ repo** (полный доступ к репозиториям)
5. Нажмите **"Generate token"**
6. **СКОПИРУЙТЕ токен!** (показывается только один раз)
7. При запросе пароля в терминале вставьте этот токен вместо пароля

#### Сохранение токена (чтобы не вводить каждый раз):

**Windows:**
```bash
git config --global credential.helper wincred
```

**macOS:**
```bash
git config --global credential.helper osxkeychain
```

**Linux:**
```bash
git config --global credential.helper store
```

---

### Шаг 7: Проверка загрузки

1. Обновите страницу вашего репозитория на GitHub
2. Вы должны увидеть все файлы проекта!
3. Структура папок, README.md, весь код - всё на месте

---

## Часть 6: Активация GitHub Actions

### Шаг 1: Перейдите на вкладку Actions

1. Откройте ваш репозиторий на GitHub
2. Кликните на вкладку **"Actions"** (вверху страницы)
3. Если увидите кнопку **"I understand my workflows, go ahead and enable them"** - нажмите её

### Шаг 2: Первый тестовый запуск

1. В списке workflows слева найдите **"Database Keep-Alive"**
2. Кликните на него
3. Справа нажмите кнопку **"Run workflow"**
4. Выберите ветку **"main"**
5. Нажмите зелёную кнопку **"Run workflow"**

### Шаг 3: Проверка результата

1. Через 10-15 секунд появится новый запуск workflow
2. Кликните на него
3. Кликните на job **"keep-alive"**
4. Раскройте шаг **"Ping Supabase Database"**
5. Должны увидеть:
   ```
   HTTP Status: 200
   Response: {"status":"ok",...}
   ✅ База данных активна
   ```

**Готово!** Теперь GitHub Actions будет автоматически пинговать вашу базу данных каждые 5 дней.

---

## Часть 7: Ежедневная работа с Git

### Когда вы вносите изменения в код:

```bash
# 1. Проверить какие файлы изменились
git status

# 2. Добавить все изменения
git add .

# 3. Создать коммит с описанием изменений
git commit -m "Описание того, что вы изменили"

# 4. Загрузить изменения на GitHub
git push
```

### Пример:

```bash
git add .
git commit -m "Добавил фильтр по категориям кофе"
git push
```

---

## Часть 8: Полезные команды Git

```bash
# Посмотреть историю коммитов
git log

# Посмотреть краткую историю (более читаемо)
git log --oneline

# Посмотреть изменения в файлах (до коммита)
git diff

# Посмотреть статус файлов
git status

# Отменить изменения в файле (осторожно!)
git checkout -- имя_файла.tsx

# Посмотреть удалённые репозитории
git remote -v
```

---

## Часть 9: Работа из VS Code (альтернатива терминалу)

### VS Code имеет встроенный Git интерфейс:

1. **Открыть Git панель:**
   - Нажмите иконку ветки слева (Source Control)
   - Или нажмите `Ctrl + Shift + G`

2. **Сделать коммит:**
   - Увидите список изменённых файлов
   - Нажмите **"+"** рядом с файлами (или возле "Changes" для всех файлов)
   - Введите сообщение коммита вверху
   - Нажмите **✓ Commit**

3. **Загрузить на GitHub:**
   - Нажмите **"..."** (три точки) → **"Push"**
   - Или нажмите кнопку синхронизации (↻) внизу

---

## Часть 10: Приватный репозиторий - кто видит код?

### Если выбрали Private:
- ✅ Код видите только вы
- ✅ Можете добавить конкретных людей (Settings → Collaborators)
- ✅ GitHub Actions работает как обычно
- ✅ Бесплатно для неограниченного количества приватных репозиториев

### Если выбрали Public:
- ⚠️ Код виден всем в интернете
- ⚠️ Люди могут скачать ваш код
- ⚠️ **Не рекомендуется для бизнес-проектов!**

### Как изменить Private на Public (или наоборот):

1. Репозиторий → **Settings** → **Danger Zone**
2. **"Change visibility"**
3. Подтвердите действие

---

## Часть 11: Проблемы и решения

### "Permission denied (publickey)"

**Проблема:** Git не может подключиться к GitHub через SSH.

**Решение:** Используйте HTTPS URL вместо SSH:
```bash
# Убедитесь, что URL начинается с https://
git remote -v

# Если показывает git@github.com, измените на https:
git remote set-url origin https://github.com/ваш-username/nechai-coffee.git
```

---

### "fatal: remote origin already exists"

**Проблема:** Вы пытаетесь добавить remote, который уже существует.

**Решение:**
```bash
# Удалить старый remote
git remote remove origin

# Добавить новый
git remote add origin https://github.com/ваш-username/nechai-coffee.git
```

---

### "! [rejected] main -> main (fetch first)"

**Проблема:** На GitHub есть изменения, которых нет у вас локально.

**Решение:**
```bash
# Скачать изменения с GitHub и объединить с вашими
git pull origin main --rebase

# Затем загрузить обратно
git push origin main
```

---

### "Author identity unknown"

**Проблема:** Git не знает ваше имя и email.

**Решение:**
```bash
git config --global user.name "Ваше Имя"
git config --global user.email "your.email@example.com"
```

---

### Не знаю в какой папке я нахожусь в терминале

**Решение:**
```bash
# Показать текущую папку
pwd

# Показать содержимое текущей папки
ls   # macOS/Linux
dir  # Windows CMD

# В Git Bash путь показан в промпте:
# username@computer MINGW64 /c/Users/YourName/project (main)
#                             ^^^^^^^^^^^^^^^^^^^^^^^ <- это ваш путь
```

---

## Часть 12: Структура проекта на GitHub

После загрузки ваш репозиторий будет выглядеть так:

```
nechai-coffee/
├── .github/
│   └── workflows/
│       └── keep-alive.yml    ← GitHub Actions для keep-alive
├── .gitignore                ← Игнорируемые файлы
├── README.md                 ← Описание проекта
├── GITHUB_ACTIONS_SETUP.md   ← Инструкция по GitHub Actions
├── KEEP_ALIVE_SETUP.md       ← Инструкция по keep-alive
├── GIT_SETUP.md              ← Эта инструкция
├── App.tsx                   ← Главный компонент
├── components/               ← React компоненты
├── lib/                      ← Библиотеки и утилиты
├── supabase/                 ← Backend код
└── styles/                   ← Стили
```

---

## Часть 13: Что дальше?

### ✅ Ваш проект теперь на GitHub!

1. **Автоматический backup** - код сохранён в облаке
2. **История изменений** - можно откатиться к любой версии
3. **GitHub Actions работает** - база данных не отключится
4. **Можно работать с разных компьютеров** - просто делайте `git pull` перед работой

### Рекомендации:

- 💾 **Делайте коммиты часто** - после каждой логической порции изменений
- 📝 **Пишите понятные сообщения коммитов** - чтобы потом понять что вы делали
- 🔄 **Push на GitHub минимум раз в день** - чтобы не потерять работу
- 🔍 **Проверяйте GitHub Actions** - заходите раз в неделю во вкладку Actions

---

## Часть 14: Полезные ссылки

- **Официальная документация Git:** https://git-scm.com/doc
- **GitHub Guides:** https://guides.github.com/
- **GitHub Actions документация:** https://docs.github.com/en/actions
- **Git Cheat Sheet (шпаргалка):** https://training.github.com/downloads/github-git-cheat-sheet.pdf
- **Интерактивное обучение Git:** https://learngitbranching.js.org/?locale=ru_RU

---

## 🎉 Готово!

Теперь ваш проект Nechai Coffee полностью подключен к GitHub с работающим автоматическим keep-alive через GitHub Actions!

Если остались вопросы - читайте документацию выше или гуглите конкретную ошибку (обычно первый результат в Stack Overflow помогает).

**Удачной разработки!** ☕️
