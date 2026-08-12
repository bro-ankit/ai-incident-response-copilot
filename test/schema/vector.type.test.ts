import { buildVectorConfig, parseVectorString, toVectorDriverString } from '../../src/schema/vector.type';

describe('Given parseVectorString', () => {
  describe('When called', () => {
    describe('And input is a standard pgvector string', () => {
      test('Then it returns the correct number array', () => {
        expect(parseVectorString('[0.1,0.2,0.3]')).toEqual([0.1, 0.2, 0.3]);
      });
    });

    describe('And input is an empty vector string', () => {
      test('Then it returns an empty array', () => {
        expect(parseVectorString('[]')).toEqual([]);
      });
    });

    describe('And input is a single-element vector', () => {
      test('Then it returns a one-element array', () => {
        expect(parseVectorString('[0.5]')).toEqual([0.5]);
      });
    });

    describe('And input contains negative values', () => {
      test('Then it preserves the sign on each element', () => {
        expect(parseVectorString('[-0.1,-0.9,0.5]')).toEqual([-0.1, -0.9, 0.5]);
      });
    });

    describe('And input contains scientific notation emitted by pgvector for near-zero values', () => {
      test('Then it parses each element without loss of precision', () => {
        const result = parseVectorString('[1.23e-7,4.56e-10]');

        expect(result[0]).toBeCloseTo(1.23e-7);
        expect(result[1]).toBeCloseTo(4.56e-10);
      });
    });

    describe('And input is a full 768-dimension vector', () => {
      test('Then the result array length matches the dimension count', () => {
        const raw = `[${new Array(768).fill('0.1').join(',')}]`;

        expect(parseVectorString(raw)).toHaveLength(768);
      });
    });

    describe('And input contains high-precision floats', () => {
      test('Then precision is maintained to 8 decimal places', () => {
        const result = parseVectorString('[0.123456789,0.987654321]');

        expect(result[0]).toBeCloseTo(0.123456789, 8);
        expect(result[1]).toBeCloseTo(0.987654321, 8);
      });
    });
  });
});

describe('Given toVectorDriverString', () => {
  describe('When called', () => {
    describe('And input is a standard float array', () => {
      test('Then it returns the pgvector bracket-format string', () => {
        expect(toVectorDriverString([0.1, 0.2, 0.3])).toBe('[0.1,0.2,0.3]');
      });
    });

    describe('And input is an empty array', () => {
      test('Then it returns empty brackets', () => {
        expect(toVectorDriverString([])).toBe('[]');
      });
    });

    describe('And input is a single-element array', () => {
      test('Then it wraps the single value in brackets', () => {
        expect(toVectorDriverString([0.5])).toBe('[0.5]');
      });
    });

    describe('And output is passed back through parseVectorString', () => {
      test('Then the round-trip produces the original values', () => {
        const original = [0.1, 0.2, -0.3, 0.999];

        expect(parseVectorString(toVectorDriverString(original))).toEqual(original);
      });
    });
  });
});

describe('Given buildVectorConfig', () => {
  describe('When called with dimensions 768', () => {
    test('Then dataType returns vector(768), toDriver serialises, and fromDriver parses back', () => {
      const config = buildVectorConfig(768);

      expect(config.dataType()).toBe('vector(768)');
      expect(config.toDriver([0.1, 0.2])).toBe('[0.1,0.2]');
      expect(config.fromDriver('[0.1,0.2]')).toEqual([0.1, 0.2]);
    });
  });

  describe('When called with dimensions 1536', () => {
    test('Then dataType returns vector(1536)', () => {
      expect(buildVectorConfig(1536).dataType()).toBe('vector(1536)');
    });
  });

  describe('When two configs are created with different dimensions', () => {
    test('Then each config independently captures its own dimension in the closure', () => {
      const config768 = buildVectorConfig(768);
      const config1536 = buildVectorConfig(1536);

      expect(config768.dataType()).toBe('vector(768)');
      expect(config1536.dataType()).toBe('vector(1536)');
    });
  });
});
