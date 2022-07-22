import { Record, String } from '.'

describe('runtypes', () => {
  describe('Record', () => {
    it('should support the alias modifier', () => {
      expect(Record({ a: String }).withBrand('f').brand).toEqual('f')
    })
  })
})
