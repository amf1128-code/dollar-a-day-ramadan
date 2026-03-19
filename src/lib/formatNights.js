export function formatNightNumbers(numbers) {
  if (!numbers || numbers.length === 0) return '';
  const sorted = [...numbers].sort((a, b) => a - b);

  const ranges = [];
  let start = sorted[0];
  let end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);

  return `Nights ${ranges.join(', ')}`;
}
