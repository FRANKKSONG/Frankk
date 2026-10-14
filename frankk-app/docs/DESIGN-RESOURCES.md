# Esther — design resources

Where the Manuscript and Parchment looks come from, and free sources for later artwork.

## Colours: medieval manuscript pigments
The area, tag and status colours are approximations of real illumination pigments:
lapis lazuli / ultramarine (Music), vermilion and red lead (General, danger), verdigris (House),
orpiment and ochre (Seround), gold leaf (accent), madder, tyrian purple, azurite, malachite, umber.
- Pigments used by medieval illuminators (lapis, azurite, vermilion, red lead, verdigris, orpiment, ochre):
  [Austria-Forum digital book](https://austria-forum.org/web-books/en/bildundbuchkultur00de2020isds/000245),
  [HMML lexicon](https://hmmlschool.org/lexicon/14968/),
  [Getty Iris blog on verdigris](https://blogs.getty.edu/iris/?p=33771)
- Pigment analysis of the Alfonso X manuscripts: [Heritage, 2024](https://doaj.org/article/e1b02115ea2f43f99b4e267624f1ed49)
- Ultramarine and azurite in a 14th-century gradual: [MDPI Minerals 2021](https://www2.mdpi.com/2075-163X/11/7/771)
- Background: [Faena Aleph: colour in medieval manuscripts](https://www.faena.com/aleph/color-in-medieval-manuscripts-realized-through-alchemy)

The hex values are visual approximations chosen for contrast on screen, not colorimetric measurements.

## Typefaces (Google Fonts, free)
- **Grenze Gotisch**: a readable Gothic textura for headings and rubrics
- **UnifrakturMaguntia**: blackletter for the illuminated initials and the Esther name
- **Alegreya** and **Alegreya SC**: calligraphy-rooted book serif and its small caps, for body text, labels and dates
- Pairing notes: [EB Garamond pairings](https://fontalternatives.com/pairings/eb-garamond/), [UnifrakturMaguntia pairings](https://fontalternatives.com/pairings/unifraktur-maguntia/)

## Ornament and imagery (public domain, check each licence)
- [The Met Open Access](https://metmuseum.org/art/collection/search/351502): public-domain images, free to reuse
- NYPL Digital Collections: medieval borders under CC0
- [Illuminated ornaments, 6th–17th c. (Wikimedia Commons scan)](https://c.enwp.org/wiki/File:Illuminated_ornaments_-_selected_from_manuscripts_and_early_printed_books,_from_the_sixth_to_the_seventeenth_centuries_(IA_illuminatedornam00shaw).pdf)
- [Racinet ornament plates (From Old Books)](https://www.fromoldbooks.org/Racinet-Ornament), out of copyright, credit requested, no bulk redistribution
- [USF ClipArt: 14th-century border](https://etc.usf.edu/clipart/77000/77079/77079_14c-msborder.htm)
- [RIBApix: medieval border plates](https://www.architecture.com/image-library/ribapix/image-information/poster/medieval-ornament-no-2-examples-of-decorative-borders-from-illuminated-manuscripts-from-the-9th-to-t/posterid/RIBA93659.html)

## What is in the app now
- **Drollery**: the lion playing a vielle (a medieval marginal drawing supplied by FRANKK) sits in the sidebar and Quick capture.
- **Drawn in code** (`src/lib/ornaments.ts`, `src/components/Ornaments.tsx`): the vine border with ivy leaves and gold dots
  (after Gothic marginal borders), a lapis/vermilion diaper band, illuminated initials (gold letter, lapis field, vermilion frame,
  white penwork), a pointed-arch emblem with stars, vellum mottling and print grain.
- **Rubrication**: pilcrows (¶), red first letters, double ink rules, Roman numerals on the release steps.

Downloading more artwork from Wikimedia Commons, the Met and other museum APIs was blocked by this cloud environment's
network policy. Once those hosts are allowed (or on your PC), public-domain miniatures can be added the same way.
