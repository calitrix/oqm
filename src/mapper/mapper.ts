import * as RT from '../runtypes'

import {
  getAlias,
  getDescribedFields,
  getIdFieldName,
  isArrayReference,
  isBrand,
  isMappableType,
  isRecordReference,
  MappableReflect,
  MaybeBrandedArray,
  OnlyReflect,
  RecordFields,
} from './reflect'
import { Row } from './types'

// TODO case-conversion
const fieldToColumnName = (fieldName: string, alias?: string): string =>
  alias ? `${alias}__${fieldName}` : fieldName

const mapRecord = (
  row: Row,
  fields: RecordFields,
  alias?: string
): Record<string, unknown> | null => {
  let allNull = true

  const result = Object.keys(fields).reduce(
    (result: Record<string, unknown>, fieldName) => {
      const nameInRow = fieldToColumnName(fieldName, alias)

      if (nameInRow in row) {
        result[fieldName] = row[nameInRow]
        allNull = allNull && row[nameInRow] === null
      }

      return result
    },
    {}
  )

  if (allNull) {
    // for left-joined columns we need to make sure to not populate an object
    // with all-null properties. Instead, return null.
    return null
  }

  return result
}

const mapRow = <A = unknown>(
  rows: Row[],
  ptr: number,
  mapping: MappableReflect
): [number, RT.Static<RT.Runtype<A>>] => {
  const rootFields = getDescribedFields(mapping)
  const rootAlias = getAlias(mapping)
  const root = mapRecord(rows[ptr], rootFields, rootAlias)

  if (root == null) {
    return [ptr, root as unknown as A]
  }

  // 1:1 references
  Object.entries(rootFields).forEach(([fieldName, fieldReflect]) => {
    if (!isRecordReference(fieldReflect)) {
      return
    }

    let obj = null
    ;[ptr, obj] = mapRow(rows, ptr, fieldReflect as MappableReflect)

    root[fieldName] = obj
  })

  // map m:m
  // TODO strongly typed filter method
  const collectionMappings = Object.entries(rootFields).filter(
    ([_, fieldReflect]) => isArrayReference(fieldReflect)
  ) as [string, MaybeBrandedArray][]

  if (collectionMappings.length) {
    let row = rows[ptr]
    const rootIdColumn = fieldToColumnName(
      getIdFieldName(rootFields),
      rootAlias
    )
    const rootIdValue = row[rootIdColumn]

    if (rootIdValue == null) {
      throw new Error(
        'null value in discriminator column while mapping collection. ' +
          `Row ${ptr}, column ${rootIdColumn}.`
      )
    }

    const knownIdsPerCollection: Record<
      string,
      Record<string | number, boolean>
    > = collectionMappings.reduce((acc, [name]) => ({ ...acc, [name]: {} }), {})
    const itemsPerCollection: Record<string, unknown[]> =
      collectionMappings.reduce((acc, [name]) => ({ ...acc, [name]: [] }), {})

    while (ptr < rows.length && row[rootIdColumn] === rootIdValue) {
      // eslint-disable-next-line no-loop-func
      collectionMappings.forEach(([fieldName, fieldReflect]) => {
        const items = itemsPerCollection[fieldName]
        const knownIds = knownIdsPerCollection[fieldName]
        const collectionFields = getDescribedFields(fieldReflect)
        const idColumn = fieldToColumnName(
          getIdFieldName(collectionFields),
          getAlias(fieldReflect)
        )
        const idValue = row[idColumn]

        if (idValue == null) {
          return
        }

        const idString = String(idValue)

        if (!(idString in knownIds)) {
          knownIds[idString] = true
          let aliasedRecord: MappableReflect

          if (isBrand(fieldReflect)) {
            aliasedRecord = RT.Aliased(
              fieldReflect.brand,
              (fieldReflect.entity as OnlyReflect<'array'>).element
            )
          } else {
            aliasedRecord = fieldReflect.element as MappableReflect
          }

          let obj = null
          // eslint-disable-next-line no-param-reassign
          ;[ptr, obj] = mapRow(rows, ptr, aliasedRecord)
          console
          items.push(obj)
        }
      })

      // eslint-disable-next-line no-param-reassign
      row = rows[++ptr]
    }

    Object.assign(root, itemsPerCollection)
    // Need to step back one row after the abort condition in the while loop
    // above failed.
    // eslint-disable-next-line no-param-reassign
    ptr--
  }

  // return [ptr, mapping.check(root)]
  return [ptr, root as A]
}

export const map = <A = unknown>(
  rows: Row[],
  mapping: RT.Runtype<A>
): RT.Static<RT.Runtype<A>>[] => {
  const reflect = mapping.reflect
  if (!isMappableType(reflect)) {
    throw new Error(
      `Mapping needs to be a [branded] record type, not ${reflect.tag}`
    )
  }

  let ptr = 0
  let curr: RT.Static<RT.Runtype<A>> | null = null
  const result: RT.Static<RT.Runtype<A>>[] = []

  while (ptr < rows.length) {
    ;[ptr, curr] = mapRow<A>(rows, ptr, reflect as MappableReflect)
    if (curr === null) {
      throw new Error('Given record type not mappable from given rows')
    }
    result.push(curr)
    ptr++
  }

  return result
}
