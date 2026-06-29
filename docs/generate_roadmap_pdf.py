from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.units import cm
import os

# Register Cyrillic fonts (Windows)
try:
    pdfmetrics.registerFont(TTFont('Arial', r'C:\Windows\Fonts\arial.ttf'))
    pdfmetrics.registerFont(TTFont('Arial-Bold', r'C:\Windows\Fonts\arialbd.ttf'))
except Exception as e:
    print('Font error:', e)
    raise

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleCyr', fontName='Arial-Bold', fontSize=22, leading=26, spaceAfter=18, textColor=colors.HexColor('#0a192f')))
styles.add(ParagraphStyle(name='HeadingCyr', fontName='Arial-Bold', fontSize=14, leading=18, spaceAfter=8, spaceBefore=14, textColor=colors.HexColor('#0077b6')))
styles.add(ParagraphStyle(name='SubHeadingCyr', fontName='Arial-Bold', fontSize=12, leading=15, spaceAfter=6, spaceBefore=10, textColor=colors.HexColor('#00b4d8')))
styles.add(ParagraphStyle(name='BodyCyr', fontName='Arial', fontSize=10, leading=14, spaceAfter=6))
styles.add(ParagraphStyle(name='BulletCyr', fontName='Arial', fontSize=10, leading=13, leftIndent=14, spaceAfter=4))
styles.add(ParagraphStyle(name='MetaCyr', fontName='Arial', fontSize=9, leading=12, textColor=colors.grey, spaceAfter=12))
styles.add(ParagraphStyle(name='Highlight', fontName='Arial-Bold', fontSize=10, leading=14, textColor=colors.HexColor('#0a192f'), backColor=colors.HexColor('#e0f7fa'), spaceAfter=6, leftIndent=8, rightIndent=8, borderPadding=6))

out_path = os.path.join(os.path.dirname(__file__), 'backoffice-roadmap.pdf')
doc = SimpleDocTemplate(out_path, pagesize=A4, rightMargin=1.5*cm, leftMargin=1.5*cm, topMargin=1.5*cm, bottomMargin=1.5*cm)
story = []

story.append(Paragraph('Дорожная карта back-office FoodChain', styles['TitleCyr']))
story.append(Paragraph('Что добавить и доделать, чтобы обогнать iiko / R-Keeper / Poster / 1С:Ресторан', styles['MetaCyr']))
story.append(Spacer(1, 0.3*cm))

# Intro box
story.append(Paragraph('Цель: вывести FoodChain на уровень, а затем и выше iiko / R-Keeper / Poster / 1С:Ресторан по back-office для ресторанов.', styles['Highlight']))
story.append(Spacer(1, 0.3*cm))

# Phase 1
story.append(Paragraph('Фаза 1. Быстрые победы (1–2 недели)', styles['HeadingCyr']))

story.append(Paragraph('1. Триггерные маркетинговые кампании + RFM', styles['SubHeadingCyr']))
story.append(Paragraph('• Сегментация клиентов: Recency / Frequency / Monetary.', styles['BulletCyr']))
story.append(Paragraph('• Автоматические рассылки: день рождения, 30 дней без заказа, брошенная корзина, повышение уровня лояльности.', styles['BulletCyr']))
story.append(Paragraph('• Каналы: push / SMS / email.', styles['BulletCyr']))
story.append(Paragraph('• <b>Почему важно:</b> у iiko/Poster/R-Keeper это ограничено или отсутствует; Toast делает сильно.', styles['BodyCyr']))

story.append(Paragraph('2. Полноценный расчёт зарплаты', styles['SubHeadingCyr']))
story.append(Paragraph('• Тарифы: оклад/час, ставка за смену, % от выручки, бонусы.', styles['BulletCyr']))
story.append(Paragraph('• Ночные/праздничные, НДФЛ и взносы (РФ).', styles['BulletCyr']))
story.append(Paragraph('• Импорт смен из графика, расчёт за период, экспорт PDF/Excel.', styles['BulletCyr']))
story.append(Paragraph('• <b>Почему важно:</b> iiko и R-Keeper делают полноценно, у FoodChain пока только смены.', styles['BodyCyr']))

story.append(Paragraph('3. Прайс-листы и сравнение поставщиков', styles['SubHeadingCyr']))
story.append(Paragraph('• История закупочных цен, рейтинг поставщика, автоподсказка «заказать у самого дешёвого».', styles['BulletCyr']))

story.append(Paragraph('4. Улучшенная инвентаризация', styles['SubHeadingCyr']))
story.append(Paragraph('• Печать бланков со штрихкодами, мобильный ввод остатков, акт с подписями.', styles['BulletCyr']))

story.append(PageBreak())

# Phase 2
story.append(Paragraph('Фаза 2. Углубление (3–4 недели)', styles['HeadingCyr']))

story.append(Paragraph('5. Планирование производства на основе прогноза', styles['SubHeadingCyr']))
story.append(Paragraph('• Авторассчёт заготовок от продаж за N дней, автосоздание производственных заданий, календарь производства.', styles['BulletCyr']))

story.append(Paragraph('6. Внутренняя бухгалтерия без 1С', styles['SubHeadingCyr']))
story.append(Paragraph('• План счетов, ОСВ, баланс, отчёт о прибылях и убытках, движение денежных средств.', styles['BulletCyr']))
story.append(Paragraph('• Кассовые ордера, учёт кредиторов/дебиторов, экспорт проводок в 1С/Бухсофт.', styles['BulletCyr']))
story.append(Paragraph('• <b>Почему важно:</b> позволит малому бизнесу обходиться без 1С — уникальное преимущество.', styles['BodyCyr']))

