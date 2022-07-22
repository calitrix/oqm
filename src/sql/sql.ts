import { MapConfig } from '../mapper/types'
import {
  CallableQuery,
  CreatePartsFunction,
  FunctionalArgs,
  QueryObject,
  SqlConfig,
  SqlTemplate,
} from './types'

const isCallableSqlTemplate = <Values extends unknown[]>(
  subject: unknown
): subject is CallableQuery<Values> => {
  return (
    typeof subject === 'function' &&
    typeof (subject as CallableQuery<Values>).toQuery === 'function'
  )
}

const queryReducer =
  <Values extends unknown[]>(
    values: Values,
    config: MapConfig,
    overrides?: Partial<FunctionalArgs<Values>>
  ) =>
  (acc: QueryObject<Values>, currString: string, i: number) => {
    if (i === 0) {
      acc.text += currString
      return acc
    }

    const override = overrides?.[i - 1]
    let prevValue = values[i - 1]

    // Resolve the actual value to use. Take an override value if given.
    // Transform using the given function, if given.
    if (override !== undefined) {
      if (
        typeof prevValue === 'function' &&
        !isCallableSqlTemplate(prevValue)
      ) {
        prevValue = prevValue(override)
      } else {
        prevValue = override
      }
    }

    if (isCallableSqlTemplate<Values>(prevValue)) {
      const parts = prevValue.getParts(config)
      acc = parts.texts.reduce(
        queryReducer(parts.values, config, prevValue.inputs),
        acc
      )
    } else {
      acc.text += `$${acc.values.push(prevValue)}`
    }

    acc.text += currString

    return acc
  }

export function createCallableQuery<Values extends unknown[]>(
  getParts: CreatePartsFunction<Values>,
  config: SqlConfig,
  inputs?: Partial<FunctionalArgs<Values>>
): CallableQuery<Values> {
  const queryFunction: CallableQuery<Values> = function CallableQuery(
    ...inputs
  ) {
    return createCallableQuery(getParts, config, inputs)
  }

  const toQuery: CallableQuery<Values>['toQuery'] = () => {
    const parts = getParts(config)
    const queryObject: QueryObject<Values> = {
      text: '',
      values: [] as unknown as QueryObject<Values>['values'],
    }

    return parts.texts.reduce(
      queryReducer(parts.values, config, inputs),
      queryObject
    )
  }

  queryFunction.inputs = inputs
  queryFunction.getParts = getParts
  queryFunction.toQuery = toQuery

  return queryFunction
}

export const makeSql =
  (config: SqlConfig = {}): SqlTemplate =>
  (strings, ...values) =>
    createCallableQuery(() => ({ texts: [...strings], values }), config)

export const sql = makeSql()
