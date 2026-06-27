import * as Print from 'expo-print';

interface PdfTechCard {
  dish_name: string;
  organization?: string;
  category?: string;
  temperature?: string;
  shelf_life?: string;
  technologist?: string;
  chef?: string;
  ingredients?: { name: string; quantity: number; unit: string }[];
  kbju?: { calories?: number; proteins?: number; fats?: number; carbs?: number };
  output?: number;
  cooking_time?: number;
  technology?: string;
  description?: string;
  cost_price?: number;
  portions?: number;
  source?: string;
  isSubscribed?: boolean;
}

function ingsTable(ings: { name: string; quantity: number; unit: string }[], totalWeight: number): string {
  const rows = ings.map((ing, i) => `
    <tr>
      <td style="padding:4px 8px;border:1px solid #ccc;text-align:center">${i + 1}</td>
      <td style="padding:4px 8px;border:1px solid #ccc">${ing.name}</td>
      <td style="padding:4px 8px;border:1px solid #ccc;text-align:center">${ing.quantity}</td>
      <td style="padding:4px 8px;border:1px solid #ccc;text-align:center">${ing.unit}</td>
    </tr>
  `).join('');
  return `
    <table>
      <thead>
        <tr><th>№</th><th>Наименование сырья</th><th>Нетто, г</th><th>Ед.</th></tr>
      </thead>
      <tbody>
        ${rows}
        <tr style="font-weight:600;background:#f9f9f9">
          <td colspan="2" style="text-align:right">Итого:</td>
          <td style="text-align:center">${totalWeight}</td>
          <td style="text-align:center">г</td>
        </tr>
      </tbody>
    </table>`;
}

function kbjuBadges(kbju: PdfTechCard['kbju']): string {
  const k = kbju || {};
  return `
    <span class="badge kcal">🔥 ${k.calories || 0} ккал</span>
    <span class="badge prot">Белки ${k.proteins || 0} г</span>
    <span class="badge fat">Жиры ${k.fats || 0} г</span>
    <span class="badge carb">Углеводы ${k.carbs || 0} г</span>`;
}

