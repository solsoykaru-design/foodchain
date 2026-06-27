/**
 * Seed script: 5000 популярных мировых блюд
 * Запуск: node seed-dishes.js
 *
 * Использует existing dishes table + mobile_tech_cards
 * Все данные генерируются локально, без AI/API.
 */
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);
const path = require('path');

// ─── Config ──────────────────────────────────────────
const TARGET = 5000;
const DB_PATH = path.join(__dirname, 'foodchain.db');

// ─── Cuisines and their dish patterns ────────────────
const CUISINES = {
  'Русская': [
    { name: 'Борщ', cat: 'Суп' }, { name: 'Щи', cat: 'Суп' }, { name: 'Уха', cat: 'Суп' },
    { name: 'Солянка', cat: 'Суп' }, { name: 'Рассольник', cat: 'Суп' }, { name: 'Окрошка', cat: 'Суп' },
    { name: 'Пельмени', cat: 'Горячее' }, { name: 'Вареники', cat: 'Горячее' },
    { name: 'Голубцы', cat: 'Горячее' }, { name: 'Котлета по-киевски', cat: 'Горячее' },
    { name: 'Бефстроганов', cat: 'Горячее' }, { name: 'Плов', cat: 'Горячее' },
    { name: 'Жаркое', cat: 'Горячее' }, { name: 'Шашлык', cat: 'Горячее' },
    { name: 'Блины', cat: 'Закуска' }, { name: 'Оладьи', cat: 'Закуска' },
    { name: 'Сырники', cat: 'Закуска' }, { name: 'Драники', cat: 'Закуска' },
    { name: 'Ватрушка', cat: 'Выпечка' }, { name: 'Кулебяка', cat: 'Выпечка' },
    { name: 'Расстегай', cat: 'Выпечка' }, { name: 'Пирожок', cat: 'Выпечка' },
    { name: 'Оливье', cat: 'Салат' }, { name: 'Винегрет', cat: 'Салат' },
    { name: 'Сельдь под шубой', cat: 'Салат' }, { name: 'Мимоза', cat: 'Салат' },
    { name: 'Кисель', cat: 'Напиток' }, { name: 'Компот', cat: 'Напиток' },
    { name: 'Квас', cat: 'Напиток' }, { name: 'Морс', cat: 'Напиток' },
  ],
  'Итальянская': [
    { name: 'Пицца Маргарита', cat: 'Пицца' }, { name: 'Пицца Пепперони', cat: 'Пицца' },
    { name: 'Пицца Гавайская', cat: 'Пицца' }, { name: 'Пицца Четыре сыра', cat: 'Пицца' },
    { name: 'Пицца Четыре сезона', cat: 'Пицца' }, { name: 'Пицца Капричоза', cat: 'Пицца' },
    { name: 'Пицца Марко Поло', cat: 'Пицца' }, { name: 'Пицца Диавола', cat: 'Пицца' },
    { name: 'Спагетти Болоньезе', cat: 'Паста' }, { name: 'Спагетти Карбонара', cat: 'Паста' },
    { name: 'Феттуччине Альфредо', cat: 'Паста' }, { name: 'Лазанья', cat: 'Паста' },
    { name: 'Равиоли', cat: 'Паста' }, { name: 'Тальятелле', cat: 'Паста' },
    { name: 'Пенне Арабьята', cat: 'Паста' }, { name: 'Ризотто', cat: 'Горячее' },
    { name: 'Минестроне', cat: 'Суп' }, { name: 'Брускетта', cat: 'Закуска' },
    { name: 'Капрезе', cat: 'Закуска' }, { name: 'Карпаччо', cat: 'Закуска' },
    { name: 'Тирамису', cat: 'Десерт' }, { name: 'Панна-котта', cat: 'Десерт' },
    { name: 'Джелато', cat: 'Десерт' }, { name: 'Канноли', cat: 'Десерт' },
    { name: 'Страчателла', cat: 'Суп' }, { name: 'Полента', cat: 'Горячее' },
  ],
  'Французская': [
    { name: 'Луковый суп', cat: 'Суп' }, { name: 'Буйабес', cat: 'Суп' },
    { name: 'Вишисуаз', cat: 'Суп' }, { name: 'Консоме', cat: 'Суп' },
    { name: 'Кок-о-вен', cat: 'Горячее' }, { name: 'Беф Бургиньон', cat: 'Горячее' },
    { name: 'Рататуй', cat: 'Горячее' }, { name: 'Кассуле', cat: 'Горячее' },
    { name: 'Улитки по-бургундски', cat: 'Закуска' }, { name: 'Фуа-гра', cat: 'Закуска' },
    { name: 'Киш Лорен', cat: 'Выпечка' }, { name: 'Круассан', cat: 'Выпечка' },
    { name: 'Мадлен', cat: 'Выпечка' }, { name: 'Эклер', cat: 'Десерт' },
    { name: 'Профитроли', cat: 'Десерт' }, { name: 'Крем-брюле', cat: 'Десерт' },
    { name: 'Мусс шоколадный', cat: 'Десерт' }, { name: 'Тарт Татен', cat: 'Десерт' },
    { name: 'Пти-фур', cat: 'Десерт' }, { name: 'Багет', cat: 'Выпечка' },
  ],
  'Японская': [
    { name: 'Суши Филадельфия', cat: 'Роллы' }, { name: 'Суши Калифорния', cat: 'Роллы' },
    { name: 'Ролл Унаги', cat: 'Роллы' }, { name: 'Ролл Дракон', cat: 'Роллы' },
    { name: 'Ролл Огненный', cat: 'Роллы' }, { name: 'Ролл Чидори', cat: 'Роллы' },
    { name: 'Нигири лосось', cat: 'Роллы' }, { name: 'Сашими', cat: 'Закуска' },
    { name: 'Темпура', cat: 'Горячее' }, { name: 'Тэрияки', cat: 'Горячее' },
    { name: 'Рамен', cat: 'Суп' }, { name: 'Мисо-суп', cat: 'Суп' },
    { name: 'Удон', cat: 'Горячее' }, { name: 'Соба', cat: 'Горячее' },
    { name: 'Гёдза', cat: 'Закуска' }, { name: 'Эдамаме', cat: 'Закуска' },
    { name: 'Якитори', cat: 'Горячее' }, { name: 'Окономияки', cat: 'Горячее' },
    { name: 'Моти', cat: 'Десерт' }, { name: 'Данго', cat: 'Десерт' },
  ],
  'Мексиканская': [
    { name: 'Тако', cat: 'Закуска' }, { name: 'Буррито', cat: 'Горячее' },
    { name: 'Кесадилья', cat: 'Закуска' }, { name: 'Начос', cat: 'Закуска' },
    { name: 'Фахитас', cat: 'Горячее' }, { name: 'Энчилада', cat: 'Горячее' },
    { name: 'Тортилья', cat: 'Выпечка' }, { name: 'Гуакамоле', cat: 'Закуска' },
    { name: 'Сальса', cat: 'Закуска' }, { name: 'Чили-кон-карне', cat: 'Горячее' },
    { name: 'Торт-илья', cat: 'Закуска' }, { name: 'Арепа', cat: 'Выпечка' },
    { name: 'Пицца Перечная', cat: 'Суп' }, { name: 'Тамалес', cat: 'Горячее' },
  ],
  'Китайская': [
    { name: 'Курица Гунгбао', cat: 'Горячее' }, { name: 'Курица в апельсинах', cat: 'Горячее' },
    { name: 'Свинина в кисло-сладком', cat: 'Горячее' }, { name: 'Утка по-пекински', cat: 'Горячее' },
    { name: 'Яичный суп', cat: 'Суп' }, { name: 'Суп Вонтон', cat: 'Суп' },
    { name: 'Кунг Пао', cat: 'Горячее' }, { name: 'Чоу Мейн', cat: 'Паста' },
    { name: 'Ло Мейн', cat: 'Паста' }, { name: 'Спринг-ролл', cat: 'Закуска' },
    { name: 'Димсам', cat: 'Закуска' }, { name: 'Тофу с овощами', cat: 'Горячее' },
    { name: 'Жареный рис', cat: 'Горячее' }, { name: 'Хого', cat: 'Горячее' },
  ],
  'Индийская': [
    { name: 'Курица Карри', cat: 'Горячее' }, { name: 'Баранина Карри', cat: 'Горячее' },
    { name: 'Тикка Масала', cat: 'Горячее' }, { name: 'Чиккен Тикка', cat: 'Закуска' },
    { name: 'Наан', cat: 'Выпечка' }, { name: 'Самоса', cat: 'Закуска' },
    { name: 'Дхал', cat: 'Горячее' }, { name: 'Бирьяни', cat: 'Горячее' },
    { name: 'Пакора', cat: 'Закуска' }, { name: 'Малай-кофта', cat: 'Горячее' },
    { name: 'Панир', cat: 'Горячее' }, { name: 'Чатни', cat: 'Закуска' },
    { name: 'Ласси', cat: 'Напиток' }, { name: 'Гулаб Джамун', cat: 'Десерт' },
  ],
  'Кавказская': [
    { name: 'Харчо', cat: 'Суп' }, { name: 'Чихиртма', cat: 'Суп' },
    { name: 'Шашлык из баранины', cat: 'Горячее' }, { name: 'Чашушули', cat: 'Горячее' },
    { name: 'Сациви', cat: 'Закуска' }, { name: 'Лобио', cat: 'Горячее' },
    { name: 'Хачапури', cat: 'Выпечка' }, { name: 'Хинкали', cat: 'Горячее' },
    { name: 'Чебуреки', cat: 'Выпечка' }, { name: 'Бастурма', cat: 'Закуска' },
    { name: 'Лаваш', cat: 'Выпечка' }, { name: 'Суджук', cat: 'Закуска' },
    { name: 'Кутабы', cat: 'Выпечка' }, { name: 'Пахлава', cat: 'Десерт' },
    { name: 'Чурчхела', cat: 'Десерт' }, { name: 'Ткемали', cat: 'Закуска' },
  ],
  'Американская': [
    { name: 'Бургер классический', cat: 'Горячее' }, { name: 'Чизбургер', cat: 'Горячее' },
    { name: 'Хот-дог', cat: 'Закуска' }, { name: 'Сэндвич', cat: 'Закуска' },
    { name: 'Клаб-сэндвич', cat: 'Закуска' }, { name: 'Стрипсы', cat: 'Закуска' },
    { name: 'Крылышки Баффало', cat: 'Закуска' }, { name: 'Картофель фри', cat: 'Закуска' },
    { name: 'Макарони с сыром', cat: 'Горячее' }, { name: 'Мясной рулет', cat: 'Горячее' },
    { name: 'Барбекю-ребрышки', cat: 'Горячее' }, { name: 'Кукурузный суп', cat: 'Суп' },
    { name: 'Чикен-фрай', cat: 'Горячее' }, { name: 'Панкейки', cat: 'Закуска' },
    { name: 'Пирог тыквенный', cat: 'Десерт' }, { name: 'Чизкейк', cat: 'Десерт' },
    { name: 'Кекс', cat: 'Выпечка' }, { name: 'Шейк', cat: 'Напиток' },
  ],
  'Тайская': [
    { name: 'Пад Тай', cat: 'Паста' }, { name: 'Том Ям', cat: 'Суп' },
    { name: 'Том Кха', cat: 'Суп' }, { name: 'Сом Там', cat: 'Салат' },
    { name: 'Массаман карри', cat: 'Горячее' }, { name: 'Грин карри', cat: 'Горячее' },
    { name: 'Пад Кра Пао', cat: 'Горячее' }, { name: 'Ларб', cat: 'Салат' },
    { name: 'Сатай', cat: 'Закуска' }, { name: 'Тан-гулу', cat: 'Десерт' },
    { name: 'Кхао Пот', cat: 'Закуска' }, { name: 'Куйтиао', cat: 'Суп' },
  ],
  'Греческая': [
    { name: 'Греческий салат', cat: 'Салат' }, { name: 'Муссака', cat: 'Горячее' },
    { name: 'Дзадзики', cat: 'Закуска' }, { name: 'Спанакопита', cat: 'Выпечка' },
    { name: 'Тиропита', cat: 'Выпечка' }, { name: 'Сумадо', cat: 'Горячее' },
    { name: 'Кефтедес', cat: 'Горячее' }, { name: 'Гирос', cat: 'Закуска' },
    { name: 'Сувлаки', cat: 'Горячее' }, { name: 'Баклава', cat: 'Десерт' },
    { name: 'Фава', cat: 'Закуска' }, { name: 'Каламараки', cat: 'Закуска' },
  ],
  'Испанская': [
    { name: 'Паэлья', cat: 'Горячее' }, { name: 'Гаспачо', cat: 'Суп' },
    { name: 'Тортилья испанская', cat: 'Закуска' }, { name: 'Тапас', cat: 'Закуска' },
    { name: 'Крокеты', cat: 'Закуска' }, { name: 'Чуррос', cat: 'Десерт' },
    { name: 'Эскаливада', cat: 'Закуска' }, { name: 'Хамон', cat: 'Закуска' },
    { name: 'Пуэррос', cat: 'Суп' }, { name: 'Альбондигас', cat: 'Горячее' },
  ],
  'Турецкая': [
    { name: 'Кебаб', cat: 'Горячее' }, { name: 'Долма', cat: 'Горячее' },
    { name: 'Манти', cat: 'Горячее' }, { name: 'Лахмаджун', cat: 'Выпечка' },
    { name: 'Шакшука', cat: 'Закуска' }, { name: 'Хумус', cat: 'Закуска' },
    { name: 'Баба-гануш', cat: 'Закуска' }, { name: 'Пияз', cat: 'Салат' },
    { name: 'Чобан', cat: 'Салат' }, { name: 'Менемен', cat: 'Закуска' },
    { name: 'Локма', cat: 'Закуска' }, { name: 'Кунефе', cat: 'Десерт' },
    { name: 'Рахат-лукум', cat: 'Десерт' }, { name: 'Айран', cat: 'Напиток' },
  ],
  'Корейская': [
    { name: 'Кимчи', cat: 'Закуска' }, { name: 'Бибимбап', cat: 'Горячее' },
    { name: 'Пулькоги', cat: 'Горячее' }, { name: 'Кальби', cat: 'Горячее' },
    { name: 'Самгёпсаль', cat: 'Горячее' }, { name: 'Твенджан-ччиге', cat: 'Суп' },
    { name: 'Кимчи-ччиге', cat: 'Суп' }, { name: 'Пхаджон', cat: 'Закуска' },
    { name: 'Сундэ', cat: 'Закуска' }, { name: 'Токпоки', cat: 'Закуска' },
    { name: 'Хотпот', cat: 'Горячее' }, { name: 'Чимичжон', cat: 'Десерт' },
  ],
  'Вьетнамская': [
    { name: 'Фо Бо', cat: 'Суп' }, { name: 'Фо Га', cat: 'Суп' },
    { name: 'Нэм', cat: 'Закуска' }, { name: 'Бан Ми', cat: 'Закуска' },
    { name: 'Бун Ча', cat: 'Горячее' }, { name: 'Спринг-ролл (вьет.)', cat: 'Закуска' },
    { name: 'Као Лау', cat: 'Паста' }, { name: 'Ком', cat: 'Горячее' },
    { name: 'Хе', cat: 'Суп' }, { name: 'Нынг Фу', cat: 'Закуска' },
  ],
  'Узбекская': [
    { name: 'Плов узбекский', cat: 'Горячее' }, { name: 'Лагман', cat: 'Суп' },
    { name: 'Манты', cat: 'Горячее' }, { name: 'Шурпа', cat: 'Суп' },
    { name: 'Самса', cat: 'Выпечка' }, { name: 'Бешбармак', cat: 'Горячее' },
    { name: 'Азу по-татарски', cat: 'Горячее' }, { name: 'Катык', cat: 'Закуска' },
    { name: 'Чак-чак', cat: 'Десерт' }, { name: 'Курт', cat: 'Закуска' },
  ],
};

