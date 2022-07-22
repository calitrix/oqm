import { fieldToColumnName } from '../mapper/mapper'
import {
  getDescribedFields,
  isBrand,
  MaybeBrandedRecord,
} from '../mapper/reflect'
import { CallableQuery, createCallableQuery, CreatePartsFunction } from '../sql'

// https://github.com/brianc/node-postgres/blob/master/lib/client.js#L385
const escapeIdentifier = (str: string) => `"${str.replace(/"/g, '""')}"`

export const columns = (...types: MaybeBrandedRecord[]): CallableQuery<[]> => {
  const getParts: CreatePartsFunction<[]> = (config) => {
    const columns: string[] = []

    for (const type of types) {
      const alias = isBrand(type.reflect) ? type.reflect.brand : null
      const fields = getDescribedFields(type.reflect)

      if (alias == null) {
        for (const fieldName of Object.keys(fields)) {
          columns.push(
            escapeIdentifier(
              fieldToColumnName(fieldName, undefined, config.caseTransform)
            )
          )
        }
      } else {
        for (const fieldName of Object.keys(fields)) {
          const nameInRow = fieldToColumnName(
            fieldName,
            undefined,
            config.caseTransform
          )
          columns.push(
            `${escapeIdentifier(alias)}.${escapeIdentifier(
              nameInRow
            )} AS ${escapeIdentifier(`${alias}__${nameInRow}`)}`
          )
        }
      }
    }

    return { texts: [columns.join(', ')], values: [] }
  }

  return createCallableQuery(getParts, {})
}
