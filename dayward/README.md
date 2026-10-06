# DAYWARD assets

The models, textures and placeholder portraits of the DAYWARD landing page, for its
standalone HTML file. The layout is the project folder's own: `landing-page-v07/` is the page's
folder and `models/` sits next to it, so the page's relative URLs resolve against one base.

A model over 20 MB (jsDelivr's ceiling per file) is stored as `name.glb.01.bin`, `02`, ... with
`name.glb.manifest.json` (size, SHA-256, parts). The parts are the file's own bytes in order:
`cat name.glb.*.bin > name.glb` gives the original back.

The standalone file reads these through jsDelivr, pinned to a tag. Do not change files in place
once a tag is out: add a new tag.
