// Временный скрипт для исправления index.tsx
// Удаляет мусорный код после строки 1953

const fixFile = async () => {
  try {
    // Читаем файл
    const content = await Deno.readTextFile('./index.tsx');
    
    // Находим позицию конца нормального кода  
    const searchPattern = '});\n\nDeno.serve(app.fetch);';
    const index = content.lastIndexOf(searchPattern);
    
    if (index === -1) {
      console.log('Паттерн не найден');
      return;
    }
    
    // Обрезаем файл до нужного места + длина паттерна
    const fixedContent = content.substring(0, index + searchPattern.length) + '\n';
    
    // Записываем исправленный файл
    await Deno.writeTextFile('./index.tsx', fixedContent);
    
    console.log('Файл исправлен успешно!');
    console.log(`Размер до: ${content.length} байт`);
    console.log(`Размер после: ${fixedContent.length} байт`);
  } catch (error) {
    console.error('Ошибка:', error);
  }
};

await fixFile();
