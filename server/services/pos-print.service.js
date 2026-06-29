const escpos = require('escpos');

function getDevice(printer) {
  const conn = String(printer.connection || '');
  if (printer.type === 'ethernet' && conn.includes(':')) {
    const [host, port] = conn.split(':');
    return new escpos.Network(host, Number(port) || 9100);
  } else if (printer.type === 'usb') {
    return new escpos.USB();
  }
  throw new Error('Неподдерживаемый тип принтера');
}

async function printReceiptToPrinter(printer, lines) {
  return new Promise((resolve, reject) => {
    try {
      const device = getDevice(printer);
      const options = { encoding: 'CP866', width: printer.width || 48 };
      const printerObj = new escpos.Printer(device, options);
      device.open((err) => {
        if (err) return reject(err);
        printerObj
          .font('a')
          .align('ct')
          .style('normal')
          .size(1, 1);
        lines.forEach(line => {
          const align = line.startsWith('^') ? 'ct' : line.startsWith('<') ? 'lt' : 'lt';
          const text = line.replace(/^[\^<]/, '');
          printerObj.align(align).text(text);
        });
        printerObj.cut().close(() => resolve({ success: true }));
      });
    } catch (e) { reject(e); }
  });
}

async function openCashDrawer(printer) {
  return new Promise((resolve, reject) => {
    try {
      const device = getDevice(printer);
      const printerObj = new escpos.Printer(device);
      device.open((err) => {
        if (err) return reject(err);
        // ESC/POS pulse to drawer pin 2
        printerObj.raw(Buffer.from([0x1B, 0x70, 0x00, 0x19, 0xFA]));
        setTimeout(() => { try { device.close(); } catch {} resolve({ success: true }); }, 300);
      });
    } catch (e) { reject(e); }
  });
}

function generateReceiptLines(order, settings, paymentMethodName, received, change) {
  const lines = [];
  lines.push(`^${settings.orgName || 'FoodChain'}`);
  lines.push(`ИНН: ${settings.orgInn || '—'}`);
  lines.push('——————————————————————');
  lines.push(`Кассир: ${order.handledByName || '—'}`);
  lines.push(`Смена: #${order.shiftId || '—'}`);
  lines.push(`Дата: ${new Date().toLocaleString('ru-RU')}`);
  lines.push('——————————————————————');
  order.items.forEach((i) => {
    lines.push(`${i.name}`);
    lines.push(`${i.quantity} x ${i.price} = ${i.quantity * i.price}`);
  });
  lines.push('——————————————————————');
  lines.push(`^ИТОГО: ${order.total}`);
  lines.push(`Оплата: ${paymentMethodName}`);
  if (change > 0) lines.push(`Сдача: ${change}`);
  lines.push('——————————————————————');
  lines.push(settings.receiptFooter || 'Спасибо за покупку!');
  return lines;
}

function generateKitchenLines(order, stationName) {
  const lines = [];
  lines.push(`^ЗАКАЗ #${order.id}`);
  lines.push(`Стол: ${order.tableName || '—'}`);
  lines.push(`Время: ${new Date().toLocaleString('ru-RU')}`);
  lines.push('——————————————————————');
  order.items.forEach(i => {
    lines.push(`${i.quantity} x ${i.name}`);
    if (i.comment) lines.push(`> ${i.comment}`);
  });
  lines.push('——————————————————————');
  if (stationName) lines.push(`^${stationName}`);
  return lines;
}

module.exports = { printReceiptToPrinter, openCashDrawer, generateReceiptLines, generateKitchenLines };
