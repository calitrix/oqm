import { CaseTransform } from './case'

export type Row = Record<string, unknown>

export type MapConfig = {
  caseTransform?: CaseTransform
}
