export function useOrderTimer(createdAt: string | undefined, warnMinutes = 20) {
  const getElapsed = () => {
    if (!createdAt) return '--:--';
    const diff = Date.now() - new Date(createdAt).getTime();
    if (diff < 0) return '00:00';
    const m = Math.floor(diff / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };
  const getIsWarning = () => {
    if (!createdAt) return false;
    const diff = Date.now() - new Date(createdAt).getTime();
    return diff > warnMinutes * 60 * 1000;
  };
  return { getElapsed, getIsWarning, warnMinutes };
}
