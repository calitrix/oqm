import * as RT from '../runtypes'

import { columns } from './utils'

describe('utils', () => {
  describe('columns', () => {
    it('should create a stringified column list', () => {
      expect(columns(RT.Record({ a: RT.Number, b: RT.Number }))).toBe(
        '"a", "b"'
      )
    })

    it('should create a aliased column list', () => {
      expect(
        columns(RT.Aliased('t', RT.Record({ a: RT.Number, b: RT.Number })))
      ).toBe('"t"."a" AS "t__a", "t"."b" AS "t__b"')
    })

    it('should create a combined column list', () => {
      expect(
        columns(
          RT.Record({ a: RT.Number }),
          RT.Aliased('t', RT.Record({ b: RT.Number }))
        )
      ).toBe('"a", "t"."b" AS "t__b"')
    })
  })
})
