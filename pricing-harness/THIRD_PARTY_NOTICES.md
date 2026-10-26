# Third-party notices

## Bundled Pricing Plugin

- Source: [critias-ai/critias-pricing-plugin](https://github.com/critias-ai/critias-pricing-plugin).
- Version: `0.4.13`.
- Source commit: `684b2bb76880f8c09056d87ea32c26b2482b2a03`.
- Copyright: 2026 Danial Kodvavi.
- License: MIT, reproduced without changes in [bundled/pricing-plugin/LICENSE](bundled/pricing-plugin/LICENSE).

The bundled tree includes the seven pricing skills and their shared knowledge and reference files. Preserve the original license and complete reference layout when redistributing or replacing that tree. Version provenance is recorded in [bundled/versions.json](bundled/versions.json).

## Pi

The application is built on [Pi](https://pi.dev), the open-source agent harness from [earendil-works/pi](https://github.com/earendil-works/pi). It uses `@earendil-works/pi-coding-agent` exactly `1.0.4` and the Pi packages it depends on (`pi-ai`, `pi-agent-core`, `pi-tui` and others in the `@earendil-works` scope). They are installed during setup under the MIT license reproduced below. The npm packages do not include the license file, so it is reproduced here from the upstream repository.

```text
MIT License

Copyright (c) 2025 Mario Zechner

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Installed dependencies

JavaScript and Python dependencies retain their respective licenses. Their code is installed during setup rather than vendored into this repository. Exact JavaScript versions and license metadata are recorded in `package-lock.json` and `npm-shrinkwrap.json`; Python versions are pinned in `requirements.txt` and `requirements-dev.txt`. Consult each installed dependency's license notices when distributing its code.

The application's Apache-2.0 license does not replace these dependency licenses.

## Browser Plotly

The locally bundled chart renderer uses `plotly.js-basic-dist-min` exactly `4.1.2`, under the MIT license reproduced below. The chart is loaded from a local Vite chunk. [Plotly source](https://github.com/plotly/plotly.js/tree/v4.1.2).

```text
MIT License

Copyright (c) 2016-2024 Plotly Technologies Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## Evaluation data

Twenty-four eval cases (`uci-*`, `aw-*`, `olist-*`, `ec-3`, `ec-19`, `out-2` and `po-5`) run on three public datasets. `tests/evals/real/fetch.py` downloads them from pinned URLs into the gitignored `datasets/` folder; no source file is committed. The cases, contexts, solution scripts and answer keys in `tests/evals/` are derived from these datasets and may contain values from them, such as customer, seller and product identifiers and names. They are distributed under the terms below. We changed each dataset as the [evals README](tests/evals/README.md#third-party-data-and-licences) describes. Unit costs, competitor prices, policies, planted customers and planted data faults are ours, not the sources'. The creators and publishers of these datasets do not endorse Critias.

### Online Retail II

- Creator: Daqing Chen.
- Source: [UCI Machine Learning Repository](https://archive.ics.uci.edu/dataset/502/online+retail+ii).
- Citation: Chen, D. (2012). Online Retail II [Dataset]. UCI Machine Learning Repository. https://doi.org/10.24432/C5CG6D.
- License: [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/).
- Changes: each sheet saved as CSV; a seeded synthetic cost file, a synthetic competitor price list, planted customers and planted data faults added. The sales rows are unchanged in the clean copies.

### AdventureWorks OLTP

- Source: [microsoft/sql-server-samples](https://github.com/microsoft/sql-server-samples/tree/e5d7bb90ca0b695ac14f61458047bfb5a498459e/samples/databases/adventure-works), commit `e5d7bb90ca0b695ac14f61458047bfb5a498459e`.
- License: MIT, reproduced below from the repository's `license.txt`.
- Changes: install files given column headers and saved as CSV, values unchanged; a pricing policy and planted data faults added.

```text
Microsoft SQL Server Sample Code

Copyright (c) Microsoft Corporation

All rights reserved.

MIT License.

Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
```

### Olist e-commerce

- Source: [olist/work-at-olist-data](https://github.com/olist/work-at-olist-data/tree/d9e49802f3e92d09ee94ab9ccc5e457f207a8959), commit `d9e49802f3e92d09ee94ab9ccc5e457f207a8959`. The Kaggle copy of this data carries a different licence and is not used.
- License: MIT, reproduced below from the repository's `LICENSE`.
- Changes: used as shipped, with planted data faults added.

```text
MIT License

Copyright (c) 2019 @olist

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
