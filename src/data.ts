export const formatLocalDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export const DAY_NAMES_FULL = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
export const DAY_NAMES_SHORT = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