// ─── Variant 1: Classic Orange ──────────────────────
function variant1(card: PdfTechCard): string {
  const ings = card.ingredients || [];
  const tw = card.output || ings.reduce((s, i) => s + i.quantity, 0);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family:'DejaVu Sans',Arial,sans-serif; margin:20px; color:#1a1a1a; }
    h1 { text-align:center; font-size:16pt; margin-bottom:4px; color:#e67e22; border-bottom:3px solid #e67e22; padding-bottom:8px; }
    .subtitle { text-align:center; font-size:10pt; color:#666; margin-bottom:20px; }
    table { width:100%; border-collapse:collapse; margin:16px 0; font-size:9pt; }
    th { background:#f0f0f0; padding:6px 8px; border:1px solid #ccc; text-align:center; font-weight:600; }
    td { padding:4px 8px; border:1px solid #ccc; }
    .section-title { font-size:11pt; font-weight:600; margin-top:16px; margin-bottom:8px; color:#e67e22; border-bottom:2px solid #e67e22; padding-bottom:4px; }
    .info-row { display:flex; justify-content:space-between; font-size:9pt; margin:4px 0; }
    .tech-text { font-size:9pt; line-height:1.5; }
    .footer { margin-top:30px; font-size:8pt; color:#999; text-align:center; border-top:1px solid #ddd; padding-top:10px; }
    .badge { display:inline-block; padding:2px 10px; border-radius:12px; font-size:8pt; margin:2px; }
    .kcal { background:#fff3e0; }
    .prot { background:#e3f2fd; }
    .fat { background:#fff8e1; }
    .carb { background:#e8f5e9; }
    .kbju-row { text-align:center; margin:12px 0; }
  </style></head><body>
    <h1>ТЕХНОЛОГИЧЕСКАЯ КАРТА</h1>
    <p class="subtitle">${card.organization || ''}${card.category ? ' | '+card.category : ''}</p>
    <table>
      <tr><td style="width:30%"><strong>Наименование блюда:</strong></td><td>${card.dish_name}</td></tr>
      <tr><td><strong>Выход готового блюда:</strong></td><td>${tw} г</td></tr>
      <tr><td><strong>Время приготовления:</strong></td><td>${card.cooking_time || '—'} мин</td></tr>
      ${card.temperature ? `<tr><td><strong>Температура подачи:</strong></td><td>${card.temperature}</td></tr>` : ''}
      ${card.shelf_life ? `<tr><td><strong>Срок годности:</strong></td><td>${card.shelf_life}</td></tr>` : ''}
      ${card.source ? `<tr><td><strong>Источник:</strong></td><td>${card.source}</td></tr>` : ''}
    </table>
    <div class="section-title">КБЖУ (на 100 г)</div>
    <div class="kbju-row">${kbjuBadges(card.kbju)}</div>
    <div class="section-title">РЕЦЕПТУРА</div>
    ${ingsTable(ings, tw)}
    ${card.cost_price ? `<div class="info-row"><span><strong>Себестоимость:</strong></span><span>${card.cost_price} ₽</span></div>` : ''}
    <div class="section-title">ТЕХНОЛОГИЯ ПРИГОТОВЛЕНИЯ</div>
    <div class="tech-text">${(card.technology || 'Не указана').replace(/\n/g,'<br>')}</div>
    ${card.description ? `<div class="section-title">ТРЕБОВАНИЯ К СЫРЬЮ</div><div class="tech-text">${card.description.replace(/\n/g,'<br>')}</div>` : ''}
    <table style="margin-top:20px;border:none;">
      <tr><td style="border:none;width:50%;"><strong>Технолог:</strong> ${card.technologist || '_____________________'}</td>
      <td style="border:none;"><strong>Шеф-повар:</strong> ${card.chef || '_____________________'}</td></tr>
    </table>
    <div class="footer">Документ сгенерирован автоматически в приложении «AI Техкарты»<br>Соответствует требованиям СанПиН 2.3/2.4.3590-20</div>
  </body></html>`;
}

// ─── Variant 2: Clean Minimal ───────────────────────
function variant2(card: PdfTechCard): string {
  const ings = card.ingredients || [];
  const tw = card.output || ings.reduce((s, i) => s + i.quantity, 0);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'DejaVu Sans',Arial,sans-serif; padding:30px; color:#222; line-height:1.4; }
    h1 { font-size:18pt; font-weight:300; letter-spacing:2px; text-transform:uppercase; margin-bottom:4px; color:#333; }
    hr { border:none; border-top:1px solid #ddd; margin:16px 0; }
    .meta { font-size:9pt; color:#888; margin-bottom:20px; }
    .dish { font-size:14pt; font-weight:600; color:#000; margin-bottom:20px; }
    table { width:100%; border-collapse:collapse; margin:12px 0; font-size:9pt; }
    th { border-bottom:2px solid #333; padding:8px 6px; text-align:left; font-weight:600; color:#333; }
    td { padding:6px; border-bottom:1px solid #eee; }
    .section-title { font-size:10pt; font-weight:600; color:#333; margin-top:20px; margin-bottom:8px; }
    .badge { display:inline-block; padding:2px 8px; font-size:8pt; margin:2px; border:1px solid #ddd; border-radius:2px; }
    .kbju-row { margin:10px 0; }
    .tech-text { font-size:9pt; line-height:1.6; color:#444; }
    .footer { margin-top:30px; font-size:8pt; color:#aaa; text-align:center; }
    .sign { margin-top:24px; font-size:9pt; }
    .sign span { display:inline-block; width:45%; }
    .wmark { color:#ccc; font-size:36pt; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-30deg); opacity:0.15; pointer-events:none; }
  </style></head><body>
    ${!card.isSubscribed ? '<div class="wmark">ДЕМО</div>' : ''}
    <h1>Технологическая карта</h1>
    <hr>
    <div class="meta">${card.organization || ''}${card.category ? ' • '+card.category : ''} • ${new Date().toLocaleDateString('ru-RU')}</div>
    <div class="dish">${card.dish_name}</div>
    <table>
      <tr><td style="width:35%;color:#888;">Выход</td><td>${tw} г</td></tr>
      <tr><td style="color:#888;">Время</td><td>${card.cooking_time || '—'} мин</td></tr>
      ${card.temperature ? `<tr><td style="color:#888;">Температура подачи</td><td>${card.temperature}</td></tr>` : ''}
      ${card.shelf_life ? `<tr><td style="color:#888;">Срок годности</td><td>${card.shelf_life}</td></tr>` : ''}
    </table>
    <div class="section-title">Пищевая ценность (на 100 г)</div>
    <div class="kbju-row">${kbjuBadges(card.kbju)}</div>
    <div class="section-title">Состав</div>
    ${ingsTable(ings, tw)}
    ${card.cost_price ? `<p style="font-size:9pt;margin-top:8px;"><strong>Себестоимость:</strong> ${card.cost_price} ₽</p>` : ''}
    <div class="section-title">Технология</div>
    <div class="tech-text">${(card.technology || 'Не указана').replace(/\n/g,'<br>')}</div>
    ${card.description ? `<div class="section-title">Требования к сырью</div><div class="tech-text">${card.description.replace(/\n/g,'<br>')}</div>` : ''}
    <div class="sign"><span><strong>Технолог:</strong> ${card.technologist || '___________'}</span><span><strong>Шеф-повар:</strong> ${card.chef || '___________'}</span></div>
    <div class="footer">AI Техкарты • СанПиН 2.3/2.4.3590-20</div>
  </body></html>`;
}

// ─── Variant 3: Modern Blue ─────────────────────────
function variant3(card: PdfTechCard): string {
  const ings = card.ingredients || [];
  const tw = card.output || ings.reduce((s, i) => s + i.quantity, 0);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family:'DejaVu Sans',Arial,sans-serif; margin:0; padding:0; background:#f8fafc; color:#1a202c; }
    .page { background:#fff; margin:20px; padding:30px; border-radius:12px; box-shadow:0 2px 8px rgba(0,0,0,0.08); }
    h1 { font-size:16pt; font-weight:700; margin:0; padding:0; color:#1a56db; }
    .header-bar { background:#1a56db; height:4px; border-radius:2px; margin:8px 0 16px 0; width:80px; }
    .subtitle { font-size:9pt; color:#64748b; margin-bottom:16px; }
    .dish-name { font-size:14pt; font-weight:700; color:#0f172a; margin-bottom:16px; padding:12px 16px; background:#f1f5f9; border-radius:8px; }
    table { width:100%; border-collapse:collapse; margin:12px 0; font-size:9pt; }
    th { background:#1a56db11; padding:8px; border:1px solid #e2e8f0; text-align:center; font-weight:600; color:#1a56db; }
    td { padding:6px 8px; border:1px solid #e2e8f0; }
    .section-title { font-size:11pt; font-weight:700; color:#0f172a; margin-top:20px; margin-bottom:8px; display:flex; align-items:center; gap:8px; }
    .section-title::before { content:''; display:inline-block; width:4px; height:14px; background:#1a56db; border-radius:2px; }
    .badge { display:inline-block; padding:4px 12px; border-radius:6px; font-size:8pt; margin:2px; font-weight:600; }
    .kcal { background:#fef3c7; color:#92400e; }
    .prot { background:#dbeafe; color:#1e40af; }
    .fat { background:#fce7f3; color:#9d174d; }
    .carb { background:#d1fae5; color:#065f46; }
    .kbju-row { margin:12px 0; }
    .tech-text { font-size:9pt; line-height:1.6; color:#334155; background:#f8fafc; padding:12px; border-radius:6px; }
    .footer { margin-top:30px; font-size:8pt; color:#94a3b8; text-align:center; border-top:1px solid #e2e8f0; padding-top:12px; }
    .sign { display:flex; gap:20px; margin-top:20px; font-size:9pt; }
    .sign-box { flex:1; padding:12px; border:1px dashed #cbd5e1; border-radius:6px; text-align:center; }
    .sign-box strong { color:#64748b; font-size:8pt; display:block; margin-bottom:4px; }
  </style></head><body>
    <div class="page">
      <h1>ТЕХНОЛОГИЧЕСКАЯ КАРТА</h1>
      <div class="header-bar"></div>
      <div class="subtitle">${card.organization || ''}${card.category ? ' | '+card.category : ''}</div>
      <div class="dish-name">${card.dish_name}</div>
      <table>
        <tr><td style="width:35%;color:#64748b;">Выход</td><td>${tw} г</td></tr>
        <tr><td style="color:#64748b;">Время приготовления</td><td>${card.cooking_time || '—'} мин</td></tr>
        ${card.temperature ? `<tr><td style="color:#64748b;">Температура подачи</td><td>${card.temperature}</td></tr>` : ''}
        ${card.shelf_life ? `<tr><td style="color:#64748b;">Срок годности</td><td>${card.shelf_life}</td></tr>` : ''}
      </table>
      <div class="section-title">Пищевая ценность</div>
      <div class="kbju-row">${kbjuBadges(card.kbju)}</div>
      <div class="section-title">Рецептура</div>
      ${ingsTable(ings, tw)}
      ${card.cost_price ? `<p style="font-size:9pt;margin-top:6px;color:#64748b;"><strong>Себестоимость:</strong> ${card.cost_price} ₽</p>` : ''}
      <div class="section-title">Технология приготовления</div>
      <div class="tech-text">${(card.technology || 'Не указана').replace(/\n/g,'<br>')}</div>
      ${card.description ? `<div class="section-title">Требования к сырью</div><div class="tech-text">${card.description.replace(/\n/g,'<br>')}</div>` : ''}
      <div class="sign">
        <div class="sign-box"><strong>Технолог</strong>${card.technologist || '_____________________'}</div>
        <div class="sign-box"><strong>Шеф-повар</strong>${card.chef || '_____________________'}</div>
      </div>
      <div class="footer">Сгенерировано в AI Техкарты • Соответствует СанПиН 2.3/2.4.3590-20</div>
    </div>
  </body></html>`;
}

// ─── Variant 4: Professional Green ──────────────────
function variant4(card: PdfTechCard): string {
  const ings = card.ingredients || [];
  const tw = card.output || ings.reduce((s, i) => s + i.quantity, 0);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family:'DejaVu Sans',Arial,sans-serif; margin:0; padding:0; }
    .header { background:#2d6a4f; color:#fff; padding:20px 30px; }
    .header h1 { margin:0; font-size:14pt; font-weight:400; letter-spacing:1px; }
    .header h2 { margin:4px 0 0; font-size:18pt; font-weight:700; }
    .content { padding:20px 30px; }
    .info-grid { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
    .info-item { flex:1; min-width:120px; padding:8px 12px; background:#f0fdf4; border-left:3px solid #2d6a4f; font-size:9pt; }
    .info-item strong { display:block; color:#2d6a4f; font-size:8pt; text-transform:uppercase; letter-spacing:0.5px; }
    .section-title { font-size:10pt; font-weight:700; color:#2d6a4f; border-bottom:2px solid #2d6a4f; padding-bottom:4px; margin-top:16px; margin-bottom:10px; }
    table { width:100%; border-collapse:collapse; font-size:9pt; }
    th { background:#2d6a4f; color:#fff; padding:6px 8px; text-align:center; font-weight:600; }
    td { padding:4px 8px; border:1px solid #d4edda; }
    tr:nth-child(even) { background:#f8fdf9; }
    .badge { display:inline-block; padding:3px 10px; border-radius:4px; font-size:8pt; margin:2px; }
    .kcal { background:#d4edda; color:#155724; }
    .prot { background:#cce5ff; color:#004085; }
    .fat { background:#fff3cd; color:#856404; }
    .carb { background:#f8d7da; color:#721c24; }
    .kbju-row { margin:10px 0; }
    .tech-text { font-size:9pt; line-height:1.6; background:#f8fdf9; padding:12px; border-radius:4px; }
    .footer { margin-top:30px; padding-top:12px; border-top:1px solid #d4edda; font-size:8pt; color:#6c757d; text-align:center; }
    .sign { display:flex; justify-content:space-between; margin-top:20px; font-size:9pt; }
    .sign span { border-top:1px solid #333; padding-top:4px; min-width:200px; text-align:center; }
  </style></head><body>
    <div class="header">
      <h1>ТЕХНОЛОГИЧЕСКАЯ КАРТА</h1>
      <h2>${card.dish_name}</h2>
    </div>
    <div class="content">
      <div class="info-grid">
        <div class="info-item"><strong>Выход</strong>${tw} г</div>
        <div class="info-item"><strong>Время</strong>${card.cooking_time || '—'} мин</div>
        ${card.temperature ? `<div class="info-item"><strong>Подача</strong>${card.temperature}</div>` : ''}
        ${card.shelf_life ? `<div class="info-item"><strong>Срок годности</strong>${card.shelf_life}</div>` : ''}
        ${card.source ? `<div class="info-item"><strong>Источник</strong>${card.source}</div>` : ''}
      </div>
      <div class="section-title">Пищевая ценность (на 100 г)</div>
      <div class="kbju-row">${kbjuBadges(card.kbju)}</div>
      <div class="section-title">Рецептура</div>
      ${ingsTable(ings, tw)}
      ${card.cost_price ? `<p style="font-size:9pt;margin-top:8px;color:#2d6a4f;"><strong>Себестоимость:</strong> ${card.cost_price} ₽</p>` : ''}
      <div class="section-title">Технология приготовления</div>
      <div class="tech-text">${(card.technology || 'Не указана').replace(/\n/g,'<br>')}</div>
      ${card.description ? `<div class="section-title">Требования к сырью</div><div class="tech-text">${card.description.replace(/\n/g,'<br>')}</div>` : ''}
      <div class="sign">
        <span><strong>Технолог</strong><br>${card.technologist || '_____________________'}</span>
        <span><strong>Шеф-повар</strong><br>${card.chef || '_____________________'}</span>
      </div>
      <div class="footer">AI Техкарты • СанПиН 2.3/2.4.3590-20</div>
    </div>
  </body></html>`;
}

// ─── Variant 5: Warm Red (Бургундия) ────────────────
function variant5(card: PdfTechCard): string {
  const ings = card.ingredients || [];
  const tw = card.output || ings.reduce((s, i) => s + i.quantity, 0);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family:'DejaVu Sans',Arial,sans-serif; margin:0; padding:0; background:#fdf2f2; }
    .border { border:2px solid #7f1d1d; margin:15px; padding:0; }
    .title-block { background:#7f1d1d; color:#fdf2f2; padding:16px 24px; text-align:center; }
    .title-block h1 { margin:0; font-size:14pt; font-weight:400; letter-spacing:3px; }
    .title-block h2 { margin:4px 0 0; font-size:16pt; font-weight:700; }
    .content { padding:20px 24px; }
    .meta { font-size:9pt; color:#7f1d1d; text-align:center; margin-bottom:16px; font-style:italic; }
    .info-row { display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
    .info-chip { background:#fff; border:1px solid #fecaca; border-radius:20px; padding:6px 14px; font-size:8pt; color:#7f1d1d; }
    .info-chip strong { display:block; font-size:7pt; color:#9ca3af; text-transform:uppercase; }
    .section-title { font-size:11pt; font-weight:700; color:#7f1d1d; border-bottom:2px solid #fecaca; padding-bottom:4px; margin-top:16px; margin-bottom:10px; }
    table { width:100%; border-collapse:collapse; font-size:9pt; }
    th { background:#7f1d1d; color:#fdf2f2; padding:6px 8px; text-align:center; font-weight:600; }
    td { padding:4px 8px; border:1px solid #fecaca; }
    .badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:8pt; margin:2px; }
    .kcal { background:#fef2f2; color:#991b1b; }
    .prot { background:#eff6ff; color:#1e40af; }
    .fat { background:#fffbeb; color:#92400e; }
    .carb { background:#f0fdf4; color:#166534; }
    .kbju-row { margin:10px 0; }
    .tech-text { font-size:9pt; line-height:1.6; background:#fff; padding:12px; border-radius:8px; border:1px solid #fecaca; }
    .footer { margin-top:24px; font-size:8pt; color:#9ca3af; text-align:center; border-top:1px solid #fecaca; padding-top:10px; }
    .sign { display:flex; justify-content:space-around; margin-top:20px; font-size:9pt; }
    .sign span { border-bottom:1px solid #7f1d1d; padding-bottom:2px; min-width:180px; text-align:center; }
  </style></head><body>
    <div class="border">
      <div class="title-block">
        <h1>ТЕХНОЛОГИЧЕСКАЯ КАРТА</h1>
        <h2>${card.dish_name}</h2>
      </div>
      <div class="content">
        <div class="meta">${card.organization || ''}${card.category ? ' • '+card.category : ''}</div>
        <div class="info-row">
          <div class="info-chip"><strong>Выход</strong>${tw} г</div>
          <div class="info-chip"><strong>Время</strong>${card.cooking_time || '—'} мин</div>
          ${card.temperature ? `<div class="info-chip"><strong>Подача</strong>${card.temperature}</div>` : ''}
          ${card.shelf_life ? `<div class="info-chip"><strong>Срок годности</strong>${card.shelf_life}</div>` : ''}
        </div>
        <div class="section-title">Пищевая ценность</div>
        <div class="kbju-row">${kbjuBadges(card.kbju)}</div>
        <div class="section-title">Рецептура</div>
        ${ingsTable(ings, tw)}
        ${card.cost_price ? `<p style="font-size:9pt;margin-top:8px;color:#7f1d1d;"><strong>Себестоимость:</strong> ${card.cost_price} ₽</p>` : ''}
        <div class="section-title">Технология</div>
        <div class="tech-text">${(card.technology || 'Не указана').replace(/\n/g,'<br>')}</div>
        ${card.description ? `<div class="section-title">Требования к сырью</div><div class="tech-text">${card.description.replace(/\n/g,'<br>')}</div>` : ''}
        <div class="sign">
          <span><strong>Технолог</strong><br>${card.technologist || '_____________________'}</span>
          <span><strong>Шеф-повар</strong><br>${card.chef || '_____________________'}</span>
        </div>
        <div class="footer">AI Техкарты • СанПиН 2.3/2.4.3590-20</div>
      </div>
    </div>
  </body></html>`;
}

// ─── Variant 6: Dark Modern ─────────────────────────
function variant6(card: PdfTechCard): string {
  const ings = card.ingredients || [];
  const tw = card.output || ings.reduce((s, i) => s + i.quantity, 0);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { font-family:'DejaVu Sans',Arial,sans-serif; margin:0; padding:0; background:#0f172a; color:#e2e8f0; }
    .page { background:#1e293b; margin:15px; border-radius:8px; overflow:hidden; }
    .top { background:#334155; padding:16px 24px; display:flex; justify-content:space-between; align-items:center; }
    .top h1 { margin:0; font-size:11pt; font-weight:400; color:#94a3b8; letter-spacing:2px; }
    .top .date { font-size:8pt; color:#64748b; }
    .dish-block { padding:20px 24px 12px; }
    .dish-block h2 { margin:0; font-size:16pt; font-weight:700; color:#f8fafc; }
    .dish-block .cat { font-size:8pt; color:#64748b; margin-top:4px; }
    .content { padding:0 24px 20px; }
    .stats { display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
    .stat { background:#334155; padding:8px 14px; border-radius:6px; text-align:center; }
    .stat .val { font-size:10pt; font-weight:600; color:#f8fafc; }
    .stat .lbl { font-size:7pt; color:#64748b; text-transform:uppercase; letter-spacing:0.5px; }
    .section-title { font-size:10pt; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:1px; margin-top:16px; margin-bottom:8px; }
    table { width:100%; border-collapse:collapse; font-size:9pt; }
    th { background:#334155; color:#94a3b8; padding:6px 8px; text-align:center; font-weight:600; border:1px solid #475569; }
    td { padding:4px 8px; border:1px solid #334155; color:#cbd5e1; }
    tr:nth-child(even) { background:#1e293b; }
    tr:nth-child(odd) { background:#172033; }
    .badge { display:inline-block; padding:3px 10px; border-radius:4px; font-size:8pt; margin:2px; }
    .kcal { background:#78350f33; color:#fb923c; }
    .prot { background:#1e3a5f33; color:#60a5fa; }
    .fat { background:#5b1d5b33; color:#e879f9; }
    .carb { background:#14532d33; color:#4ade80; }
    .kbju-row { margin:10px 0; }
    .tech-text { font-size:9pt; line-height:1.6; color:#cbd5e1; background:#334155; padding:12px; border-radius:6px; }
    .footer { margin-top:20px; padding:12px 24px; border-top:1px solid #334155; font-size:8pt; color:#64748b; text-align:center; }
    .sign { display:flex; justify-content:space-between; margin-top:16px; }
    .sign span { color:#94a3b8; font-size:8pt; border-top:1px solid #475569; padding-top:4px; min-width:160px; text-align:center; }
    .sign span strong { color:#e2e8f0; }
  </style></head><body>
    <div class="page">
      <div class="top">
        <h1>ТЕХНОЛОГИЧЕСКАЯ КАРТА</h1>
        <span class="date">${new Date().toLocaleDateString('ru-RU')}</span>
      </div>
      <div class="dish-block">
        <h2>${card.dish_name}</h2>
        <div class="cat">${card.organization || ''}${card.category ? ' • '+card.category : ''}</div>
      </div>
      <div class="content">
        <div class="stats">
          <div class="stat"><div class="val">${tw}</div><div class="lbl">Выход, г</div></div>
          <div class="stat"><div class="val">${card.cooking_time || '—'}</div><div class="lbl">Мин</div></div>
          ${card.temperature ? `<div class="stat"><div class="val">${card.temperature}</div><div class="lbl">Подача</div></div>` : ''}
          ${card.shelf_life ? `<div class="stat"><div class="val">${card.shelf_life}</div><div class="lbl">Срок</div></div>` : ''}
        </div>
        <div class="section-title">КБЖУ (на 100 г)</div>
        <div class="kbju-row">${kbjuBadges(card.kbju)}</div>
        <div class="section-title">Рецептура</div>
        ${ingsTable(ings, tw)}
        ${card.cost_price ? `<p style="font-size:9pt;margin-top:6px;color:#94a3b8;"><strong>Себестоимость:</strong> ${card.cost_price} ₽</p>` : ''}
        <div class="section-title">Технология</div>
        <div class="tech-text">${(card.technology || 'Не указана').replace(/\n/g,'<br>')}</div>
        ${card.description ? `<div class="section-title">Требования к сырью</div><div class="tech-text">${card.description.replace(/\n/g,'<br>')}</div>` : ''}
        <div class="sign">
          <span><strong>Технолог</strong><br>${card.technologist || '_____________________'}</span>
          <span><strong>Шеф-повар</strong><br>${card.chef || '_____________________'}</span>
        </div>
      </div>
      <div class="footer">AI Техкарты • СанПиН 2.3/2.4.3590-20</div>
    </div>
  </body></html>`;
}

const VARIANTS = [variant1, variant2, variant3, variant4, variant5, variant6];

export function getPdfHtml(card: PdfTechCard, variant: number = 1): string {
  const idx = Math.max(0, Math.min(5, (variant || 1) - 1));
  return VARIANTS[idx](card);
}

export async function generateTechCardPdf(card: PdfTechCard, variant: number = 1): Promise<string> {
  const html = getPdfHtml(card, variant);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  return uri;
}

export const VARIANT_NAMES = [
  'Классический оранжевый',
  'Чистый минимализм',
  'Современный синий',
  'Профессиональный зелёный',
  'Тёплый бордовый',
  'Тёмная тема',
];

export const VARIANT_COLORS = [
  '#e67e22',
  '#333333',
  '#1a56db',
  '#2d6a4f',
  '#7f1d1d',
  '#0f172a',
];