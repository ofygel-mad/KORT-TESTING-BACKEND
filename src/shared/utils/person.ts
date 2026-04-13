const WORD_START_RE = /(^|[\s-]+)([a-zа-яёәіңғүұқөһ])/giu;

export function formatPersonNameInput(value: string): string {
  return value
    .replace(/\s+/g, ' ')
    .trimStart()
    .toLocaleLowerCase('ru-RU')
    .replace(WORD_START_RE, (match, separator: string, letter: string) => {
      const upper = letter.toLocaleUpperCase('ru-RU');
      return `${separator}${upper}`;
    });
}