// ─── Temperature and shelf life defaults ─────────────
const TEMPS = {
  'Суп': 'Подавать горячим, 65-75°C',
  'Салат': 'Подавать охлаждённым, 8-12°C',
  'Горячее': 'Температура подачи 65-75°C',
  'Десерт': 'Подавать охлаждённым, 6-10°C',
  'Закуска': 'Подавать охлаждённым, 10-14°C',
  'Выпечка': 'Подавать тёплым, 40-50°C',
  'Паста': 'Подавать горячим, 65-75°C',
  'Пицца': 'Подавать горячей, 60-70°C',
  'Роллы': 'Подавать охлаждёнными, 8-12°C',
  'Напиток': 'Подавать охлаждённым, 6-10°C',
};
const SHELF = {
  'Горячее': '48 часов при 2-6°C',
  'Суп': '24 часа при 2-6°C',
  'Салат': '12 часов при 2-6°C',
  'Закуска': '24 часа при 2-6°C',
  'Десерт': '48 часов при 2-6°C',
  'Выпечка': '72 часа при 2-6°C',
  'Паста': '24 часа при 2-6°C',
  'Пицца': '24 часа при 2-6°C',
  'Роллы': '12 часов при 2-6°C',
  'Напиток': '72 часа при 2-6°C',
};

