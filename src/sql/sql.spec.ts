import { sql } from './sql'

describe('sql', () => {
  describe('basic queries', () => {
    it('should insert sql parameters for values', () => {
      expect(sql`SELECT * FROM foo WHERE a = ${1}`.toQuery()).toEqual({
        text: 'SELECT * FROM foo WHERE a = $1',
        values: [1],
      })
    })

    it('should handle parameters at the end of the query', () => {
      expect(
        sql`SELECT * FROM foo WHERE a = ${1} AND b = ${2}`.toQuery()
      ).toEqual({
        text: 'SELECT * FROM foo WHERE a = $1 AND b = $2',
        values: [1, 2],
      })
    })

    it('should handle no parameters at the end', () => {
      expect(
        sql`SELECT * FROM foo WHERE a = ${1} AND b = 2`.toQuery().text
      ).toEqual('SELECT * FROM foo WHERE a = $1 AND b = 2')
    })

    it('should handle parameters at the beginning', () => {
      expect(sql`${1} == 1`.toQuery().text).toEqual('$1 == 1')
    })

    it('should store parameter values in the query object', () => {
      expect(sql`${1} == 1`.toQuery().values).toEqual([1])
    })

    it('should combine nested query templates', () => {
      const where = sql`a = ${1}`
      expect(sql`SELECT * FROM foo WHERE ${where}`.toQuery().text).toEqual(
        'SELECT * FROM foo WHERE a = $1'
      )
    })
  })

  describe('parameter mapping', () => {
    it('should support overriding the default values', () => {
      const queryFn = sql`SELECT * FROM foo WHERE bar = ${1}`
      expect(queryFn.toQuery().values).toEqual([1])
      expect(queryFn(2).toQuery().values).toEqual([2])
    })

    it('should skip overrides if undefined', () => {
      const queryFn = sql`SELECT * FROM foo WHERE bar = ${1} AND baz = ${2}`
      expect(queryFn.toQuery().values).toEqual([1, 2])
      expect(queryFn(undefined, 3).toQuery().values).toEqual([1, 3])
    })

    it('should support complex parameters', () => {
      type User = { id: number; name: string }
      const queryFn = sql`SELECT * FROM foo WHERE bar = ${(user: User) =>
        user.id} AND id = ${(n: number) => n}`

      expect(queryFn({ id: 1, name: 'John Doe' }, 1).toQuery()).toEqual({
        text: 'SELECT * FROM foo WHERE bar = $1 AND id = $2',
        values: [{ id: 1, name: 'John Doe' }, 1],
      })
    })
  })

  describe('query combination', () => {
    it('should flatten multiple queries when combining', () => {
      const queryA = sql`id = ${1}`
      const queryB = sql`SELECT * FROM foo WHERE ${queryA}`

      expect(queryB().toQuery()).toEqual({
        text: 'SELECT * FROM foo WHERE id = $1',
        values: [1],
      })
    })

    it('should correctly enumerate parameters when combining', () => {
      // TODO type for any injectable value
      const queryA = sql<[unknown]>`id = ${undefined}`
      const queryB = sql`(SELECT id FROM bar WHERE stuff = ${2})`
      const queryC = sql`SELECT * FROM foo WHERE foo = ${3} AND ${queryA(
        queryB
      )} AND b = ${4}`

      expect(queryC().toQuery()).toEqual({
        text: 'SELECT * FROM foo WHERE foo = $1 AND id = (SELECT id FROM bar WHERE stuff = $2) AND b = $3',
        values: [3, 2, 4],
      })
    })

    it('should skip unused parameters while numerating', () => {
      const queryA = sql<[unknown]>`id = ${undefined}`
      const queryB = sql`(SELECT id FROM bar WHERE stuff = true)`
      const queryC = sql`SELECT * FROM foo WHERE foo = ${3} AND ${queryA(
        queryB
      )} AND b = ${4}`

      expect(queryC().toQuery()).toEqual({
        text: 'SELECT * FROM foo WHERE foo = $1 AND id = (SELECT id FROM bar WHERE stuff = true) AND b = $2',
        values: [3, 4],
      })
    })
  })
})
