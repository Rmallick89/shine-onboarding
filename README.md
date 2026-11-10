# Shine candidate onboarding: case study

A full-screen, keyboard-navigable slideshow about redesigning candidate onboarding at Shine.com, which cut registration drop-off from 94.8% to 36.6% in 90 days. Phones get a short, swipe-up mobile version.

## View it

- **Online:** turn on GitHub Pages for this repository (Settings → Pages → Deploy from a branch → `main` / root). The case study opens at `https://<your-username>.github.io/<repo-name>/`.
- **Locally:** open `index.html` in any modern browser. Nothing needs to be installed and no internet connection is needed: fonts, styles, scripts, images and videos are all in this folder.

## Desktop and mobile

- Laptops, desktops and tablets see the slides (`index.html`).
- Phones (screens 600px wide or less) are sent to `shine-onboarding-mobile.html`: five full-screen reels you swipe up through. Resizing the window past 600px switches between the two live, with a short loading screen.
- `?view=desktop` keeps the slides on a phone; `?view=mobile` keeps the mobile page on a big screen.
- The mobile page's "Download demo app" button points to `#install-app`: replace it with the demo app's link.

## Controls (slides)

| Key | Action |
|---|---|
| → / Space | next slide or build step |
| ← | previous slide or step |
| R | back to the first slide |
| Esc | close |

On touch screens, swipe left or right.

## What's inside

```
index.html                     the case study (20 slides)
shine-onboarding-mobile.html   the mobile version (5 reels)
assets/
  case-study.css               deck shell: stage, bottom bar, motion
  case-study.js                keyboard, scaling to any screen, build steps
  shine-ds.css                 Shine design-system tokens
  themes/field-report.css      the Field Report theme
  fonts/                       Plus Jakarta Sans and Satoshi (woff2)
  media/                       images and videos used on the slides and the mobile page
.nojekyll                      tells GitHub Pages to serve every file as is
```

## Close button

The close button (and Esc) goes to the page in `?return=` if the link has one, back in history if the visitor came from your site, or otherwise to `data-return-url` on the `<body>` tag in `index.html` (currently `/`). Change it to your portfolio's URL if you link here from another site.
