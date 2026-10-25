"""Offline checks: recover a known synthetic seed, then reject wrong holdout."""
import importlib.util
from bisect import bisect_right
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('audit', Path(__file__).resolve().parents[1]/'scripts/randomness-audit.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class SeedSearchTest(unittest.TestCase):
    def test_known_generator_vectors(self):
        for generator, seed, first in [
            ('numerical-recipes-32', 1, 1015568748),
            ('ansi-lcg-31', 1, 1103527590),
            ('ansi-high-15', 1, 16838),
            ('msvc-high-15', 1, 41),
            ('java-random-next32', 0, 3139482720),
        ]:
            self.assertEqual(next(audit.outputs(generator, seed)), first)

    def test_known_seeds_and_unseen_suffix(self):
        # Unequal weights exercise the mapping boundaries, not a uniform toy pool.
        items = [{'giftRate':1+i%4} for i in range(80)]
        models, ends, total = audit.weighted_pool(items)
        seed, skip = 1792900000123, 7
        for generator, config in audit.GENERATORS.items():
            stream = audit.outputs(generator, seed)
            for _ in range(skip):
                next(stream)
            observed = [models[bisect_right(ends, next(stream)*total//(1 << config[4]))] for _ in range(9)]
            result = audit.seed_search(items, observed, seed, seed, padding_ms=0, max_skip=8)
            self.assertTrue(any(c['generator'] == generator and c['seed'] == seed and c['skip'] == skip
                                for c in result['holdoutMatches']))
            changed = observed[:-1]+[observed[-1]%len(items)+1]
            rejected = audit.seed_search(items, changed, seed, seed, padding_ms=0, max_skip=8)
            self.assertTrue(rejected['fittedCandidates'])
            self.assertFalse(rejected['holdoutMatches'])

    def test_unknown_or_incomplete_gifts_rejected(self):
        for observed in ([1]*8, [1]*8+[0], [1]*8+[2]):
            with self.assertRaises(ValueError):
                audit.seed_search([{'giftRate':1}], observed, 1, 1)

    def test_modulo_mapping(self):
        items = [{'giftRate':1+i%3} for i in range(100)]
        models, ends, total = audit.weighted_pool(items)
        seed = 1792900000123
        stream = audit.outputs('numerical-recipes-32', seed)
        observed = [models[bisect_right(ends, next(stream) % total)] for _ in range(9)]
        result = audit.seed_search(items, observed, seed, seed, padding_ms=0, max_skip=0)
        self.assertTrue(any(c['mapping'] == 'modulo' and c['seed'] == seed for c in result['holdoutMatches']))


if __name__ == '__main__':
    unittest.main()
