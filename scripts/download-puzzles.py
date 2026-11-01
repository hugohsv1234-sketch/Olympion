#!/usr/bin/env python3
"""Stream a bounded source sample; no full database is kept in memory.
pip install zstandard
python3 scripts/download-puzzles.py /path/to/lichess.csv [60000]
The subset is deterministic for the selected database snapshot.
"""
import io
import sys
import urllib.request
import zstandard

destination = sys.argv[1] if len(sys.argv) > 1 else 'lichess-source.csv'
limit = int(sys.argv[2]) if len(sys.argv) > 2 else 60000
url = 'https://database.lichess.org/lichess_db_puzzle.csv.zst'
with urllib.request.urlopen(url, timeout=90) as response:
    with zstandard.ZstdDecompressor().stream_reader(response) as raw:
        with open(destination, 'w', encoding='utf-8', newline='') as output:
            for number, line in enumerate(io.TextIOWrapper(raw, encoding='utf-8')):
                output.write(line)
                if number >= limit:
                    break
print(f'{number} rows written to {destination}')