// ─── Category defaults ───────────────────────────────
const CATEGORY_DEFAULTS = {
  'Суп': { output: [300, 400], cook_time: [30, 90], kcal: [45, 120], protein: [3, 8], fat: [2, 6], carb: [5, 15] },
  'Салат': { output: [150, 250], cook_time: [5, 25], kcal: [80, 250], protein: [2, 10], fat: [5, 20], carb: [3, 15] },
  'Горячее': { output: [200, 350], cook_time: [20, 90], kcal: [150, 400], protein: [10, 30], fat: [8, 25], carb: [5, 20] },
  'Закуска': { output: [100, 200], cook_time: [5, 30], kcal: [100, 300], protein: [5, 15], fat: [5, 20], carb: [5, 15] },
  'Десерт': { output: [100, 200], cook_time: [20, 60], kcal: [200, 450], protein: [3, 8], fat: [8, 25], carb: [25, 50] },
  'Выпечка': { output: [80, 200], cook_time: [25, 60], kcal: [200, 400], protein: [5, 12], fat: [8, 20], carb: [25, 45] },
  'Напиток': { output: [200, 350], cook_time: [5, 15], kcal: [30, 120], protein: [0, 2], fat: [0, 3], carb: [5, 20] },
  'Паста': { output: [250, 400], cook_time: [15, 35], kcal: [180, 350], protein: [8, 15], fat: [5, 15], carb: [25, 40] },
  'Пицца': { output: [300, 500], cook_time: [15, 30], kcal: [220, 350], protein: [10, 18], fat: [8, 15], carb: [25, 35] },
  'Роллы': { output: [180, 300], cook_time: [10, 30], kcal: [120, 280], protein: [6, 14], fat: [3, 12], carb: [15, 30] },
};

