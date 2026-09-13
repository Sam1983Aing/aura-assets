# Third-party software and fonts

Runtime dependencies are locally vendored to keep this iteration reproducible and independent of a CDN.

| Dependency | Version | Source / license |
| --- | --- | --- |
| Three.js | 0.180.0 | [Three.js repository](https://github.com/mrdoob/three.js), MIT; full notice in `vendor/three/LICENSE` |
| GSAP, ScrollTrigger, SplitText | 3.15.0 | [GSAP](https://gsap.com/), [Standard License](https://gsap.com/standard-license/); distributed minified file headers retain their notices |
| Lenis | 1.3.26 | [Lenis repository](https://github.com/darkroomengineering/lenis), MIT; full notice in `vendor/LENIS-LICENSE` |
| Draco decoder | 1.5.7 | [Google Draco](https://github.com/google/draco), Apache-2.0; full notice in `vendor/draco/LICENSE`; decoder distributed with `draco3dgltf` |
| Instrument Sans | Google Fonts distribution | [Project source](https://github.com/Instrument/instrument-sans), SIL OFL; full notice in `assets/fonts/instrument-sans-OFL.txt` |
| IBM Plex Mono | Google Fonts distribution | [IBM Plex](https://github.com/IBM/plex), SIL OFL; full notice in `assets/fonts/ibm-plex-mono-OFL.txt` |

Build-only tooling is pinned in `../scripts/web/package-lock.json`: glTF Transform 4.5.0 (MIT), meshoptimizer 1.2.0 (MIT), Sharp 0.35.4 (Apache-2.0), and Draco 1.5.7 (Apache-2.0). These tools are not shipped as website JavaScript.

Implementation references: [Lenis GSAP integration](https://github.com/darkroomengineering/lenis#gsap-scrolltrigger), [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/) and [ScrollTrigger.refresh](https://gsap.com/docs/v3/Plugins/ScrollTrigger/static.refresh()). glTF Transform behavior was checked against the pinned package source used by the optimizer.

V2 adds Michroma, copyright 2011 the Michroma Project Authors, under SIL Open Font
License 1.1. Font and license are bundled in `assets/fonts/`. Source:
https://github.com/google/fonts/tree/main/ofl/michroma
