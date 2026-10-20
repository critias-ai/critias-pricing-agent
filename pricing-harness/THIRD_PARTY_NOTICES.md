# Third-party notices

## Bundled Pricing Plugin

- Source: [critias-ai/critias-pricing-plugin](https://github.com/critias-ai/critias-pricing-plugin).
- Version: `0.4.12`.
- Source commit: `aa7e818af41e78d3771169636791ed8a7751c850`.
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
