export type AsArray<T> = T extends any[] ? T : [T]

export type QueryParameter = any
export type SqlStringParameter = any

export type QueryObject = {
  text: string
  values: any[]
}

export type FunctionalQuery<V extends SqlStringParameter[] = any[]> = {
  (...params: Partial<V>): FunctionalQuery<V>

  toQuery(): QueryObject
}

type TemplateExpressions<V extends SqlStringParameter[]> = V extends []
  ? []
  : {
      [K in keyof V]: V[K] | ((v: V[K]) => any)
    }

class ExtensibleFunction<T extends Function> extends Function {
  constructor(f: T) {
    return Object.setPrototypeOf(f, new.target.prototype)
    super()
  }
}

const queryReducer =
  (values: TemplateExpressions<any>) =>
  (acc: QueryObject, currString: string, i: number) => {
    if (i === 0) {
      acc.text += currString
      return acc
    }

    const prevValue = values[i - 1]

    if (prevValue instanceof CallableQuery) {
      acc = prevValue.strings.reduce(queryReducer(prevValue.values), acc)
    } else {
      acc.text += `$${acc.values.push(prevValue)}`
    }

    acc.text += currString

    return acc
  }

export class CallableQuery<
  V extends SqlStringParameter[]
> extends ExtensibleFunction<FunctionalQuery> {
  constructor(public strings: string[], public values: TemplateExpressions<V>) {
    // @ts-ignore
    super((...overrides: TemplateExpressions<V>) => {
      this.values = this.values.map((original, i) =>
        overrides[i] === undefined ? original : overrides[i]
      ) as TemplateExpressions<V>

      return this
    })
  }

  toQuery(): QueryObject {
    const queryObject: QueryObject = {
      text: '',
      values: [],
    }

    return this.strings.reduce(queryReducer(this.values), queryObject)
  }
}

export const sql = <V extends SqlStringParameter[]>(
  strings: TemplateStringsArray,
  ...values: TemplateExpressions<V>
): FunctionalQuery<V> => {
  const queryFn = new CallableQuery<V>(
    [...strings],
    values
  ) as unknown as FunctionalQuery<V> // TODO remove unknown

  return queryFn
}
