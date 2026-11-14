# 3D model credits

The study room uses these models. They were optimised for Meta Quest (WebP textures, quantised
geometry) with gltf-transform; shapes and textures are otherwise the authors' work.

| File | Model | Author | Licence | Source |
| --- | --- | --- | --- | --- |
| `loading.glb` | Loading | tamminen | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | https://sketchfab.com/3d-models/loading-22593732efaa4bc194cb0d9d059bf439 |
| `school-chair.glb` | School Chair 01 | Ethan Place (Poly Haven) | [CC0](https://creativecommons.org/publicdomain/zero/1.0/) | https://polyhaven.com/a/SchoolChair_01 |
| `speaker-*.glb` (10 people) | The Listening cast (see `src/speakers.ts`) | LafaekTOEFL, made with Meshy AI (image to 3D) from our own design pictures | Project asset | – |
| `interviewer-lafaek.glb` | Lafaek, the crocodile interviewer | LafaekTOEFL, made with Meshy AI (image to 3D) from our own mascot | Project asset | – |
| `lecture-podium.glb` | Lecture podium | LafaekTOEFL, made with Meshy AI (text to 3D) | Project asset | – |

Changes: textures resized and converted to WebP, geometry quantised. The first two speakers
were simplified from about 530,000 to about 20,000 triangles each (32 MB → 0.6 MB); the other
eight were generated at about 15,000 triangles (Meshy smart topology), 0.4–0.5 MB each.
