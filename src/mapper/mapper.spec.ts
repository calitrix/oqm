import * as RT from 'runtypes'

import { Aliased, Id } from '../runtypes'
import { camelCase, makeTransform, snakeCase } from './case'

import { makeMap, map } from './mapper'

describe('map', () => {
  const MapAB = RT.Record({
    a: RT.Number,
    b: RT.String,
  })

  it('should apply a simple mapping', () => {
    const result = map([{ a: 1, b: 'foo' }], MapAB)

    expect(result).toEqual([{ a: 1, b: 'foo' }])
  })

  it('should apply a sequence of mappings', () => {
    const result = map(
      [
        { a: 1, b: 'foo' },
        { a: 2, b: 'foo2' },
      ],
      MapAB
    )

    expect(result).toEqual([
      { a: 1, b: 'foo' },
      { a: 2, b: 'foo2' },
    ])
  })

  it('should map a 1:1 relation', () => {
    const result = map(
      [{ a: 1, b: 'foo', d: 3 }],
      MapAB.extend({
        c: RT.Record({
          d: RT.Number,
        }),
      })
    )

    expect(result).toEqual([{ a: 1, b: 'foo', c: { d: 3 } }])
  })

  it('should map a nested 1:1 relation', () => {
    const result = map(
      [{ a: 1, b: 'foo', d: 3, e: 4 }],
      MapAB.extend({
        r1: RT.Record({
          d: RT.Number,
          r2: RT.Record({
            e: RT.Number,
          }),
        }),
      })
    )

    expect(result).toEqual([{ a: 1, b: 'foo', r1: { d: 3, r2: { e: 4 } } }])
  })

  it('should skip unmatched left joins (all null results)', () => {
    const result = map(
      [{ a: 1, b: 'foo', d: null, e: null }],
      MapAB.extend({
        c: RT.Record({
          d: RT.String,
          e: RT.String,
        }),
      })
    )

    expect(result).toEqual([{ a: 1, b: 'foo', c: null }])
  })

  it('should skip a nested all-null reference mapping', () => {
    const result = map(
      [{ a: 1, b: 'foo', d: 3, e: null }],
      MapAB.extend({
        r1: RT.Record({
          d: RT.String,
          r2: RT.Record({ e: RT.String }),
        }),
      })
    )

    expect(result).toEqual([{ a: 1, b: 'foo', r1: { d: 3, r2: null } }])
  })

  it('should map reference with some null values', () => {
    const result = map(
      [{ a: 1, b: 'foo', d: null, e: 1 }],
      MapAB.extend({
        c: RT.Record({
          d: RT.String,
          e: RT.String,
        }),
      })
    )

    expect(result).toEqual([{ a: 1, b: 'foo', c: { d: null, e: 1 } }])
  })

  it('should map 1:m relations', () => {
    const result = map(
      [{ a: 1, b: 2, c: 3 }],
      MapAB.extend({
        a: Id(RT.Number),
        many: RT.Array(RT.Record({ c: Id(RT.Number) })),
      })
    )
    expect(result).toEqual([{ a: 1, b: 2, many: [{ c: 3 }] }])
  })

  it('should throw if the root id column is null when mapping collections', () => {
    expect(() => {
      map(
        [{ a: 1, b: 2, c: 3 }],
        MapAB.extend({
          a: RT.Number, // should be wrapped with Id() to fail the test
          many: RT.Array(RT.Record({ c: Id(RT.Number) })),
        })
      )
    }).toThrow('null value in discriminator column')
  })

  it('should set nested collection to null if the parent record is null ', () => {
    const result = map(
      [{ a: 1, b: null, c: null }],
      RT.Record({
        a: Id(RT.Number),
        r1: RT.Record({
          b: Id(RT.String),
          c1: RT.Array(
            RT.Record({
              c: Id(RT.String),
            })
          ),
        }),
      })
    )

    expect(result).toEqual([{ a: 1, r1: null }])
  })

  it('should group collection items by parent id', () => {
    const result = map(
      [
        { a: 1, b: 2, c: 3 },
        { a: 1, b: 4, c: 5 },
        { a: 2, b: 6, c: 7 },
        { a: 2, b: 8, c: 9 },
      ],
      RT.Record({
        a: Id(RT.Number),
        c1: RT.Array(
          RT.Record({
            b: Id(RT.Number),
            c: RT.Number,
          })
        ),
      })
    )

    expect(result).toEqual([
      {
        a: 1,
        c1: [
          { b: 2, c: 3 },
          { b: 4, c: 5 },
        ],
      },
      {
        a: 2,
        c1: [
          { b: 6, c: 7 },
          { b: 8, c: 9 },
        ],
      },
    ])
  })

  it('should skip all-null collection items mapping', () => {
    const result = map(
      [
        { a: 1, b: 'foo', d: 3, e: null },
        { a: 1, b: 'foo', d: 4, e: null },
        { a: 2, b: 'foo', d: null, e: null },
      ],
      RT.Record({
        a: Id(RT.Number),
        b: RT.String,
        c1: RT.Array(
          RT.Record({
            d: Id(RT.Number),
            e: RT.String,
          })
        ),
      })
    )

    expect(result).toEqual([
      {
        a: 1,
        b: 'foo',
        c1: [
          { d: 3, e: null },
          { d: 4, e: null },
        ],
      },
      { a: 2, b: 'foo', c1: [] },
    ])
  })

  it('should group multiple (cross-selected) collections by parent id', () => {
    const result = map(
      [
        { a: 1, b: 2, c: 3 },
        { a: 1, b: 2, c: 4 },
        { a: 1, b: 2, c: 6 },
        { a: 1, b: 5, c: 3 },
        { a: 1, b: 5, c: 4 },
        { a: 1, b: 5, c: 6 },
        { a: 2, b: 7, c: 8 },
        { a: 2, b: 7, c: 9 },
      ],
      RT.Record({
        a: Id(RT.Number),
        c1: RT.Array(
          RT.Record({
            b: Id(RT.Number),
          })
        ),
        c2: RT.Array(
          RT.Record({
            c: Id(RT.Number),
          })
        ),
      })
    )

    expect(result).toEqual([
      {
        a: 1,
        c1: [{ b: 2 }, { b: 5 }],
        c2: [{ c: 3 }, { c: 4 }, { c: 6 }],
      },
      {
        a: 2,
        c1: [{ b: 7 }],
        c2: [{ c: 8 }, { c: 9 }],
      },
    ])
  })

  it('should group nested collections by parent id(s)', () => {
    const result = map(
      [
        { a: 1, b: 2, c: 3 },
        { a: 1, b: 2, c: 4 },
        { a: 1, b: 5, c: 6 },
        { a: 2, b: 7, c: 8 },
        { a: 2, b: 7, c: 9 },
      ],
      RT.Record({
        a: Id(RT.Number),
        c1: RT.Array(
          RT.Record({
            b: Id(RT.Number),
            c2: RT.Array(
              RT.Record({
                c: Id(RT.Number),
              })
            ),
          })
        ),
      })
    )

    expect(result).toEqual([
      {
        a: 1,
        c1: [
          { b: 2, c2: [{ c: 3 }, { c: 4 }] },
          { b: 5, c2: [{ c: 6 }] },
        ],
      },
      {
        a: 2,
        c1: [{ b: 7, c2: [{ c: 8 }, { c: 9 }] }],
      },
    ])
  })

  it('should group nested collections and references', () => {
    const result = map(
      [
        { a: 1, b: 2, c: 3 },
        { a: 1, b: 5, c: 6 },
        { a: 2, b: 7, c: 8 },
        { a: 2, b: 9, c: 10 },
      ],
      RT.Record({
        a: Id(RT.Number),
        c1: RT.Array(
          RT.Record({
            b: Id(RT.Number),
            r1: RT.Record({
              c: Id(RT.Number),
            }),
          })
        ),
      })
    )

    expect(result).toEqual([
      {
        a: 1,
        c1: [
          { b: 2, r1: { c: 3 } },
          { b: 5, r1: { c: 6 } },
        ],
      },
      {
        a: 2,
        c1: [
          { b: 7, r1: { c: 8 } },
          { b: 9, r1: { c: 10 } },
        ],
      },
    ])
  })

  it('should fail on aliased columns without alias information', () => {
    expect(() => {
      map(
        [{ t__a: 1, t__b: 2 }],
        RT.Record({
          a: RT.Number,
          B: RT.Number,
        })
      )
    }).toThrow('not mappable')
  })

  it('should map aliased columns', () => {
    const result = map(
      [{ t__a: 1, t__b: 2 }],
      Aliased(
        't',
        RT.Record({
          a: RT.Number,
          b: RT.Number,
        })
      )
    )

    expect(result).toEqual([{ a: 1, b: 2 }])
  })

  it('should map aliased references', () => {
    const result = map(
      [{ a: 1, t1__b: 2, t2__c: 3 }],
      RT.Record({
        a: Id(RT.Number),
        t1: Aliased(
          't1',
          RT.Record({
            b: RT.Number,
          })
        ),
        t2: Aliased(
          't2',
          RT.Array(
            RT.Record({
              c: Id(RT.Number),
            })
          )
        ),
      })
    )

    expect(result).toEqual([{ a: 1, t1: { b: 2 }, t2: [{ c: 3 }] }])
  })

  it('should map array references with aliased records', () => {
    const result = map(
      [{ a: 1, t1__c: 3 }],
      RT.Record({
        a: Id(RT.Number),
        t1: RT.Array(
          Aliased(
            't1',
            RT.Record({
              c: Id(RT.Number),
            })
          )
        ),
      })
    )

    expect(result).toEqual([{ a: 1, t1: [{ c: 3 }] }])
  })

  it('should flatten unions and intersections', () => {
    // All columns from unions and intersectons are mappable so the
    // types need to be flattened to capture all possible column names.
    // e.g:
    // type mapping = {a: string} & ({b: 'a} | {b: 'b', c: boolean})
    // => {a: string, b: 'a' | 'b', c: boolean}
    const mapping = RT.Intersect(
      RT.Record({
        a: RT.String,
      }),
      RT.Union(
        RT.Record({ b: RT.Literal('a') }),
        RT.Record({
          b: RT.Literal('b'),
          c: RT.Boolean,
        })
      )
    )

    const result = map(
      [
        { a: 'a1', b: 'a', c: null },
        { a: 'a2', b: 'b', c: false },
      ],
      mapping
    )

    expect(result).toEqual([
      { a: 'a1', b: 'a', c: null },
      { a: 'a2', b: 'b', c: false },
    ])
  })

  it('should map literal types', () => {
    expect(map([{ a: 'a' }], RT.Record({ a: RT.Literal('a') }))).toEqual([
      { a: 'a' },
    ])
  })

  describe('makeMap', () => {
    it('should allow case handling', () => {
      const map = makeMap({
        caseTransform: makeTransform(camelCase, snakeCase),
      })
      const result = map(
        [{ some_column: 1 }],
        RT.Record({ someColumn: RT.Number })
      )

      expect(result).toEqual([{ someColumn: 1 }])
    })
  })
})