// ─── Modifiers for dish name generation ──────────────
const ADJECTIVES = [
  'Домашний', 'Классический', 'Фирменный', 'Пикантный', 'Нежный', 'Острый',
  'Сочный', 'Ароматный', 'Сытный', 'Лёгкий', 'Пряный', 'Запечённый',
  'Фаршированный', 'Панированный', 'Копчёный', 'Вяленый', 'Маринованный',
  'Свежий', 'Тушёный', 'Варёный', 'Жареный', 'Глазированный',
  'Кремовый', 'Воздушный', 'Хрустящий', 'Талийский', 'По-деревенски',
  'По-домашнему', 'Любимый', 'Изысканный', 'Простой', 'Быстрый',
  'Полезный', 'Диетический', 'Монастырский', 'Купеческий', 'Царский',
];

const PREPOSITIONS = ['с', 'со', 'в', 'на', 'под', 'из', 'от', 'по'];

// ─── Helpers ──────────────────────────────────────────
function rand(min, max) { return Math.round(min + Math.random() * (max - min)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateTechnology(category, dishName) {
  const tech = [
    `Подготовить все ингредиенты согласно рецептуре. ${pick(['Промыть', 'Очистить', 'Нарезать', 'Измельчить'])} ${pick(['кубиками', 'соломкой', 'ломтиками', 'кольцами'])}.`,
    `Смешать подготовленные компоненты в соответствии с технологией приготовления блюда "${dishName}".`,
    `Довести до вкуса, добавив ${pick(['соль', 'перец', 'специи', 'приправы'])} по вкусу.`,
    `Подавать при ${pick(['комнатной температуре', 'температуре 65°C', 'температуре 8-12°C', 'температуре 10-14°C'])}. Срок хранения: ${SHELF[category] || '24 часа при 2-6°C'}.`,
  ];
  return tech.join('\n');
}

// ─── Seed into existing db ───────────────────────────
function seedDishCatalog(db) {
  const count = db.prepare('SELECT COUNT(*) as c FROM dish_catalog').get()?.c || 0;
  if (count > 0) {
    console.log(`[dish_catalog] уже содержит ${count} записей, пропускаем`);
    return count;
  }

  const dishes = [];
  for (const [cuisine, items] of Object.entries(CUISINES)) {
    for (const item of items) {
      const def = CATEGORY_DEFAULTS[item.cat] || CATEGORY_DEFAULTS['Горячее'];
      dishes.push({
        name: item.name + (Math.random() > 0.7 ? ` ${pick(ADJECTIVES)}` : ''),
        cuisine, category: item.cat,
        output: rand(def.output[0], def.output[1]),
        cooking_time: rand(def.cook_time[0], def.cook_time[1]),
        calories: rand(def.kcal[0], def.kcal[1]),
        proteins: rand(def.protein[0], def.protein[1]),
        fats: rand(def.fat[0], def.fat[1]),
        carbs: rand(def.carb[0], def.carb[1]),
        temperature: TEMPS[item.cat] || '',
        shelf_life: SHELF[item.cat] || '',
      });
    }
  }

  const INGREDIENTS = ['Говядина','Свинина','Курица','Индейка','Баранина','Утка','Лосось','Форель','Треска','Креветки','Кальмары','Мидии','Картофель','Рис','Гречка','Паста','Капуста','Морковь','Свекла','Кабачки','Баклажаны','Тыква','Грибы','Тофу','Сыр','Творог','Яйцо','Фасоль','Чечевица','Нут'];
  const STYLES = ['жареный','тушёный','печёный','фаршированный','панированный','маринованный','копчёный','запечённый','свежий','вяленый'];
  const PREFIXES = ['по-домашнему','по-деревенски','по-купечески','по-флотски','в горшочке','в сливочном соусе','в томатном соусе','с грибами','с сыром','с овощами'];
  const SUFFIXES = ['по-новому','оригинальный','деликатесный','премиальный','классический','пряный','пикантный','нежный','сытный','лёгкий'];
  const baseDishes = [...dishes];
  let attempts = 0;
  while (dishes.length < 5000 && attempts < 50000) {
    attempts++;
    if (Math.random() > 0.4) {
      const src = pick(baseDishes);
      const parts = [src.name];
      if (Math.random() > 0.5) parts.push(pick(SUFFIXES));
      if (Math.random() > 0.6) parts.unshift(pick(PREFIXES));
      const name = parts.join(' ');
      if (dishes.some(d => d.name.toLowerCase() === name.toLowerCase())) continue;
      dishes.push({ name, cuisine: src.cuisine, category: src.category,
        output: Math.max(80, src.output + rand(-30, 30)),
        cooking_time: Math.max(5, src.cooking_time + rand(-10, 10)),
        calories: Math.max(10, src.calories + rand(-20, 20)),
        proteins: Math.max(1, src.proteins + rand(-2, 2)),
        fats: Math.max(1, src.fats + rand(-3, 3)),
        carbs: Math.max(1, src.carbs + rand(-3, 3)),
        temperature: src.temperature, shelf_life: src.shelf_life,
      });
    } else {
      const ing = pick(INGREDIENTS);
      const style = pick(STYLES);
      const catNames = Object.keys(CATEGORY_DEFAULTS);
      const cat = pick(catNames);
      const name = `${ing} ${style} — ${cat}`;
      if (dishes.some(d => d.name.toLowerCase() === name.toLowerCase())) continue;
      const def = CATEGORY_DEFAULTS[cat];
      const cuisine = pick(Object.keys(CUISINES));
      dishes.push({ name, cuisine, category: cat,
        output: rand(def.output[0], def.output[1]),
        cooking_time: rand(def.cook_time[0], def.cook_time[1]),
        calories: rand(def.kcal[0], def.kcal[1]),
        proteins: rand(def.protein[0], def.protein[1]),
        fats: rand(def.fat[0], def.fat[1]),
        carbs: rand(def.carb[0], def.carb[1]),
        temperature: TEMPS[cat] || '', shelf_life: SHELF[cat] || '',
      });
    }
  }

  const insert = db.prepare(`INSERT OR IGNORE INTO dish_catalog
    (name, cuisine, category, description, temperature, shelf_life, output, cooking_time, calories, proteins, fats, carbs, technology)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  const insertMany = db.transaction((items) => {
    for (const d of items) {
      const tech = generateTechnology(d.category, d.name);
      const desc = `${d.cuisine} кухня. Категория: ${d.category}. Выход: ${d.output} г, время приготовления: ${d.cooking_time} мин.`;
      const t = typeof d.temperature === 'string' ? d.temperature : (TEMPS[d.category] || '');
      const s = typeof d.shelf_life === 'string' ? d.shelf_life : (SHELF[d.category] || '');
      insert.run(d.name, d.cuisine, d.category, desc, t, s, d.output, d.cooking_time, d.calories, d.proteins, d.fats, d.carbs, tech);
    }
  });

  insertMany(dishes);
  const total = db.prepare('SELECT COUNT(*) as c FROM dish_catalog').get()?.c || 0;
  console.log(`[dish_catalog] добавлено ${dishes.length} записей, всего: ${total}`);
  return total;
}

// ─── Main ────────────────────────────────────────────
async function main() {
  const Database = require('better-sqlite3');
  const db = new Database(DB_PATH);

  db.exec(`CREATE TABLE IF NOT EXISTS dish_catalog (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cuisine TEXT DEFAULT '',
    category TEXT DEFAULT '',
    description TEXT DEFAULT '',
    temperature TEXT DEFAULT '',
    shelf_life TEXT DEFAULT '',
    output REAL DEFAULT 0,
    cooking_time INTEGER DEFAULT 0,
    calories REAL DEFAULT 0,
    proteins REAL DEFAULT 0,
    fats REAL DEFAULT 0,
    carbs REAL DEFAULT 0,
    technology TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  const total = seedDishCatalog(db);
  const cuisines = db.prepare('SELECT COUNT(DISTINCT cuisine) as c FROM dish_catalog').get().c;
  const cats = db.prepare('SELECT COUNT(DISTINCT category) as c FROM dish_catalog').get().c;
  console.log(`\n✅ Готово: ${total} блюд, ${cuisines} кухонь, ${cats} категорий`);

  db.close();
}

// ─── Also seed into mobile_tech_cards? ───────────────
// The dish_catalog is for browsing. When user picks a dish to generate,
// the AI creates a tech card. The catalog is a reference / inspiration.

if (require.main === module) {
  main().catch(e => { console.error('❌ Ошибка:', e.message); process.exit(1); });
} else {
  module.exports = { seedDishCatalog, generateTechnology, main };
}
