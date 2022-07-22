import { camelCase, makeTransform, snakeCase } from '../mapper'
import * as RT from '../runtypes'
import { makeSql } from '../sql'

import { columns } from './utils'

describe('utils', () => {
  describe('columns', () => {
    it('should create a stringified column list', () => {
      expect(
        columns(RT.Record({ a: RT.Number, b: RT.Number })).toQuery().text
      ).toBe('"a", "b"')
    })

    it('should create a aliased column list', () => {
      expect(
        columns(
          RT.Aliased('t', RT.Record({ a: RT.Number, b: RT.Number }))
        ).toQuery().text
      ).toBe('"t"."a" AS "t__a", "t"."b" AS "t__b"')
    })

    it('should create a combined column list', () => {
      expect(
        columns(
          RT.Record({ a: RT.Number }),
          RT.Aliased('t', RT.Record({ b: RT.Number }))
        ).toQuery().text
      ).toBe('"a", "t"."b" AS "t__b"')
    })

    it('should use case transforms if provided', () => {
      const config = {
        caseTransform: makeTransform(camelCase, snakeCase),
      }
      const sql = makeSql(config)

      expect(
        sql`${columns(
          RT.Record({ someCol: RT.Number, otherCol: RT.Number })
        )}`.toQuery().text
      ).toBe('"some_col", "other_col"')
    })

    it('should use case transforms with aliases if provided', () => {
      const config = {
        caseTransform: makeTransform(camelCase, snakeCase),
      }
      const sql = makeSql(config)

      expect(
        sql`${columns(
          RT.Aliased(
            'tab',
            RT.Record({ someCol: RT.Number, otherCol: RT.Number })
          )
        )}`.toQuery().text
      ).toBe(
        '"tab"."some_col" AS "tab__some_col", "tab"."other_col" AS "tab__other_col"'
      )
    })
  })
})
