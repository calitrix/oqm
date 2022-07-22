import { MapConfig } from '../mapper/types'

export type ReturnOrType<T> = T extends (...args: any[]) => infer ReturnType
  ? ReturnType
  : T

export type FunctionalReturns<Values extends unknown[]> = {
  [Key in keyof Values]: ReturnOrType<Values[Key]>
}

export type QueryObject<Values extends unknown[]> = {
  text: string
  values: FunctionalReturns<Values>
}

export type QueryParts<Values extends unknown[]> = {
  texts: string[]
  values: Values
}

export type ArgOrType<T> = T extends (arg: infer ArgType) => unknown
  ? ArgType
  : T

export type FunctionalArgs<Values extends unknown[]> = {
  [Key in keyof Values]: ArgOrType<Values[Key]>
}

export type CallableQuery<Values extends unknown[]> = {
  (...values: Partial<FunctionalArgs<Values>>): CallableQuery<Values>

  inputs?: Partial<FunctionalArgs<Values>>
  getParts: (config: SqlConfig) => QueryParts<Values>
  toQuery: () => QueryObject<Values>
}

export type SqlTemplate = <Values extends unknown[]>(
  strings: TemplateStringsArray,
  ...values: Values
) => CallableQuery<Values>

export type SqlConfig = MapConfig & {
  createParts?: <Values extends unknown[]>() => QueryParts<Values>
}

export type CreatePartsFunction<Values extends unknown[]> = (
  config: SqlConfig
) => QueryParts<Values>
