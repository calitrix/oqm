import * as RT from '../runtypes'

type Row = { [key: string]: unknown }

export type OfReflect = {
  [T in RT.Reflect['tag']]: Extract<RT.Reflect, { tag: T }>
}

const fieldToColumnName = (fieldName: string, alias?: string): string =>
  alias ? `${alias}__${fieldName}` : fieldName

const mapRecord = (
  row: Row,
  record: OfReflect['record'],
  alias?: string
): Record<string, unknown> | null => {
  let allNull = true

  const result = Object.entries(record.fields).reduce(
    (result, [fieldName, fieldReflect]) => {
      const nameInRow = fieldToColumnName(fieldName, alias)

      if (nameInRow in row) {
        result[fieldName] = row[nameInRow]
        allNull = allNull && row[nameInRow] === null
      }

      return result
    },
    {} as Record<string, unknown>
  )

  if (allNull) {
    // for left-joined columns we need to make sure to not populate an object
    // with all-null properties. Instead, return null.
    return null
  }

  return result
}

const getIdColumn = (mapping: OfReflect['record']): string => {
  const idField = Object.entries(mapping.fields).find(
    ([_, fieldReflect]) =>
      fieldReflect.tag === 'brand' && fieldReflect.brand === RT.IdBrand
  )

  if (idField) return idField[0]
  return 'id'
}

const isReference = <R extends RT.Reflect>(reflect: R): boolean =>
  reflect.tag === 'record' ||
  (reflect.tag === 'brand' && reflect.entity.tag === 'record')

const isArrayReference = <R extends RT.Reflect>(reflect: R): boolean =>
  (reflect.tag === 'array' && reflect.element.tag === 'record') ||
  (reflect.tag === 'array' &&
    reflect.element.tag === 'brand' &&
    reflect.element.entity.tag === 'record') ||
  (reflect.tag === 'brand' &&
    reflect.entity.tag === 'array' &&
    reflect.entity.element.tag === 'record')

const getRecordReflect = <
  R extends OfReflect['record'] | OfReflect['array'] | OfReflect['brand']
>(
  reflect: R
): OfReflect['record'] => {
  if (reflect.tag === 'record') {
    return reflect
  }
  if (reflect.tag === 'array') {
    if (reflect.element.tag === 'record') {
      return reflect.element as OfReflect['record']
    }
    if (
      reflect.element.tag === 'brand' &&
      reflect.element.entity.tag === 'record'
    ) {
      return reflect.element.entity as OfReflect['record']
    }
  }
  if (reflect.tag === 'brand' && reflect.entity.tag === 'record') {
    return reflect.entity as OfReflect['record']
  }
  if (
    reflect.tag === 'brand' &&
    reflect.entity.tag === 'array' &&
    reflect.entity.element.tag === 'record'
  ) {
    return reflect.entity.element as OfReflect['record']
  }

  throw new Error(`No nested record type at ${reflect.tag} type`)
}

const getAlias = <
  R extends OfReflect['array'] | OfReflect['brand'] | OfReflect['record']
>(
  reflect: R
): string | undefined => {
  if (reflect.tag == 'brand') {
    return reflect.brand
  }

  if (reflect.tag === 'array' && reflect.element.tag === 'brand') {
    return reflect.element.brand
  }

  return undefined
}

type MaybeAliased = OfReflect['brand'] | OfReflect['record']
type MaybeAliasedArray = OfReflect['brand'] | OfReflect['array']

const mapRow = <A = unknown>(
  rows: Row[],
  ptr: number,
  mapping: MaybeAliased
): [number, RT.Static<RT.Runtype<A>>] => {
  const rootReflect = getRecordReflect(mapping)
  const rootAlias = getAlias(mapping)
  const root = mapRecord(rows[ptr], rootReflect, rootAlias)

  if (root == null) {
    return [ptr, root as unknown as A]
  }

  // 1:1 references
  Object.entries(rootReflect.fields).forEach(([fieldName, fieldReflect]) => {
    if (!isReference(fieldReflect)) {
      return
    }

    let obj = null
    ;[ptr, obj] = mapRow(rows, ptr, fieldReflect as MaybeAliased)

    root[fieldName] = obj
  })

  // map m:m
  // TODO strongly typed filter method
  const collectionMappings = Object.entries(rootReflect.fields).filter(
    ([_, fieldReflect]) => isArrayReference(fieldReflect)
  ) as [string, MaybeAliasedArray][]

  if (collectionMappings.length) {
    let row = rows[ptr]
    const rootIdColumn = fieldToColumnName(getIdColumn(rootReflect), rootAlias)
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
        const element = getRecordReflect(fieldReflect)
        const idColumn = fieldToColumnName(
          getIdColumn(element),
          getAlias(fieldReflect)
        )
        const idValue = row[idColumn]

        if (idValue == null) {
          return
        }

        const idString = String(idValue)

        if (!(idString in knownIds)) {
          knownIds[idString] = true
          let aliasedRecord: MaybeAliased

          if (fieldReflect.tag === 'brand') {
            aliasedRecord = RT.Aliased(
              fieldReflect.brand,
              (fieldReflect.entity as OfReflect['array']).element
            )
          } else {
            aliasedRecord = fieldReflect.element as MaybeAliased
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
  if (!['brand', 'record'.includes(reflect.tag)]) {
    throw new Error(`Mapping needs to be a record type, not ${reflect.tag}`)
  }

  let ptr = 0
  let curr: RT.Static<RT.Runtype<A>> | null = null
  const result: RT.Static<RT.Runtype<A>>[] = []

  while (ptr < rows.length) {
    ;[ptr, curr] = mapRow(rows, ptr, mapping.reflect as MaybeAliased)
    if (curr === null) {
      throw new Error('Given record type not mappable from given rows')
    }
    result.push(curr)
    ptr++
  }

  return result
}
