export type WordList = string[]
export type CaseParser = {
  words(input: string): WordList
  string(input: WordList): string
}
export type CaseTransform = {
  left: CaseParser
  right: CaseParser
  leftToRight: (string: string) => string
  rightToLeft: (string: string) => string
}

const wordCase = (word: string): string =>
  word.length ? word[0].toUpperCase() + word.slice(1) : ''

const lowerCase = (word: string): string => word.toLowerCase()

export const camelCase: CaseParser = {
  words(input) {
    return input
      .split(/([A-Z]+(?=[A-Z+])|[A-Z][a-z\d]+)/)
      .filter((word) => !!word)
  },
  string(words) {
    return words
      .map((word, index) => (index === 0 ? lowerCase(word) : wordCase(word)))
      .join('')
  },
}

export const pascalCase: CaseParser = {
  words(input) {
    return input
      .split(/([A-Z]+(?=[A-Z+])|[A-Z][a-z\d]+)/)
      .filter((word) => !!word)
  },
  string(words) {
    return words.map(wordCase).join('')
  },
}

export const snakeCase: CaseParser = {
  words(input) {
    return input.split('_')
  },
  string(words) {
    return words.map(lowerCase).join('_')
  },
}

export const makeTransform = (
  left: CaseParser,
  right: CaseParser
): CaseTransform => ({
  left,
  right,
  leftToRight(string) {
    return right.string(left.words(string))
  },
  rightToLeft(string) {
    return left.string(right.words(string))
  },
})
