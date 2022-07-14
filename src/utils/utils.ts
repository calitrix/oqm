import { Brand, Record, Reflect } from 'runtypes'
import { OfReflect } from '../mapper'

// https://github.com/brianc/node-postgres/blob/master/lib/client.js#L385
const escapeIdentifier = (str: string) => `"${str.replace(/"/g, '""')}"`

type RecordOrAlias = Record<any, any> | Brand<any, Record<any, any>>

export const columns = (...types: RecordOrAlias[]): string => {
  const columns: string[] = []

  for (const type of types) {
    let reflect: OfReflect['record']
    let alias: string | null = null

    if (type.reflect.tag === 'brand') {
      alias = type.reflect.brand
      reflect = type.reflect.entity as OfReflect['record']
    } else {
      reflect = type.reflect as OfReflect['record']
    }

    if (alias == null) {
      for (const fieldName of Object.keys(reflect.fields)) {
        columns.push(escapeIdentifier(fieldName))
      }
    } else {
      for (const fieldName of Object.keys(reflect.fields)) {
        columns.push(
          `${escapeIdentifier(alias)}.${escapeIdentifier(
            fieldName
          )} AS ${escapeIdentifier(`${alias}__${fieldName}`)}`
        )
      }
    }
  }

  return columns.join(', ')
}
