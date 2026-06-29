from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
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
styles.add(ParagraphStyle(name='TitleCyr', fontName='Arial-Bold', fontSize=18, leading=22, spaceAfter=12))
styles.add(ParagraphStyle(name='HeadingCyr', fontName='Arial-Bold', fontSize=12, leading=14, spaceAfter=6, spaceBefore=10))
styles.add(ParagraphStyle(name='BodyCyr', fontName='Arial', fontSize=9, leading=12))
styles.add(ParagraphStyle(name='Cell', fontName='Arial', fontSize=7, leading=9))
styles.add(ParagraphStyle(name='CellBold', fontName='Arial-Bold', fontSize=7, leading=9))

out_path = os.path.join(os.path.dirname(__file__), 'backoffice-comparison.pdf')
doc = SimpleDocTemplate(out_path, pagesize=landscape(A4), rightMargin=1*cm, leftMargin=1*cm, topMargin=1*cm, bottomMargin=1*cm)
story = []

story.append(Paragraph('Сравнение back-office FoodChain с конкурентами', styles['TitleCyr']))
story.append(Paragraph('Легенда: ● — развито, ○ — ограничено, - — нет, ✅ — есть в FoodChain, 🔄 — заглушка, ❌ — нет', styles['BodyCyr']))
story.append(Spacer(1, 0.3*cm))

competitors = ['FoodChain', 'iiko', 'R-Keeper', 'Poster', '1С', 'Toast', 'Lightspeed', 'Jowi']

data = [
    ['Блок / функция'] + competitors,
    ['POS-терминал', '✅', '●', '●', '●', '○', '●', '●', '○'],
    ['Кухонный дисплей (KDS)', '✅', '●', '●', '○', '○', '●', '○', '○'],
    ['План зала / бронирование', '✅', '●', '●', '○', '○', '○', '○', '-'],
    ['Онлайн-заказы / QR / киоск', '✅', '○', '○', '○', '○', '●', '●', '○'],
    ['Доставка / диспетчеризация', '✅', '●', '●', '○', '○', '●', '○', '○'],
    ['Агрегаторы доставки', '🔄', '●', '●', '○', '○', '○', '○', '○'],
    ['Справочник товаров / категории', '✅', '●', '●', '●', '●', '●', '●', '●'],
    ['Технологические карты', '✅', '●', '●', '○', '●', '○', '○', '●'],
    ['Автосписание по продажам', '✅', '●', '●', '○', '●', '○', '○', '○'],
    ['Акты пересчёта', '✅', '●', '●', '○', '●', '○', '○', '○'],
    ['Заказы поставщикам / приёмка', '✅', '●', '●', '○', '●', '○', '○', '○'],
    ['Перемещения / возвраты', '✅', '●', '●', '○', '●', '○', '○', '○'],
    ['Списание сроков годности', '✅', '●', '●', '○', '●', '-', '-', '○'],
    ['Производственные задания', '✅', '●', '●', '-', '●', '-', '-', '○'],
    ['Прогноз спроса / автозаказы', '✅', '●', '○', '-', '○', '○', '-', '○'],
    ['База клиентов / сегментация', '✅', '●', '●', '●', '○', '●', '●', '○'],
    ['Программа лояльности', '✅', '●', '●', '●', '○', '●', '○', '○'],
    ['Отзывы / оценки', '✅', '○', '○', '○', '-', '○', '○', '-'],
    ['Рассылки / push / SMS / email', '✅', '○', '○', '○', '-', '○', '○', '-'],
    ['Триггерные кампании', '❌', '○', '-', '○', '-', '●', '○', '-'],
    ['RFM-анализ', '❌', '○', '-', '○', '-', '●', '○', '-'],
    ['Сотрудники / роли / доступ', '✅', '●', '●', '●', '○', '●', '○', '○'],
    ['Графики работы', '✅', '●', '●', '○', '○', '●', '○', '○'],
    ['Расчёт зарплаты по сменам', '○', '●', '●', '-', '○', '●', '-', '-'],
    ['Учёт чаевых / премий', '✅', '○', '○', '-', '-', '●', '-', '-'],
    ['Смены / X-Z отчёты', '✅', '●', '●', '●', '●', '●', '●', '○'],
    ['Кассовые операции', '✅', '●', '●', '○', '●', '●', '○', '○'],
    ['Онлайн-оплаты / эквайринг', '✅', '●', '●', '●', '○', '●', '●', '○'],
    ['Фискализация (54-ФЗ)', '✅', '●', '●', '●', '●', '-', '-', '-'],
    ['Налоговый учёт / НДС', '✅', '○', '○', '-', '●', '-', '-', '-'],
    ['Бухгалтерия / баланс / ОСВ', '○', '●', '●', '-', '●', '○', '-', '-'],
    ['Экспорт в 1С / МойСклад / Битрикс', '🔄', '●', '●', '-', '●', '○', '○', '-'],
    ['Дашборд / KPI', '✅', '●', '●', '●', '○', '●', '●', '○'],
    ['Продажи / категории / блюда', '✅', '●', '●', '●', '○', '●', '●', '○'],
    ['Прибыль / P&L / ABC', '✅', '●', '●', '○', '●', '●', '○', '○'],
    ['Фудкост / себестоимость', '✅', '●', '●', '-', '●', '○', '-', '○'],
    ['Расхождения инвентаризации', '✅', '●', '●', '-', '●', '-', '-', '-'],
    ['Мульти-тенантность / франчайзинг', '✅', '○', '○', '○', '-', '●', '●', '-'],
    ['Филиальная сеть', '✅', '●', '●', '○', '○', '●', '●', '○'],
    ['API / интеграции', '✅', '●', '●', '○', '○', '●', '●', '○'],
    ['Маркетплейс приложений', '❌', '●', '○', '○', '-', '●', '●', '-'],
    ['Мобильное приложение управляющего', '❌', '●', '●', '●', '-', '●', '●', '○'],
    ['Офлайн-режим', '✅', '●', '●', '○', '-', '○', '○', '-'],
    ['Резервное копирование', '✅', '○', '○', '●', '-', '●', '●', '○'],
]

