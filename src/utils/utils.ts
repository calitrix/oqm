import {
  getDescribedFields,
  isBrand,
  MaybeBrandedRecord,
} from '../mapper/reflect'
import { CallableQuery, FunctionalQuery, sql } from '../sql'

// https://github.com/brianc/node-postgres/blob/master/lib/client.js#L385
const escapeIdentifier = (str: string) => `"${str.replace(/"/g, '""')}"`

export const columns = (...types: MaybeBrandedRecord[]): CallableQuery<[]> => {
  const columns: string[] = []

  for (const type of types) {
    const alias = isBrand(type.reflect) ? type.reflect.brand : null
    const fields = getDescribedFields(type.reflect)

    if (alias == null) {
      for (const fieldName of Object.keys(fields)) {
        columns.push(escapeIdentifier(fieldName))
      }
    } else {
      for (const fieldName of Object.keys(fields)) {
        columns.push(
          `${escapeIdentifier(alias)}.${escapeIdentifier(
            fieldName
          )} AS ${escapeIdentifier(`${alias}__${fieldName}`)}`
        )
      }
    }
  }

  return new CallableQuery([columns.join(', ')], [])
}
