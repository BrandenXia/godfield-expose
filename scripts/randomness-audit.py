"""Offline catalog audit and narrowly scoped timestamp-seed hypothesis tests.

Consumes downloaded public sources and an optional randomness-probe.json.
No network requests. A match is a candidate, never proof of the server algorithm.
"""
import argparse
from bisect import bisect_right
from collections import Counter
import hashlib
import json
import math
from pathlib import Path


# These are hypotheses, not identified God Field implementations.
GENERATORS = {
    'numerical-recipes-32': (1664525, 1013904223, 32, 0, 32),
    'ansi-lcg-31': (1103515245, 12345, 31, 0, 31),
    'ansi-high-15': (1103515245, 12345, 31, 16, 15),
    'msvc-high-15': (214013, 2531011, 32, 16, 15),
    'java-random-next32': (25214903917, 11, 48, 16, 32),
}


def outputs(name, seed):
    multiplier, increment, bits, shift, output_bits = GENERATORS[name]
    mask = (1 << bits)-1
    state = (seed ^ multiplier) & mask if name.startswith('java-') else seed & mask
    while True:
        state = (multiplier*state+increment) & mask
        yield (state >> shift) & ((1 << output_bits)-1)


def weighted_pool(items):
    models, ends, total = [], [], 0
    for model_id, item in enumerate(items, 1):
        weight = item.get('giftRate', 0)
        if type(weight) is not int or weight < 0:
            raise ValueError('Gift weights must be nonnegative integers')
        if weight:
            total += weight
            models.append(model_id)
            ends.append(total)
    if not total:
        raise ValueError('Empty gift pool')
    return models, ends, total


def seed_search(items, observed, start_ms, end_ms, padding_ms=5000, max_skip=32):
    """Fit six gifts, reserve the remaining three as a within-deal holdout.

    Assumes catalog-order intervals, contiguous independent gift draws, one RNG
    output per gift, and a timestamp seed. Hidden/interleaved calls violate it.
    """
    if len(observed) != 9 or any(type(x) is not int or x <= 0 for x in observed):
        raise ValueError('Exactly nine known, ordered gift-event models required')
    if not all(isinstance(x, (int, float)) and math.isfinite(x) for x in (start_ms, end_ms)):
        raise ValueError('Finite request and receipt timestamps required')
    if end_ms < start_ms or end_ms-start_ms > 120000:
        raise ValueError('Invalid or excessively wide timestamp window')
    models, ends, total = weighted_pool(items)
    intervals = {model:(0 if i == 0 else ends[i-1], ends[i]) for i, model in enumerate(models)}
    if any(model not in intervals for model in observed):
        raise ValueError('Observed gift outside the weighted pool')
    lower, upper = intervals[observed[0]]
    ranges = {
        'epoch-milliseconds': (math.floor(start_ms-padding_ms), math.ceil(end_ms+padding_ms)),
        'epoch-seconds': (math.floor((start_ms-padding_ms)/1000), math.ceil((end_ms+padding_ms)/1000)),
    }
    fitted, validated, tested = [], [], 0
    for generator, config in GENERATORS.items():
        scale = 1 << config[4]
        for unit, (first, last) in ranges.items():
            for seed in range(first, last+1):
                stream = outputs(generator, seed)
                values = [next(stream) for _ in range(max_skip+9)]
                for mapping in ('floor-scaled', 'modulo'):
                    tickets = [v*total//scale if mapping == 'floor-scaled' else v % total for v in values]
                    for skip in range(max_skip+1):
                        tested += 1
                        if not lower <= tickets[skip] < upper:
                            continue
                        predicted = [models[bisect_right(ends, t)] for t in tickets[skip:skip+9]]
                        if predicted[:6] != observed[:6]:
                            continue
                        candidate = {'generator':generator, 'seedUnit':unit, 'seed':seed,
                                     'mapping':mapping, 'skip':skip, 'predictedHoldout':predicted[6:]}
                        fitted.append(candidate)
                        if predicted[6:] == observed[6:]:
                            validated.append(candidate)
    return {'seedWindowsInclusive':ranges, 'maximumInitialSkippedOutputs':max_skip,
            'testedHypotheses':tested, 'fitGiftCount':6, 'holdoutGiftCount':3,
            'fittedCandidates':fitted, 'holdoutMatches':validated}


def summarize(items):
    _, _, total = weighted_pool(items)
    categories = Counter()
    for item in items:
        categories[item['category']] += item.get('giftRate', 0)
    probabilities = [i['giftRate']/total for i in items if i.get('giftRate', 0)]
    # Elementary symmetric polynomial: 9! e_9(p) is P(no duplicate in 9 IID draws).
    symmetric = [1.0]+[0.0]*9
    for probability in probabilities:
        for k in range(9, 0, -1):
            symmetric[k] += symmetric[k-1]*probability
    return {'itemModels':len(items), 'positiveGiftModels':len(probabilities), 'totalGiftWeight':total,
            'categoryGiftWeights':dict(sorted(categories.items())),
            'iidIllustrationOnly':{
                'twoGiftsSameModelProbability':sum(p*p for p in probabilities),
                'duplicateWithinNineProbability':1-math.factorial(9)*symmetric[9],
                'entropyBitsPerGift':-sum(p*math.log2(p) for p in probabilities)}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('catalog', type=Path)
    parser.add_argument('--client', type=Path)
    parser.add_argument('--probe', type=Path)
    args = parser.parse_args()
    catalog = args.catalog.read_bytes()
    items = json.loads(catalog)['items']
    report = {'schemaVersion':1, 'catalogSha256':hashlib.sha256(catalog).hexdigest(), **summarize(items)}
    if args.client:
        client = args.client.read_bytes()
        report['clientSha256'] = hashlib.sha256(client).hexdigest()
        report['literalMathRandomLines'] = [n for n, line in enumerate(client.decode().splitlines(), 1) if 'Math.random' in line]
    if args.probe:
        probe = json.loads(args.probe.read_text())
        report['probeSha256'] = hashlib.sha256(args.probe.read_bytes()).hexdigest()
        report['timestampSeedTests'] = []
        for result in probe['results']:
            if args.client and result['clientHash'] != report['clientSha256']:
                raise ValueError('Probe and audited client fingerprints differ')
            request = next(r for r in result['requests'] if r['endpoint'] == '/start-game')
            capture = next(c for c in result['captures'] if sum(e['action'] == 'gift' for e in c['events']) == 9)
            observed = [e['modelId'] for e in capture['events'] if e['action'] == 'gift']
            timestamps = [request['observedAtMs'], capture['receivedAtMs']]
            if capture.get('serverUpdatedAtMs') is not None:
                timestamps.append(capture['serverUpdatedAtMs'])
            report['timestampSeedTests'].append({'trial':result['trial'], 'observedGiftModels':observed,
                **seed_search(items, observed, min(timestamps), max(timestamps))})
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