# Convert to Paragraphs for wrapping
styled_data = []
for i, row in enumerate(data):
    styled_row = []
    for j, cell in enumerate(row):
        style = styles['CellBold'] if i == 0 or j == 0 else styles['Cell']
        styled_row.append(Paragraph(str(cell), style))
    styled_data.append(styled_row)

table = Table(styled_data, colWidths=[6.5*cm] + [2.4*cm]*8, repeatRows=1)
table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f3f4f6')),
    ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#f9fafb')),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ('ALIGN', (0, 0), (0, -1), 'LEFT'),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ('LEFTPADDING', (0, 0), (-1, -1), 4),
    ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ('TOPPADDING', (0, 0), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
]))
story.append(table)

story.append(Spacer(1, 0.5*cm))
story.append(Paragraph('Основные пробелы FoodChain', styles['HeadingCyr']))
gaps = [
    '1. Триггерные маркетинговые кампании + RFM-сегментация.',
    '2. Полноценный расчёт зарплаты по сменам/часам/премиям.',
    '3. Внутренняя бухгалтерия / ОСВ / баланс.',
    '4. Мобильное приложение управляющего.',
    '5. Маркетплейс расширений.',
    '6. Честный знак / ЕГАИС (требует реальных ключей).',
]
for g in gaps:
    story.append(Paragraph(g, styles['BodyCyr']))

story.append(Spacer(1, 0.3*cm))
story.append(Paragraph('Матрица составлена на основе публично заявленного функционала продуктов.', styles['BodyCyr']))

doc.build(story)
print('PDF created:', out_path)
