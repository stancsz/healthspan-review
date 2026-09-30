# Vendored PDF.js

`pdf.min.mjs` and `pdf.worker.min.mjs` are from `pdfjs-dist@6.3.289`, pinned and
served with the app so PDF content is not sent to a third-party script CDN.
License: `LICENSE` (Apache-2.0).

Source: [pinned npm release](https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.3.289.tgz),
using `package/build/pdf.min.mjs`, `package/build/pdf.worker.min.mjs`, and
`package/LICENSE`. The vendored bytes were compared with that release on
2026-09-30. SHA-256:

```text
f80490490320511e5df18c580b9edd6b5db8058dceebaf6f161992e0a964b9e2  pdf.min.mjs
8ab0e5e30031b4a06ecfddd5ae9562f0227f830ee7ec9ed1a968b134243d2386  pdf.worker.min.mjs
0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594  LICENSE
```
