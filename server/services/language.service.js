function updateUserLanguage(db, userId, language) {
  const stmt = db.prepare('UPDATE staff SET language = ? WHERE id = ?');
  return stmt.run(language, userId);
}

function getUserLanguage(db, userId) {
  const stmt = db.prepare('SELECT language FROM staff WHERE id = ?');
  const row = stmt.get(userId);
  return row ? row.language : 'ru';
}

module.exports = { updateUserLanguage, getUserLanguage };
