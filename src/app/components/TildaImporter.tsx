import { useState } from 'react';
import { Button } from './ui/button';
import { Upload, Loader2, Database } from 'lucide-react';
import { toast } from 'sonner';
import { createRetailProduct } from '../lib/api';

interface TildaImporterProps {
  onImportComplete: () => void;
}

export function TildaImporter({ onImportComplete }: TildaImporterProps) {
  const [isImporting, setIsImporting] = useState(false);

  const handleImportFromTildaData = async () => {
    // Предзагруженные данные из Tilda
    const tildaProducts = [
      {
        name: 'Колумбия Уила',
        description: '(красное яблоко, виноград, какао)',
        price: 704,
        imageUrl: 'https://static.tildacdn.com/stor3364-3739-4765-b764-633533363332/62880383.png',
        category: 'Эспрессо',
        cardText: 'Обработка: Мытая\nРегион: Уила\nСорт зерна: Caturra\nQ-score: 84',
        longDescription: 'Colombia Huila — гармония вкуса из сердца Колумбии\nЗдесь, на высоте 1 500–1 900 метров, фермеры выращивают зёрна, впитывающие солнечное тепло Анд и питательные вещества вулканических почв.',
        roast: 'Эспрессо, Фильтр',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Кения Киамумби АА',
        description: '(красная смородина, яблоко, какао)',
        price: 890,
        imageUrl: 'https://static.tildacdn.com/stor6333-3237-4037-a331-366562356133/97818023.png',
        category: 'Фильтр',
        cardText: 'Обработка: Мытая\nРегион: Ньери\nСорт зерна: SL28, SL34\nQ-score: 85',
        longDescription: 'Кения Киамумби — это кофе с ярким, узнаваемым характером. Его аромат раскрывается оттенками чёрной смородины, цитрусовых и красных ягод.',
        roast: 'Фильтр, Эспрессо',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Колумбия Эль Лоро',
        description: '(лемонграсс, манго, специи)',
        price: 1630,
        imageUrl: 'https://static.tildacdn.com/stor3539-6161-4837-a438-633366383063/31204472.png',
        category: 'Фильтр',
        cardText: 'Обработка: Мытая, термошок\nРегион: Уила\nСорт зерна: Бурбон\nQ-score: 88',
        longDescription: 'Colombia El Loro Washed Thermoshock — это выдающийся лот из региона Уила, муниципалитет Опорапа, собранный на ферме Quebraditas.',
        roast: 'Фильтр, Эспрессо',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Бразилия Басадао',
        description: '(лесной орех, яблоко, темный шоколад)',
        price: 890,
        imageUrl: 'https://static.tildacdn.com/stor6161-6134-4432-a237-653631313633/27150066.png',
        category: 'Фильтр',
        cardText: 'Обработка: Натуральная\nРегион: Минас-Жерайс\nСорт: Catuai\nQ-score: 84',
        longDescription: 'Яркий представитель классического бразильского профиля: мягкий, сладкий и сбалансированный.',
        roast: 'Фильтр, Эспрессо',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Гватемала декаф (без кофеина)',
        description: '(темный шоколад, карамель, красные ягоды)',
        price: 890,
        imageUrl: 'https://static.tildacdn.com/stor6161-3939-4233-b836-396166393738/42671068.png',
        category: 'Фильтр',
        cardText: 'Обработка: Мытая\nРегион: Антигуа\nСорт зерна: Caturra\nQ-score: 84',
        longDescription: 'Гватемала Декаф — это кофе без кофеина, который сохраняет всю полноту вкуса и аромата.',
        roast: 'Фильтр, Эспрессо',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Бурунди Бусинде',
        description: '(гречишный мед, шоколад, красное яблоко)',
        price: 780,
        imageUrl: 'https://static.tildacdn.com/stor6130-3731-4139-a662-356536323933/28905179.png',
        category: 'Фильтр',
        cardText: 'Обработка: Натуральная\nРегион: Гитега\nСорт зерна: Красный Бурбон\nQ-score: 85',
        longDescription: 'Кофе из Бусинде — это яркий представитель бурундийских натуральных сортов.',
        roast: 'Фильтр, Эспрессо',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Руанда Хуруме',
        description: '(красная смородина, слива, какао)',
        price: 740,
        imageUrl: 'https://static.tildacdn.com/stor3233-6162-4862-b466-333964346434/61560470.png',
        category: 'Фильтр',
        cardText: 'Обработка: Мытая\nРегион: Уйе\nСорт зерна: Бурбон\nQ-score: 85',
        longDescription: 'Кофе из высокогорного региона Хуруме в Руанде — пример чистоты вкуса.',
        roast: 'Фильтр, Эспрессо',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Эфиопия Бомбе',
        description: '(апельсин, миндаль, черный чай)',
        price: 785,
        imageUrl: 'https://static.tildacdn.com/stor6666-3963-4664-b036-653265313661/38366870.png',
        category: 'Фильтр',
        cardText: 'Обработка: Натуральная\nРегион: Сидамо\nСорт зерна: Heirloom\nQ-score: 86,75',
        longDescription: 'Бомбе — небольшой горный район в регионе Сидамо, известный своими плодородными почвами.',
        roast: 'Фильтр, Эспрессо',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Эфиопия Шантовене',
        description: '(кленовый сироп, земляника, юдзу)',
        price: 920,
        imageUrl: 'https://static.tildacdn.com/stor3663-3739-4336-b336-363766653938/14087775.png',
        category: 'Фильтр',
        cardText: 'Обработка: Анаэробная\nРегион: Сидамо\nСорт зерна: Эфиопские Heirloom\nQ-score: 86',
        longDescription: 'Ethiopia Sidamo Shantawene G1 Anaerobic Natural — это яркий пример современного подхода к обработке кофе.',
        roast: 'Фильтр, Эспрессо',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Эфиопия Челчели',
        description: '(персик, вишня, бергамот, чай)',
        price: 930,
        imageUrl: 'https://static.tildacdn.com/stor3465-3534-4639-a539-396637386364/31169406.png',
        category: 'Фильтр',
        cardText: 'Обработка: Мытая\nРегион: Иргачеффе\nСорт зерна: Куруме, Дега\nQ-score: 86',
        longDescription: 'Иргачеффе — один из самых известных и уважаемых регионов Эфиопии.',
        roast: 'Фильтр, Эспрессо',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Эфиопия Коке',
        description: '(персик, ликер, молочный шоколад)',
        price: 910,
        imageUrl: 'https://static.tildacdn.com/stor6533-3239-4036-a435-353433323036/67091422.png',
        category: 'Фильтр',
        cardText: 'Обработка: Анаэробная\nРегион: Иргачеффе\nСорт зерна: Эфиопские Heirloom\nQ-score: 87',
        longDescription: 'Коке — небольшая станция обработки в легендарном регионе Иргачеффе.',
        roast: 'Фильтр, Эспрессо',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Эфиопия Маджи Геша',
        description: '(абрикосовый джем, лайм, черный чай)',
        price: 870,
        imageUrl: 'https://static.tildacdn.com/stor6666-3963-4664-b036-653265313661/38366870.png',
        category: 'Фильтр',
        cardText: 'Обработка: Натуральная\nРегион: Бенч Маджи\nСорт зерна: Heirloom\nQ-score: 86',
        longDescription: 'Регион Бенч Маджи славится высокогорными плантациями.',
        roast: 'Фильтр, Эспрессо',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Бразилия Серрадо',
        description: '(грецкий орех, яблоко, карамель)',
        price: 690,
        imageUrl: 'https://static.tildacdn.com/stor6161-6134-4432-a237-653631313633/27150066.png',
        category: 'Эспрессо',
        cardText: 'Обработка: Натуральная\nРегион: Серрадо Минейро\nСорт: Catuai\nQ-score: 83',
        longDescription: 'Регион Cerrado Mineiro — один из первых в Бразилии, получивших статус географического происхождения (PGI).',
        roast: 'Эспрессо, Фильтр',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Эфиопия Сидамо',
        description: '(абрикос, бергамот, шоколад)',
        price: 699,
        imageUrl: 'https://static.tildacdn.com/stor3838-6237-4534-b439-313639343131/79423559.png',
        category: 'Эспрессо',
        cardText: 'Обработка: Мытая\nРегион: Сидамо\nСорт зерна: Heirloom\nQ-score: 84',
        longDescription: 'Эфиопия Сидамо — один из регионов страны, где кофе выращивают на высокогорьях 1 800 м.',
        roast: 'Эспрессо, Фильтр',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Бурунди Масасу',
        description: '(красные ягоды, лайм, тростниковый сахар)',
        price: 789,
        imageUrl: 'https://static.tildacdn.com/stor6166-3662-4336-b137-373365376565/88991202.png',
        category: 'Фильтр',
        cardText: 'Обработка: Мытая\nРегион: Гитега\nСорт зерна: Бурбон\nQ-score: 85',
        longDescription: 'Кофе из региона Масасу, Бурунди, выращивается на высокогорных плантациях на высоте 1 700–2 000 м.',
        roast: 'Фильтр, Эспрессо',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Руанда Килимби',
        description: '(яблоко, мандарин, какао, карамель)',
        price: 890,
        imageUrl: 'https://static.tildacdn.com/stor3135-6230-4935-a265-343932626239/27937646.png',
        category: 'Фильтр',
        cardText: 'Обработка: Хани\nРегион: Ньямашеке\nСорт зерна: Красный Бурбон\nQ-score: 85',
        longDescription: 'Руанда Килимби — это кофе с характером, в котором сочетаются яркость африканских терруаров.',
        roast: 'Фильтр, Эспрессо',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Уганда Боба-Боба',
        description: '(папайя, малина, темный шоколад)',
        price: 840,
        imageUrl: 'https://static.tildacdn.com/stor6335-6361-4231-a663-313237356638/f6ddb3e014bde5736b7999d40bdf6239.png',
        category: 'Фильтр',
        cardText: 'Обработка: Натуральная\nРегион: Восточная Уганда\nСорт зерна: SL28, SL34\nQ-score: 86',
        longDescription: 'Кофе «Boda Boda» выращивается на высокогорных участках около горы Эльгон.',
        roast: 'Фильтр, Эспрессо',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      },
      {
        name: 'Кения Керугоя АБ',
        description: '(кизил, черный чай, какао)',
        price: 780,
        imageUrl: 'https://static.tildacdn.com/stor6633-3434-4662-a234-656261316231/40efc8df32edf18fde5a669a0eb3ee6c.png',
        category: 'Эспрессо',
        cardText: 'Обработка: Мытая\nРегион: Керугоя\nСорт зерна: SL28, SL34\nQ-score: 84',
        longDescription: 'Кения Керугоя AB — кофе, отражающий лучшие особенности кенийского высокогорья.',
        roast: 'Эспрессо, Фильтр',
        grind: 'В зернах',
        weight: '200гр, 1000гр'
      }
    ];

    try {
      setIsImporting(true);
      let imported = 0;

      for (const product of tildaProducts) {
        try {
          await createRetailProduct(product);
          imported++;
          console.log(`Импортирован: ${product.name}`);
          
          // Небольшая задержка между запросами
          await new Promise(resolve => setTimeout(resolve, 150));
        } catch (error) {
          console.error(`Ошибка импорта товара ${product.name}:`, error);
        }
      }

      toast.success(`Импортировано ${imported} товаров из ${tildaProducts.length}`);
      onImportComplete();
    } catch (error) {
      console.error('Ошибка импорта:', error);
      toast.error('Не удалось импортировать данные');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="mb-6 p-4 border border-border rounded-lg bg-muted/30">
      <h3 className="text-foreground mb-3">Импорт из Tilda</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Импортируйте товары из каталога Tilda одним нажатием
      </p>
      
      <Button
        onClick={handleImportFromTildaData}
        disabled={isImporting}
      >
        {isImporting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Импорт...
          </>
        ) : (
          <>
            <Database className="w-4 h-4 mr-2" />
            Импортировать из Tilda (18 товаров)
          </>
        )}
      </Button>
    </div>
  );
}