story.append(Paragraph('7. Консолидированная аналитика по сети', styles['SubHeadingCyr']))
story.append(Paragraph('• Единый дашборд по филиалам, сравнение по выручке/среднему чеку/фудкосту/персоналу, drill-down до чека.', styles['BulletCyr']))

story.append(Paragraph('8. Расширенная лояльность', styles['SubHeadingCyr']))
story.append(Paragraph('• Гибкие уровни, персональные офферы, реферальная программа, геймификация, A/B тестирование акций.', styles['BulletCyr']))

# Phase 3
story.append(Paragraph('Фаза 3. Масштабирование и экосистема (1–2 месяца)', styles['HeadingCyr']))

story.append(Paragraph('9. Мобильное приложение управляющего', styles['SubHeadingCyr']))
story.append(Paragraph('• PWA/Capacitor: push-уведомления, быстрые отчёты, утверждение заказов поставщикам, фотоотчёты.', styles['BulletCyr']))
story.append(Paragraph('• Алерты: низкие остатки, списания, превышение фудкоста.', styles['BulletCyr']))

story.append(Paragraph('10. Маркетплейс расширений', styles['SubHeadingCyr']))
story.append(Paragraph('• Магазин интеграций (1С, МойСклад, Bitrix24, Telegram, Яндекс.Маркет), вкл/выкл модулей, SDK для разработчиков.', styles['BulletCyr']))

story.append(Paragraph('11. Честный знак / ЕГАИС', styles['SubHeadingCyr']))
story.append(Paragraph('• Интеграция с API «Честный знак», ЕГАИС-декларации, Ветис/Меркурий.', styles['BulletCyr']))

story.append(Paragraph('12. AI-ассистент управляющего', styles['SubHeadingCyr']))
story.append(Paragraph('• Естественно-языковые ответы: «почему упала выручка?», «что заказать у поставщиков?».', styles['BulletCyr']))
story.append(Paragraph('• Автогенерация еженедельного отчёта, voice/чат-интерфейс.', styles['BulletCyr']))
story.append(Paragraph('• <b>Почему важно:</b> уникальное преимущество, которого нет ни у одного конкурента в комплексе.', styles['BodyCyr']))

story.append(PageBreak())

# Unique advantages
story.append(Paragraph('Уникальные конкурентные преимущества', styles['HeadingCyr']))

advantages = [
    ['Автопилот закупок', 'Прогноз → рекомендация заказа → утверждение → приёмка → корректировка остатков'],
    ['AI-копирайтер акций', 'Генерация текста SMS/push под сегмент и любимые блюда'],
    ['Динамическое ценообразование', 'Happy Hour, цены по сегментам, цены по остаткам'],
    ['Полный цикл сотрудника', 'Найм → график → зарплата → мотивация → увольнение в одной системе'],
    ['Бухгалтерия без 1С', 'Полный учёт внутри FoodChain для малого и среднего бизнеса'],
    ['CDP + RFM + LTV прогноз', 'Уровень enterprise-маркетинга'],
]

tbl = Table(advantages, colWidths=[5.5*cm, 10.5*cm])
tbl.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#e0f7fa')),
    ('BACKGROUND', (1, 0), (1, -1), colors.HexColor('#f8fafc')),
    ('TEXTCOLOR', (0, 0), (-1, -1), colors.HexColor('#0a192f')),
    ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('FONTNAME', (0, 0), (0, -1), 'Arial-Bold'),
    ('FONTNAME', (1, 0), (1, -1), 'Arial'),
    ('FONTSIZE', (0, 0), (-1, -1), 9),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
    ('LEFTPADDING', (0, 0), (-1, -1), 8),
    ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ('TOPPADDING', (0, 0), (-1, -1), 7),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
]))
story.append(tbl)
story.append(Spacer(1, 0.4*cm))

# Priority order
story.append(Paragraph('Приоритетный порядок старта', styles['HeadingCyr']))
story.append(Paragraph('1. RFM + триггерные кампании — быстро, сильно влияет на выручку.', styles['BulletCyr']))
story.append(Paragraph('2. Расчёт зарплаты — HR-блок критичен для сетей.', styles['BulletCyr']))
story.append(Paragraph('3. Внутренняя бухгалтерия — позволяет отказаться от 1С для малого бизнеса.', styles['BulletCyr']))
story.append(Paragraph('4. Мобильное приложение управляющего — отличает от десктопных конкурентов.', styles['BulletCyr']))
story.append(Paragraph('5. Маркетплейс + AI-ассистент — формирует экосистему.', styles['BulletCyr']))

# Metrics
story.append(Paragraph('Метрики обгона (через 12 месяцев)', styles['HeadingCyr']))
story.append(Paragraph('• 100% функционала iiko / R-Keeper в back-office.', styles['BulletCyr']))
story.append(Paragraph('• 100% функционала Poster.', styles['BulletCyr']))
story.append(Paragraph('• 90%+ функционала 1С:Ресторан (кроме узкой бухгалтерии).', styles['BulletCyr']))
story.append(Paragraph('• Уникальные фичи: AI-ассистент, CDP+RFM, автопилот закупок, мобильное приложение управляющего.', styles['BulletCyr']))

story.append(Spacer(1, 0.5*cm))
story.append(Paragraph('FoodChain Enterprise — дорожная карта back-office, июнь 2026', styles['MetaCyr']))

doc.build(story)
print('PDF created:', out_path)
