import * as RT from '../runtypes'

export type Tags = RT.Reflect['tag']
export type AnyReflect = Partial<RT.Reflect>
export type OnlyReflect<Tag extends Tags> = Extract<RT.Reflect, { tag: Tag }>
export type RecordFields = Record<string, RT.Reflect>
export type MappableReflect = OnlyReflect<'brand' | 'record' | 'intersect'>
export type MaybeBrandedArray =
  | OnlyReflect<'array'>
  | (OnlyReflect<'brand'> & { entity: OnlyReflect<'array'> })
export type MaybeBrandedRecord =
  | OnlyReflect<'record'>
  | (OnlyReflect<'brand'> & { entity: OnlyReflect<'record'> })

export const isMappableType = (
  mappingType: AnyReflect
): mappingType is MappableReflect =>
  ['brand', 'record', 'intersect'].includes(mappingType.tag ?? 'unknown')

export const isOnlyReflect = <Tag extends Tags>(
  reflect: AnyReflect,
  tag: Tag
): reflect is OnlyReflect<Tag> => reflect.tag === tag

export const isArray = (
  reflect: AnyReflect
): reflect is OnlyReflect<'array'> => {
  return isOnlyReflect(reflect, 'array')
}

export const isRecord = (
  reflect: AnyReflect
): reflect is OnlyReflect<'record'> => {
  return isOnlyReflect(reflect, 'record')
}

export const isIntersection = (
  reflect: AnyReflect
): reflect is OnlyReflect<'intersect'> => {
  return isOnlyReflect(reflect, 'intersect')
}

export const isBrand = (
  reflect: AnyReflect
): reflect is OnlyReflect<'brand'> => {
  return isOnlyReflect(reflect, 'brand')
}

export const isRecordReference = (
  reflect: AnyReflect
): reflect is MaybeBrandedRecord =>
  isRecord(reflect) || (isBrand(reflect) && isRecord(reflect.entity))

export const isArrayReference = (
  reflect: AnyReflect
): reflect is MaybeBrandedArray =>
  (isArray(reflect) && isRecord(reflect.element)) ||
  (isArray(reflect) &&
    isBrand(reflect.element) &&
    isRecord(reflect.element.entity)) ||
  (isBrand(reflect) &&
    isArray(reflect.entity) &&
    isRecord(reflect.entity.element))

export const getDescribedFields = (reflect: AnyReflect): RecordFields => {
  if (isRecord(reflect)) {
    return reflect.fields
  }

  if (isBrand(reflect)) {
    return getDescribedFields(reflect.entity)
  }

  if (isArray(reflect)) {
    return getDescribedFields(reflect.element)
  }

  if (isIntersection(reflect)) {
    return reflect.intersectees.reduce(
      (acc: RecordFields, curr: AnyReflect) =>
        Object.assign(acc, getDescribedFields(curr)),
      {}
    )
  }

  throw new Error(`Cant determine record fields at ${reflect.tag} type`)
}

export const getAlias = (reflect: AnyReflect): string | undefined => {
  if (isBrand(reflect)) {
    return reflect.brand
  }

  if (isArray(reflect) && isBrand(reflect.element)) {
    return reflect.element.brand
  }

  return undefined
}

export const getIdFieldName = (fields: RecordFields): string => {
  const idField = Object.entries(fields).find(
    ([_, fieldReflect]) =>
      isBrand(fieldReflect) && fieldReflect.brand === RT.IdBrand
  )

  if (idField) return idField[0]
  return 'id'
}
