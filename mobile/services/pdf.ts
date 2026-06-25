import * as Print from 'expo-print';

interface PdfTechCard {
  dish_name: string;
  organization?: string;
  category?: string;
  ingredients?: { name: string; quantity: number; unit: string }[];
  kbju?: { calories?: number; proteins?: number; fats?: number; carbs?: number };
  output?: number;
  cooking_time?: number;
  technology?: string;
  description?: string;
  cost_price?: number;
  portions?: number;
  source?: string;
}

export async function generateTechCardPdf(card: PdfTechCard): Promise<string> {
  const ings = (card.ingredients || []).map((ing, i) => `
    <tr>
      <td style="padding:4px 8px;border:1px solid #ccc;text-align:center">${i + 1}</td>
      <td style="padding:4px 8px;border:1px solid #ccc">${ing.name}</td>
      <td style="padding:4px 8px;border:1px solid #ccc;text-align:center">${ing.quantity}</td>
      <td style="padding:4px 8px;border:1px solid #ccc;text-align:center">${ing.unit}</td>
    </tr>
  `).join('');

  const totalWeight = card.output || (card.ingredients || []).reduce((s, i) => s + i.quantity, 0);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'DejaVu Sans', Arial, sans-serif; margin: 20px; color: #1a1a1a; }
    h1 { text-align: center; font-size: 16pt; margin-bottom: 4px; }
    .subtitle { text-align: center; font-size: 10pt; color: #666; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 9pt; }
    th { background: #f0f0f0; padding: 6px 8px; border: 1px solid #ccc; text-align: center; font-weight: 600; }
    td { padding: 4px 8px; border: 1px solid #ccc; }
    .section-title { font-size: 11pt; font-weight: 600; margin-top: 16px; margin-bottom: 8px; color: #333; border-bottom: 2px solid #333; padding-bottom: 4px; }
    .info-row { display: flex; justify-content: space-between; font-size: 9pt; margin: 4px 0; }
    .tech-text { font-size: 9pt; line-height: 1.5; }
    .footer { margin-top: 30px; font-size: 8pt; color: #999; text-align: center; border-top: 1px solid #ddd; padding-top: 10px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 8pt; margin: 2px; }
    .badge-kcal { background: #fff3e0; }
    .badge-protein { background: #e3f2fd; }
    .badge-fat { background: #fff8e1; }
    .badge-carb { background: #e8f5e9; }
    .kbju-row { text-align: center; margin: 12px 0; }
  </style>
</head>
<body>
  <h1>ТЕХНОЛОГИЧЕСКАЯ КАРТА</h1>
  <p class="subtitle">${card.organization || ''}${card.category ? ' | Категория: ' + card.category : ''}</p>

  <table>
    <tr><td style="width:30%"><strong>Наименование блюда:</strong></td><td>${card.dish_name}</td></tr>
    <tr><td><strong>Выход готового блюда:</strong></td><td>${totalWeight} г</td></tr>
    <tr><td><strong>Время приготовления:</strong></td><td>${card.cooking_time || '—'} мин</td></tr>
    ${card.source ? `<tr><td><strong>Источник рецептуры:</strong></td><td>${card.source}</td></tr>` : ''}
  </table>

  <div class="section-title">КБЖУ (на 100 г)</div>
  <div class="kbju-row">
    <span class="badge badge-kcal">🔥 ${card.kbju?.calories || 0} ккал</span>
    <span class="badge badge-protein">Белки ${card.kbju?.proteins || 0} г</span>
    <span class="badge badge-fat">Жиры ${card.kbju?.fats || 0} г</span>
    <span class="badge badge-carb">Углеводы ${card.kbju?.carbs || 0} г</span>
  </div>

  <div class="section-title">РЕЦЕПТУРА</div>
  <table>
    <thead>
      <tr><th>№</th><th>Наименование сырья</th><th>Нетто, г</th><th>Ед.</th></tr>
    </thead>
    <tbody>
      ${ings}
      <tr style="font-weight:600;background:#f9f9f9">
        <td colspan="2" style="text-align:right">Итого:</td>
        <td style="text-align:center">${totalWeight}</td>
        <td style="text-align:center">г</td>
      </tr>
    </tbody>
  </table>

  ${card.cost_price ? `
    <div class="info-row"><span><strong>Себестоимость:</strong></span><span>${card.cost_price} ₽${(card.portions || 0) > 1 ? ` (${card.portions} порций)` : ''}</span></div>
  ` : ''}

  <div class="section-title">ТЕХНОЛОГИЯ ПРИГОТОВЛЕНИЯ</div>
  <div class="tech-text">${(card.technology || 'Не указана').replace(/\n/g, '<br>')}</div>

  ${card.description ? `
    <div class="section-title">ТРЕБОВАНИЯ К СЫРЬЮ</div>
    <div class="tech-text">${card.description.replace(/\n/g, '<br>')}</div>
  ` : ''}

  <div class="footer">
    Документ сгенерирован автоматически в приложении «AI Техкарты»<br>
    Соответствует требованиям СанПиН 2.3/2.4.3590-20
  </div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({ html, base64: false });
  const pdfName = `techcard_${card.dish_name.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.pdf`;
  // In expo-file-system v18+, use Directory/File API
  // Fallback: just return the generated URI
  return uri;
}
