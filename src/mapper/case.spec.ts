import { camelCase, makeTransform, pascalCase, snakeCase } from './case'

describe('case', () => {
  describe('camelCase', () => {
    it('should split a camel case string into words', () => {
      expect(camelCase.words('fooBar')).toEqual(['foo', 'Bar'])
    })

    it('should split multiple uppercase into correct words', () => {
      expect(camelCase.words('someAPIStuff')).toEqual(['some', 'API', 'Stuff'])
    })

    it('should build a camel case string', () => {
      expect(camelCase.string(['foo', 'bar'])).toEqual('fooBar')
    })

    it('should allow digits when splitting', () => {
      expect(camelCase.words('foo1Bar3')).toEqual(['foo1', 'Bar3'])
    })

    it('should allow digits when joining', () => {
      expect(camelCase.string(['foo1', 'bar3'])).toEqual('foo1Bar3')
    })
  })

  describe('pascalCase', () => {
    it('should split a pascal case string into words', () => {
      expect(pascalCase.words('FooBar')).toEqual(['Foo', 'Bar'])
    })

    it('should split multiple uppercase into correct words', () => {
      expect(pascalCase.words('SomeAPIStuff')).toEqual(['Some', 'API', 'Stuff'])
    })

    it('should build a pascal case string', () => {
      expect(pascalCase.string(['foo', 'bar'])).toEqual('FooBar')
    })

    it('should allow digits when splitting', () => {
      expect(pascalCase.words('Foo1Bar3')).toEqual(['Foo1', 'Bar3'])
    })

    it('should allow digits when joining', () => {
      expect(pascalCase.string(['foo1', 'bar3'])).toEqual('Foo1Bar3')
    })
  })

  describe('snakeCase', () => {
    it('should split a snake case string into words', () => {
      expect(snakeCase.words('foo_bar')).toEqual(['foo', 'bar'])
    })

    it('should build a snake case string', () => {
      expect(snakeCase.string(['foo', 'bar'])).toEqual('foo_bar')
    })

    it('should allow digits when splitting', () => {
      expect(snakeCase.words('foo1_bar3')).toEqual(['foo1', 'bar3'])
    })

    it('should allow digits when joining', () => {
      expect(snakeCase.string(['foo1', 'bar3'])).toEqual('foo1_bar3')
    })
  })

  describe('transforms', () => {
    it('should transform from left to right', () => {
      expect(makeTransform(camelCase, snakeCase).leftToRight('fooBar')).toBe(
        'foo_bar'
      )
    })
    it('should transform from right to left', () => {
      expect(makeTransform(camelCase, snakeCase).rightToLeft('foo_bar')).toBe(
        'fooBar'
      )
    })
  })
})
